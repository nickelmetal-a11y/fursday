import { supabase } from './supabase';

// The browser never changes money fields itself (migration 037's trigger
// refuses them); every payment step goes through /api/payments/* instead.

const PROD = 'https://fursday.vercel.app';
// The native apps, local dev and the admin site all call the customer site's API.
export const apiBase = () => (typeof window !== 'undefined' && window.location?.origin === PROD ? '' : PROD);

export class PaymentsError extends Error {
  constructor(message, status = 0, code = 'unreachable') { super(message); this.status = status; this.code = code; }
}

// True when the payments server couldn't be reached or isn't ready (not
// deployed, not configured, migration 037 not run), as opposed to a real
// refusal such as "not your booking" or a failed Razorpay refund.
export const serverUnavailable = (e) => !e?.status || e.status === 404 || (e.status >= 500 && e.status !== 502);

async function call(action, body) {
  const { data: { session } = {} } = await supabase.auth.getSession();
  let r, reply;
  try {
    r = await fetch(apiBase() + '/api/payments/' + action, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + (session?.access_token || ''), 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    reply = await r.json();
  } catch (e) {
    throw new PaymentsError(e.message || 'Network error');
  }
  if (!r.ok) throw new PaymentsError(reply?.error || 'Request failed', r.status || 500, reply?.code || 'error');
  if (!reply || reply.ok !== true) throw new PaymentsError('Unexpected reply from the payments server');
  return reply;
}

export const createOrder = (bookingId) => call('create-order', { booking_id: bookingId });
export const verifyPayment = (bookingId, rz) => call('verify', { booking_id: bookingId, ...rz });
export const simulatePayment = (bookingId) => call('simulate', { booking_id: bookingId });
export const capturePayment = (bookingId) => call('capture', { booking_id: bookingId });
export const releaseHold = (bookingId, reason) => call('release-hold', { booking_id: bookingId, reason });
export const cancelBooking = (bookingId, reason) => call('cancel', { booking_id: bookingId, reason });
export const runReleaseCheck = () => call('sweep', {});

export const CHECKOUT_MODES = ['live', 'test', 'simulated'];
export const moneyInHand = (b) => ['authorized', 'held', 'paid'].includes(b?.payment_status);
export const moneyCaptured = (b) => ['held', 'paid'].includes(b?.payment_status);

const SVC_KEYS = { walk30: 'pay_svcWalk', walk60: 'pay_svcWalk', boarding: 'pay_svcBoarding', daycare: 'pay_svcDaycare' };

// What the parent should read about the money on one booking, or null.
export function moneyLine(b, tr, sitterName) {
  const amount = Math.round((b.gross_amount_paise || 0) / 100);
  const refundPaise = b.refunded_amount_paise || b.refund_amount_paise || 0;
  const vars = { amount, name: sitterName || tr('pay_sitterFallback'), service: tr(SVC_KEYS[b.service_type] || 'pay_svcOther'), refund: Math.round(refundPaise / 100) };
  const line = (key, tone, icon) => ({ text: tr(key, vars), tone, icon });
  switch (b.payment_status) {
    case 'authorized': return b.status === 'cancelled' ? line('pay_lineReleasing', 'success', 'check') : line('pay_lineAuthorized', 'info', 'lock');
    case 'voided': return line('pay_lineVoided', 'success', 'check');
    case 'refunded': return line('pay_lineRefunded', 'success', 'repeat');
    case 'partially_refunded': return line('pay_linePartRefund', 'info', 'repeat');
    case 'held':
    case 'paid':
      if (b.status === 'cancelled') return refundPaise > 0 ? line('pay_lineRefundPending', 'warning', 'clock') : line('pay_lineNoRefund', 'warning', 'info');
      if (b.payout_status === 'disputed') return line('pay_lineDisputed', 'warning', 'shield');
      if (['ready', 'paid'].includes(b.payout_status)) return line('pay_lineReleased', 'success', 'check');
      if (!b.payout_status) return line('pay_linePaid', 'success', 'check');
      return line('pay_lineHeld', 'success', 'shield');
    default: return null;
  }
}
