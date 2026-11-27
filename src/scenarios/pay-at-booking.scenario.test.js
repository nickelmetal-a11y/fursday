// Pay when booking, sitter paid after the service. The real payments server
// (api/payments/[action].js) runs against the in-memory database through
// src/testing/fakePayments.js, so these follow the money end to end.
import React from 'react';
import crypto from 'crypto';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { payments } from '../testing/fakePayments';
import { buildSeed, IDS } from '../testing/seed';
import BookingFlow from '../BookingFlow';
import BookingsDashboard from '../BookingsDashboard';
import SitterDashboard from '../SitterDashboard';
import SitterEarningsDashboard from '../SitterEarningsDashboard';
import AdminPayouts from '../AdminPayouts';
import PaymentScreen from '../PaymentScreen';
import AdminBookings from '../AdminBookings';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../paymentsClient', () => require('../testing/fakePayments'));
jest.mock('../emailService', () => {
  const ok = () => Promise.resolve({ success: true });
  return new Proxy({}, { get: (_t, k) => (k === '__esModule' ? true : ok) });
});

const DAY = 24 * 3600 * 1000;
const isoDate = (offsetMs) => new Date(Date.now() + offsetMs).toISOString().split('T')[0];
const LOADING = /Loading your jobs|Loading your bookings|Loading earnings/;
const settle = async (r) => { await waitFor(() => expect(within(r.container).queryByText(LOADING)).toBeNull()); return r; };
const CARD = 'div[style*="border-radius: 20px"][style*="margin-bottom: 12px"]';
const cardFor = (r, b) => within(r.container).getByText(b.booking_date).closest(CARD);
const cardByTime = (r, b) => within(r.container).getByText(b.time_slot).closest(CARD);
const PRIYA_FROM_EXPLORE = { id: IDS.priya, name: 'Priya Kapoor', area: 'Gurgaon' };
const notes = (userId, type) => db.rows('notifications', { user_id: userId, type });
const events = (bookingId, kind) => db.rows('payment_events', { booking_id: bookingId, kind });

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  payments.reset();
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  db.one('users', { id: IDS.ananya }).email = 'fursday.test.ananya@example.com';
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn(() => 'Feeling unwell');
});

function addBooking(id, extra) {
  return db.insert('bookings', {
    id, booking_ref: 'FUR-' + id.toUpperCase(), city_id: IDS.gurgaon, pet_parent_id: IDS.ananya, sitter_id: IDS.priya, pet_id: IDS.bruno,
    service_type: 'walk30', time_slot: '07:00 AM', gross_amount_paise: 40000, sitter_payout_paise: 40000, status: 'pending',
    payment_status: 'authorized', payment_mode: 'simulated', payment_id: 'sim_' + id, paid_at: new Date().toISOString(), ...extra,
  });
}

// BookingFlow from the service step to Review, skipping Priya's days off (she works Mon–Fri).
async function walkToReview() {
  fireEvent.click(screen.getByText('Request a walker'));
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Pick a time');
  await new Promise(r => setTimeout(r, 30));
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const tileFor = (date) => screen.getAllByText(String(date.getDate()))[0].closest('[role="button"]');
  while (tileFor(d).getAttribute('aria-disabled') === 'true') d.setDate(d.getDate() + 1);
  fireEvent.click(tileFor(d));
  fireEvent.click(screen.getByText('7:00 AM'));
  fireEvent.click(screen.getByText('Continue →'));
  fireEvent.click(await screen.findByText('Bruno'));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Review booking');
}

