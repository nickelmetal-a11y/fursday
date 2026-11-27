// Stand-in for src/paymentsClient.js in the scenario tests. Instead of faking
// the server's rules, it runs the real api/payments/[action].js handler against
// the in-memory fakeSupabase tables, with a fake Razorpay behind it, so a
// scenario exercises the same money logic production does.
//   jest.mock('../paymentsClient', () => require('../testing/fakePayments'));
import { db } from './fakeSupabase';

const real = jest.requireActual('../paymentsClient');
const handler = require('../../api/payments/[action].js');

const PAYMENT_COLUMNS = {
  payment_status: null, payment_id: null, payout_status: null, razorpay_order_id: null, payment_mode: null,
  paid_at: null, captured_at: null, payout_release_at: null, released_at: null, refunded_amount_paise: 0, tip_paise: 0,
};

export const payments = {
  migrated: true,
  offline: false,
  razorpayCalls: [],
  calls: [],
  orders: [],
  reset() { this.migrated = true; this.offline = false; this.razorpayCalls = []; this.calls = []; this.orders = []; },
};

const reply = (status, body) => ({ ok: status < 400, status, text: async () => JSON.stringify(body), json: async () => body });

function postgrest(url, opts) {
  const u = new URL(url);
  const table = u.pathname.replace('/rest/v1/', '');
  const filters = [...u.searchParams.entries()].filter(([k]) => k !== 'select');
  const match = (r) => filters.every(([k, v]) => v.startsWith('eq.') ? String(r[k]) === v.slice(3) : v.startsWith('in.(') ? v.slice(4, -1).split(',').includes(String(r[k])) : true);
  const shape = (r) => (table === 'bookings' && payments.migrated ? { ...PAYMENT_COLUMNS, ...r } : { ...r });
  const method = opts.method || 'GET';
  const rows = db.table(table).filter(match);
  if (method === 'GET') return reply(200, rows.map(shape));
  const body = JSON.parse(opts.body);
  if (method === 'PATCH') { rows.forEach(r => Object.assign(r, body)); return reply(200, rows.map(shape)); }
  return reply(201, [db.insert(table, body)]);
}

function razorpay(url, opts) {
  const path = url.replace('https://api.razorpay.com/v1', '');
  const body = opts.body ? JSON.parse(opts.body) : null;
  payments.razorpayCalls.push({ path, method: opts.method || 'GET', body });
  if (path === '/orders') {
    const order = { id: 'order_' + payments.razorpayCalls.length, amount: body.amount, notes: body.notes || {} };
    payments.orders.push(order);
    return reply(200, order);
  }
  if (path.startsWith('/orders/')) return reply(200, payments.orders.find(o => o.id === path.split('/')[2]) || {});
  if (path.endsWith('/capture')) return reply(200, { id: path.split('/')[2], status: 'captured' });
  if (path.endsWith('/refund')) return reply(200, { id: 'rfnd_' + payments.razorpayCalls.length });
  // A payment is for the newest order (the checkout the scenario just opened).
  const order = payments.orders[payments.orders.length - 1];
  return reply(200, { id: path.split('/')[2], order_id: order?.id, amount: order?.amount, status: 'authorized' });
}

const bridge = (fallback) => async (url, opts = {}) => {
  if (url.endsWith('/auth/v1/user')) {
    const u = db.user && db.one('users', { id: db.user.id });
    return u ? reply(200, { id: u.id, email: u.email }) : reply(401, { msg: 'not signed in' });
  }
  if (url.startsWith('https://api.razorpay.com/v1')) return razorpay(url, opts);
  if (url.includes('/rest/v1/')) return postgrest(url, opts);
  return fallback(url, opts);
};

async function call(action, body) {
  payments.calls.push({ action, ...body });
  if (payments.offline) throw new real.PaymentsError('Network error');
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'fake-service-key';
  const res = { statusCode: 200, body: null, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  const previous = global.fetch;
  global.fetch = bridge(previous);
  try {
    await handler({ method: 'POST', query: { action }, headers: { authorization: 'Bearer scenario-session' }, body }, res);
  } finally {
    global.fetch = previous;
  }
  if (res.statusCode >= 400) throw new real.PaymentsError(res.body.error, res.statusCode, res.body.code);
  return res.body;
}

export const {
  apiBase, PaymentsError, serverUnavailable, CHECKOUT_MODES, moneyInHand, moneyCaptured, moneyLine,
  TIP_MIN_RUPEES, TIP_MAX_RUPEES, CANCELLATION_POLICIES, policyOf, refundPercentFor,
} = real;
const ids = (bookingIds) => (Array.isArray(bookingIds) ? { booking_ids: bookingIds } : { booking_id: bookingIds });
export const createOrder = (bookingIds) => call('create-order', ids(bookingIds));
export const verifyPayment = (bookingId, rz) => call('verify', { booking_id: bookingId, ...rz });
export const simulatePayment = (bookingIds) => call('simulate', ids(bookingIds));
export const startTip = (bookingId, amountPaise) => call('tip', { booking_id: bookingId, amount_paise: amountPaise });
export const verifyTip = (bookingId, rz) => call('verify', { booking_id: bookingId, purpose: 'tip', ...rz });
export const simulateTip = (bookingId, amountPaise) => call('simulate', { booking_id: bookingId, purpose: 'tip', amount_paise: amountPaise });
export const capturePayment = (bookingId) => call('capture', { booking_id: bookingId });
export const releaseHold = (bookingId, reason) => call('release-hold', { booking_id: bookingId, reason });
export const cancelBooking = (bookingId, reason) => call('cancel', { booking_id: bookingId, reason });
export const runReleaseCheck = () => call('sweep', {});
