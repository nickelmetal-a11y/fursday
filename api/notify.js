// POST /api/notify { notification_id }: takes a notification row the caller
// just created and delivers it outside the app, as an email (Resend) and a
// phone push (Firebase Cloud Messaging HTTP v1). Server-made notifications
// (api/payments) call deliver() directly.
//
// Not an open relay: the row must be under 5 minutes old, and the caller must
// be the recipient, an admin, or the recipient's counterpart on a booking, a
// conversation or a nearby request. Delivery failures never reach the caller;
// emailed_at / pushed_at are claimed before sending, so each goes out once.
const crypto = require('crypto');
const L = require('./payments/_lib');

const FROM = 'Fursday <noreply@fursday.in>';
const APP_URL = 'https://fursday.vercel.app';
const FRESH_MS = 5 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const EMAILS_PER_HOUR = 12;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only these are worth an email; every type can still be a push.
const EMAIL_TYPES = new Set([
  'booking_request', 'booking_confirmed', 'booking_accepted', 'booking_declined', 'booking_cancelled', 'booking_reassigned',
  'booking_paid', 'payment_released', 'payment_refunded',
  'broadcast_request', 'broadcast_offer', 'broadcast_chosen',
  'stay_checked_in', 'stay_checked_out', 'stay_update',
  'message_received', 'conversation_message',
  'payout_ready', 'payout_marked', 'tip_received',
  'sitter_approved', 'sitter_needs_changes',
]);
// At most one email per conversation per hour; the push still goes out.
const MESSAGE_TYPES = new Set(['message_received', 'conversation_message']);

const isoAgo = (ms) => new Date(Date.now() - ms).toISOString();
// notifications.sent_at is "timestamp without time zone" (UTC).
const parseTime = (v) => (v ? new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : v + 'Z').getTime() : NaN);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const q = encodeURIComponent;

function emailHtml(n, name) {
  return '<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;color:#15192a">'
    + '<div style="background:#1f2a5c;padding:22px 24px;border-radius:0 0 16px 16px"><div style="font-size:21px;font-weight:800;color:#ffffff">fursday</div></div>'
    + '<div style="padding:26px 24px">'
    + '<p style="font-size:14px;color:#5b6275;margin:0 0 6px">Hi ' + esc(name || 'there') + ',</p>'
    + '<h1 style="font-size:19px;line-height:1.35;margin:0 0 10px">' + esc(n.title) + '</h1>'
    + (n.body ? '<p style="font-size:15px;line-height:1.6;color:#2b3145;margin:0 0 22px">' + esc(n.body) + '</p>' : '')
    + '<a href="' + APP_URL + '" style="display:inline-block;background:#1f2a5c;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:12px">Open Fursday</a>'
    + '</div>'
    + '<div style="padding:16px 24px;border-top:1px solid #eceef3;font-size:12px;color:#8a90a2;line-height:1.5">You get this email because of your Fursday account. Turn emails off any time in the app: Account, then Email notifications.</div>'
    + '</div>';
}

async function claim(n, column) {
  const rows = await L.rest('notifications?id=eq.' + q(n.id) + '&' + column + '=is.null', 'PATCH', { [column]: new Date().toISOString() });
  return Array.isArray(rows) && rows.length > 0;
}
const unclaim = (n, column) => L.rest('notifications?id=eq.' + q(n.id), 'PATCH', { [column]: null }, 'return=minimal').catch(() => {});

