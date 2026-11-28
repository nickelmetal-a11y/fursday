// Shared server-side money logic for /api/payments/*. Every change to a
// booking's payment or payout fields happens here, with the service role: the
// guard_booking_money trigger (migration 037) refuses them from the browser.
const crypto = require('crypto');

const SUPABASE_URL = 'https://vucboyiklqdxpqbpfplt.supabase.co';
const RAZORPAY_API = 'https://api.razorpay.com/v1';
const TEST_EMAIL = /@example\.com$/i;
const ALLOWED_ORIGINS = [
  'https://fursday.vercel.app', 'https://fursday-admin.vercel.app', 'http://localhost:3000',
  'capacitor://localhost', 'http://localhost', 'https://localhost',
];
const HOUR = 60 * 60 * 1000;
const RELEASE_DELAY_HOURS = 24;
const NO_REPLY_HOURS = 24;
const IN_HAND = ['authorized', 'held', 'paid'];
const CLOSED_DISPUTE = ['resolved', 'closed', 'rejected', 'dismissed'];

class HttpError extends Error {
  constructor(status, message, code) { super(message); this.status = status; this.code = code; }
}

const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
const razorpayKeys = () => {
  const id = process.env.RAZORPAY_KEY_ID, secret = process.env.RAZORPAY_KEY_SECRET;
  return id && secret ? { id, secret } : null;
};
const gatewayMode = (keys) => (/^rzp_live_/.test(keys.id) ? 'live' : 'test');

const parseJson = async (r) => { const t = await r.text(); try { return t ? JSON.parse(t) : null; } catch { return t; } };

async function rest(path, method = 'GET', body, prefer = 'return=representation') {
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    method,
    headers: { apikey: serviceKey(), Authorization: 'Bearer ' + serviceKey(), 'Content-Type': 'application/json', Prefer: prefer },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await parseJson(r);
  if (!r.ok) throw new HttpError(500, (data && (data.message || data.msg)) || ('Database error ' + r.status), 'db');
  return data;
}

async function razorpay(path, method = 'GET', body) {
  const keys = razorpayKeys();
  if (!keys) throw new HttpError(503, 'Online payments are not set up yet', 'gateway_off');
  const r = await fetch(RAZORPAY_API + path, {
    method,
    headers: { Authorization: 'Basic ' + Buffer.from(keys.id + ':' + keys.secret).toString('base64'), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await parseJson(r);
  if (!r.ok) throw new HttpError(502, 'Razorpay: ' + ((data && data.error && data.error.description) || r.status), 'gateway');
  return data;
}

function signatureValid(orderId, paymentId, signature) {
  const keys = razorpayKeys();
  if (!keys || !orderId || !paymentId || typeof signature !== 'string') return false;
  const expected = crypto.createHmac('sha256', keys.secret).update(orderId + '|' + paymentId).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function callerFrom(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in first', 'auth');
  const who = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: serviceKey(), Authorization: 'Bearer ' + token } });
  if (!who.ok) throw new HttpError(401, 'Session expired, sign in again', 'auth');
  const user = await who.json();
  let aal = 'aal1';
  try { aal = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).aal || 'aal1'; } catch { /* malformed token */ }
  return { id: user.id, email: user.email || '', aal, token };
}

async function isAdmin(caller) {
  const rows = await rest('users?select=is_admin&id=eq.' + encodeURIComponent(caller.id));
  if (!rows?.[0]?.is_admin) return false;
  return !(process.env.ADMIN_REQUIRE_2FA === 'true' && caller.aal !== 'aal2');
}

async function loadBooking(id) {
  if (!id || typeof id !== 'string') throw new HttpError(400, 'booking_id is required', 'bad_request');
  const rows = await rest('bookings?select=*&id=eq.' + encodeURIComponent(id));
  const b = rows?.[0];
  if (!b) throw new HttpError(404, 'Booking not found', 'not_found');
  // select=* returns every column, so a missing key means migration 037 hasn't run.
  if (!('payment_mode' in b) || !('payout_release_at' in b)) throw new HttpError(503, 'Payments need database migration 037', 'needs_migration');
  return b;
}

async function sitterUserId(b) {
  if (!b.sitter_id) return null;
  const rows = await rest('sitter_profiles?select=user_id&id=eq.' + encodeURIComponent(b.sitter_id));
  return rows?.[0]?.user_id || null;
}

async function updateBooking(id, fields) {
  const rows = await rest('bookings?id=eq.' + encodeURIComponent(id), 'PATCH', fields);
  return rows?.[0] || null;
}

async function logEvent(bookingId, kind, amount, gatewayRef, note) {
  try { await rest('payment_events', 'POST', { booking_id: bookingId, kind, amount_paise: amount ?? null, gateway_ref: gatewayRef || null, note: note || null }, 'return=minimal'); }
  catch (e) { console.error('payment_events insert failed:', e.message); }
}

