/**
 * Unit tests for BookingsDashboard.js — covers loadBookings' contact-merging
 * fix from this session (sitter phone switched from a direct users(phone)
 * embed to the get_user_contact() RPC, see CLAUDE.md Session 10) and the
 * core cancel/no-show flows.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingsDashboard from './BookingsDashboard';

let updateCalls, rpcCalls;
let notifyNoShowMock;

jest.mock('./supportContact', () => ({
  useSupportContact: () => ({ phone: null }),
  callSupport: jest.fn(),
}));

// The real src/i18n.js dictionary doesn't have BookingsDashboard's new
// bookings_* keys yet — they're merged in separately (see CLAUDE.md i18n
// rollout notes) to avoid concurrent-edit conflicts on that shared file.
// Mocking useLanguage() here keeps this test's assertions (plain English
// strings) stable regardless of when that merge lands, same as every other
// dependency already mocked in this file.
jest.mock('./i18n', () => ({
  registerTranslations: () => {},
  useLanguage: () => ({
    lang: 'en',
    setLang: () => {},
    t: (key, vars) => {
      const dict = {
        bookings_noUpcoming: 'No upcoming bookings',
        bookings_cancelBooking: 'Cancel booking',
        bookings_call: 'Call',
        bookings_message: 'Message',
      };
      let str = dict[key] ?? key;
      if (vars) Object.keys(vars).forEach(k => { str = str.replace('{' + k + '}', vars[k]); });
      return str;
    },
  }),
}));

jest.mock('./notificationService', () => ({
  notifyNoShow: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./ReviewModal', () => () => <div>ReviewModal</div>);
jest.mock('./CancellationPolicyModal', () => () => <div>CancellationPolicyModal</div>);
jest.mock('./ReceiptModal', () => () => <div>ReceiptModal</div>);
jest.mock('./DisputeForm', () => () => <div>DisputeForm</div>);

jest.mock('./supabase', () => {
  const makeSingleChain = (resolveValue) => ({
    select: () => makeSingleChain(resolveValue),
    eq: () => makeSingleChain(resolveValue),
    single: () => Promise.resolve(resolveValue),
  });
  const bookingsTable = {
    select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: global.__bookings }) }) }),
    update: (fields) => { global.__updateCalls.push(fields); return { eq: () => Promise.resolve({ error: null }) }; },
  };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'parent-1', email: 'parent@test.com', phone: '9000000000' } } }) },
      from: (table) => {
        if (table === 'bookings') return bookingsTable;
        return makeSingleChain({ data: null });
      },
      rpc: (fn, args) => {
        global.__rpcCalls.push({ fn, args });
        return Promise.resolve({ data: [{ phone: '9111111111', email: 'sitter@test.com' }], error: null });
      },
    },
  };
});

function makeBooking(overrides = {}) {
  return {
    id: 'booking-1',
    status: 'confirmed',
    service_type: 'walk30',
    booking_date: '2026-12-01',
    time_slot: '09:00',
    gross_amount_paise: 34900,
    payment_status: 'paid',
    sitter_profiles: { id: 'sitter-profile-9', user_id: 'sitter-user-9', users: { name: 'Priya' }, rating: 4.8 },
    ...overrides,
  };
}

beforeEach(() => {
  global.__bookings = [];
  global.__updateCalls = [];
  global.__rpcCalls = [];
  updateCalls = global.__updateCalls;
  rpcCalls = global.__rpcCalls;
  notifyNoShowMock = require('./notificationService').notifyNoShow;
  notifyNoShowMock.mockClear();
  window.alert = jest.fn();
  window.confirm = jest.fn().mockReturnValue(true);
});

describe('BookingsDashboard', () => {

  test('shows an empty state when there are no upcoming bookings', async () => {
    render(<BookingsDashboard onBack={() => {}} city="Gurgaon" />);
    expect(await screen.findByText('No upcoming bookings')).toBeInTheDocument();
  });

  test('resolves the sitter phone via get_user_contact and shows the Call button', async () => {
    global.__bookings = [makeBooking()];
    render(<BookingsDashboard onBack={() => {}} city="Gurgaon" />);

    await waitFor(() => expect(rpcCalls).toContainEqual({ fn: 'get_user_contact', args: { target_id: 'sitter-user-9' } }));
    const callLink = await screen.findByText('Call');
    expect(callLink.closest('a')).toHaveAttribute('href', 'tel:9111111111');
  });

  test('passes the sitter real user id (not sitter_profiles.id) up through onMessage', async () => {
    global.__bookings = [makeBooking()];
    const onMessage = jest.fn();
    render(<BookingsDashboard onBack={() => {}} city="Gurgaon" onMessage={onMessage} />);

    fireEvent.click(await screen.findByText('Message'));
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'booking-1' }),
      'Priya',
      '9111111111',
      'sitter-user-9'
    );
  });

  test('the quick Cancel button opens the refund-policy sheet instead of cancelling blind', async () => {
    global.__bookings = [makeBooking({ status: 'pending' })];
    render(<BookingsDashboard onBack={() => {}} city="Gurgaon" />);

    fireEvent.click(await screen.findByText('Cancel booking'));
    expect(await screen.findByText('CancellationPolicyModal')).toBeInTheDocument();
    expect(updateCalls).toHaveLength(0);
  });

  test('a held payment shows where the money is, and the start code, with no Pay button', async () => {
    global.__bookings = [makeBooking({ payment_status: 'held', payout_status: 'on_hold', start_otp: '4321' })];
    render(<BookingsDashboard onBack={() => {}} city="Gurgaon" />);
    expect(await screen.findByText('pay_lineHeld')).toBeInTheDocument();
    expect(screen.getByText('4321')).toBeInTheDocument();
    expect(screen.queryByText('bookings_payNowCta')).toBeNull();
  });

  test('a request on hold waits for the sitter; an unfinished checkout and an accepted unpaid booking can be paid', async () => {
    const onPayNow = jest.fn();
    global.__bookings = [
      makeBooking({ id: 'held', status: 'pending', payment_status: 'authorized' }),
      makeBooking({ id: 'left', status: 'pending', payment_status: 'unpaid', razorpay_order_id: 'order_9' }),
      makeBooking({ id: 'accepted', status: 'confirmed', payment_status: 'unpaid' }),
    ];
    render(<BookingsDashboard onBack={() => {}} city="Gurgaon" onPayNow={onPayNow} />);
    expect(await screen.findByText('pay_lineAuthorized')).toBeInTheDocument();
    fireEvent.click(screen.getByText('bookings_finishPaymentCta'));
    fireEvent.click(screen.getByText('bookings_payNowCta'));
    expect(onPayNow.mock.calls.map(c => c[0].id)).toEqual(['left', 'accepted']);
  });

  test('an active booking past its time by over an hour triggers a no-show notification to self', async () => {
    const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000);
    global.__bookings = [makeBooking({
      status: 'active',
      booking_date: pastTime.toISOString().split('T')[0],
      time_slot: pastTime.toISOString().slice(11, 16),
    })];
    render(<BookingsDashboard onBack={() => {}} city="Gurgaon" />);

    await waitFor(() => expect(notifyNoShowMock).toHaveBeenCalledWith(
      'parent-1', 'parent@test.com', '9000000000', 'Priya', undefined
    ));
  });
});