async function sendEmail(n) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'off';
  if (n.emailed_at) return 'already';
  if (!EMAIL_TYPES.has(n.type)) return 'not_important';
  const prefs = (await L.rest('notification_preferences?select=*&user_id=eq.' + q(n.user_id)))?.[0];
  if (prefs && prefs.email_enabled === false) return 'disabled';
  const user = (await L.rest('users?select=email,name&id=eq.' + q(n.user_id)))?.[0];
  // @example.com test accounts would only bounce and hurt the sending domain.
  if (!user?.email || L.TEST_EMAIL.test(user.email)) return 'no_address';
  const since = isoAgo(HOUR_MS);
  if (MESSAGE_TYPES.has(n.type)) {
    const thread = n.booking_id ? '&booking_id=eq.' + q(n.booking_id) : n.action_url ? '&action_url=eq.' + q(n.action_url) : '';
    const recent = await L.rest('notifications?select=id&user_id=eq.' + q(n.user_id) + '&type=eq.' + q(n.type) + thread + '&emailed_at=gte.' + q(since) + '&limit=1');
    if (recent?.length) return 'throttled';
  }
  const lastHour = await L.rest('notifications?select=id&user_id=eq.' + q(n.user_id) + '&emailed_at=gte.' + q(since) + '&limit=' + EMAILS_PER_HOUR);
  if ((lastHour || []).length >= EMAILS_PER_HOUR) return 'throttled';
  if (!(await claim(n, 'emailed_at'))) return 'already';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, reply_to: 'support@fursday.in', to: user.email, subject: String(n.title || 'Fursday').slice(0, 150), html: emailHtml(n, user.name), text: [n.title, n.body, APP_URL].filter(Boolean).join('\n\n') }),
    });
    if (!r.ok) throw new Error('Resend ' + r.status);
    return 'sent';
  } catch (e) {
    console.error('notify email failed:', e.message);
    await unclaim(n, 'emailed_at');
    return 'failed';
  }
}

let googleToken = null;
function serviceAccount() {
  try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '');
    return sa.client_email && sa.private_key && sa.project_id ? sa : null;
  } catch { return null; }
}
async function accessToken(sa) {
  if (googleToken && googleToken.email === sa.client_email && googleToken.exp > Date.now() + 60e3) return googleToken.token;
  const now = Math.floor(Date.now() / 1000);
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = part({ alg: 'RS256', typ: 'JWT' }) + '.' + part({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  });
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key.replace(/\\n/g, '\n'), 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + signature }).toString(),
  });
  const data = await r.json();
  if (!r.ok || !data.access_token) throw new Error('Google token ' + r.status);
  googleToken = { token: data.access_token, email: sa.client_email, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return googleToken.token;
}

async function sendPush(n) {
  const sa = serviceAccount();
  if (!sa) return 'off';
  if (n.pushed_at) return 'already';
  const prefs = (await L.rest('notification_preferences?select=*&user_id=eq.' + q(n.user_id)))?.[0];
  if (!prefs?.push_token) return 'no_device';
  if (prefs.push_enabled === false) return 'disabled';
  if (!(await claim(n, 'pushed_at'))) return 'already';
  try {
    const data = { type: String(n.type || ''), notification_id: String(n.id) };
    if (n.booking_id) data.booking_id = String(n.booking_id);
    if (n.action_url) data.action_url = String(n.action_url);
    const r = await fetch('https://fcm.googleapis.com/v1/projects/' + q(sa.project_id) + '/messages:send', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + await accessToken(sa), 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: {
        token: prefs.push_token,
        notification: { title: String(n.title || 'Fursday'), body: String(n.body || '') },
        data,
        android: { priority: 'HIGH' },
        apns: { payload: { aps: { sound: 'default' } } },
      } }),
    });
    if (r.ok) return 'sent';
    const reply = await r.json().catch(() => null);
    const gone = r.status === 404 || JSON.stringify(reply || '').includes('UNREGISTERED');
    // The app was uninstalled or the token rotated: stop sending to it.
    if (gone) await L.rest('notification_preferences?user_id=eq.' + q(n.user_id) + '&push_token=eq.' + q(prefs.push_token), 'PATCH', { push_token: null }, 'return=minimal').catch(() => {});
    else await unclaim(n, 'pushed_at');
    return gone ? 'device_gone' : 'failed';
  } catch (e) {
    console.error('notify push failed:', e.message);
    await unclaim(n, 'pushed_at');
    return 'failed';
  }
}

