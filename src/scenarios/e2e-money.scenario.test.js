// E2E_SCENARIOS.md sections C (payment confirmation), D (reversal: void and
// refund) and E (disbursement). Each booking's money is followed through all
// three roles: the parent pays, the sitter accepts or declines, the daily sweep
// releases the payout and the admin pays it out. The real payments server
// (api/payments/[action].js) runs through src/testing/fakePayments.js, with a
// fake Razorpay behind it when keys are set.
import React from 'react';
import crypto from 'crypto';
import { render, screen, fireEvent, waitFor, within, act, cleanup } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { payments } from '../testing/fakePayments';
import { buildSeed, IDS } from '../testing/seed';
import {
  createOrder, verifyPayment, simulatePayment, capturePayment, releaseHold, releasePayout, cancelBooking, runReleaseCheck, startTip, verifyTip, simulateTip,
} from '../paymentsClient';
import App from '../App';
import AdminPanel from '../AdminPanel';
import BookingsDashboard from '../BookingsDashboard';
import PaymentScreen from '../PaymentScreen';
import SitterDashboard from '../SitterDashboard';
import SitterEarningsDashboard from '../SitterEarningsDashboard';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../paymentsClient', () => require('../testing/fakePayments'));
jest.mock('../geolocationService', () => ({
  checkLocationRestriction: () => Promise.resolve({ allowed: true, ip: '127.0.0.1' }),
  getLocationRestrictedMessage: () => 'Coming soon to your area',
}));

const HOUR = 3600e3;
const DAY = 24 * HOUR;
const SLOW = { timeout: 8000 };
const RealDate = Date;
const SECRET = 'e2e-money-secret';
const CARD = 'div[style*="border-radius: 20px"][style*="margin-bottom: 12px"]';
const LOADING = /Loading your jobs|Loading your bookings|Loading earnings/;

// The clock moves on from `iso`, or stands still with { still: true } so refund
// tiers can be checked to the exact hour.
function freezeTime(iso, { still = false } = {}) {
  const target = new RealDate(iso).getTime();
  const offset = target - RealDate.now();
  class MockDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(MockDate.now()); else super(...a); }
    static now() { return still ? target : RealDate.now() + offset; }
  }
  global.Date = MockDate;
}
const ist = (date, hhmm = '07:00') => new RealDate(date + 'T' + hhmm + ':00+05:30');
const isoAt = (date, hhmm, plusMs = 0) => new RealDate(ist(date, hhmm).getTime() + plusMs).toISOString();
const futureDate = (days) => new Date(Date.now() + days * DAY).toISOString().slice(0, 10);

const row = (id) => db.one('bookings', { id });
const events = (id, kind) => db.rows('payment_events', { booking_id: id, kind });
const notes = (userId, type) => db.rows('notifications', { user_id: userId, type });
const rzp = (suffix) => payments.razorpayCalls.filter(c => c.method === 'POST' && c.path.endsWith(suffix));
const removeBookings = (...ids) => { const t = db.table('bookings'); ids.forEach(id => t.splice(t.findIndex(b => b.id === id), 1)); };
// Seed bookings are dated relative to the real today, so they can land on a scenario's fixed date.
const clearSeedOn = (date, keep) => removeBookings(...db.table('bookings').filter(b => b.booking_date === date && !keep.includes(b.id)).map(b => b.id));

function addBooking(id, extra) {
  return db.insert('bookings', {
    id, booking_ref: 'FUR-' + id.toUpperCase(), city_id: IDS.gurgaon, pet_parent_id: IDS.ananya, sitter_id: IDS.priya, pet_id: IDS.bruno,
    service_type: 'walk30', time_slot: '07:00 AM', gross_amount_paise: 40000, sitter_payout_paise: 40000, status: 'pending',
    payment_status: 'unpaid', ...extra,
  });
}
// A booking Priya accepted and whose money was captured, held until 24h after the walk.
function heldBooking(id, date, extra) {
  return addBooking(id, {
    booking_date: date, status: 'confirmed', payment_status: 'held', payment_mode: 'simulated', payment_id: 'sim_' + id,
    paid_at: new Date().toISOString(), captured_at: new Date().toISOString(), payout_status: 'on_hold', payout_release_at: isoAt(date, '07:00', DAY), ...extra,
  });
}
const doneBooking = (id, date, extra) => heldBooking(id, date, { status: 'completed', completed_at: isoAt(date, '07:45'), ...extra });

function gatewayOn() {
  process.env.RAZORPAY_KEY_ID = 'rzp_test_e2e';
  process.env.RAZORPAY_KEY_SECRET = SECRET;
}
const sign = (orderId, paymentId, secret = SECRET) => crypto.createHmac('sha256', secret).update(orderId + '|' + paymentId).digest('hex');

// The parent's side of a Razorpay checkout without the widget: order, then a signed payment.
async function payThroughGateway(bookingIds, paymentId) {
  db.signInAs(IDS.ananya);
  const order = await createOrder(bookingIds);
  const first = Array.isArray(bookingIds) ? bookingIds[0] : bookingIds;
  await verifyPayment(first, { razorpay_order_id: order.order_id, razorpay_payment_id: paymentId, razorpay_signature: sign(order.order_id, paymentId) });
  return order;
}

let razorpayWidgets = [];
function installRazorpayWidget() {
  razorpayWidgets = [];
  window.Razorpay = function FakeRazorpay(options) {
    this.options = options;
    this.handlers = {};
    this.on = (ev, fn) => { this.handlers[ev] = fn; };
    this.open = () => {};
    razorpayWidgets.push(this);
  };
}

const settle = async (view) => { await waitFor(() => expect(within(view.container).queryByText(LOADING)).toBeNull(), SLOW); return view; };
const cardOn = (view, text) => within(view.container).getByText(text).closest(CARD);

async function parentBookings(userId = IDS.ananya, props = {}) {
  db.signInAs(userId);
  return settle(render(<BookingsDashboard city="Gurgaon" onBack={() => {}} onNav={() => {}} onPayNow={jest.fn()} {...props} />));
}
async function sitterJobs(userId = IDS.priyaUser) {
  db.signInAs(userId);
  return settle(render(<SitterDashboard city="Gurgaon" onBack={() => {}} />));
}
async function sitterEarnings(userId = IDS.priyaUser) {
  db.signInAs(userId);
  return settle(render(<SitterEarningsDashboard city="Gurgaon" onBack={() => {}} />));
}
const tile = (view, label) => within(view.container).getByText(label).parentElement.nextSibling.textContent;

async function adminTab(name) {
  db.signInAs(IDS.admin);
  const view = render(<AdminPanel />);
  const nav = await screen.findByRole('navigation', { name: 'Admin sections' }, SLOW);
  await within(nav).findByText(/^Sitters \([1-9]\d*\)$/, {}, SLOW);
  fireEvent.click(within(nav).getByText(new RegExp('^' + name)));
  return view;
}

