/**
 * Unit tests for PaymentScreen.js — the Razorpay checkout screen. This is
 * the highest financial-risk untested code in the app before this suite:
 * it marks a booking paid/confirmed and fires the booking-confirmed /
 * payment-failed notifications. window.Razorpay is a fake stand-in for the
 * real externally-loaded script, which jsdom never actually runs.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PaymentScreen from './PaymentScreen';

let updateCalls, rpcCalls, razorpayInstances;
let notifyBookingConfirmedMock, notifyPaymentFailedMock;

jest.mock('./notificationService', () => ({
  notifyBookingConfirmed: jest.fn().mockResolvedValue(undefined),
  notifyPaymentFailed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./supabase', () => {
  const updateChain = {
    eq: () => Promise.resolve({ error: global.__updateError }),
  };
  const listChain = {
    select: () => listChain,
    eq: () => listChain,
    single: () => Promise.resolve({ data: global.__bookingRow }),
  };
  const bookingsTable = {
    update: (fields) => { global.__updateCalls.push(fields); return updateChain; },
    select: () => listChain,
  };
  return {
    supabase: {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'parent-1', email: 'parent@test.com' } } }),
      },
      from: (table) => {
        if (table === 'bookings') return bookingsTable;
        throw new Error('unexpected table: ' + table);
      },
      rpc: (fn, args) => {
        global.__rpcCalls.push({ fn, args });
        const contact = args.target_id === 'sitter-user-9'
          ? { email: 'sitter@test.com', phone: '9111111111' }
          : { email: 'parent2@test.com', phone: '9000000000' };
        return Promise.resolve({ data: [contact], error: null });
      },
    },
  };
});

function makeBooking(overrides = {}) {
  return { id: 'booking-1', amount: 34900, service: 'Walk 30 min', ref: 'FUR123456', ...overrides };
}

beforeEach(() => {
  global.__updateCalls = [];
  global.__rpcCalls = [];
  global.__updateError = null;
  global.__bookingRow = {
    booking_date: '2026-12-01',
    time_slot: '09:00',
    service_type: 'walk30',
    gross_amount_paise: 34900,
    booking_ref: 'FUR123456',
    pet_name: 'Bruno',
    sitter_id: 'sitter-profile-9',
    sitter_profiles: { users: { id: 'sitter-user-9', name: 'Priya' } },
  };
  updateCalls = global.__updateCalls;
  rpcCalls = global.__rpcCalls;
  notifyBookingConfirmedMock = require('./notificationService').notifyBookingConfirmed;
  notifyPaymentFailedMock = require('./notificationService').notifyPaymentFailed;
  notifyBookingConfirmedMock.mockClear();
  notifyPaymentFailedMock.mockClear();

  razorpayInstances = [];
  global.window.Razorpay = jest.fn().mockImplementation(function (options) {
    this.options = options;
    this.handlers = {};
    this.on = (event, cb) => { this.handlers[event] = cb; };
    this.open = jest.fn();
    razorpayInstances.push(this);
  });
});

describe('PaymentScreen', () => {

  test('shows the order summary for the booking', () => {
    render(<PaymentScreen booking={makeBooking()} city="Gurgaon" onBack={() => {}} onSuccess={() => {}} />);
    expect(screen.getByText('Walk 30 min')).toBeInTheDocument();
    expect(screen.getByText('Rs.349')).toBeInTheDocument();
  });

  test('clicking pay opens Razorpay with the right amount', () => {
    render(<PaymentScreen booking={makeBooking()} city="Gurgaon" onBack={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText(/Pay Rs\.349 securely/));
    expect(razorpayInstances).toHaveLength(1);
    expect(razorpayInstances[0].options.amount).toBe(34900);
    expect(razorpayInstances[0].open).toHaveBeenCalled();
  });

  test('a successful payment updates the booking by id and shows the success screen', async () => {
    const onSuccess = jest.fn();
    render(<PaymentScreen booking={makeBooking()} city="Gurgaon" onBack={() => {}} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText(/Pay Rs\.349 securely/));

    await act(async () => {
      await razorpayInstances[0].options.handler({ razorpay_payment_id: 'pay_123' });
    });

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toMatchObject({ payment_id: 'pay_123', payment_status: 'paid', status: 'confirmed' });

    await waitFor(() => expect(screen.getByText('Payment done!')).toBeInTheDocument());
    expect(onSuccess).toHaveBeenCalledWith('pay_123');
  });

  test('booking confirmation notifies the sitter at their real users.id, not sitter_profiles.id', async () => {
    render(<PaymentScreen booking={makeBooking()} city="Gurgaon" onBack={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText(/Pay Rs\.349 securely/));
    await act(async () => {
      await razorpayInstances[0].options.handler({ razorpay_payment_id: 'pay_123' });
    });

    await waitFor(() => expect(notifyBookingConfirmedMock).toHaveBeenCalled());
    const call = notifyBookingConfirmedMock.mock.calls[0][0];
    expect(call.sitterId).toBe('sitter-user-9'); // not 'sitter-profile-9'
    expect(call.sitterEmail).toBe('sitter@test.com');
    expect(call.petParentId).toBe('parent-1');
    expect(rpcCalls.map(c => c.args.target_id)).toEqual(expect.arrayContaining(['sitter-user-9', 'parent-1']));
  });

  test('a declined/failed payment shows the retry screen and notifies the payer', async () => {
    render(<PaymentScreen booking={makeBooking()} city="Gurgaon" onBack={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText(/Pay Rs\.349 securely/));

    await act(async () => {
      await razorpayInstances[0].handlers['payment.failed']({ error: { description: 'Card declined' } });
    });

    expect(await screen.findByText((_, el) => el.textContent === 'Payment unsuccessful')).toBeInTheDocument();
    expect(screen.getByText('Card declined')).toBeInTheDocument();
    await waitFor(() => expect(notifyPaymentFailedMock).toHaveBeenCalledWith(
      'parent-1', 'parent@test.com', undefined, 'Card declined'
    ));
  });

  test('retrying after a failure and failing again says "failed again", not "unsuccessful"', async () => {
    render(<PaymentScreen booking={makeBooking()} city="Gurgaon" onBack={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText(/Pay Rs\.349 securely/));
    await act(async () => {
      await razorpayInstances[0].handlers['payment.failed']({ error: { description: 'Card declined' } });
    });
    expect(screen.getByText((_, el) => el.textContent === 'Payment unsuccessful')).toBeInTheDocument();

    act(() => { fireEvent.click(screen.getByText('Try again')); });
    await act(async () => {
      await razorpayInstances[1].handlers['payment.failed']({ error: { description: 'Card declined again' } });
    });
    expect(screen.getByText((_, el) => el.textContent === 'Payment failed again')).toBeInTheDocument();
  });

  test('dismissing the Razorpay modal shows a non-alarming "saved, try again" message', () => {
    render(<PaymentScreen booking={makeBooking()} city="Gurgaon" onBack={() => {}} onSuccess={() => {}} />);
    fireEvent.click(screen.getByText(/Pay Rs\.349 securely/));

    act(() => { razorpayInstances[0].options.modal.ondismiss(); });

    expect(screen.getByText(/Payment was cancelled\. Your booking is saved/)).toBeInTheDocument();
  });
});
