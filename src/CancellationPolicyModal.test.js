/**
 * Unit tests for CancellationPolicyModal.js — the refund-tier logic is the
 * highest-risk code in the app (it moves real money). Covers UT-CAN-01..09.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CancellationPolicyModal from './CancellationPolicyModal';

let updateCalls, onCancelled, onClose;

jest.mock('./notificationService', () => ({
  notifyCancellationReminder: jest.fn(),
  notifyBookingCancelled: jest.fn(),
}));

jest.mock('./supabase', () => {
  const bookingsTable = {
    update: (fields) => { global.__updateCalls.push(fields); return bookingsTable; },
    eq: () => Promise.resolve({ data: null, error: null }),
  };
  const sitterTable = {
    select: () => sitterTable,
    eq: () => sitterTable,
    single: () => Promise.resolve({ data: { users: { name: 'Priya', email: 'sitter@test.com', phone: '9111111111' } } }),
  };
  return {
    supabase: {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'parent-1', email: 'parent@test.com', phone: '9000000000', user_metadata: { name: 'Rahul' } } } }),
      },
      from: (table) => {
        if (table === 'bookings') return bookingsTable;
        if (table === 'sitter_profiles') return sitterTable;
        throw new Error('unexpected table: ' + table);
      },
    },
  };
});

// Hours from "now", as an ISO string, the way booking.booking_date is stored.
const hoursFromNow = (h) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

function makeBooking(overrides = {}) {
  return {
    id: 'booking-1',
    pet_parent_id: 'parent-1',
    sitter_id: 'sitter-1',
    booking_ref: 'FUR123',
    gross_amount_paise: 34900,
    payment_status: 'paid',
    booking_date: hoursFromNow(100),
    ...overrides,
  };
}

beforeEach(() => {
  global.__updateCalls = [];
  updateCalls = global.__updateCalls;
  onCancelled = jest.fn();
  onClose = jest.fn();
});

describe('CancellationPolicyModal - refund tiers', () => {

  // UT-CAN-01
  test('100 hours before the booking: full 100% refund', () => {
    render(<CancellationPolicyModal booking={makeBooking({ booking_date: hoursFromNow(100) })} onClose={onClose} />);
    expect(screen.getByText('Full refund (100%)')).toBeInTheDocument();
  });

  // UT-CAN-02 (boundary, inclusive). +0.001h (~3.6s) buffer absorbs test
  // execution time so the real hoursUntil doesn't drift just under 72.
  test('exactly 72 hours before: still 100% (boundary is inclusive)', () => {
    render(<CancellationPolicyModal booking={makeBooking({ booking_date: hoursFromNow(72.001) })} onClose={onClose} />);
    expect(screen.getByText('Full refund (100%)')).toBeInTheDocument();
  });

  // UT-CAN-03. "75% refund" and "No refund" also appear verbatim in the
  // static REFUND RULES table, so scope the query to the "Your refund"
  // summary box specifically rather than searching the whole page.
  test('71h59m before: drops to 75%', () => {
    render(<CancellationPolicyModal booking={makeBooking({ booking_date: hoursFromNow(71 + 59 / 60) })} onClose={onClose} />);
    expect(screen.getByText('Your refund').parentElement.textContent).toContain('75% refund');
  });

  // UT-CAN-04 (boundary, inclusive)
  test('exactly 24 hours before: still 75% (boundary is inclusive)', () => {
    render(<CancellationPolicyModal booking={makeBooking({ booking_date: hoursFromNow(24.001) })} onClose={onClose} />);
    expect(screen.getByText('Your refund').parentElement.textContent).toContain('75% refund');
  });

  // UT-CAN-05
  test('23h59m before: no refund', () => {
    render(<CancellationPolicyModal booking={makeBooking({ booking_date: hoursFromNow(23 + 59 / 60) })} onClose={onClose} />);
    expect(screen.getByText('Your refund').parentElement.textContent).toContain('No refund');
  });

  // UT-CAN-06
  test('a booking already in the past: no refund, no crash', () => {
    render(<CancellationPolicyModal booking={makeBooking({ booking_date: hoursFromNow(-5) })} onClose={onClose} />);
    expect(screen.getByText('Your refund').parentElement.textContent).toContain('No refund');
  });

  // UT-CAN-07
  test('refund amount = amount paid x percentage, correctly rounded', () => {
    // 48h out -> 75% tier. 349 * 0.75 = 261.75, displayed rounded to ₹262.
    render(<CancellationPolicyModal booking={makeBooking({ gross_amount_paise: 34900, booking_date: hoursFromNow(48) })} onClose={onClose} />);
    expect(screen.getByText('₹262')).toBeInTheDocument();
  });

  // UT-CAN-08
  test('unpaid booking: refund is ₹0, never NaN', () => {
    render(<CancellationPolicyModal booking={makeBooking({ payment_status: 'unpaid', booking_date: hoursFromNow(100) })} onClose={onClose} />);
    expect(screen.getByText('₹0')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/i)).not.toBeInTheDocument();
  });

  // UT-CAN-09. bookings.cancelled_at/refund_percentage/refund_amount_paise
  // (migration 014, safety-netted by 023) back the displayed refund tier —
  // this must actually get written, not just shown.
  test('confirming cancellation writes exactly one bookings update with the right fields', async () => {
    render(
      <CancellationPolicyModal
        booking={makeBooking({ gross_amount_paise: 34900, booking_date: hoursFromNow(48) })}
        onClose={onClose}
        onCancelled={onCancelled}
      />
    );

    fireEvent.click(screen.getByText('Cancel booking'));
    fireEvent.click(screen.getByText('Change of plans'));
    fireEvent.click(screen.getByText('Yes, cancel this booking'));

    await waitFor(() => expect(updateCalls).toHaveLength(1));
    expect(updateCalls[0]).toMatchObject({
      status: 'cancelled',
      cancellation_reason: 'Change of plans',
      refund_percentage: 75,
      refund_amount_paise: 26175, // 349 * 0.75 = 261.75 -> paise, rounded
    });
    expect(typeof updateCalls[0].cancelled_at).toBe('string');

    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  test('"Keep booking" just closes the modal — no cancellation happens', () => {
    render(<CancellationPolicyModal booking={makeBooking()} onClose={onClose} onCancelled={onCancelled} />);
    fireEvent.click(screen.getByText('Keep booking'));
    expect(onClose).toHaveBeenCalled();
    expect(onCancelled).not.toHaveBeenCalled();
    expect(updateCalls).toHaveLength(0);
  });

  test('cannot confirm cancellation without picking a reason first', () => {
    render(<CancellationPolicyModal booking={makeBooking()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel booking'));
    // Still on the "reason" step — no "Yes, cancel this booking" button yet.
    expect(screen.queryByText('Yes, cancel this booking')).not.toBeInTheDocument();
  });
});