// Parent cancels from a booking card through the policy sheet; returns what the sheet showed.
async function cancelFromCard(view, cardText, reason = 'Change of plans') {
  fireEvent.click(within(cardOn(view, cardText)).getByRole('button', { name: 'Cancel booking' }));
  const sheet = screen.getByText('Keep booking').closest('div[style*="border-radius: 24px"]');
  const shown = sheet.textContent;
  fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel booking' }));
  fireEvent.click(screen.getByRole('button', { name: reason }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel this booking' }));
  return shown;
}

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  payments.reset();
  installRazorpayWidget();
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  db.one('users', { id: IDS.ananya }).email = 'fursday.test.ananya@example.com';
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn(() => 'Family emergency');
});

afterEach(() => {
  global.Date = RealDate;
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete window.Razorpay;
});

// ─── C. Payment confirmation ────────────────────────────────────────────────

describe('C. Payment confirmation', () => {
  test('C1: a test parent finishes paying from Bookings inside the app: the money is only held and the card says so', async () => {
    const date = futureDate(9);
    addBooking('c1', { booking_date: date, razorpay_order_id: 'order_started_earlier' });
    db.signInAs(IDS.ananya);
    render(<App />);
    fireEvent.click(within(await screen.findByRole('navigation', { name: 'Main' }, SLOW)).getByRole('button', { name: 'Bookings' }));
    await waitFor(() => expect(screen.queryByText('Loading your bookings...')).toBeNull(), SLOW);
    fireEvent.click(within(screen.getByText(date).closest(CARD)).getByRole('button', { name: 'Pay Rs.400 now — held until Priya Kapoor accepts' }));

    expect(await screen.findByText('Test account: this is a pretend payment. No real money moves.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pay Rs.400 (test payment)' }));
    await waitFor(() => expect(row('c1').payment_status).toBe('authorized'));
    expect(row('c1')).toMatchObject({ status: 'pending', payment_mode: 'simulated', gross_amount_paise: 40000 });
    expect(row('c1').captured_at || row('c1').payout_status).toBeFalsy();
    expect(events('c1', 'authorized')).toEqual([expect.objectContaining({ amount_paise: 40000 })]);
    expect(events('c1', 'captured')).toHaveLength(0);
    expect(notes(IDS.priyaUser, 'booking_request')[0].body).toMatch(/paid Rs\.400 .*held safely: accept to confirm, or decline and they are not charged/);
    expect(payments.razorpayCalls).toHaveLength(0);

    fireEvent.click((await screen.findAllByRole('button', { name: 'View my bookings' }, SLOW))[0]);
    await waitFor(() => expect(screen.queryByText('Loading your bookings...')).toBeNull(), SLOW);
    expect(within(screen.getByText(date).closest(CARD)).getByText("Rs.400 on hold — you're only charged when Priya Kapoor accepts")).toBeInTheDocument();
  }, 30000);

  test('C2: real gateway: the order is for the gross the DB holds (promo price), a valid signature holds it, and paying again is refused', async () => {
    gatewayOn();
    addBooking('c2', { booking_date: futureDate(9), gross_amount_paise: 30000, sitter_payout_paise: 40000 });
    db.signInAs(IDS.ananya);
    const view = render(<PaymentScreen onBack={jest.fn()} onSuccess={jest.fn()} booking={{ id: 'c2', amount: 99999, service: 'Walk', ref: 'FUR-C2', sitterName: 'Priya Kapoor' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Rs.300 securely' }));

    const { options } = razorpayWidgets[0];
    expect(payments.orders).toEqual([expect.objectContaining({ amount: 30000 })]);
    expect(options).toMatchObject({ key: 'rzp_test_e2e', amount: 30000, order_id: row('c2').razorpay_order_id });
    await act(async () => { await options.handler({ razorpay_order_id: options.order_id, razorpay_payment_id: 'pay_c2', razorpay_signature: sign(options.order_id, 'pay_c2') }); });
    expect(await screen.findByText('Payment done!')).toBeInTheDocument();
    expect(screen.getByText(/Rs\.300 is held safely\. You are only charged when Priya Kapoor accepts/)).toBeInTheDocument();
    expect(row('c2')).toMatchObject({ payment_status: 'authorized', payment_id: 'pay_c2', payment_mode: 'test', sitter_payout_paise: 40000 });
    expect(events('c2', 'authorized')[0].amount_paise).toBe(30000);
    expect(rzp('/capture')).toHaveLength(0);
    view.unmount();

    render(<PaymentScreen onBack={jest.fn()} booking={{ id: 'c2', amount: 30000, ref: 'FUR-C2' }} />);
    expect(await screen.findByText('This booking is already paid')).toBeInTheDocument();
    expect(payments.orders).toHaveLength(1);
  });

  test('C2: a bad signature, or a payment from another order, is refused and leaves the booking unpaid', async () => {
    gatewayOn();
    addBooking('c2bad', { booking_date: futureDate(9) });
    db.signInAs(IDS.ananya);
    render(<PaymentScreen onBack={jest.fn()} onSuccess={jest.fn()} booking={{ id: 'c2bad', amount: 40000, service: 'Walk', ref: 'FUR-C2BAD', sitterName: 'Priya Kapoor' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Rs.400 securely' }));
    const { options } = razorpayWidgets[0];
    await act(async () => { await options.handler({ razorpay_order_id: options.order_id, razorpay_payment_id: 'pay_forged', razorpay_signature: sign(options.order_id, 'pay_forged', 'not-the-secret') }); });

    expect(await screen.findByText('Payment unsuccessful')).toBeInTheDocument();
    expect(screen.getByText(/We could not confirm this payment/)).toBeInTheDocument();
    expect(row('c2bad').payment_status).toBe('unpaid');
    expect(row('c2bad').payment_id || row('c2bad').paid_at).toBeFalsy();
    expect(events('c2bad', 'authorized')).toHaveLength(0);
    expect(notes(IDS.priyaUser, 'booking_request')).toHaveLength(0);

    await expect(verifyPayment('c2bad', { razorpay_order_id: 'order_someone_else', razorpay_payment_id: 'pay_x', razorpay_signature: sign('order_someone_else', 'pay_x') }))
      .rejects.toMatchObject({ code: 'order_mismatch', status: 400 });
    db.signInAs(IDS.rohit);
    await expect(verifyPayment('c2bad', { razorpay_order_id: options.order_id, razorpay_payment_id: 'pay_y', razorpay_signature: sign(options.order_id, 'pay_y') }))
      .rejects.toMatchObject({ code: 'forbidden' });
    expect(row('c2bad').payment_status).toBe('unpaid');
  });

  test('C3: Priya accepts a gateway hold: Razorpay captures the full amount once, the payout waits until 24h after the service, Ananya is told', async () => {
    gatewayOn();
    const date = futureDate(9);
    addBooking('c3', { booking_date: date, time_slot: '06:30 PM' });
    await payThroughGateway('c3', 'pay_c3');
    const jobs = await sitterJobs();
    fireEvent.click(within(cardOn(jobs, date)).getByRole('button', { name: /Accept/ }));

    await waitFor(() => expect(row('c3').payment_status).toBe('held'));
    expect(rzp('/capture')).toEqual([expect.objectContaining({ path: '/payments/pay_c3/capture', body: { amount: 40000, currency: 'INR' } })]);
    expect(row('c3')).toMatchObject({ status: 'confirmed', payout_status: 'on_hold', payout_release_at: isoAt(date, '18:30', DAY) });
    expect(events('c3', 'captured')).toHaveLength(1);
    await waitFor(() => expect(notes(IDS.ananya, 'booking_accepted')).toHaveLength(1));
    expect(notes(IDS.ananya, 'booking_accepted')[0].body).toMatch(/Rs\.400 is held safely and paid to Priya Kapoor 24 hours after the service/);
    jobs.unmount();

    const parent = await parentBookings();
    expect(within(cardOn(parent, date)).getByText('Rs.400 held safely — paid to Priya Kapoor 24h after the walk')).toBeInTheDocument();
    expect(within(cardOn(parent, date)).queryByRole('button', { name: /Pay Rs\./ })).toBeNull();
  });

  test('C3: a boarding stay is held until 24h after check-out day, not after check-in', async () => {
    const start = futureDate(10), end = futureDate(13);
    addBooking('c3stay', { service_type: 'boarding', booking_date: start, end_date: end, time_slot: '10:00 AM', gross_amount_paise: 360000, sitter_payout_paise: 360000 });
    db.signInAs(IDS.ananya);
    await simulatePayment('c3stay');
    db.signInAs(IDS.priyaUser);
    await capturePayment('c3stay');
    expect(row('c3stay')).toMatchObject({ payment_status: 'held', payout_status: 'on_hold', payout_release_at: isoAt(end, '10:00', DAY) });
  });

  test('C4: a weekly plan is one order; Priya accepting one visit captures the whole plan once, each visit keeps its own release time', async () => {
    gatewayOn();
    const dates = [futureDate(8), futureDate(15), futureDate(22)];
    const ids = dates.map((d, i) => addBooking('plan' + i, { booking_date: d, series_id: 'ser-c4' }).id);
    const order = await payThroughGateway(ids, 'pay_plan');

    expect(order.amount).toBe(120000);
    expect(payments.orders).toHaveLength(1);
    ids.forEach(id => expect(row(id)).toMatchObject({ payment_status: 'authorized', payment_id: 'pay_plan', razorpay_order_id: order.order_id }));
    expect(notes(IDS.priyaUser, 'booking_request')).toHaveLength(1);
    expect(notes(IDS.priyaUser, 'booking_request')[0].body).toMatch(/paid Rs\.1200 for 3 bookings/);

    db.signInAs(IDS.priyaUser);
    await capturePayment('plan1');
    expect(rzp('/capture')).toEqual([expect.objectContaining({ body: { amount: 120000, currency: 'INR' } })]);
    ids.forEach((id, i) => expect(row(id)).toMatchObject({ status: 'confirmed', payment_status: 'held', payout_status: 'on_hold', payout_release_at: isoAt(dates[i], '07:00', DAY) }));
    ids.forEach(id => expect(events(id, 'captured')).toHaveLength(1));
    await capturePayment('plan2');
    expect(rzp('/capture')).toHaveLength(1);
  });

  test('C4: a visit cancelled before Priya accepts the plan is refunded straight after the capture, the rest stay held', async () => {
    gatewayOn();
    const ids = [futureDate(8), futureDate(15), futureDate(22)].map((d, i) => addBooking('pl' + i, { booking_date: d, series_id: 'ser-c4b' }).id);
    await payThroughGateway(ids, 'pay_pl');
    const voided = await cancelBooking('pl2', 'Change of plans');
    expect(voided).toMatchObject({ outcome: 'voided', refund_amount_paise: 40000 });
    expect(row('pl2')).toMatchObject({ status: 'cancelled', payment_status: 'voided' });

    db.signInAs(IDS.priyaUser);
    await capturePayment('pl0');
    expect(rzp('/capture')[0].body.amount).toBe(120000);
    expect(rzp('/refund')).toEqual([expect.objectContaining({ path: '/payments/pay_pl/refund', body: expect.objectContaining({ amount: 40000 }) })]);
    expect(row('pl2')).toMatchObject({ payment_status: 'refunded', refunded_amount_paise: 40000, payout_status: null });
    expect(row('pl0')).toMatchObject({ payment_status: 'held', payout_status: 'on_hold' });
    expect(row('pl1')).toMatchObject({ payment_status: 'held', payout_status: 'on_hold', status: 'confirmed' });
  });

  test('C5: a real customer before Razorpay keys exist: Priya accepts without any capture and Rohit is asked to pay later', async () => {
    const date = futureDate(9);
    addBooking('c5', { booking_date: date, pet_parent_id: IDS.rohit, pet_id: IDS.coco });
    db.signInAs(IDS.rohit);
    expect(await createOrder('c5')).toMatchObject({ mode: 'unavailable', amount: 40000 });
    await expect(simulatePayment('c5')).rejects.toMatchObject({ code: 'not_test_account' });

    const jobs = await sitterJobs();
    fireEvent.click(within(cardOn(jobs, date)).getByRole('button', { name: /Accept/ }));
    await waitFor(() => expect(row('c5').status).toBe('confirmed'));
    expect(row('c5').payment_status).toBe('unpaid');
    expect(payments.calls.filter(c => c.action === 'capture')).toHaveLength(0);
    await waitFor(() => expect(notes(IDS.rohit, 'booking_accepted')).toHaveLength(1));
    expect(notes(IDS.rohit, 'booking_accepted')[0].body).toMatch(/^Pay now to lock in/);
    jobs.unmount();

    const onPayNow = jest.fn();
    const parent = await parentBookings(IDS.rohit, { onPayNow });
    fireEvent.click(within(cardOn(parent, date)).getByRole('button', { name: 'Priya Kapoor accepted! Pay Rs.400 now' }));
    expect(onPayNow).toHaveBeenCalledWith(expect.objectContaining({ id: 'c5' }));
    parent.unmount();

    render(<PaymentScreen onBack={jest.fn()} booking={{ id: 'c5', amount: 40000, ref: 'FUR-C5' }} />);
    expect(await screen.findByText('Online payment is not switched on yet')).toBeInTheDocument();
    expect(row('c5')).toMatchObject({ status: 'confirmed', payment_status: 'unpaid' });
    expect(row('c5').razorpay_order_id).toBeFalsy();
  });

  test('C6: a payment that fails twice shows "unsuccessful" then "failed again", and the booking can still be paid', async () => {
    gatewayOn();
    addBooking('c6', { booking_date: futureDate(9) });
    db.signInAs(IDS.ananya);
    render(<PaymentScreen onBack={jest.fn()} onSuccess={jest.fn()} booking={{ id: 'c6', amount: 40000, service: 'Walk', ref: 'FUR-C6', sitterName: 'Priya Kapoor' }} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Pay Rs.400 securely' }));
    await act(async () => { await razorpayWidgets[0].handlers['payment.failed']({ error: { description: 'Your bank declined this payment' } }); });

    expect(screen.getByText('Payment unsuccessful')).toBeInTheDocument();
    expect(screen.getByText('Your bank declined this payment')).toBeInTheDocument();
    expect(screen.getByText('No money has been deducted')).toBeInTheDocument();
    expect(screen.getByText('Booking ref FUR-C6 is saved')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await act(async () => { await razorpayWidgets[1].handlers['payment.failed']({ error: { description: 'Your bank declined this payment' } }); });
    expect(screen.getByText('Payment failed again')).toBeInTheDocument();
    expect(row('c6').payment_status).toBe('unpaid');
    expect(row('c6').payment_id).toBeFalsy();

    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    const { options } = razorpayWidgets[2];
    expect(options.order_id).toBe(row('c6').razorpay_order_id);
    await act(async () => { await options.handler({ razorpay_order_id: options.order_id, razorpay_payment_id: 'pay_c6', razorpay_signature: sign(options.order_id, 'pay_c6') }); });
    expect(await screen.findByText('Payment done!')).toBeInTheDocument();
    expect(row('c6')).toMatchObject({ payment_status: 'authorized', payment_id: 'pay_c6' });
  });
});

// ─── D. Payment reversal ──────────────────────────────────────────────────

describe('D. Payment reversal', () => {
  test('D1: Priya declines a gateway hold: it is voided, never captured or refunded, and Ananya pays nothing', async () => {
    gatewayOn();
    const date = futureDate(9);
    addBooking('d1', { booking_date: date });
    await payThroughGateway('d1', 'pay_d1');
    const jobs = await sitterJobs();
    fireEvent.click(within(cardOn(jobs, date)).getByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(row('d1').payment_status).toBe('voided'));
    expect(row('d1')).toMatchObject({ status: 'cancelled', refund_percentage: 100, refund_amount_paise: 40000, payout_status: null });
    expect(rzp('/capture')).toHaveLength(0);
    expect(rzp('/refund')).toHaveLength(0);
    expect(events('d1', 'voided')).toHaveLength(1);
    expect(notes(IDS.ananya, 'payment_released')[0].body).toMatch(/Declined by sitter\. The Rs\.400 hold goes back to you/);
    await waitFor(() => expect(notes(IDS.ananya, 'booking_declined')).toHaveLength(1));
    jobs.unmount();

    const earn = await sitterEarnings();
    expect(tile(earn, 'Upcoming (on hold)')).toBe('Rs. 0.00');
    earn.unmount();
    const parent = await parentBookings();
    fireEvent.click(within(parent.container).getByRole('button', { name: /^Past/ }));
    expect(within(cardOn(parent, date)).getByText('No charge — your hold was released')).toBeInTheDocument();
  });

  test('D2: Priya never answers: the daily sweep keeps the hold for 24h, then voids it and she can no longer accept', async () => {
    freezeTime('2026-12-01T09:00:00+05:30');
    addBooking('d2', { booking_date: '2026-12-08' });
    db.signInAs(IDS.ananya);
    await simulatePayment('d2');
    expect(row('d2').payment_status).toBe('authorized');

    freezeTime('2026-12-02T08:59:00+05:30');
    db.signInAs(IDS.admin);
    expect(await runReleaseCheck()).toMatchObject({ voided: 0 });
    expect(row('d2')).toMatchObject({ status: 'pending', payment_status: 'authorized' });

    freezeTime('2026-12-02T09:01:00+05:30');
    await adminTab('Payouts');
    fireEvent.click(await screen.findByRole('button', { name: 'Run release check' }, SLOW));
    expect(await screen.findByText(/1 unanswered holds released/)).toBeInTheDocument();
    expect(row('d2')).toMatchObject({ status: 'cancelled', payment_status: 'voided', cancellation_reason: 'The sitter did not reply within 24 hours' });
    expect(notes(IDS.ananya, 'payment_released')[0].body).toMatch(/did not reply within 24 hours\. The Rs\.400 hold goes back to you/);

    db.signInAs(IDS.priyaUser);
    await expect(capturePayment('d2')).rejects.toMatchObject({ status: 409 });
    expect(row('d2').payment_status).toBe('voided');
  }, 20000);

  // [policy, hours before the start, refund %]
  const TIERS = [
    ['flexible', 24, 100], ['flexible', 24 - 1 / 60, 0],
    ['moderate', 72, 100], ['moderate', 72 - 1 / 60, 75], ['moderate', 24, 75], ['moderate', 24 - 1 / 60, 0],
    ['strict', 168, 100], ['strict', 168 - 1 / 60, 50], ['strict', 48, 50], ['strict', 48 - 1 / 60, 0],
  ];
  test.each(TIERS)('D3/D4: %s policy, cancelled %f h before the start: %i%% back, the sitter keeps the rest as a fee', async (policy, hours, pct) => {
    freezeTime(new RealDate(ist('2026-12-20').getTime() - hours * HOUR).toISOString(), { still: true });
    heldBooking('tier', '2026-12-20', { cancellation_policy: policy });
    db.signInAs(IDS.ananya);
    const res = await cancelBooking('tier', 'Change of plans');

    const refund = 400 * pct;
    expect(res).toMatchObject({ refund_percentage: pct, refund_amount_paise: refund, policy });
    expect(row('tier')).toMatchObject({
      status: 'cancelled', refund_percentage: pct, refunded_amount_paise: refund,
      payment_status: pct === 100 ? 'refunded' : pct === 0 ? 'held' : 'partially_refunded',
      payout_status: pct === 100 ? null : 'on_hold',
    });
    expect(events('tier', 'refunded').map(e => e.amount_paise)).toEqual(pct ? [refund] : []);
    if (pct < 100) expect(row('tier')).toMatchObject({ sitter_payout_paise: 40000 - refund, payout_release_at: isoAt('2026-12-20', '07:00', DAY) });
  });

  test('D3: with no policy on the booking the server uses the host\'s current one (strict), and so does the sheet', async () => {
    freezeTime('2026-12-01T09:00:00+05:30');
    db.one('sitter_profiles', { id: IDS.priya }).cancellation_policy = 'strict';
    heldBooking('d3s', '2026-12-05', { time_slot: '01:00 PM' });
    const parent = await parentBookings();
    const shown = await cancelFromCard(parent, '2026-12-05');

    expect(shown).toMatch(/Strict policy/);
    expect(shown).toMatch(/Your refund₹200/);
    await waitFor(() => expect(row('d3s').status).toBe('cancelled'));
    expect(row('d3s')).toMatchObject({ refund_percentage: 50, refunded_amount_paise: 20000, payment_status: 'partially_refunded', sitter_payout_paise: 20000, payout_status: 'on_hold' });
    expect(await screen.findByText(/₹200 \(50%\) is on its way back/)).toBeInTheDocument();
    await waitFor(() => expect(notes(IDS.priyaUser, 'booking_cancelled')).toHaveLength(1));
  }, 20000);

  test('D3: a gateway refund goes to Razorpay for exactly the policy amount', async () => {
    gatewayOn();
    freezeTime('2026-12-01T09:00:00+05:30');
    heldBooking('d3g', '2026-12-03', { payment_mode: 'test', payment_id: 'pay_d3g', cancellation_policy: 'moderate' });
    db.signInAs(IDS.ananya);
    const res = await cancelBooking('d3g', 'Pet is sick');
    expect(res).toMatchObject({ refund_percentage: 75, outcome: 'refunded' });
    expect(rzp('/refund')).toEqual([expect.objectContaining({ path: '/payments/pay_d3g/refund', body: expect.objectContaining({ amount: 30000 }) })]);
  });

  test('D4: Ananya cancels 10h before (moderate): no refund, and Priya keeps her payout through the sweep to Payouts', async () => {
    freezeTime('2026-12-03T21:00:00+05:30');
    heldBooking('d4', '2026-12-04', { cancellation_policy: 'moderate' });
    const parent = await parentBookings();
    const shown = await cancelFromCard(parent, '2026-12-04');
    expect(shown).toMatch(/Your refund₹0/);

    expect(await screen.findByText("No refund under this booking's moderate policy.")).toBeInTheDocument();
    expect(row('d4')).toMatchObject({ status: 'cancelled', payment_status: 'held', refund_percentage: 0, refunded_amount_paise: 0, sitter_payout_paise: 40000, payout_status: 'on_hold' });
    expect(events('d4', 'refunded')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(within(parent.container).getByRole('button', { name: /^Past/ })).toBeInTheDocument());
    fireEvent.click(within(parent.container).getByRole('button', { name: /^Past/ }));
    expect(await within(parent.container).findByText('No refund under the cancellation policy')).toBeInTheDocument();
    parent.unmount();

    const holdEarn = await sitterEarnings();
    expect(tile(holdEarn, 'Upcoming (on hold)')).toBe('Rs. 340.00');
    holdEarn.unmount();

    freezeTime('2026-12-05T07:01:00+05:30');
    removeBookings('bk-done', 'bk-done-hi');
    await adminTab('Payouts');
    fireEvent.click(await screen.findByRole('button', { name: 'Run release check' }, SLOW));
    expect(await screen.findByText(/1 ready to pay/)).toBeInTheDocument();
    expect(notes(IDS.priyaUser, 'payout_ready')[0].body).toMatch(/cancelled late; your cancellation fee is on its way/);
    const priya = await screen.findByRole('region', { name: 'Payouts for Priya Kapoor' }, SLOW);
    expect(within(priya).getByText('Sitter gets: Rs.340')).toBeInTheDocument();
    cleanup();

    const earn = await sitterEarnings();
    expect(tile(earn, 'Ready — on its way')).toBe('Rs. 340.00');
  }, 30000);

  test('D5: Priya cancels a captured gateway job: Razorpay refunds all of it and nothing is left for her payout', async () => {
    gatewayOn();
    const date = futureDate(9);
    heldBooking('d5', date, { payment_mode: 'test', payment_id: 'pay_d5' });
    const jobs = await sitterJobs();
    fireEvent.click(within(jobs.container).getByRole('button', { name: /^Upcoming/ }));
    fireEvent.click(within(cardOn(jobs, date)).getByText(date));
    fireEvent.click(within(cardOn(jobs, date)).getByRole('button', { name: 'Cancel this job' }));

    await waitFor(() => expect(row('d5').payment_status).toBe('refunded'));
    expect(rzp('/refund')).toEqual([expect.objectContaining({ path: '/payments/pay_d5/refund', body: expect.objectContaining({ amount: 40000 }) })]);
    expect(row('d5')).toMatchObject({ status: 'cancelled', refunded_amount_paise: 40000, refund_percentage: 100, payout_status: null, cancellation_reason: 'Sitter: Family emergency' });
    expect(notes(IDS.ananya, 'payment_refunded')[0].body).toMatch(/Rs\.400 goes back to your original payment method/);
    await waitFor(() => expect(notes(IDS.ananya, 'booking_cancelled')).toHaveLength(1));
    jobs.unmount();

    const earn = await sitterEarnings();
    expect(tile(earn, 'Upcoming (on hold)')).toBe('Rs. 0.00');
    earn.unmount();
    const parent = await parentBookings();
    fireEvent.click(within(parent.container).getByRole('button', { name: /^Past/ }));
    expect(within(cardOn(parent, date)).getByText('Refunded Rs.400')).toBeInTheDocument();
  });

  test('D6: an admin cancels a captured job 6h before from AdminPanel → Bookings: full refund despite the moderate policy', async () => {
    gatewayOn();
    freezeTime('2026-12-04T01:00:00+05:30');
    heldBooking('d6', '2026-12-04', { payment_mode: 'test', payment_id: 'pay_d6', cancellation_policy: 'moderate' });
    await adminTab('Bookings');
    fireEvent.click(await screen.findByRole('button', { name: 'FUR-D6' }, SLOW));
    fireEvent.click(await screen.findByText('Cancel with full refund'));
    expect(screen.getByText(/The parent gets a full refund of Rs\.400/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Reason for cancelling'), { target: { value: 'Sitter unwell, no cover' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));

    expect(await screen.findByText(/Cancelled with a full refund of Rs\.400/, {}, SLOW)).toBeInTheDocument();
    expect(row('d6')).toMatchObject({ status: 'cancelled', payment_status: 'refunded', refund_percentage: 100, refunded_amount_paise: 40000, payout_status: null, cancellation_reason: 'Fursday: Sitter unwell, no cover' });
    expect(rzp('/refund')[0].body.amount).toBe(40000);
    expect(notes(IDS.ananya, 'booking_cancelled')[0].body).toMatch(/full refund/);
    expect(notes(IDS.priyaUser, 'booking_cancelled')).toHaveLength(1);
    expect(db.rows('admin_audit_logs', { action: 'admin_cancel_booking', resource_id: 'd6' })).toHaveLength(1);
  }, 20000);

  test('D6: a refund Razorpay cannot send (an older payment) is owed, not marked sent, until the admin records sending it', async () => {
    gatewayOn();
    const date = futureDate(9);
    addBooking('d6m', { booking_date: date, status: 'confirmed', payment_status: 'paid', payment_id: 'pay_before_orders' });
    db.signInAs(IDS.ananya);
    expect(await cancelBooking('d6m', 'Change of plans')).toMatchObject({ refund_percentage: 100, outcome: 'refund_manual' });
    expect(rzp('/refund')).toHaveLength(0);
    expect(row('d6m')).toMatchObject({ status: 'cancelled', payment_status: 'paid', refund_amount_paise: 40000, refunded_amount_paise: 0 });
    expect(events('d6m', 'refund_due')).toHaveLength(1);
    expect(events('d6m', 'refunded')).toHaveLength(0);
    const parent = await parentBookings();
    fireEvent.click(within(parent.container).getByRole('button', { name: /^Past/ }));
    expect(within(cardOn(parent, date)).getByText('Refund of Rs.400 is being processed')).toBeInTheDocument();
    parent.unmount();

    await adminTab('Bookings');
    fireEvent.click(await screen.findByRole('button', { name: 'FUR-D6M' }, SLOW));
    expect(await screen.findByText(/Refund of Rs\.400 has not gone back to the parent/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark refund sent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, it was sent' }));
    expect(await screen.findByText('Refund of Rs.400 recorded as sent', {}, SLOW)).toBeInTheDocument();
    expect(row('d6m')).toMatchObject({ payment_status: 'refunded', refunded_amount_paise: 40000 });
    expect(events('d6m', 'refunded')).toEqual([expect.objectContaining({ amount_paise: 40000 })]);
    expect(notes(IDS.ananya, 'payment_refunded')[0].body).toMatch(/^Rs\.400 has been sent back to you/);
    expect(db.rows('admin_audit_logs', { action: 'admin_refund_sent', resource_id: 'd6m' })).toHaveLength(1);
  }, 20000);

  test('D7: an open dispute keeps the payout from being released until it is settled', async () => {
    freezeTime('2026-12-10T10:00:00+05:30');
    doneBooking('d7', '2026-12-08');
    db.insert('disputes', { booking_id: 'd7', status: 'open', reported_by: IDS.ananya, title: 'Walk cut short' });
    db.signInAs(IDS.admin);
    expect(await runReleaseCheck()).toMatchObject({ released: expect.any(Number), disputed: 1 });
    expect(row('d7').payout_status).toBe('disputed');
    expect(events('d7', 'disputed')).toHaveLength(1);
    expect(await runReleaseCheck()).toMatchObject({ disputed: 0 });
    expect(row('d7').payout_status).toBe('disputed');

    const parent = await parentBookings();
    fireEvent.click(within(parent.container).getByRole('button', { name: /^Past/ }));
    expect(within(cardOn(parent, '2026-12-08')).getByText('Rs.400 held while we look into your report')).toBeInTheDocument();
    parent.unmount();
    const earn = await sitterEarnings();
    expect(within(earn.container).getByText('Paused — the parent reported a problem')).toBeInTheDocument();
    earn.unmount();

    db.one('disputes', { booking_id: 'd7' }).status = 'resolved';
    db.signInAs(IDS.admin);
    expect(await runReleaseCheck()).toMatchObject({ disputed: 0 });
    expect(row('d7').payout_status).toBe('ready');
    expect(notes(IDS.priyaUser, 'payout_ready')).toHaveLength(1);
  });

  test('D7: a sitter report on the booking pauses the payout the same way', async () => {
    freezeTime('2026-12-10T10:00:00+05:30');
    doneBooking('d7r', '2026-12-08');
    db.insert('sitter_reports', { booking_id: 'd7r', reported_by: IDS.ananya, reason: 'Late' });
    db.signInAs(IDS.admin);
    await runReleaseCheck();
    expect(row('d7r').payout_status).toBe('disputed');
  });

  test('D8: a promo booking cancelled refunds what was paid, never the pre-promo price', async () => {
    freezeTime('2026-12-01T09:00:00+05:30');
    heldBooking('d8far', '2026-12-09', { gross_amount_paise: 30000, cancellation_policy: 'moderate' });
    heldBooking('d8mid', '2026-12-03', { gross_amount_paise: 30000, cancellation_policy: 'moderate' });
    clearSeedOn('2026-12-03', ['d8mid']);
    db.signInAs(IDS.ananya);
    expect(await cancelBooking('d8far', 'Change of plans')).toMatchObject({ refund_percentage: 100, refund_amount_paise: 30000 });
    expect(row('d8far')).toMatchObject({ payment_status: 'refunded', refunded_amount_paise: 30000, payout_status: null });

    const parent = await parentBookings();
    const shown = await cancelFromCard(parent, '2026-12-03');
    expect(shown).toMatch(/Your refund₹225/);
    await waitFor(() => expect(row('d8mid').status).toBe('cancelled'));
    expect(row('d8mid')).toMatchObject({ refund_percentage: 75, refunded_amount_paise: 22500, payment_status: 'partially_refunded', sitter_payout_paise: 10000, payout_status: 'on_hold' });
    expect(await screen.findByText(/₹225 \(75%\) is on its way back/)).toBeInTheDocument();
  }, 20000);
});

// ─── E. Disbursement ───────────────────────────────────────────────────────

describe('E. Disbursement', () => {
  test('E1: one walk end to end: paid, accepted, done, held 24h by the sweep, released, marked paid, and Priya sees it paid', async () => {
    removeBookings('bk-done', 'bk-done-hi');
    freezeTime('2026-12-01T09:00:00+05:30');
    addBooking('e1', { booking_date: '2026-12-03' });
    db.signInAs(IDS.ananya);
    await simulatePayment('e1');
    const jobs = await sitterJobs();
    fireEvent.click(within(cardOn(jobs, '2026-12-03')).getByRole('button', { name: /Accept/ }));
    await waitFor(() => expect(row('e1').payment_status).toBe('held'));
    jobs.unmount();
    expect(row('e1').payout_release_at).toBe(isoAt('2026-12-03', '07:00', DAY));

    freezeTime('2026-12-03T08:00:00+05:30');
    Object.assign(row('e1'), { status: 'completed', completed_at: new Date().toISOString() });

    freezeTime('2026-12-04T06:59:00+05:30');
    db.signInAs(IDS.admin);
    expect(await runReleaseCheck()).toMatchObject({ released: 0 });
    expect(row('e1').payout_status).toBe('on_hold');
    const early = await sitterEarnings();
    expect(tile(early, 'Upcoming (on hold)')).toBe('Rs. 340.00');
    expect(tile(early, 'Ready — on its way')).toBe('Rs. 0.00');
    early.unmount();

    freezeTime('2026-12-04T07:01:00+05:30');
    await adminTab('Payouts');
    fireEvent.click(await screen.findByRole('button', { name: 'Run release check' }, SLOW));
    expect(await screen.findByText(/1 ready to pay/)).toBeInTheDocument();
    expect(row('e1')).toMatchObject({ payout_status: 'ready' });
    expect(row('e1').released_at).toBeTruthy();
    expect(notes(IDS.priyaUser, 'payout_ready')).toHaveLength(1);
    const priya = await screen.findByRole('region', { name: 'Payouts for Priya Kapoor' }, SLOW);
    expect(within(priya).getByText('UPI priya@okaxis · 1 job')).toBeInTheDocument();
    expect(within(priya).getByText('Sitter gets: Rs.340')).toBeInTheDocument();
    expect(within(priya).getByText(/parent paid Rs\.400/)).toBeInTheDocument();
    fireEvent.click(within(priya).getByRole('button', { name: 'Mark paid' }));

    await waitFor(() => expect(row('e1').payout_status).toBe('paid'));
    expect(notes(IDS.priyaUser, 'payout_marked')[0].body).toBe('Rs. 340 marked as paid');
    expect(events('e1', 'paid_out')).toEqual([expect.objectContaining({ amount_paise: 34000 })]);
    expect(['authorized', 'captured', 'released', 'paid_out'].map(k => events('e1', k).length)).toEqual([1, 1, 1, 1]);
    expect(await screen.findByText('All payouts up to date', {}, SLOW)).toBeInTheDocument();
    cleanup();

    const earn = await sitterEarnings();
    expect(tile(earn, 'Paid to your UPI')).toBe('Rs. 340.00');
    expect(tile(earn, 'Ready — on its way')).toBe('Rs. 0.00');
    expect(within(earn.container).getByText('✓ Paid out')).toBeInTheDocument();
  }, 40000);

  test('E2: Payouts groups by sitter, net of 15% (0% for a Founding sitter); "Mark all paid" pays and notifies once with the net total', async () => {
    doneBooking('e2a', futureDate(-4), { gross_amount_paise: 50000, sitter_payout_paise: 50000, payout_status: 'ready' });
    doneBooking('e2s', futureDate(-4), { sitter_id: IDS.sunita, gross_amount_paise: 30000, sitter_payout_paise: 30000, payout_status: 'ready' });
    await adminTab('Payouts');

    const priya = await screen.findByRole('region', { name: 'Payouts for Priya Kapoor' }, SLOW);
    expect(within(priya).getByText('UPI priya@okaxis · 2 jobs')).toBeInTheDocument();
    expect(within(priya).getByText('Rs.765')).toBeInTheDocument();
    expect(within(priya).getAllByText(/^Sitter gets: Rs\./).map(n => n.textContent).sort()).toEqual(['Sitter gets: Rs.340', 'Sitter gets: Rs.425']);
    const sunita = screen.getByRole('region', { name: 'Payouts for सुनीता देवी' });
    expect(within(sunita).getByText('Founding')).toBeInTheDocument();
    expect(within(sunita).getByText('Sitter gets: Rs.300 (Founding — 0% commission)')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Payouts for राम सिंह' })).getByText('Sitter gets: Rs.340')).toBeInTheDocument();
    expect(screen.getByText('Total due to sitters').parentElement.textContent).toMatch(/Rs\.1,405/);

    fireEvent.click(within(priya).getByRole('button', { name: 'Mark all paid (2)' }));
    expect(screen.getByText(/Only do this after you have sent Rs\.765 to Priya Kapoor \(UPI priya@okaxis\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, mark Rs.765 paid' }));
    await waitFor(() => expect(row('e2a').payout_status).toBe('paid'));
    expect(row('bk-done').payout_status).toBe('paid');
    expect(notes(IDS.priyaUser, 'payout_marked')).toHaveLength(1);
    expect(notes(IDS.priyaUser, 'payout_marked')[0].body).toBe('Rs. 765 marked as paid');
    expect([...events('bk-done', 'paid_out'), ...events('e2a', 'paid_out')].map(e => e.amount_paise).sort()).toEqual([34000, 42500]);

    fireEvent.click(within(await screen.findByRole('region', { name: 'Payouts for सुनीता देवी' }, SLOW)).getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => expect(row('e2s').payout_status).toBe('paid'));
    expect(notes(IDS.sunitaUser, 'payout_marked')[0].body).toBe('Rs. 300 marked as paid');
    expect(row('bk-done-hi').payout_status).not.toBe('paid');
  }, 30000);

  test('E3: Earnings totals for on hold, ready and paid, and the yearly statement, all match the payouts', async () => {
    freezeTime('2026-11-20T12:00:00+05:30');
    removeBookings('bk-done', 'bk-far', 'bk-unpaid');
    doneBooking('e3hold', '2026-11-20', { payout_release_at: isoAt('2026-11-20', '07:00', DAY) });
    doneBooking('e3ready', '2026-11-10', { payout_status: 'ready' });
    doneBooking('e3paid', '2026-10-05', { gross_amount_paise: 50000, sitter_payout_paise: 50000, payout_status: 'paid' });
    doneBooking('e3old', '2026-03-10', { payout_status: 'paid' });
    const earn = await sitterEarnings();
    const c = within(earn.container);

    expect(tile(earn, 'Upcoming (on hold)')).toBe('Rs. 340.00');
    expect(tile(earn, 'Ready — on its way')).toBe('Rs. 340.00');
    expect(tile(earn, 'Paid to your UPI')).toBe('Rs. 765.00');
    expect(c.getByText('Total Earnings (All Time)').nextSibling.textContent).toBe('Rs. 1445.00');

    const statement = () => Object.fromEntries([...earn.container.querySelector('dl').children].map(d => [d.querySelector('dt').textContent, d.querySelector('dd').textContent]));
    expect(statement()).toMatchObject({ 'Booking value': 'Rs. 1300.00', 'Fursday fee': 'Rs. 195.00', 'You earned': 'Rs. 1105.00', 'Completed bookings': '3' });
    fireEvent.click(c.getByRole('button', { name: 'FY 2025–26' }));
    expect(statement()).toMatchObject({ 'Booking value': 'Rs. 400.00', 'Fursday fee': 'Rs. 60.00', 'You earned': 'Rs. 340.00', 'Completed bookings': '1' });
  });

  test('E4: a tip before the payout goes to Priya in full and rides with her payout', async () => {
    removeBookings('bk-done', 'bk-done-hi');
    freezeTime('2026-12-10T10:00:00+05:30');
    doneBooking('e4', '2026-12-09');
    const parent = await parentBookings();
    fireEvent.click(within(parent.container).getByRole('button', { name: /^Past/ }));
    fireEvent.click(within(cardOn(parent, '2026-12-09')).getByText('2026-12-09'));
    fireEvent.click(within(cardOn(parent, '2026-12-09')).getByRole('button', { name: /Add a tip/ }));
    expect(screen.getByText('Every rupee goes to your sitter. Fursday keeps nothing.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tip Rs\.100/ }));
    expect(await screen.findByText('Rs.100 goes to Priya Kapoor in full, with their payout.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(within(cardOn(parent, '2026-12-09')).getByText('Tip Rs.100 sent')).toBeInTheDocument());
    expect(row('e4')).toMatchObject({ tip_paise: 10000, sitter_payout_paise: 50000, gross_amount_paise: 40000 });
    expect(notes(IDS.priyaUser, 'tip_received')[0].title).toBe('You got a Rs.100 tip');
    parent.unmount();

    const earn = await sitterEarnings();
    expect(tile(earn, 'Upcoming (on hold)')).toBe('Rs. 440.00');
    earn.unmount();

    await adminTab('Payouts');
    fireEvent.click(await screen.findByRole('button', { name: 'Release now' }, SLOW));
    const priya = await screen.findByRole('region', { name: 'Payouts for Priya Kapoor' }, SLOW);
    expect(within(priya).getByText('Sitter gets: Rs.440')).toBeInTheDocument();
    fireEvent.click(within(priya).getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => expect(row('e4').payout_status).toBe('paid'));
    expect(notes(IDS.priyaUser, 'payout_marked')[0].body).toBe('Rs. 440 marked as paid');
  }, 30000);

  test('E4: a tip after the payout was paid is listed for the admin to pay separately, in full', async () => {
    doneBooking('e4late', futureDate(-6), { payout_status: 'paid' });
    db.signInAs(IDS.ananya);
    await simulateTip('e4late', 15000);
    expect(events('e4late', 'tip_unpaid')).toEqual([expect.objectContaining({ amount_paise: 15000 })]);

    await adminTab('Payouts');
    const tips = await screen.findByRole('region', { name: 'Tips to pay' }, SLOW);
    expect(within(tips).getByText('FUR-E4LATE · Priya Kapoor')).toBeInTheDocument();
    expect(within(tips).getByText('Tip: Rs.150')).toBeInTheDocument();
    fireEvent.click(within(tips).getByRole('button', { name: 'Mark tip paid' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Tips to pay' })).toBeNull());
    expect(events('e4late', 'tip_paid')).toEqual([expect.objectContaining({ amount_paise: 15000 })]);
    expect(notes(IDS.priyaUser, 'payout_marked')[0].body).toBe('Rs.150 tip sent to your UPI');
  }, 20000);

  test('E4: a gateway tip needs a valid signature; a forged one adds nothing', async () => {
    gatewayOn();
    doneBooking('e4g', futureDate(-2));
    db.signInAs(IDS.ananya);
    const order = await startTip('e4g', 5000);
    expect(payments.orders[0]).toMatchObject({ amount: 5000, notes: { booking_id: 'e4g', purpose: 'tip' } });
    await expect(verifyTip('e4g', { razorpay_order_id: order.order_id, razorpay_payment_id: 'pay_tipx', razorpay_signature: sign(order.order_id, 'pay_tipx', 'wrong') }))
      .rejects.toMatchObject({ code: 'bad_signature' });
    expect(row('e4g').tip_paise || 0).toBe(0);
    await verifyTip('e4g', { razorpay_order_id: order.order_id, razorpay_payment_id: 'pay_tip', razorpay_signature: sign(order.order_id, 'pay_tip') });
    expect(row('e4g')).toMatchObject({ tip_paise: 5000, sitter_payout_paise: 45000 });
    await verifyTip('e4g', { razorpay_order_id: order.order_id, razorpay_payment_id: 'pay_tip', razorpay_signature: sign(order.order_id, 'pay_tip') });
    expect(row('e4g').tip_paise).toBe(5000);
  });

  test('E5: a promo booking pays the sitter on her own price, never on what the parent paid', async () => {
    removeBookings('bk-done', 'bk-done-hi');
    doneBooking('e5', futureDate(-3), { gross_amount_paise: 30000, payout_release_at: new Date(Date.now() - HOUR).toISOString(), completed_at: new Date(Date.now() - 2 * HOUR).toISOString() });
    db.signInAs(IDS.admin);
    expect(await runReleaseCheck()).toMatchObject({ released: 1 });
    expect(events('e5', 'released')[0].amount_paise).toBe(40000);

    const jobs = await sitterJobs();
    expect(within(jobs.container).getByText('This month so far').nextSibling.textContent).toBe('Rs.340');
    jobs.unmount();
    const earn = await sitterEarnings();
    expect(tile(earn, 'Ready — on its way')).toBe('Rs. 340.00');
    expect(within(earn.container).getByText('Booking: Rs. 400.00')).toBeInTheDocument();
    earn.unmount();

    await adminTab('Payouts');
    const priya = await screen.findByRole('region', { name: 'Payouts for Priya Kapoor' }, SLOW);
    expect(within(priya).getByText(/parent paid Rs\.300/)).toBeInTheDocument();
    expect(within(priya).getByText('Sitter gets: Rs.340')).toBeInTheDocument();
  }, 20000);

  test('E6: an admin can release a finished job before its 24h hold ends; the sitter herself and the parent cannot', async () => {
    doneBooking('e6', futureDate(-0.2), { payout_release_at: new Date(Date.now() + 20 * HOUR).toISOString() });
    heldBooking('e6up', futureDate(3));
    db.signInAs(IDS.priyaUser);
    await expect(releasePayout('e6', 'Please pay me now')).rejects.toMatchObject({ status: 403, code: 'forbidden' });
    db.signInAs(IDS.ananya);
    await expect(releasePayout('e6')).rejects.toMatchObject({ status: 403 });
    expect(row('e6').payout_status).toBe('on_hold');
    db.signInAs(IDS.admin);
    await expect(releasePayout('e6up')).rejects.toMatchObject({ status: 409 });

    await adminTab('Payouts');
    const onHold = await screen.findByRole('region', { name: 'On hold' }, SLOW);
    expect(within(within(onHold).getByText(/FUR-E6UP/).parentElement.parentElement).queryByRole('button', { name: 'Release now' })).toBeNull();
    fireEvent.click(within(within(onHold).getByText(/FUR-E6 /).parentElement.parentElement).getByRole('button', { name: 'Release now' }));
    await waitFor(() => expect(row('e6').payout_status).toBe('ready'));
    expect(events('e6', 'released')[0].note).toBe('Released early by Fursday');
    expect(notes(IDS.priyaUser, 'payout_ready')).toHaveLength(1);
    expect(await screen.findByText('FUR-E6', {}, SLOW)).toBeInTheDocument();
  }, 20000);

  test('E6: handing a held booking back (release-hold) works for the sitter or an admin, never for the parent or another sitter', async () => {
    heldBooking('e6r', futureDate(9));
    db.signInAs(IDS.ananya);
    await expect(releaseHold('e6r', 'I want my money back')).rejects.toMatchObject({ status: 403 });
    db.signInAs(IDS.sunitaUser);
    await expect(releaseHold('e6r', 'Not mine')).rejects.toMatchObject({ status: 403 });
    expect(row('e6r')).toMatchObject({ status: 'confirmed', payment_status: 'held', payout_status: 'on_hold' });

    db.signInAs(IDS.admin);
    expect(await releaseHold('e6r', 'Fursday: sitter suspended')).toMatchObject({ outcome: 'refunded' });
    expect(row('e6r')).toMatchObject({ status: 'cancelled', payment_status: 'refunded', refunded_amount_paise: 40000, payout_status: null });
  });
});