describe('Paying at booking', () => {
  test('a test account pays while booking: the money is held, Priya hears about a paid request, nothing is captured yet', async () => {
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA_FROM_EXPLORE} city="Gurgaon" />);
    await walkToReview();
    fireEvent.click(screen.getByText('Request booking 🐾'));

    expect(await screen.findByText('Test account: this is a pretend payment. No real money moves.')).toBeInTheDocument();
    expect(screen.getByText(/You're only charged once Priya Kapoor accepts/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pay Rs.400 (test payment)' }));

    expect(await screen.findByText(/Rs\.400 is held safely\. You are only charged when Priya Kapoor accepts/)).toBeInTheDocument();
    const [row] = db.rows('bookings', { pet_parent_id: IDS.ananya, status: 'pending' });
    expect(row).toMatchObject({ payment_status: 'authorized', payment_mode: 'simulated', gross_amount_paise: 40000 });
    expect(row.captured_at).toBeFalsy();
    expect(events(row.id, 'authorized')).toHaveLength(1);
    expect(notes(IDS.priyaUser, 'booking_request')).toHaveLength(1);
    expect(notes(IDS.priyaUser, 'booking_request')[0].body).toMatch(/paid Rs\.400 .* held safely/);
  });

  test('a real customer while online payments are off books as before: request sent, pay after the sitter accepts', async () => {
    db.signInAs(IDS.rohit);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA_FROM_EXPLORE} city="Gurgaon" />);
    fireEvent.click(screen.getByText('Request a walker'));
    fireEvent.click(screen.getByText('Continue →'));
    await screen.findByText('Pick a time');
    await new Promise(r => setTimeout(r, 30));
    const d = new Date(); d.setDate(d.getDate() + 1);
    const tileFor = (date) => screen.getAllByText(String(date.getDate()))[0].closest('[role="button"]');
    while (tileFor(d).getAttribute('aria-disabled') === 'true') d.setDate(d.getDate() + 1);
    fireEvent.click(tileFor(d));
    fireEvent.click(screen.getByText('7:00 AM'));
    fireEvent.click(screen.getByText('Continue →'));
    fireEvent.click(await screen.findByText('Coco'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Continue →'));
    await screen.findByText('Review booking');
    fireEvent.click(screen.getByText('Request booking 🐾'));

    expect(await screen.findByText('Booking requested!')).toBeInTheDocument();
    expect(screen.getByText(/Payment is collected after Priya Kapoor accepts/)).toBeInTheDocument();
    const rows = db.rows('bookings', { pet_parent_id: IDS.rohit, status: 'pending' });
    expect(rows).toHaveLength(1);
    expect(rows[0].payment_status || 'unpaid').toBe('unpaid');
    expect(payments.calls.map(c => c.action)).toEqual(['create-order']);
  });

  test('before migration 037 runs, booking still works and nothing pretends to be paid', async () => {
    payments.migrated = false;
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA_FROM_EXPLORE} city="Gurgaon" />);
    await walkToReview();
    fireEvent.click(screen.getByText('Request booking 🐾'));
    expect(await screen.findByText('Booking requested!')).toBeInTheDocument();
    expect(db.rows('bookings', { pet_parent_id: IDS.ananya, status: 'pending' })[0].payment_status || 'unpaid').toBe('unpaid');
  });

  test('Razorpay checkout: the order uses the DB price and a correctly signed payment is held', async () => {
    process.env.RAZORPAY_KEY_ID = 'rzp_test_scenario';
    process.env.RAZORPAY_KEY_SECRET = 'scenario-secret';
    const b = addBooking('bk-rz', { payment_status: 'unpaid', payment_mode: null, payment_id: null, paid_at: null, booking_date: isoDate(6 * DAY) });
    const instances = [];
    window.Razorpay = function FakeRazorpay(options) { this.options = options; this.on = () => {}; this.open = () => {}; instances.push(this); };
    db.signInAs(IDS.ananya);
    render(<PaymentScreen onBack={jest.fn()} onSuccess={jest.fn()} booking={{ id: b.id, amount: 1, service: 'Walk', ref: b.booking_ref, sitterName: 'Priya Kapoor' }} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Pay Rs.400 securely' }));
    const { options } = instances[0];
    expect(options).toMatchObject({ key: 'rzp_test_scenario', amount: 40000, order_id: db.one('bookings', { id: 'bk-rz' }).razorpay_order_id });
    const signature = crypto.createHmac('sha256', 'scenario-secret').update(options.order_id + '|pay_abc').digest('hex');
    await act(async () => { await options.handler({ razorpay_order_id: options.order_id, razorpay_payment_id: 'pay_abc', razorpay_signature: signature }); });

    expect(await screen.findByText('Payment done!')).toBeInTheDocument();
    expect(db.one('bookings', { id: 'bk-rz' })).toMatchObject({ payment_status: 'authorized', payment_id: 'pay_abc', payment_mode: 'test' });
  });
});

