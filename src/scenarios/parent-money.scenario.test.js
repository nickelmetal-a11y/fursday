import React from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import BookingsDashboard from '../BookingsDashboard';
import BookingFlow from '../BookingFlow';
import PaymentScreen from '../PaymentScreen';
import App from '../App';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../geolocationService', () => ({
  checkLocationRestriction: () => Promise.resolve({ allowed: true, ip: '127.0.0.1' }),
  getLocationRestrictedMessage: () => 'Coming soon to your area',
}));

const RealDate = Date;
function freezeTime(target) {
  const offset = target.getTime() - RealDate.now();
  class MockDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(RealDate.now() + offset); else super(...a); }
    static now() { return RealDate.now() + offset; }
  }
  global.Date = MockDate;
}

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
});

afterEach(() => {
  global.Date = RealDate;
});

const PRIYA_FROM_EXPLORE = {
  id: IDS.priya, name: 'Priya Kapoor', area: 'Gurgaon', minPrice: 400,
  services: [{ service_type: 'walk30', price_paise: 40000 }, { service_type: 'boarding', price_paise: 120000 }],
};

async function openDashboard(userId, props = {}) {
  db.signInAs(userId);
  render(<BookingsDashboard city="Gurgaon" onNav={jest.fn()} onPayNow={jest.fn()} {...props} />);
  await waitFor(() => expect(screen.queryByText('Loading your bookings...')).toBeNull());
}

async function expandCard(sitterName) {
  fireEvent.click(await screen.findByText('with ' + sitterName));
}

// Drives BookingsDashboard -> "Cancel this booking" -> CancellationPolicyModal
// through all three steps, returning the text the parent saw on each step.
async function cancelViaPolicy(sitterName, reason = 'Change of plans') {
  await expandCard(sitterName);
  fireEvent.click(screen.getByText('✕ Cancel this booking'));
  const card = screen.getByText('Cancellation Policy').parentElement.parentElement;
  const policyText = card.textContent;
  fireEvent.click(within(card).getByText('Cancel booking'));
  fireEvent.click(screen.getByText(reason));
  const confirmText = screen.getByText('Confirm cancellation').parentElement.textContent;
  fireEvent.click(screen.getByText('Yes, cancel this booking'));
  return { policyText, confirmText };
}

// Drives BookingFlow from the service step to the Review step.
async function walkToReview({ dayIndex = 1, time = '7:00 AM', petName = 'Bruno', skipService = false } = {}) {
  if (!skipService) {
    fireEvent.click(screen.getByText('Request a walker'));
    fireEvent.click(screen.getByText('Continue →'));
  }
  await screen.findByText('Pick a time');
  await new Promise(r => setTimeout(r, 30)); // let the sitter's calendar load
  // Skip the sitter's weekly days off (Priya works Mon–Fri), so the suite passes on any weekday.
  const d = new Date();
  d.setDate(d.getDate() + dayIndex);
  const tileFor = (date) => screen.getAllByText(String(date.getDate()))[0].closest('[role="button"]');
  while (tileFor(d).getAttribute('aria-disabled') === 'true') d.setDate(d.getDate() + 1);
  fireEvent.click(tileFor(d));
  fireEvent.click(screen.getByText(time));
  fireEvent.click(screen.getByText('Continue →'));
  if (petName) fireEvent.click(await screen.findByText(petName));
  else await screen.findByText('Which pet?');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Review booking');
}

function totalShown() {
  return screen.getByText('Total').parentElement.textContent;
}

async function applyPromo(code) {
  fireEvent.change(screen.getByPlaceholderText('Enter code'), { target: { value: code } });
  fireEvent.click(screen.getByText('Apply'));
}

