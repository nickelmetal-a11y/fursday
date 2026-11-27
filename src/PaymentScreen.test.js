/**
 * Unit tests for PaymentScreen.js — the checkout screen. The price, order
 * and key come from the payments server (paymentsClient, mocked here); the
 * screen itself never writes payment fields. window.Razorpay is a fake
 * stand-in for the real externally-loaded script, which jsdom never runs.
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import PaymentScreen from './PaymentScreen';

let updateCalls, rpcCalls, razorpayInstances;
let notifyBookingConfirmedMock, notifyPaymentFailedMock;

jest.mock('./notificationService', () => ({
  notifyBookingConfirmed: jest.fn().mockResolvedValue(undefined),
  notifyPaymentFailed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./paymentsClient', () => ({
  ...jest.requireActual('./paymentsClient'),
  createOrder: (...a) => global.__createOrder(...a),
  verifyPayment: (...a) => global.__verifyPayment(...a),
  simulatePayment: (...a) => global.__simulatePayment(...a),
}));

jest.mock('./supabase', () => {
  const listChain = {
    select: () => listChain,
    eq: () => listChain,
    single: () => Promise.resolve({ data: global.__bookingRow }),
  };
  const bookingsTable = {
    update: (fields) => { global.__updateCalls.push(fields); return { eq: () => Promise.resolve({ error: null }) }; },
    select: () => listChain,
  };
  return {
    supabase: {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'parent-1', email: 'parent@test.com' } } }),
        getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }),
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

const ORDER = { ok: true, mode: 'test', order_id: 'order_1', key_id: 'rzp_test_fromserver', amount: 34900, currency: 'INR' };
function makeBooking(overrides = {}) {
  return { id: 'booking-1', amount: 100, service: 'Walk 30 min', ref: 'FUR123456', sitterName: 'Priya', ...overrides };
}
const renderScreen = (props = {}) => render(<PaymentScreen booking={makeBooking()} city="Gurgaon" onBack={() => {}} onSuccess={() => {}} {...props} />);
const payButton = () => screen.findByRole('button', { name: /Pay Rs\.349 securely/ });

beforeEach(() => {
  global.__updateCalls = [];
  global.__rpcCalls = [];
  global.__createOrder = jest.fn(() => Promise.resolve(ORDER));
  global.__verifyPayment = jest.fn(() => Promise.resolve({ ok: true, payment_status: 'authorized' }));
  global.__simulatePayment = jest.fn(() => Promise.resolve({ ok: true, payment_status: 'authorized' }));
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

  test("shows the order summary at the server's price, not the amount passed in", async () => {
    renderScreen();
    expect(screen.getByText('Walk 30 min')).toBeInTheDocument();
    expect(await screen.findByText('Rs.349')).toBeInTheDocument();
    expect(global.__createOrder).toHaveBeenCalledWith('booking-1');
    expect(screen.getByText(/You're only charged once Priya accepts/)).toBeInTheDocument();
  });

  test('paying opens Razorpay with the server order and key', async () => {
    renderScreen();
    fireEvent.click(await payButton());
    expect(razorpayInstances).toHaveLength(1);
    expect(razorpayInstances[0].options).toMatchObject({ key: 'rzp_test_fromserver', order_id: 'order_1', amount: 34900 });
    expect(razorpayInstances[0].open).toHaveBeenCalled();
  });

  test('a successful payment is verified by the server; the screen never writes the booking itself', async () => {
    const onSuccess = jest.fn();
    renderScreen({ onSuccess });
    fireEvent.click(await payButton());
    const rz = { razorpay_order_id: 'order_1', razorpay_payment_id: 'pay_123', razorpay_signature: 'sig' };
    await act(async () => { await razorpayInstances[0].options.handler(rz); });

    expect(global.__verifyPayment).toHaveBeenCalledWith('booking-1', rz);
    expect(updateCalls).toHaveLength(0);
    expect(await screen.findByText('Payment done!')).toBeInTheDocument();
    expect(screen.getByText(/Rs\.349 is held safely\. You are only charged when Priya accepts/)).toBeInTheDocument();
    expect(screen.getByText('Waiting for sitter')).toBeInTheDocument();
    expect(onSuccess).toHaveBeenCalledWith('pay_123', expect.objectContaining({ payment_status: 'authorized' }));
    expect(notifyBookingConfirmedMock).not.toHaveBeenCalled();
  });

  test('when the sitter had already accepted, the payment is captured and both sides get the confirmation, the sitter at their users.id', async () => {
    global.__verifyPayment = jest.fn(() => Promise.resolve({ ok: true, payment_status: 'held' }));
    renderScreen();
    fireEvent.click(await payButton());
    await act(async () => { await razorpayInstances[0].options.handler({ razorpay_payment_id: 'pay_123' }); });

    await waitFor(() => expect(notifyBookingConfirmedMock).toHaveBeenCalled());
    const call = notifyBookingConfirmedMock.mock.calls[0][0];
    expect(call.sitterId).toBe('sitter-user-9'); // not 'sitter-profile-9'
    expect(call.sitterEmail).toBe('sitter@test.com');
    expect(call.petParentId).toBe('parent-1');
    expect(rpcCalls.map(c => c.args.target_id)).toEqual(expect.arrayContaining(['sitter-user-9', 'parent-1']));
    expect(screen.getByText(/paid to Priya 24 hours after the service/)).toBeInTheDocument();
  });

  test('if the server cannot verify the payment, the parent is told and can retry', async () => {
    global.__verifyPayment = jest.fn(() => Promise.reject(new Error('bad signature')));
    renderScreen();
    fireEvent.click(await payButton());
    await act(async () => { await razorpayInstances[0].options.handler({ razorpay_payment_id: 'pay_123' }); });
    expect(await screen.findByText(/We could not confirm this payment/)).toBeInTheDocument();
    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  test('a declined/failed payment shows the retry screen and notifies the payer', async () => {
    renderScreen();
    fireEvent.click(await payButton());
    await act(async () => {
      await razorpayInstances[0].handlers['payment.failed']({ error: { description: 'Card declined' } });
    });

    expect(await screen.findByText((_, el) => el.textContent === 'Payment unsuccessful')).toBeInTheDocument();
    expect(screen.getByText('Card declined')).toBeInTheDocument();
    await waitFor(() => expect(notifyPaymentFailedMock).toHaveBeenCalledWith('parent-1', 'parent@test.com', undefined, 'Card declined'));
  });

  test('retrying after a failure and failing again says "failed again", not "unsuccessful"', async () => {
    renderScreen();
    fireEvent.click(await payButton());
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

  test('dismissing the Razorpay modal shows a non-alarming "saved, try again" message', async () => {
    renderScreen();
    fireEvent.click(await payButton());
    act(() => { razorpayInstances[0].options.modal.ondismiss(); });
    expect(screen.getByText(/Payment was cancelled\. Your booking is saved/)).toBeInTheDocument();
  });

  test('a test account in simulated mode sees a clear test notice and pays through the simulator, never Razorpay', async () => {
    global.__createOrder = jest.fn(() => Promise.resolve({ ok: true, mode: 'simulated', amount: 34900 }));
    renderScreen();
    expect(await screen.findByText('Test account: this is a pretend payment. No real money moves.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pay Rs.349 (test payment)' }));
    expect(await screen.findByText('Payment done!')).toBeInTheDocument();
    expect(global.__simulatePayment).toHaveBeenCalledWith('booking-1');
    expect(razorpayInstances).toHaveLength(0);
  });

  test('when online payment is not available it says so honestly, or hands back to the caller', async () => {
    global.__createOrder = jest.fn(() => Promise.resolve({ ok: true, mode: 'unavailable' }));
    const first = renderScreen();
    expect(await screen.findByText('Online payment is not switched on yet')).toBeInTheDocument();
    expect(screen.getByText(/nothing has been charged/)).toBeInTheDocument();
    first.unmount();

    const onUnavailable = jest.fn();
    renderScreen({ onUnavailable });
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledWith('unavailable'));
  });

  test('an already-paid booking is not offered for payment again', async () => {
    const err = Object.assign(new Error('already paid'), { status: 409, code: 'already_paid' });
    global.__createOrder = jest.fn(() => Promise.reject(err));
    renderScreen();
    expect(await screen.findByText('This booking is already paid')).toBeInTheDocument();
  });
});
