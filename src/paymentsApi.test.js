// Rules for api/payments/[action].js: the price comes from the database,
// Razorpay's signature is checked, only the right person can move money,
// refunds follow the policy computed on the server, simulation is for test
// accounts only, and the daily sweep releases payouts by the rules.
const path = require('path');
const crypto = require('crypto');

const HOUR = 3600e3;
const SECRET = 'rzp_secret_test';
const USERS = {
  'tok-parent': { id: 'u-parent', email: 'parent@gmail.com' },
  'tok-testparent': { id: 'u-testparent', email: 'fursday.test.parent@example.com' },
  'tok-sitter': { id: 'u-sitter', email: 'sitter@gmail.com' },
  'tok-othersitter': { id: 'u-other', email: 'other@gmail.com' },
  'tok-admin': { id: 'u-admin', email: 'admin@gmail.com' },
};

let db, rzCalls, rzPayment, handler;
const reply = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)), json: async () => body });

function restCall(url, opts) {
  const u = new URL(url);
  const table = u.pathname.replace('/rest/v1/', '');
  const rows = (db[table] = db[table] || []);
  const filters = [...u.searchParams.entries()].filter(([k]) => k !== 'select');
  const match = (r) => filters.every(([k, v]) => v.startsWith('eq.') ? String(r[k]) === v.slice(3) : v.startsWith('in.(') ? v.slice(4, -1).split(',').includes(String(r[k])) : true);
  const method = opts.method || 'GET';
  if (method === 'GET') return reply(200, rows.filter(match).map(r => ({ ...r })));
  const body = JSON.parse(opts.body);
  if (method === 'PATCH') { rows.filter(match).forEach(r => Object.assign(r, body)); return reply(200, rows.filter(match)); }
  const r = { id: table + '-' + (rows.length + 1), ...body };
  rows.push(r);
  return reply(201, [r]);
}

const fakeFetch = async (url, opts = {}) => {
  if (url.endsWith('/auth/v1/user')) {
    const u = USERS[(opts.headers.Authorization || '').replace('Bearer ', '')];
    return u ? reply(200, u) : reply(401, { msg: 'bad token' });
  }
  if (url.startsWith('https://api.razorpay.com/v1')) {
    const p = url.replace('https://api.razorpay.com/v1', '');
    rzCalls.push({ path: p, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null, auth: opts.headers.Authorization });
    if (p === '/orders') return reply(200, { id: 'order_1', amount: JSON.parse(opts.body).amount });
    if (p.endsWith('/capture')) return reply(200, { id: 'pay_1', status: 'captured' });
    if (p.endsWith('/refund')) return reply(200, { id: 'rfnd_1' });
    return reply(200, rzPayment);
  }
  if (url.includes('/rest/v1/')) return restCall(url, opts);
  throw new Error('unexpected ' + url);
};

// booking_date/time_slot are IST; build them for "h hours from now".
const istSlot = (h) => {
  const ist = new Date(Date.now() + h * HOUR + 5.5 * HOUR).toISOString();
  return { booking_date: ist.slice(0, 10), time_slot: ist.slice(11, 16) };
};
const booking = (id, extra) => ({
  id, booking_ref: 'FUR-' + id, pet_parent_id: 'u-parent', sitter_id: 'sp-sitter', service_type: 'walk30', status: 'pending',
  gross_amount_paise: 40000, sitter_payout_paise: 40000, payment_status: 'unpaid', payment_id: null, razorpay_order_id: null,
  payment_mode: null, paid_at: null, captured_at: null, payout_status: null, payout_release_at: null, released_at: null,
  refunded_amount_paise: 0, ...istSlot(100), ...extra,
});

const withKeys = () => { process.env.RAZORPAY_KEY_ID = 'rzp_test_abc'; process.env.RAZORPAY_KEY_SECRET = SECRET; };
const sign = (orderId, paymentId) => crypto.createHmac('sha256', SECRET).update(orderId + '|' + paymentId).digest('hex');
const row = (id) => db.bookings.find(b => b.id === id);
const events = (id, kind) => (db.payment_events || []).filter(e => e.booking_id === id && (!kind || e.kind === kind));

