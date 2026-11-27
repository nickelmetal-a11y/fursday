// Rules for api/notify.js: signed-in callers only, only fresh notifications,
// only for someone the caller is really dealing with (no open relay), the
// recipient's email/push preferences are respected, each channel goes out
// once, push only when Firebase is configured, and delivery problems never
// fail the caller's request.
const path = require('path');
const crypto = require('crypto');

const USERS = {
  'tok-parent': { id: 'u-parent', email: 'parent@gmail.com' },
  'tok-sitter': { id: 'u-sitter', email: 'sitter@gmail.com' },
  'tok-stranger': { id: 'u-stranger', email: 'stranger@gmail.com' },
  'tok-admin': { id: 'u-admin', email: 'admin@gmail.com' },
};
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const SERVICE_ACCOUNT = { project_id: 'fursday-app', client_email: 'push@fursday-app.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };

let db, calls, handler, resendStatus, fcmReply, idCounter;
const reply = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)), json: async () => body });

function restCall(url, opts) {
  const u = new URL(url);
  const table = u.pathname.replace('/rest/v1/', '');
  const rows = (db[table] = db[table] || []);
  const filters = [...u.searchParams.entries()].filter(([k]) => !['select', 'limit', 'order'].includes(k));
  const match = (r) => filters.every(([k, v]) => {
    if (v.startsWith('eq.')) return String(r[k]) === v.slice(3);
    if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(r[k]));
    if (v === 'is.null') return r[k] == null;
    if (v.startsWith('gte.')) return r[k] != null && String(r[k]) >= v.slice(4);
    return true;
  });
  const method = opts.method || 'GET';
  if (method === 'GET') return reply(200, rows.filter(match).map(r => ({ ...r })));
  const body = JSON.parse(opts.body);
  if (method === 'PATCH') { const hit = rows.filter(match); hit.forEach(r => Object.assign(r, body)); return reply(200, hit.map(r => ({ ...r }))); }
  const r = { id: 'n-' + (++idCounter), created_at: new Date().toISOString(), emailed_at: null, pushed_at: null, ...body };
  rows.push(r);
  return reply(201, [r]);
}

const fakeFetch = async (url, opts = {}) => {
  if (url.endsWith('/auth/v1/user')) {
    const u = USERS[(opts.headers.Authorization || '').replace('Bearer ', '')];
    return u ? reply(200, u) : reply(401, { msg: 'bad token' });
  }
  if (url.includes('/rest/v1/')) return restCall(url, opts);
  calls.push({ url, opts, body: opts.body && opts.headers['Content-Type'] === 'application/json' ? JSON.parse(opts.body) : opts.body });
  if (url === 'https://api.resend.com/emails') return reply(resendStatus, { id: 'email_1' });
  if (url === 'https://oauth2.googleapis.com/token') return reply(200, { access_token: 'google-token', expires_in: 3600 });
  if (url.startsWith('https://fcm.googleapis.com/')) return fcmReply;
  throw new Error('unexpected ' + url);
};

const NID = '11111111-1111-4111-8111-111111111111';
const notification = (extra) => ({
  id: NID, user_id: 'u-sitter', type: 'booking_request', title: 'New paid request FUR-1', body: 'Accept or decline <soon>',
  booking_id: 'bk-1', action_url: null, created_at: new Date().toISOString(), emailed_at: null, pushed_at: null, ...extra,
});