// Lazy require: api/notify.js requires this file too.
async function notify(userId, type, title, body, bookingId) {
  if (!userId) return;
  try {
    const rows = await rest('notifications', 'POST', { user_id: userId, type, title, body, booking_id: bookingId || null });
    if (rows?.[0]) await require('../notify').deliver(rows[0]);
  } catch (e) { console.error('notification failed:', e.message); }
}

// booking_date is an IST calendar date and time_slot e.g. '7:00 AM' or '07:00'.
function istTime(date, slot) {
  if (!date) return null;
  const m = String(slot || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  let h = m ? parseInt(m[1], 10) : 0;
  const min = m ? m[2] : '00';
  if (m && m[3]) { const pm = m[3].toUpperCase() === 'PM'; if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
  const d = new Date(String(date).slice(0, 10) + 'T' + String(h).padStart(2, '0') + ':' + min + ':00+05:30');
  return Number.isNaN(d.getTime()) ? null : d;
}
const serviceStart = (b) => istTime(b.booking_date, b.time_slot);
function serviceEnd(b) {
  if (b.service_type === 'boarding' && b.end_date) return istTime(b.end_date, b.time_slot);
  if (b.service_type === 'daycare' && b.pickup_time) return istTime(b.booking_date, b.pickup_time);
  return serviceStart(b);
}
function payoutReleaseAt(b) {
  const end = serviceEnd(b) || new Date();
  return new Date(end.getTime() + RELEASE_DELAY_HOURS * HOUR).toISOString();
}

// The host's cancellation policy: [hours before the start, refund %] from the
// most generous tier down; anything later refunds nothing. Mirrored in
// src/CancellationPolicyModal.js and the Terms.
const POLICIES = {
  flexible: [[24, 100]],
  moderate: [[72, 100], [24, 75]],
  strict: [[168, 100], [48, 50]],
};
const DEFAULT_POLICY = 'moderate';

function refundPercent(b, policy = DEFAULT_POLICY, now = new Date()) {
  const start = serviceStart(b);
  if (!start) return 0;
  const hours = (start - now) / HOUR;
  const tier = (POLICIES[policy] || POLICIES[DEFAULT_POLICY]).find(([h]) => hours >= h);
  return tier ? tier[1] : 0;
}

// The policy fixed on the booking (migration 038), else the sitter's current one.
async function policyFor(b) {
  if (POLICIES[b.cancellation_policy]) return b.cancellation_policy;
  if (!b.sitter_id) return DEFAULT_POLICY;
  try {
    const rows = await rest('sitter_profiles?select=*&id=eq.' + encodeURIComponent(b.sitter_id));
    return POLICIES[rows?.[0]?.cancellation_policy] ? rows[0].cancellation_policy : DEFAULT_POLICY;
  } catch { return DEFAULT_POLICY; }
}

// Bookings paid together (a repeat plan) share one Razorpay payment id.
async function paymentGroup(b) {
  if (!b.payment_id) return [b];
  const rows = await rest('bookings?select=*&payment_id=eq.' + encodeURIComponent(b.payment_id));
  return rows?.length ? rows : [b];
}

// Takes the held money. A payment covering several bookings is captured once,
// for all of them: accepting any booking of a plan accepts the whole plan.
// Shares of bookings cancelled while on hold are refunded straight after.
// Simulated (test-account) payments never touch Razorpay.
async function capture(given) {
  const group = await paymentGroup(given);
  const b = group.find(x => x.id === given.id) || given;
  if (['held', 'paid'].includes(b.payment_status)) {
    if (b.payout_status) return b;
    return updateBooking(b.id, { payout_status: 'on_hold', payout_release_at: payoutReleaseAt(b) });
  }
  if (b.payment_status !== 'authorized') throw new HttpError(409, 'There is no payment to capture', 'not_paid');
  const take = group.filter(x => x.payment_status === 'authorized' && x.status !== 'cancelled');
  if (!take.some(x => x.id === b.id)) throw new HttpError(409, 'There is no payment to capture', 'not_paid');
  const share = take.reduce((s, x) => s + (x.gross_amount_paise || 0), 0);
  let ref = b.payment_id, leftover = 0;
  if (b.payment_mode !== 'simulated') {
    const total = group.length > 1 ? Number((await razorpay('/payments/' + encodeURIComponent(b.payment_id))).amount) : b.gross_amount_paise;
    const p = await razorpay('/payments/' + encodeURIComponent(b.payment_id) + '/capture', 'POST', { amount: total, currency: 'INR' });
    ref = p.id || ref;
    leftover = total - share;
  }
  const now = new Date().toISOString();
  let mine = null;
  for (const x of take) {
    const releaseAt = payoutReleaseAt(x);
    const fields = { payment_status: 'held', captured_at: now, payout_status: 'on_hold', payout_release_at: releaseAt };
    if (x.status === 'pending') fields.status = 'confirmed';
    const updated = await updateBooking(x.id, fields);
    await logEvent(x.id, 'captured', x.gross_amount_paise, ref, 'Payout releases ' + releaseAt);
    if (x.id === b.id) mine = updated;
  }
  if (leftover > 0) {
    const r = await refund(b, leftover, 'Bookings cancelled before the sitter accepted');
    for (const x of group.filter(y => y.payment_status === 'voided')) {
      await updateBooking(x.id, r.manual ? { payment_status: 'held' } : { payment_status: 'refunded', refunded_amount_paise: x.gross_amount_paise || 0 });
      await logEvent(x.id, r.manual ? 'refund_due' : 'refunded', x.gross_amount_paise, r.ref, (r.manual ? 'Refund by hand: ' : '') + 'cancelled before the plan was accepted');
    }
  }
  return mine;
}

// Gives back `amount` of a captured payment. Payments from before order-based
// checkout (no payment_mode) or from the other Razorpay mode are flagged for
// the admin to refund by hand instead.
async function refund(b, amount, note) {
  if (amount <= 0) return { manual: false };
  if (b.payment_mode === 'simulated') return { manual: false, ref: 'sim_refund' };
  const keys = razorpayKeys();
  if (b.payment_id && keys && b.payment_mode === gatewayMode(keys)) {
    const r = await razorpay('/payments/' + encodeURIComponent(b.payment_id) + '/refund', 'POST', { amount, speed: 'normal', notes: { booking_id: b.id, reason: String(note || '').slice(0, 200) } });
    return { manual: false, ref: r.id };
  }
  return { manual: true };
}

// Hands everything back: voids an authorization, or refunds a capture in full.
async function releaseFully(b, reason) {
  const fields = { payout_status: null };
  if (!['pending', 'confirmed', 'active', 'cancelled'].includes(b.status)) throw new HttpError(409, 'This booking can no longer be released', 'bad_state');
  if (b.status !== 'cancelled') Object.assign(fields, { status: 'cancelled', cancellation_reason: reason, cancelled_at: new Date().toISOString() });
  let outcome = 'none';
  if (b.payment_status === 'authorized') {
    // Razorpay returns an uncaptured authorization to the payer on its own.
    Object.assign(fields, { payment_status: 'voided', refund_percentage: 100, refund_amount_paise: b.gross_amount_paise || 0 });
    outcome = 'voided';
  } else if (['held', 'paid'].includes(b.payment_status)) {
    const amount = (b.gross_amount_paise || 0) - (b.refunded_amount_paise || 0);
    const r = await refund(b, amount, reason);
    // A refund by hand is owed, not sent, until the admin marks it sent.
    Object.assign(fields, {
      payment_status: r.manual ? b.payment_status : 'refunded', refunded_amount_paise: (b.refunded_amount_paise || 0) + (r.manual ? 0 : amount),
      refund_percentage: 100, refund_amount_paise: b.gross_amount_paise || 0,
    });
    outcome = r.manual ? 'refund_manual' : 'refunded';
    await logEvent(b.id, r.manual ? 'refund_due' : 'refunded', amount, r.ref, (r.manual ? 'Refund by hand: ' : '') + reason);
  }
  const updated = await updateBooking(b.id, fields);
  if (outcome === 'voided') await logEvent(b.id, 'voided', b.gross_amount_paise, b.payment_id, reason);
  if (outcome === 'voided') await notify(b.pet_parent_id, 'payment_released', 'No charge — your hold was released', 'Booking ' + (b.booking_ref || '') + ': ' + reason + '. The Rs.' + Math.round((b.gross_amount_paise || 0) / 100) + ' hold goes back to you; your bank may take a few days to show it.', b.id);
  if (outcome === 'refunded' || outcome === 'refund_manual') await notify(b.pet_parent_id, 'payment_refunded', 'Full refund on its way', 'Booking ' + (b.booking_ref || '') + ': ' + reason + '. Rs.' + Math.round((b.gross_amount_paise || 0) / 100) + ' goes back to your original payment method in 5 to 7 working days.', b.id);
  return { booking: updated, outcome };
}

function cors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
}

const readBody = (req) => (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));

module.exports = {
  HttpError, TEST_EMAIL, HOUR, NO_REPLY_HOURS, IN_HAND, CLOSED_DISPUTE, POLICIES, SUPABASE_URL,
  razorpayKeys, gatewayMode, rest, razorpay, signatureValid, callerFrom, isAdmin, loadBooking, sitterUserId,
  updateBooking, logEvent, notify, istTime, payoutReleaseAt, refundPercent, policyFor, paymentGroup, capture, refund, releaseFully,
  cors, readBody, serviceKey,
};