async function call(action, token, body = {}, method = 'POST') {
  const res = { headers: {}, statusCode: null, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  await handler({ method, query: { action }, headers: { authorization: token ? (token.startsWith('Bearer') ? token : 'Bearer ' + token) : '' }, body }, res);
  return res;
}

beforeEach(() => {
  jest.resetModules();
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET; delete process.env.CRON_SECRET;
  handler = require(path.join(__dirname, '..', 'api', 'payments', '[action].js'));
  rzCalls = [];
  rzPayment = { id: 'pay_1', order_id: 'order_1', amount: 40000, status: 'authorized' };
  db = {
    users: [{ id: 'u-parent' }, { id: 'u-testparent' }, { id: 'u-sitter' }, { id: 'u-other' }, { id: 'u-admin', is_admin: true }],
    sitter_profiles: [{ id: 'sp-sitter', user_id: 'u-sitter' }, { id: 'sp-other', user_id: 'u-other' }],
    bookings: [], payment_events: [], notifications: [], disputes: [], sitter_reports: [],
  };
  global.fetch = fakeFetch;
});

describe('create-order', () => {
  test('charges the price stored on the booking, never the amount the app sends, with manual capture', async () => {
    withKeys();
    db.bookings.push(booking('b1', { gross_amount_paise: 30000 }));
    const res = await call('create-order', 'tok-parent', { booking_id: 'b1', amount: 100 });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, mode: 'test', order_id: 'order_1', key_id: 'rzp_test_abc', amount: 30000 });
    expect(rzCalls[0].body).toMatchObject({ amount: 30000, currency: 'INR', payment: { capture: 'manual' } });
    expect(rzCalls[0].auth).toBe('Basic ' + Buffer.from('rzp_test_abc:' + SECRET).toString('base64'));
    expect(row('b1').razorpay_order_id).toBe('order_1');
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  test("another user can't create an order for someone else's booking", async () => {
    withKeys();
    db.bookings.push(booking('b1'));
    const res = await call('create-order', 'tok-othersitter', { booking_id: 'b1' });
    expect(res.statusCode).toBe(403);
    expect(rzCalls).toHaveLength(0);
  });

  test('without Razorpay keys: test accounts get simulated checkout, real customers get "unavailable"', async () => {
    db.bookings.push(booking('b1'), booking('b2', { pet_parent_id: 'u-testparent' }));
    expect((await call('create-order', 'tok-parent', { booking_id: 'b1' })).body).toMatchObject({ ok: true, mode: 'unavailable' });
    expect((await call('create-order', 'tok-testparent', { booking_id: 'b2' })).body).toMatchObject({ ok: true, mode: 'simulated', amount: 40000 });
  });

  test('before migration 037 the booking has no payment columns, so checkout is unavailable', async () => {
    withKeys();
    const { payment_mode, payout_release_at, ...old } = booking('b1');
    db.bookings.push(old);
    const res = await call('create-order', 'tok-parent', { booking_id: 'b1' });
    expect(res.body).toMatchObject({ ok: true, mode: 'unavailable', reason: 'needs_migration' });
    expect(rzCalls).toHaveLength(0);
  });

  test('an already-paid booking cannot be ordered again', async () => {
    withKeys();
    db.bookings.push(booking('b1', { payment_status: 'authorized' }));
    expect((await call('create-order', 'tok-parent', { booking_id: 'b1' })).statusCode).toBe(409);
  });
});

describe('verify', () => {
  test('a forged signature is refused and nothing changes', async () => {
    withKeys();
    db.bookings.push(booking('b1', { razorpay_order_id: 'order_1' }));
    const res = await call('verify', 'tok-parent', { booking_id: 'b1', razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'f'.repeat(64) });
    expect(res.statusCode).toBe(400);
    expect(row('b1').payment_status).toBe('unpaid');
    expect(events('b1')).toHaveLength(0);
  });

  test('a valid payment is held (authorized), logged, and the sitter is told about the paid request', async () => {
    withKeys();
    db.bookings.push(booking('b1', { razorpay_order_id: 'order_1' }));
    const res = await call('verify', 'tok-parent', { booking_id: 'b1', razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_1', 'pay_1') });
    expect(res.statusCode).toBe(200);
    expect(row('b1')).toMatchObject({ payment_status: 'authorized', payment_id: 'pay_1', payment_mode: 'test', status: 'pending' });
    expect(row('b1').paid_at).toBeTruthy();
    expect(events('b1', 'authorized')).toHaveLength(1);
    expect(db.notifications.filter(n => n.user_id === 'u-sitter' && n.type === 'booking_request')).toHaveLength(1);
    expect(rzCalls.some(c => c.path.endsWith('/capture'))).toBe(false);
  });

  test('a payment whose amount differs from the booking is refused', async () => {
    withKeys();
    rzPayment.amount = 100;
    db.bookings.push(booking('b1', { razorpay_order_id: 'order_1' }));
    const res = await call('verify', 'tok-parent', { booking_id: 'b1', razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_1', 'pay_1') });
    expect(res.statusCode).toBe(400);
    expect(row('b1').payment_status).toBe('unpaid');
  });

  test('a booking the sitter already accepted is captured straight away', async () => {
    withKeys();
    db.bookings.push(booking('b1', { razorpay_order_id: 'order_1', status: 'confirmed' }));
    await call('verify', 'tok-parent', { booking_id: 'b1', razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_1', razorpay_signature: sign('order_1', 'pay_1') });
    expect(row('b1')).toMatchObject({ payment_status: 'held', payout_status: 'on_hold' });
    expect(rzCalls.find(c => c.path === '/payments/pay_1/capture').body).toEqual({ amount: 40000, currency: 'INR' });
  });
});

describe('simulate', () => {
  test('only @example.com test accounts can simulate, and only while Razorpay is off', async () => {
    db.bookings.push(booking('real'), booking('test', { pet_parent_id: 'u-testparent' }));
    expect((await call('simulate', 'tok-parent', { booking_id: 'real' })).statusCode).toBe(403);
    expect(row('real').payment_status).toBe('unpaid');

    const ok = await call('simulate', 'tok-testparent', { booking_id: 'test' });
    expect(ok.statusCode).toBe(200);
    expect(row('test')).toMatchObject({ payment_status: 'authorized', payment_mode: 'simulated' });

    withKeys();
    db.bookings.push(booking('test2', { pet_parent_id: 'u-testparent' }));
    expect((await call('simulate', 'tok-testparent', { booking_id: 'test2' })).statusCode).toBe(409);
  });
});

describe('capture', () => {
  test("only that booking's sitter (or an admin) can capture", async () => {
    withKeys();
    db.bookings.push(booking('b1', { payment_status: 'authorized', payment_id: 'pay_1', payment_mode: 'test' }));
    expect((await call('capture', 'tok-parent', { booking_id: 'b1' })).statusCode).toBe(403);
    expect((await call('capture', 'tok-othersitter', { booking_id: 'b1' })).statusCode).toBe(403);
    expect(row('b1').payment_status).toBe('authorized');
    expect(rzCalls).toHaveLength(0);
  });

  test('the sitter accepting captures the money and holds the payout until 24h after the service', async () => {
    withKeys();
    db.bookings.push(booking('b1', { payment_status: 'authorized', payment_id: 'pay_1', payment_mode: 'test', booking_date: '2026-12-10', time_slot: '7:00 AM' }));
    const res = await call('capture', 'tok-sitter', { booking_id: 'b1' });
    expect(res.statusCode).toBe(200);
    expect(row('b1')).toMatchObject({ payment_status: 'held', payout_status: 'on_hold', status: 'confirmed' });
    expect(row('b1').payout_release_at).toBe('2026-12-11T01:30:00.000Z');
    expect(events('b1', 'captured')).toHaveLength(1);
  });

  test('boarding releases 24h after the end date', async () => {
    db.bookings.push(booking('b1', { service_type: 'boarding', payment_status: 'authorized', payment_id: 'sim_1', payment_mode: 'simulated', booking_date: '2026-12-10', end_date: '2026-12-13', time_slot: '10:00 AM' }));
    await call('capture', 'tok-sitter', { booking_id: 'b1' });
    expect(row('b1').payout_release_at).toBe('2026-12-14T04:30:00.000Z');
    expect(rzCalls).toHaveLength(0);
  });

  test('an unpaid booking has nothing to capture', async () => {
    db.bookings.push(booking('b1'));
    expect((await call('capture', 'tok-sitter', { booking_id: 'b1' })).statusCode).toBe(409);
  });
});

describe('release-hold', () => {
  test('a sitter declining an unaccepted paid request voids the hold and the parent is told there is no charge', async () => {
    withKeys();
    db.bookings.push(booking('b1', { payment_status: 'authorized', payment_id: 'pay_1', payment_mode: 'test' }));
    expect((await call('release-hold', 'tok-othersitter', { booking_id: 'b1' })).statusCode).toBe(403);
    const res = await call('release-hold', 'tok-sitter', { booking_id: 'b1', reason: 'Declined by sitter' });
    expect(res.body).toMatchObject({ ok: true, outcome: 'voided' });
    expect(row('b1')).toMatchObject({ payment_status: 'voided', status: 'cancelled', cancellation_reason: 'Declined by sitter' });
    expect(db.notifications.find(n => n.user_id === 'u-parent').title).toBe('No charge — your hold was released');
    expect(rzCalls).toHaveLength(0);
  });

  test('a sitter cancelling an accepted job refunds the captured money in full', async () => {
    withKeys();
    db.bookings.push(booking('b1', { status: 'confirmed', payment_status: 'held', payment_id: 'pay_1', payment_mode: 'test', payout_status: 'on_hold' }));
    await call('release-hold', 'tok-sitter', { booking_id: 'b1', reason: 'Sitter unwell' });
    expect(rzCalls.find(c => c.path === '/payments/pay_1/refund').body.amount).toBe(40000);
    expect(row('b1')).toMatchObject({ payment_status: 'refunded', refunded_amount_paise: 40000, payout_status: null });
  });
});

describe('cancel', () => {
  test('the refund % is recomputed on the server from the booking time; the app cannot ask for more', async () => {
    withKeys();
    db.bookings.push(booking('b1', { status: 'confirmed', payment_status: 'held', payment_id: 'pay_1', payment_mode: 'test', payout_status: 'on_hold', ...istSlot(48) }));
    const res = await call('cancel', 'tok-parent', { booking_id: 'b1', reason: 'Change of plans', refund_percentage: 100, refund_amount_paise: 40000 });
    expect(res.body).toMatchObject({ ok: true, refund_percentage: 75, refund_amount_paise: 30000 });
    expect(rzCalls.find(c => c.path === '/payments/pay_1/refund').body.amount).toBe(30000);
    expect(row('b1')).toMatchObject({ status: 'cancelled', payment_status: 'partially_refunded', refunded_amount_paise: 30000, refund_percentage: 75, payout_status: null });
    expect(events('b1', 'refunded')[0].amount_paise).toBe(30000);
  });

  test('under 24h before: no refund and Razorpay is not called', async () => {
    withKeys();
    db.bookings.push(booking('b1', { status: 'confirmed', payment_status: 'held', payment_id: 'pay_1', payment_mode: 'test', ...istSlot(5) }));
    const res = await call('cancel', 'tok-parent', { booking_id: 'b1', reason: 'Change of plans' });
    expect(res.body).toMatchObject({ refund_percentage: 0, refund_amount_paise: 0 });
    expect(rzCalls).toHaveLength(0);
    expect(row('b1')).toMatchObject({ status: 'cancelled', payment_status: 'held', refunded_amount_paise: 0 });
  });

  test("another parent or the sitter can't cancel; an admin always refunds 100%", async () => {
    withKeys();
    db.bookings.push(booking('b1', { status: 'confirmed', payment_status: 'held', payment_id: 'pay_1', payment_mode: 'test', ...istSlot(5) }));
    expect((await call('cancel', 'tok-testparent', { booking_id: 'b1' })).statusCode).toBe(403);
    expect((await call('cancel', 'tok-sitter', { booking_id: 'b1' })).statusCode).toBe(403);
    const res = await call('cancel', 'tok-admin', { booking_id: 'b1', reason: 'Fursday: Sitter unwell' });
    expect(res.body).toMatchObject({ refund_percentage: 100, refund_amount_paise: 40000 });
    expect(row('b1')).toMatchObject({ payment_status: 'refunded', refunded_amount_paise: 40000 });
  });

  test('cancelling before the sitter accepted voids the whole hold whatever the timing', async () => {
    db.bookings.push(booking('b1', { payment_status: 'authorized', payment_id: 'sim_1', payment_mode: 'simulated', ...istSlot(5) }));
    const res = await call('cancel', 'tok-parent', { booking_id: 'b1', reason: 'Change of plans' });
    expect(res.body).toMatchObject({ refund_percentage: 100, outcome: 'voided' });
    expect(row('b1')).toMatchObject({ payment_status: 'voided', status: 'cancelled' });
  });

  test('a payment from before order-based checkout is recorded for a refund by hand', async () => {
    withKeys();
    db.bookings.push(booking('b1', { status: 'confirmed', payment_status: 'paid', payment_id: 'pay_old', payment_mode: null }));
    const res = await call('cancel', 'tok-parent', { booking_id: 'b1', reason: 'Change of plans' });
    expect(res.body.outcome).toBe('refund_manual');
    expect(rzCalls).toHaveLength(0);
    expect(events('b1', 'refunded')[0].note).toMatch(/^Refund by hand/);
  });
});

describe('sweep', () => {
  const past = (h) => new Date(Date.now() - h * HOUR).toISOString();
  const future = (h) => new Date(Date.now() + h * HOUR).toISOString();

  test('needs the cron secret or an admin', async () => {
    process.env.CRON_SECRET = 'cron-123';
    expect((await call('sweep', 'tok-parent', {}, 'GET')).statusCode).toBe(403);
    expect((await call('sweep', 'Bearer wrong', {}, 'GET')).statusCode).toBe(401);
    expect((await call('sweep', 'Bearer cron-123', {}, 'GET')).statusCode).toBe(200);
    expect((await call('sweep', 'tok-admin')).statusCode).toBe(200);
  });

  test('voids holds a sitter never answered within 24h, and leaves fresh ones', async () => {
    db.bookings.push(
      booking('stale', { payment_status: 'authorized', payment_mode: 'simulated', payment_id: 'sim_1', paid_at: past(30) }),
      booking('fresh', { payment_status: 'authorized', payment_mode: 'simulated', payment_id: 'sim_2', paid_at: past(2) }),
    );
    const res = await call('sweep', 'tok-admin');
    expect(res.body.voided).toBe(1);
    expect(row('stale')).toMatchObject({ payment_status: 'voided', status: 'cancelled', cancellation_reason: 'The sitter did not reply within 24 hours' });
    expect(row('fresh').payment_status).toBe('authorized');
  });

  test('releases completed jobs past their hold, keeps future ones, and pauses disputed or reported ones', async () => {
    const held = { payment_status: 'held', payout_status: 'on_hold' };
    db.bookings.push(
      booking('due', { ...held, status: 'completed', payout_release_at: past(1) }),
      booking('early', { ...held, status: 'completed', payout_release_at: future(5) }),
      booking('notdone', { ...held, status: 'confirmed', payout_release_at: past(1) }),
      booking('disputed', { ...held, status: 'completed', payout_release_at: past(1) }),
      booking('reported', { ...held, status: 'completed', payout_release_at: past(1) }),
      booking('settled', { ...held, status: 'completed', payout_release_at: past(1) }),
    );
    db.disputes.push({ booking_id: 'disputed', status: 'open' }, { booking_id: 'settled', status: 'resolved' });
    db.sitter_reports.push({ booking_id: 'reported', reason: 'Sitter was late or no-show' });

    const res = await call('sweep', 'tok-admin');
    expect(res.body).toMatchObject({ released: 2, disputed: 2 });
    expect(row('due')).toMatchObject({ payout_status: 'ready' });
    expect(row('due').released_at).toBeTruthy();
    expect(row('settled').payout_status).toBe('ready');
    expect(row('early').payout_status).toBe('on_hold');
    expect(row('notdone').payout_status).toBe('on_hold');
    expect(row('disputed').payout_status).toBe('disputed');
    expect(row('reported').payout_status).toBe('disputed');
    expect(db.notifications.filter(n => n.type === 'payout_ready' && n.user_id === 'u-sitter')).toHaveLength(2);

    db.disputes[0].status = 'resolved';
    await call('sweep', 'tok-admin');
    expect(row('disputed').payout_status).toBe('ready');
    expect(row('reported').payout_status).toBe('disputed');
  });
});

test('rejects unknown actions and non-POST calls', async () => {
  expect((await call('everything', 'tok-admin')).statusCode).toBe(404);
  expect((await call('capture', 'tok-sitter', {}, 'GET')).statusCode).toBe(405);
});