async function call(token, body = { notification_id: NID }, method = 'POST') {
  const res = { headers: {}, statusCode: null, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  await handler({ method, headers: { authorization: token ? 'Bearer ' + token : '' }, body }, res);
  return res;
}
const emails = () => calls.filter(c => c.url === 'https://api.resend.com/emails');
const pushes = () => calls.filter(c => c.url.startsWith('https://fcm.googleapis.com/'));
const row = (id = NID) => db.notifications.find(n => n.id === id);

beforeEach(() => {
  jest.resetModules();
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.RESEND_API_KEY = 're_test';
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  handler = require(path.join(__dirname, '..', 'api', 'notify.js'));
  calls = []; resendStatus = 200; idCounter = 0;
  fcmReply = reply(200, { name: 'projects/fursday-app/messages/1' });
  db = {
    users: [
      { id: 'u-parent', email: 'parent@gmail.com', name: 'Ananya' }, { id: 'u-sitter', email: 'sitter@gmail.com', name: 'Priya' },
      { id: 'u-stranger', email: 'stranger@gmail.com', name: 'X' }, { id: 'u-admin', email: 'admin@gmail.com', is_admin: true },
      { id: 'u-test', email: 'fursday.test.p@example.com' },
    ],
    sitter_profiles: [{ id: 'sp-sitter', user_id: 'u-sitter' }],
    bookings: [{ id: 'bk-1', pet_parent_id: 'u-parent', sitter_id: 'sp-sitter' }],
    notification_preferences: [{ user_id: 'u-sitter', email_enabled: true, push_enabled: true, push_token: 'fcm-token-1', push_platform: 'android' }],
    notifications: [notification()],
    conversations: [], broadcast_requests: [], broadcast_recipients: [], broadcast_responses: [],
  };
  global.fetch = fakeFetch;
});

describe('who may trigger a delivery', () => {
  test('needs a signed-in caller and a real notification id', async () => {
    expect((await call(null)).statusCode).toBe(401);
    expect((await call('tok-parent', { notification_id: 'not-a-uuid' })).statusCode).toBe(400);
    expect((await call('tok-parent', { notification_id: '22222222-2222-4222-8222-222222222222' })).statusCode).toBe(404);
    expect((await call('tok-parent', {}, 'GET')).statusCode).toBe(405);
    expect(emails()).toHaveLength(0);
  });

  test("a stranger can't make Fursday email someone (not an open relay)", async () => {
    const res = await call('tok-stranger');
    expect(res.statusCode).toBe(403);
    expect(emails()).toHaveLength(0);
    expect(row().emailed_at).toBeNull();
  });

  test('only fresh notifications: an old row cannot be re-sent', async () => {
    row().created_at = new Date(Date.now() - 10 * 60e3).toISOString();
    expect((await call('tok-parent')).statusCode).toBe(409);
    expect(emails()).toHaveLength(0);
  });

  test('the booking counterpart can; sent_at without a time zone is read as UTC', async () => {
    const n = row();
    delete n.created_at;
    n.sent_at = new Date().toISOString().replace('Z', '');
    const res = await call('tok-parent');
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, email: 'sent' });
  });

  test('a booking id that does not connect the two people is refused', async () => {
    db.bookings.push({ id: 'bk-other', pet_parent_id: 'u-stranger', sitter_id: 'sp-sitter' });
    row().booking_id = 'bk-other';
    expect((await call('tok-parent')).statusCode).toBe(403);
  });

  test('a pre-booking conversation or a nearby-request invite also counts as dealing with each other', async () => {
    db.bookings = [];
    row().booking_id = null;
    row().type = 'conversation_message';
    expect((await call('tok-parent')).statusCode).toBe(403);

    db.conversations.push({ id: 'c-1', pet_parent_id: 'u-parent', sitter_id: 'sp-sitter' });
    expect((await call('tok-parent')).statusCode).toBe(200);

    db.conversations = [];
    db.notifications.push(notification({ id: '33333333-3333-4333-8333-333333333333', user_id: 'u-parent', type: 'broadcast_offer', booking_id: null }));
    expect((await call('tok-sitter', { notification_id: '33333333-3333-4333-8333-333333333333' })).statusCode).toBe(403);
    db.broadcast_requests.push({ id: 'br-1', pet_parent_id: 'u-parent', created_at: new Date().toISOString() });
    db.broadcast_recipients.push({ request_id: 'br-1', sitter_id: 'sp-sitter' });
    expect((await call('tok-sitter', { notification_id: '33333333-3333-4333-8333-333333333333' })).statusCode).toBe(200);
  });

  test('the recipient and admins may always trigger it', async () => {
    expect((await call('tok-sitter')).statusCode).toBe(200);
    db.notifications.push(notification({ id: '44444444-4444-4444-8444-444444444444', booking_id: null }));
    db.bookings = [];
    expect((await call('tok-admin', { notification_id: '44444444-4444-4444-8444-444444444444' })).statusCode).toBe(200);
  });
});