async function deliver(n) {
  if (!process.env.RESEND_API_KEY && !serviceAccount()) return { email: 'off', push: 'off' };
  // Before migration 038 there is nowhere to record a send, so nothing is sent twice by accident.
  if (!n || !('emailed_at' in n) || !('pushed_at' in n)) return { email: 'needs_migration', push: 'needs_migration' };
  const out = {};
  try { out.email = await sendEmail(n); } catch (e) { console.error('notify email failed:', e.message); out.email = 'failed'; }
  try { out.push = await sendPush(n); } catch (e) { console.error('notify push failed:', e.message); out.push = 'failed'; }
  return out;
}

async function sitterIds(userId) {
  return (await L.rest('sitter_profiles?select=id&user_id=eq.' + q(userId)) || []).map(s => s.id);
}

// Is the caller the other side of something with the recipient?
async function counterparts(callerId, recipientId, bookingId) {
  const [mine, theirs] = await Promise.all([sitterIds(callerId), sitterIds(recipientId)]);
  if (bookingId) {
    const b = (await L.rest('bookings?select=pet_parent_id,sitter_id&id=eq.' + q(bookingId)))?.[0];
    if (!b) return false;
    return (b.pet_parent_id === callerId && theirs.includes(b.sitter_id)) || (b.pet_parent_id === recipientId && mine.includes(b.sitter_id));
  }
  const pairs = [[callerId, theirs], [recipientId, mine]].filter(([, s]) => s.length);
  for (const [parent, sitters] of pairs) {
    const ins = 'in.(' + sitters.map(q).join(',') + ')';
    if ((await L.rest('bookings?select=id&pet_parent_id=eq.' + q(parent) + '&sitter_id=' + ins + '&limit=1'))?.length) return true;
    try { if ((await L.rest('conversations?select=id&pet_parent_id=eq.' + q(parent) + '&sitter_id=' + ins + '&limit=1'))?.length) return true; } catch { /* before 038 */ }
    try {
      const requests = (await L.rest('broadcast_requests?select=id&pet_parent_id=eq.' + q(parent) + '&created_at=gte.' + q(isoAgo(30 * 24 * HOUR_MS))) || []).map(r => r.id);
      if (requests.length) {
        const reqs = 'in.(' + requests.map(q).join(',') + ')';
        if ((await L.rest('broadcast_recipients?select=request_id&request_id=' + reqs + '&sitter_id=' + ins + '&limit=1'))?.length) return true;
        if ((await L.rest('broadcast_responses?select=id&request_id=' + reqs + '&sitter_id=' + ins + '&limit=1'))?.length) return true;
      }
    } catch { /* before 037 */ }
  }
  return false;
}

async function handler(req, res) {
  L.cors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST' }); return; }
  if (!L.serviceKey()) { res.status(500).json({ error: 'Server is not configured' }); return; }
  res.setHeader('Cache-Control', 'no-store');
  try {
    const caller = await L.callerFrom(req);
    const id = L.readBody(req).notification_id;
    if (typeof id !== 'string' || !UUID.test(id)) throw new L.HttpError(400, 'notification_id is required', 'bad_request');
    const n = (await L.rest('notifications?select=*&id=eq.' + q(id)))?.[0];
    if (!n) throw new L.HttpError(404, 'Notification not found', 'not_found');
    const age = Date.now() - parseTime(n.created_at || n.sent_at);
    if (!(age < FRESH_MS && age > -FRESH_MS)) throw new L.HttpError(409, 'Only new notifications can be sent', 'stale');
    const allowed = n.user_id === caller.id || await counterparts(caller.id, n.user_id, n.booking_id) || await L.isAdmin(caller);
    if (!allowed) throw new L.HttpError(403, 'You cannot alert this person', 'forbidden');
    res.status(200).json({ ok: true, ...(await deliver(n)) });
  } catch (err) {
    const status = err instanceof L.HttpError ? err.status : 500;
    if (status >= 500) console.error('notify failed:', err);
    res.status(status).json({ error: err.message, code: err.code || 'error' });
  }
}

module.exports = handler;
module.exports.deliver = deliver;
module.exports.EMAIL_TYPES = EMAIL_TYPES;