describe('Sitter answers a paid request', () => {
  test('Priya accepts: the money is captured and held until 24h after the walk, and Ananya sees that', async () => {
    const b = addBooking('bk-acc', { booking_date: isoDate(6 * DAY) });
    db.signInAs(IDS.priyaUser);
    const dash = await settle(render(<SitterDashboard city="Gurgaon" onBack={() => {}} />));
    fireEvent.click(within(cardFor(dash, b)).getByRole('button', { name: /Accept/ }));

    await waitFor(() => expect(db.one('bookings', { id: 'bk-acc' }).payment_status).toBe('held'));
    const row = db.one('bookings', { id: 'bk-acc' });
    expect(row).toMatchObject({ status: 'confirmed', payout_status: 'on_hold' });
    expect(row.payout_release_at).toBe(new Date(new Date(b.booking_date + 'T07:00:00+05:30').getTime() + DAY).toISOString());
    expect(events('bk-acc', 'captured')).toHaveLength(1);
    await waitFor(() => expect(notes(IDS.ananya, 'booking_accepted')).toHaveLength(1));
    expect(notes(IDS.ananya, 'booking_accepted')[0].body).toMatch(/Rs\.400 is held safely/);
    dash.unmount();

    db.signInAs(IDS.ananya);
    const parent = await settle(render(<BookingsDashboard city="Gurgaon" onBack={() => {}} onNav={() => {}} onPayNow={jest.fn()} />));
    expect(within(cardFor(parent, b)).getByText('Rs.400 held safely — paid to Priya Kapoor 24h after the walk')).toBeInTheDocument();
    expect(within(cardFor(parent, b)).queryByText(/Pay Rs\.400 now/)).toBeNull();
  });

  test('Priya declines: the hold is released and Ananya is told there is no charge', async () => {
    const b = addBooking('bk-dec', { booking_date: isoDate(7 * DAY) });
    db.signInAs(IDS.priyaUser);
    const dash = await settle(render(<SitterDashboard city="Gurgaon" onBack={() => {}} />));
    fireEvent.click(within(cardFor(dash, b)).getByRole('button', { name: 'Decline' }));

    await waitFor(() => expect(db.one('bookings', { id: 'bk-dec' }).payment_status).toBe('voided'));
    expect(db.one('bookings', { id: 'bk-dec' }).status).toBe('cancelled');
    expect(notes(IDS.ananya, 'payment_released')[0].title).toBe('No charge — your hold was released');
    dash.unmount();

    db.signInAs(IDS.ananya);
    const parent = await settle(render(<BookingsDashboard city="Gurgaon" onBack={() => {}} onNav={() => {}} onPayNow={jest.fn()} />));
    fireEvent.click(within(parent.container).getByRole('button', { name: /^Past/ }));
    expect(within(cardFor(parent, b)).getByText('No charge — your hold was released')).toBeInTheDocument();
  });

  test('if the payments server is unreachable, Priya can still accept and the daily sweep captures later', async () => {
    addBooking('bk-off', { booking_date: isoDate(6 * DAY) });
    payments.offline = true;
    db.signInAs(IDS.priyaUser);
    const dash = await settle(render(<SitterDashboard city="Gurgaon" onBack={() => {}} />));
    fireEvent.click(within(cardFor(dash, db.one('bookings', { id: 'bk-off' }))).getByRole('button', { name: /Accept/ }));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-off' }).status).toBe('confirmed'));
    expect(db.one('bookings', { id: 'bk-off' }).payment_status).toBe('authorized');

    payments.offline = false;
    db.signInAs(IDS.admin);
    render(<AdminPayouts bookings={db.table('bookings')} sitters={db.table('sitter_profiles')} showMsg={jest.fn()} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run release check' }));
    expect(await screen.findByText(/1 captured/)).toBeInTheDocument();
    expect(db.one('bookings', { id: 'bk-off' }).payment_status).toBe('held');
  });
});

describe('Sitter or Fursday cancels an accepted paid job', () => {
  test('Priya cancels: Ananya gets the whole amount back', async () => {
    const b = addBooking('bk-sc', { status: 'confirmed', payment_status: 'held', payout_status: 'on_hold', booking_date: isoDate(7 * DAY) });
    db.signInAs(IDS.priyaUser);
    const dash = await settle(render(<SitterDashboard city="Gurgaon" onBack={() => {}} />));
    fireEvent.click(within(dash.container).getByRole('button', { name: /^Upcoming/ }));
    fireEvent.click(within(cardFor(dash, b)).getByText(b.booking_date));
    fireEvent.click(within(cardFor(dash, b)).getByRole('button', { name: 'Cancel this job' }));

    await waitFor(() => expect(db.one('bookings', { id: 'bk-sc' }).payment_status).toBe('refunded'));
    expect(db.one('bookings', { id: 'bk-sc' })).toMatchObject({ status: 'cancelled', refunded_amount_paise: 40000, payout_status: null });
    expect(notes(IDS.ananya, 'payment_refunded')).toHaveLength(1);
  });

  test('an admin cancels a held booking: the server refunds it in full', async () => {
    addBooking('bk-adm', { status: 'confirmed', payment_status: 'held', payout_status: 'on_hold', booking_date: isoDate(0.2 * DAY) });
    db.signInAs(IDS.admin);
    const bookings = db.table('bookings').map(b => ({ ...b, users: db.one('users', { id: b.pet_parent_id }) }));
    const sitters = db.table('sitter_profiles').map(s => ({ ...s, users: db.one('users', { id: s.user_id }) }));
    render(<AdminBookings bookings={bookings} sitters={sitters} focusId="bk-adm" onChanged={() => {}} />);
    fireEvent.click(await screen.findByText('Cancel with full refund'));
    fireEvent.change(screen.getByLabelText('Reason for cancelling'), { target: { value: 'Sitter unwell' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));

    await waitFor(() => expect(db.one('bookings', { id: 'bk-adm' }).payment_status).toBe('refunded'));
    expect(db.one('bookings', { id: 'bk-adm' })).toMatchObject({ status: 'cancelled', refund_percentage: 100, refunded_amount_paise: 40000, cancellation_reason: 'Fursday: Sitter unwell' });
    expect(await screen.findByText(/Cancelled with a full refund of Rs\.400/)).toBeInTheDocument();
  });
});

describe('Parent cancels a paid booking', () => {
  test('48h before: the server applies the 75% tier and Ananya sees the refund', async () => {
    const start = new Date(Date.now() + 48 * 3600 * 1000 + 5.5 * 3600 * 1000).toISOString();
    const b = addBooking('bk-can', {
      status: 'confirmed', payment_status: 'held', payout_status: 'on_hold', captured_at: new Date().toISOString(),
      booking_date: start.slice(0, 10), time_slot: start.slice(11, 16),
    });
    db.signInAs(IDS.ananya);
    const parent = await settle(render(<BookingsDashboard city="Gurgaon" onBack={() => {}} onNav={() => {}} onPayNow={jest.fn()} />));
    fireEvent.click(within(cardByTime(parent, b)).getByRole('button', { name: 'Cancel booking' }));
    expect(screen.getByText('Your refund').parentElement.textContent).toMatch(/₹300/);
    fireEvent.click(within(screen.getByText('Keep booking').closest('div[style*="border-radius: 24px"]')).getByRole('button', { name: 'Cancel booking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change of plans' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel this booking' }));

    await waitFor(() => expect(db.one('bookings', { id: 'bk-can' }).status).toBe('cancelled'));
    expect(db.one('bookings', { id: 'bk-can' })).toMatchObject({ payment_status: 'partially_refunded', refunded_amount_paise: 30000, refund_percentage: 75, payout_status: null });
    expect(payments.calls.find(c => c.action === 'cancel')).toEqual({ action: 'cancel', booking_id: 'bk-can', reason: 'Change of plans' });
    await waitFor(() => expect(within(parent.container).getByRole('button', { name: /^Past/ })).toBeInTheDocument());
    fireEvent.click(within(parent.container).getByRole('button', { name: /^Past/ }));
    expect(await within(parent.container).findByText('Refunded Rs.300 of Rs.400')).toBeInTheDocument();
  });

  test('before Priya answers: cancelling releases the whole hold, whatever the timing', async () => {
    const b = addBooking('bk-early', { booking_date: isoDate(0.3 * DAY), time_slot: '11:11 PM' });
    db.signInAs(IDS.ananya);
    const parent = await settle(render(<BookingsDashboard city="Gurgaon" onBack={() => {}} onNav={() => {}} onPayNow={jest.fn()} />));
    fireEvent.click(within(cardByTime(parent, b)).getByRole('button', { name: 'Cancel booking' }));
    expect(screen.getByText('No charge — your hold is released in full')).toBeInTheDocument();
    fireEvent.click(within(screen.getByText('Keep booking').closest('div[style*="border-radius: 24px"]')).getByRole('button', { name: 'Cancel booking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change of plans' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel this booking' }));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-early' }).payment_status).toBe('voided'));
  });
});

describe('Paying the sitter after the service', () => {
  test('the release check makes a finished job Ready; a job still inside its hold is listed with its date and cannot be marked paid', async () => {
    addBooking('bk-due', { status: 'completed', payment_status: 'held', payout_status: 'on_hold', payout_release_at: new Date(Date.now() - 3600e3).toISOString(), booking_date: isoDate(-6 * DAY), completed_at: new Date(Date.now() - 2 * DAY).toISOString() });
    addBooking('bk-wait', { status: 'confirmed', payment_status: 'held', payout_status: 'on_hold', payout_release_at: new Date(Date.now() + 3 * DAY).toISOString(), booking_date: isoDate(2 * DAY) });
    db.table('bookings').forEach(b => { if (['bk-done', 'bk-done-hi'].includes(b.id)) b.payout_status = 'paid'; });
    db.signInAs(IDS.admin);
    const sitters = db.table('sitter_profiles').map(s => ({ ...s, users: db.one('users', { id: s.user_id }) }));
    const view = render(<AdminPayouts bookings={db.table('bookings').map(b => ({ ...b }))} sitters={sitters} showMsg={jest.fn()} onChanged={jest.fn()} />);

    expect(screen.getByText('All payouts up to date')).toBeInTheDocument();
    const onHold = screen.getByRole('region', { name: 'On hold' });
    expect(within(onHold).getByText(/FUR-BK-WAIT/)).toBeInTheDocument();
    expect(within(onHold).getByText(/FUR-BK-DUE/)).toBeInTheDocument();
    expect(within(onHold).queryByRole('button', { name: 'Mark paid' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Run release check' }));
    expect(await screen.findByText(/1 ready to pay/)).toBeInTheDocument();
    expect(db.one('bookings', { id: 'bk-due' })).toMatchObject({ payout_status: 'ready' });
    expect(db.one('bookings', { id: 'bk-wait' }).payout_status).toBe('on_hold');
    expect(notes(IDS.priyaUser, 'payout_ready')).toHaveLength(1);

    view.rerender(<AdminPayouts bookings={db.table('bookings').map(b => ({ ...b }))} sitters={sitters} showMsg={jest.fn()} onChanged={jest.fn()} />);
    const ready = screen.getByRole('region', { name: 'Payouts for Priya Kapoor' });
    expect(within(ready).getByText('FUR-BK-DUE')).toBeInTheDocument();
    fireEvent.click(within(ready).getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-due' }).payout_status).toBe('paid'));
  });

  test('an open dispute pauses the payout, and Priya sees it is under review', async () => {
    addBooking('bk-disp', { status: 'completed', payment_status: 'held', payout_status: 'on_hold', payout_release_at: new Date(Date.now() - 3600e3).toISOString(), booking_date: isoDate(-6 * DAY), completed_at: new Date(Date.now() - 2 * DAY).toISOString() });
    addBooking('bk-up', { status: 'confirmed', payment_status: 'held', payout_status: 'on_hold', payout_release_at: new Date(Date.now() + 3 * DAY).toISOString(), booking_date: isoDate(2 * DAY) });
    db.insert('disputes', { booking_id: 'bk-disp', status: 'open', reported_by: IDS.ananya, title: 'Walk cut short' });
    db.signInAs(IDS.admin);
    render(<AdminPayouts bookings={[]} sitters={[]} showMsg={jest.fn()} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run release check' }));
    expect(await screen.findByText(/1 paused for a dispute/)).toBeInTheDocument();
    expect(db.one('bookings', { id: 'bk-disp' }).payout_status).toBe('disputed');

    db.signInAs(IDS.priyaUser);
    const earn = await settle(render(<SitterEarningsDashboard city="Gurgaon" onBack={() => {}} />));
    const c = within(earn.container);
    expect(c.getByText('Upcoming payouts')).toBeInTheDocument();
    expect(c.getByText('Paused — the parent reported a problem')).toBeInTheDocument();
    expect(c.getByText(/^Releases /)).toBeInTheDocument();
    expect(c.getByText('Upcoming (on hold)').parentElement.nextSibling.textContent).toBe('Rs. 680.00');
  });
});