describe('email (Resend)', () => {
  test('sends a branded, escaped email from noreply@fursday.in and marks emailed_at', async () => {
    const res = await call('tok-parent');
    expect(res.body.email).toBe('sent');
    const [mail] = emails();
    expect(mail.opts.headers.Authorization).toBe('Bearer re_test');
    expect(mail.body).toMatchObject({ from: 'Fursday <noreply@fursday.in>', to: 'sitter@gmail.com', subject: 'New paid request FUR-1' });
    expect(mail.body.html).toContain('Hi Priya');
    expect(mail.body.html).toContain('Accept or decline &lt;soon&gt;');
    expect(mail.body.html).not.toContain('<soon>');
    expect(row().emailed_at).toBeTruthy();
  });

  test('respects email_enabled = false, skips unimportant types and @example.com test accounts', async () => {
    db.notification_preferences[0].email_enabled = false;
    expect((await call('tok-parent')).body.email).toBe('disabled');

    db.notification_preferences[0].email_enabled = true;
    row().type = 'walk_started';
    expect((await call('tok-parent')).body.email).toBe('not_important');

    row().type = 'booking_request';
    db.users.find(u => u.id === 'u-sitter').email = 'fursday.test.priya@example.com';
    expect((await call('tok-parent')).body.email).toBe('no_address');
    expect(emails()).toHaveLength(0);
  });

  test('idempotent: a second call sends nothing more', async () => {
    await call('tok-parent');
    const again = await call('tok-parent');
    expect(again.statusCode).toBe(200);
    expect(again.body.email).toBe('already');
    expect(emails()).toHaveLength(1);
  });

  test('chat messages: at most one email per conversation per hour', async () => {
    row().type = 'message_received';
    await call('tok-parent');
    db.notifications.push(notification({ id: '55555555-5555-4555-8555-555555555555', type: 'message_received' }));
    const second = await call('tok-parent', { notification_id: '55555555-5555-4555-8555-555555555555' });
    expect(second.body.email).toBe('throttled');
    db.bookings.push({ id: 'bk-2', pet_parent_id: 'u-parent', sitter_id: 'sp-sitter' });
    db.notifications.push(notification({ id: '66666666-6666-4666-8666-666666666666', type: 'message_received', booking_id: 'bk-2' }));
    expect((await call('tok-parent', { notification_id: '66666666-6666-4666-8666-666666666666' })).body.email).toBe('sent');
    expect(emails()).toHaveLength(2);
  });

  test('a Resend failure is not an error for the caller, and the row is left unsent', async () => {
    resendStatus = 500;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call('tok-parent');
    console.error.mockRestore();
    expect(res.statusCode).toBe(200);
    expect(res.body.email).toBe('failed');
    expect(row().emailed_at).toBeNull();
  });

  test('before migration 038 (no emailed_at column) nothing is sent, so nothing can repeat', async () => {
    const n = row();
    delete n.emailed_at; delete n.pushed_at;
    const res = await call('tok-parent');
    expect(res.body).toMatchObject({ email: 'needs_migration', push: 'needs_migration' });
    expect(emails()).toHaveLength(0);
  });
});

describe('push (Firebase Cloud Messaging v1)', () => {
  test('nothing is pushed while FIREBASE_SERVICE_ACCOUNT is not set', async () => {
    const res = await call('tok-parent');
    expect(res.body.push).toBe('off');
    expect(pushes()).toHaveLength(0);
    expect(calls.some(c => c.url.includes('oauth2'))).toBe(false);
  });

  test('with a service account: signs a JWT, gets a Google token, sends to the device and marks pushed_at', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(SERVICE_ACCOUNT);
    row().type = 'walk_started';
    const res = await call('tok-parent');
    expect(res.body).toMatchObject({ push: 'sent', email: 'not_important' });

    const tokenCall = calls.find(c => c.url === 'https://oauth2.googleapis.com/token');
    const assertion = new URLSearchParams(tokenCall.body).get('assertion');
    const [h, p, sig] = assertion.split('.');
    expect(crypto.verify('RSA-SHA256', Buffer.from(h + '.' + p), publicKey, Buffer.from(sig, 'base64url'))).toBe(true);
    expect(JSON.parse(Buffer.from(p, 'base64url').toString())).toMatchObject({ iss: SERVICE_ACCOUNT.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging' });

    const [push] = pushes();
    expect(push.url).toBe('https://fcm.googleapis.com/v1/projects/fursday-app/messages:send');
    expect(push.opts.headers.Authorization).toBe('Bearer google-token');
    expect(push.body.message).toMatchObject({ token: 'fcm-token-1', notification: { title: 'New paid request FUR-1' }, data: { type: 'walk_started', booking_id: 'bk-1', notification_id: NID } });
    expect(row().pushed_at).toBeTruthy();

    await call('tok-parent');
    expect(pushes()).toHaveLength(1);
  });

  test('respects push_enabled = false and people with no registered device', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(SERVICE_ACCOUNT);
    db.notification_preferences[0].push_enabled = false;
    expect((await call('tok-parent')).body.push).toBe('disabled');
    db.notification_preferences = [];
    expect((await call('tok-parent')).body.push).toBe('no_device');
    expect(pushes()).toHaveLength(0);
  });

  test('an uninstalled app (UNREGISTERED token) clears the stored token', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(SERVICE_ACCOUNT);
    fcmReply = reply(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });
    const res = await call('tok-parent');
    expect(res.statusCode).toBe(200);
    expect(res.body.push).toBe('device_gone');
    expect(db.notification_preferences[0].push_token).toBeNull();
  });
});

test('notifications made by the payments server are delivered the same way', async () => {
  const L = require(path.join(__dirname, '..', 'api', 'payments', '_lib.js'));
  await L.notify('u-parent', 'payment_refunded', 'Full refund on its way', 'Rs.400 back to you', 'bk-1');
  const made = db.notifications.find(n => n.type === 'payment_refunded');
  expect(made.emailed_at).toBeTruthy();
  expect(emails()[0].body).toMatchObject({ to: 'parent@gmail.com', subject: 'Full refund on its way' });
});