describe('Parent money scenarios', () => {
  test('S1: cancel a paid booking 5 days out (Priya) gives a 100% refund of Rs.400', async () => {
    await openDashboard(IDS.ananya);
    const { policyText, confirmText } = await cancelViaPolicy('Priya Kapoor');

    await waitFor(() => expect(db.one('bookings', { id: 'bk-far' }).status).toBe('cancelled'));
    const row = db.one('bookings', { id: 'bk-far' });
    expect(row.refund_percentage).toBe(100);
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.priyaUser, type: 'booking_cancelled' })).toHaveLength(1));

    expect(policyText).toContain('Full refund (100%)');
    expect(policyText).toMatch(/Your refund\s*₹400/);
    expect(confirmText).toContain('₹400');
    expect(row.refund_amount_paise).toBe(40000);
  });

  test('S1: the quick "Cancel booking" button on the card applies the same refund policy', async () => {
    await openDashboard(IDS.ananya);
    let card = await screen.findByText('with Priya Kapoor');
    while (!within(card).queryByText('Cancel booking')) card = card.parentElement;
    fireEvent.click(within(card).getByText('Cancel booking'));
    // The quick button now opens the same policy sheet as the detailed one.
    const sheet = (await screen.findByText('Keep booking', { exact: false })).closest('div[style*="border-radius: 24px"]');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel booking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change of plans' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel this booking' }));

    await waitFor(() => expect(db.one('bookings', { id: 'bk-far' }).status).toBe('cancelled'));
    const row = db.one('bookings', { id: 'bk-far' });
    expect(row.refund_percentage).toBe(100);
    expect(row.refund_amount_paise).toBe(40000);
    expect(db.rows('notifications', { user_id: IDS.priyaUser, type: 'booking_cancelled' })).toHaveLength(1);
  });

  test('S2: an accepted but unpaid booking offers Pay now and hides the start OTP', async () => {
    db.one('bookings', { id: 'bk-unpaid' }).start_otp = '4321';
    const onPayNow = jest.fn();
    await openDashboard(IDS.rohit, { onPayNow });

    const pay = await screen.findByText('Priya Kapoor accepted! Pay Rs.400 now');
    expect(screen.queryByText('Your start code')).toBeNull();
    expect(screen.queryByText('4321')).toBeNull();
    fireEvent.click(pay);
    expect(onPayNow).toHaveBeenCalledWith(expect.objectContaining({ id: 'bk-unpaid' }));
  });

  test('S2: PaymentScreen says "unsuccessful" on the first failure and "failed again" only after a retry', async () => {
    db.signInAs(IDS.rohit);
    const instances = [];
    window.Razorpay = function FakeRazorpay(options) {
      this.options = options;
      this.handlers = {};
      this.on = (evt, fn) => { this.handlers[evt] = fn; };
      this.open = () => {};
      instances.push(this);
    };
    const b = db.one('bookings', { id: 'bk-unpaid' });
    // Same shape App.js's onPayNow builds from a BookingsDashboard row.
    render(<PaymentScreen city="Gurgaon" onBack={jest.fn()} onSuccess={jest.fn()}
      booking={{ service: b.service_type, amount: b.gross_amount_paise, ref: b.booking_ref, id: b.id }} />);

    fireEvent.click(screen.getByText('Pay Rs.400 securely'));
    expect(instances[0].options.amount).toBe(40000);
    await act(async () => { await instances[0].handlers['payment.failed']({ error: { description: 'Bank declined' } }); });
    expect(screen.getByText('Payment unsuccessful')).toBeInTheDocument();
    expect(screen.queryByText('Payment failed again')).toBeNull();
    expect(db.one('bookings', { id: 'bk-unpaid' }).payment_status).toBe('unpaid');

    fireEvent.click(screen.getByText('Try again'));
    expect(instances).toHaveLength(2);
    await act(async () => { await instances[1].handlers['payment.failed']({ error: { description: 'Bank declined' } }); });
    expect(screen.getByText('Payment failed again')).toBeInTheDocument();
    expect(db.one('bookings', { id: 'bk-unpaid' }).payment_status).toBe('unpaid');
  });

  test('S10: cancelling under 24h before (bk-soon) gives 0% refund and says so', async () => {
    await openDashboard(IDS.rohit);
    const { policyText, confirmText } = await cancelViaPolicy('राम सिंह');

    await waitFor(() => expect(db.one('bookings', { id: 'bk-soon' }).status).toBe('cancelled'));
    const row = db.one('bookings', { id: 'bk-soon' });
    expect(policyText).toMatch(/Your refund\s*₹0\s*No refund/);
    expect(confirmText).toContain('₹0');
    expect(row.refund_percentage).toBe(0);
    expect(row.refund_amount_paise).toBe(0);
  });

  test('S11: cancelling 24-72h before (bk-mid) gives 75% = Rs.300', async () => {
    await openDashboard(IDS.ananya);
    const { policyText, confirmText } = await cancelViaPolicy('सुनीता देवी');

    await waitFor(() => expect(db.one('bookings', { id: 'bk-mid' }).status).toBe('cancelled'));
    const row = db.one('bookings', { id: 'bk-mid' });
    expect(row.refund_percentage).toBe(75);
    expect(policyText).toMatch(/Your refund\s*₹300/);
    expect(confirmText).toContain('₹300');
    expect(row.refund_amount_paise).toBe(30000);
  });

  test('S11: the refund tier counts hours to the booked time slot, not to midnight of the booking date', async () => {
    // Now: 1 Dec 18:00. Booking: 4 Dec 7:00 PM -> 73h away -> should be the 100% tier.
    freezeTime(new RealDate(2026, 11, 1, 18, 0, 0));
    db.insert('bookings', {
      id: 'bk-edge', booking_ref: 'FUR-EDGE', pet_parent_id: IDS.ananya, sitter_id: IDS.ram, pet_id: IDS.bruno,
      city_id: IDS.gurgaon, service_type: 'walk30', status: 'confirmed', payment_status: 'paid',
      booking_date: '2026-12-04', time_slot: '07:00 PM', gross_amount_paise: 40000, sitter_payout_paise: 40000,
    });
    db.one('bookings', { id: 'bk-far' }).status = 'completed';
    db.one('bookings', { id: 'bk-mid' }).status = 'completed';
    await openDashboard(IDS.ananya);
    const { policyText } = await cancelViaPolicy('राम सिंह');

    await waitFor(() => expect(db.one('bookings', { id: 'bk-edge' }).status).toBe('cancelled'));
    expect(policyText).toContain('Full refund (100%)');
    expect(db.one('bookings', { id: 'bk-edge' }).refund_percentage).toBe(100);
  });

  test('S12: a parent can cancel a still-pending request', async () => {
    await openDashboard(IDS.meera);
    await cancelViaPolicy('सुनीता देवी');

    await waitFor(() => expect(db.one('bookings', { id: 'bk-pending' }).status).toBe('cancelled'));
    const row = db.one('bookings', { id: 'bk-pending' });
    expect(row.cancellation_reason).toBe('Change of plans');
    // Nothing was ever paid on a pending request, so nothing can be refunded.
    expect(row.refund_amount_paise || 0).toBe(0);
  });

  test('S18: review validation rejects a short 1-star review, then a valid review is stored', async () => {
    await openDashboard(IDS.ananya);
    fireEvent.click(screen.getByText('Past'));
    await expandCard('Priya Kapoor');
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));

    const modal = screen.getByText('Rate your experience').parentElement.parentElement;
    const headerText = modal.textContent;
    const stars = within(modal).getAllByRole('button').filter(b => b.querySelector('svg') && !b.textContent.trim()).slice(1, 6);
    expect(stars).toHaveLength(5);

    fireEvent.click(stars[0]);
    fireEvent.change(within(modal).getByRole('textbox'), { target: { value: 'bad' } });
    fireEvent.click(within(modal).getByText('Submit review'));
    expect(await within(modal).findByText('Review must be at least 10 characters')).toBeInTheDocument();
    expect(db.rows('reviews')).toHaveLength(0);

    fireEvent.click(stars[4]);
    fireEvent.change(within(modal).getByRole('textbox'), { target: { value: 'Priya was on time and Bruno loved the walk.' } });
    fireEvent.click(within(modal).getByText('Submit review'));
    await waitFor(() => expect(db.rows('reviews')).toHaveLength(1));
    expect(db.rows('reviews')[0]).toMatchObject({
      booking_id: 'bk-done', sitter_id: IDS.priya, reviewer_id: IDS.ananya, rating: 5,
      review_text: 'Priya was on time and Bruno loved the walk.',
    });
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.priyaUser, type: 'review_received' })).toHaveLength(1));

    expect(headerText).toContain('How was your experience with Priya Kapoor?');
  });

  test('S19: a booking that was already reviewed cannot be reviewed again', async () => {
    db.insert('reviews', { booking_id: 'bk-done', sitter_id: IDS.priya, reviewer_id: IDS.ananya, rating: 5, review_text: 'Great walk, very caring.' });
    await openDashboard(IDS.ananya);
    fireEvent.click(screen.getByText('Past'));
    await expandCard('Priya Kapoor');

    const reviewBtn = screen.queryByRole('button', { name: 'Review' });
    if (reviewBtn) {
      fireEvent.click(reviewBtn);
      const modal = screen.getByText('Rate your experience').parentElement.parentElement;
      const stars = within(modal).getAllByRole('button').filter(b => b.querySelector('svg') && !b.textContent.trim()).slice(1, 6);
      fireEvent.click(stars[0]);
      fireEvent.change(within(modal).getByRole('textbox'), { target: { value: 'Changed my mind, it was bad.' } });
      fireEvent.click(within(modal).getByText('Submit review'));
      await act(async () => { await new Promise(r => setTimeout(r, 50)); });
    }
    expect(db.rows('reviews', { booking_id: 'bk-done' })).toHaveLength(1);
    expect(reviewBtn).toBeNull();
  });

  test('S20: reporting a sitter from a completed booking stores a sitter_reports row with the reason', async () => {
    await openDashboard(IDS.ananya);
    fireEvent.click(screen.getByText('Past'));
    await expandCard('Priya Kapoor');
    fireEvent.click(screen.getByText('⚑ Report a problem with this sitter'));
    expect(screen.getByText('Report Priya Kapoor')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sitter was late or no-show'));
    fireEvent.click(screen.getByText('Submit report'));

    await waitFor(() => expect(db.rows('sitter_reports')).toHaveLength(1));
    expect(db.rows('sitter_reports')[0]).toMatchObject({ booking_id: 'bk-done', reason: 'Sitter was late or no-show' });
    expect(await screen.findByText('Report submitted. We will review within 24 hours.')).toBeInTheDocument();
  });

  test('S21: raising a dispute on bk-done records the parent as reporter and the sitter user as reported', async () => {
    await openDashboard(IDS.ananya);
    fireEvent.click(screen.getByText('Past'));
    await expandCard('Priya Kapoor');
    fireEvent.click(screen.getByText('⚖️ Dispute'));
    expect(screen.getByText('File Dispute with Priya Kapoor')).toBeInTheDocument();
    fireEvent.click(screen.getByText('❌ No Show'));
    fireEvent.change(screen.getByPlaceholderText('Brief title of issue'), { target: { value: 'Sitter never came' } });
    fireEvent.change(screen.getByPlaceholderText('Describe what happened...'), { target: { value: 'Waited 45 minutes, no call.' } });
    fireEvent.click(screen.getByText('File Dispute'));

    await waitFor(() => expect(db.rows('disputes')).toHaveLength(1));
    const d = db.rows('disputes')[0];
    expect(d).toMatchObject({ booking_id: 'bk-done', reported_by: IDS.ananya, dispute_type: 'no_show', status: 'open' });
    expect(window.alert).toHaveBeenCalledWith('Dispute filed successfully. Our team will review within 24 hours.');
    expect(d.reported_user_id).toBe(IDS.priyaUser);
  });

  test('S22: promo WELCOME100 at checkout takes Rs.100 off and is redeemed server-side', async () => {
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA_FROM_EXPLORE} city="Gurgaon" />);
    await walkToReview();
    const before = Number(totalShown().match(/Rs\.(\d+)/)[1]);

    await applyPromo('WELCOME100');
    expect(await screen.findByText(/WELCOME100 applied/)).toBeInTheDocument();
    const after = Number(totalShown().match(/Rs\.(\d+)/)[1]);
    expect(before - after).toBe(100);

    fireEvent.click(screen.getByText('Request booking 🐾'));
    await screen.findByText('Booking requested!');
    const rows = db.rows('bookings', { pet_parent_id: IDS.ananya, status: 'pending' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sitter_id: IDS.priya, service_type: 'walk30', pet_id: IDS.bruno, city_id: IDS.gurgaon });
    expect(rows[0].sitter_payout_paise).toBe(before * 100);
    expect(rows[0].gross_amount_paise).toBe(after * 100);
    expect(db.rows('promo_usage', { user_id: IDS.ananya, promo_id: 'promo-welcome', booking_id: rows[0].id })).toHaveLength(1);
    expect(screen.getByText('Rs.' + after)).toBeInTheDocument();
    expect(screen.queryByText(/promo code couldn't be applied/)).toBeNull();
  });

  test("S22: checkout charges the chosen sitter's own price (Priya walk = Rs.400)", async () => {
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA_FROM_EXPLORE} city="Gurgaon" />);
    await walkToReview();
    expect(totalShown()).toContain('Rs.400');
  });

  test('S23: the same parent cannot reuse WELCOME100', async () => {
    db.signInAs(IDS.ananya);
    const first = render(<BookingFlow onBack={jest.fn()} sitter={PRIYA_FROM_EXPLORE} city="Gurgaon" />);
    await walkToReview();
    await applyPromo('WELCOME100');
    await screen.findByText(/WELCOME100 applied/);
    fireEvent.click(screen.getByText('Request booking 🐾'));
    await screen.findByText('Booking requested!');
    first.unmount();

    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA_FROM_EXPLORE} city="Gurgaon" />);
    await walkToReview({ dayIndex: 2 });
    const before = totalShown();
    await applyPromo('WELCOME100');
    expect(await screen.findByText("You've already used this code")).toBeInTheDocument();
    expect(screen.queryByText(/WELCOME100 applied/)).toBeNull();
    expect(totalShown()).toBe(before);
    expect(db.rows('promo_usage', { user_id: IDS.ananya })).toHaveLength(1);
  });

  test('S24: booking cannot continue past the pet step without the aggression disclosure', async () => {
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA_FROM_EXPLORE} city="Gurgaon" />);
    fireEvent.click(screen.getByText('Request a walker'));
    fireEvent.click(screen.getByText('Continue →'));
    await screen.findByText('Pick a time');
    fireEvent.click(screen.getAllByText(String(new Date(Date.now() + 86400000).getDate()))[0]);
    fireEvent.click(screen.getByText('7:00 AM'));
    fireEvent.click(screen.getByText('Continue →'));
    fireEvent.click(await screen.findByText('Bruno'));
    expect(screen.getByRole('checkbox')).not.toBeChecked();

    fireEvent.click(screen.getByText('Continue →'));
    expect(screen.getByText('Please confirm your dog does not have aggression issues')).toBeInTheDocument();
    expect(screen.getByText('Which pet?')).toBeInTheDocument();
    expect(screen.queryByText('Review booking')).toBeNull();
    expect(db.rows('bookings', { status: 'pending', pet_parent_id: IDS.ananya })).toHaveLength(0);
  });

  test('S25: a hot late-morning slot in May shows the heat advisory', async () => {
    freezeTime(new RealDate(2026, 4, 14, 8, 0, 0));
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA_FROM_EXPLORE} city="Gurgaon" />);
    await walkToReview({ dayIndex: 0, time: '11:00 AM' });
    expect(screen.getByText('Heat Advisory')).toBeInTheDocument();
    expect(screen.getByText(/It's hot outside/)).toBeInTheDocument();
  });

  test('S33: "Book again" on a completed booking opens BookingFlow prefilled with the same sitter, service and pet', async () => {
    db.signInAs(IDS.ananya);
    render(<App />);
    fireEvent.click(await screen.findByText('Bookings'));
    await waitFor(() => expect(screen.queryByText('Loading your bookings...')).toBeNull());
    fireEvent.click(screen.getByText('Past'));
    await expandCard('Priya Kapoor');
    fireEvent.click(screen.getByText('↻ Book again'));

    expect(await screen.findByText('Book a sitter')).toBeInTheDocument();
    expect(screen.getByText(/Priya Kapoor ·/)).toBeInTheDocument();
    // Service is prefilled, so the flow starts on the Schedule step.
    await walkToReview({ skipService: true, petName: null });
    const summary = screen.getByText('Review booking').parentElement.textContent;
    expect(summary).toContain('Priya Kapoor');
    expect(summary).toContain('Request a walker · 30 minutes');
    expect(summary).toContain('Bruno (Labrador)');

    fireEvent.click(screen.getByText('Request booking 🐾'));
    await screen.findByText('Booking requested!');
    const rows = db.rows('bookings', { pet_parent_id: IDS.ananya, status: 'pending' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sitter_id: IDS.priya, service_type: 'walk30', pet_id: IDS.bruno });
  });
});
