import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import AdminBookings from '../AdminBookings';
import AdminBroadcast from '../AdminBroadcast';
import { attentionItems, sitterScorecard } from '../adminInsights';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));

const HOUR = 3600 * 1000;
const sittersWithNames = () => db.table('sitter_profiles').map(s => ({ ...s, users: db.one('users', { id: s.user_id }) }));
const bookingsWithNames = () => db.table('bookings').map(b => ({ ...b, users: db.one('users', { id: b.pet_parent_id }), cities: db.one('cities', { id: b.city_id }) }));

beforeEach(() => {
  db.reset(buildSeed());
  db.signInAs(IDS.admin);
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn(() => 'Sitter unwell');
});

describe('Needs attention', () => {
  test('S48: flags a likely no-show, a silent sitter, unpaid-soon, overdue payout and a slow dispute', () => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const bks = [
      { id: 'a', booking_ref: 'NOSHOW', status: 'confirmed', payment_status: 'paid', booking_date: '2020-01-01', time_slot: '7:00 AM', sitter_id: IDS.priya },
      { id: 'b', booking_ref: 'SILENT', status: 'pending', created_at: new Date(now - 5 * HOUR).toISOString(), booking_date: '2099-01-01', sitter_id: IDS.ram },
      { id: 'c', booking_ref: 'UNPAID', status: 'confirmed', payment_status: 'unpaid', booking_date: new Date(now.getTime() + 6 * HOUR).toISOString() },
      { id: 'd', booking_ref: 'PAYOUT', status: 'completed', payout_status: 'pending', completed_at: new Date(now - 5 * 24 * HOUR).toISOString(), booking_date: today },
    ];
    const items = attentionItems({ bookings: bks, sitters: sittersWithNames(), disputes: [{ id: 'x', status: 'open', title: 'Dirty dog', created_at: new Date(now - 4 * 24 * HOUR).toISOString() }], now });
    const kinds = items.map(i => i.kind);
    expect(kinds).toEqual(expect.arrayContaining(['no_show', 'no_reply', 'unpaid_soon', 'payout_late', 'dispute_sla']));
    expect(items[0].level).toBe('critical');
  });

  test('a quiet day shows nothing', () => {
    expect(attentionItems({ bookings: [], sitters: [] })).toEqual([]);
  });
});

describe('Sitter scorecard', () => {
  test('S49: counts sitter cancellations and declines, and flags poor reliability', () => {
    const s = { id: 'sp-x', avg_rating: 3.2, review_count: 4 };
    const bks = [
      { sitter_id: 'sp-x', status: 'completed' },
      { sitter_id: 'sp-x', status: 'cancelled', cancellation_reason: 'Sitter: sick' },
      { sitter_id: 'sp-x', status: 'cancelled', cancellation_reason: 'Declined by sitter' },
      { sitter_id: 'sp-x', status: 'cancelled', cancellation_reason: 'Declined by sitter' },
      { sitter_id: 'sp-x', status: 'cancelled', cancellation_reason: 'Change of plans' },
    ];
    const sc = sitterScorecard(s, bks);
    expect(sc).toMatchObject({ total: 5, completed: 1, sitterCancelled: 3, acceptanceRate: 60 });
    expect(sc.flags.join(' ')).toMatch(/Rating below 3.5/);
    expect(sc.flags.join(' ')).toMatch(/Cancels 60%/);
  });
});

describe('Booking tools', () => {
  test('S50: admin finds a booking, cancels it with a full refund, and both sides are told', async () => {
    render(<AdminBookings bookings={bookingsWithNames()} sitters={sittersWithNames()} onChanged={() => {}} />);
    fireEvent.change(screen.getByLabelText('Search bookings'), { target: { value: 'Rohit' } });
    fireEvent.click(screen.getByText(/FUR-SOON/));
    fireEvent.click(await screen.findByText('Cancel with full refund'));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-soon' }).status).toBe('cancelled'));
    expect(db.one('bookings', { id: 'bk-soon' })).toMatchObject({ refund_percentage: 100, refund_amount_paise: 40000, cancellation_reason: 'Fursday: Sitter unwell' });
    expect(db.rows('notifications', { user_id: IDS.rohit })).toHaveLength(1);
    expect(db.rows('notifications', { user_id: IDS.ramUser })).toHaveLength(1);
    expect(db.rows('admin_audit_logs', { action: 'admin_cancel_booking' })).toHaveLength(1);
  });

  test('S51: admin reassigns a pending request to another sitter in the same city', async () => {
    render(<AdminBookings bookings={bookingsWithNames()} sitters={sittersWithNames()} focusId="bk-pending" onChanged={() => {}} />);
    fireEvent.change(await screen.findByLabelText('Reassign to'), { target: { value: IDS.priya } });
    fireEvent.click(screen.getByText('Reassign'));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-pending' }).sitter_id).toBe(IDS.priya));
    expect(db.rows('notifications', { user_id: IDS.priyaUser, type: 'booking_request' })).toHaveLength(1);
    expect(db.rows('notifications', { user_id: IDS.meera, type: 'booking_reassigned' })).toHaveLength(1);
    expect(db.rows('notifications', { user_id: IDS.sunitaUser, type: 'booking_reassigned' })).toHaveLength(1);
  });

  test('S52: admin notes are kept on the booking history', async () => {
    render(<AdminBookings bookings={bookingsWithNames()} sitters={sittersWithNames()} focusId="bk-far" onChanged={() => {}} />);
    fireEvent.change(await screen.findByLabelText('Add a note'), { target: { value: 'Called parent, all good' } });
    fireEvent.click(screen.getByText('Add'));
    expect(await screen.findByText('Called parent, all good')).toBeInTheDocument();
    expect(db.rows('admin_audit_logs', { action: 'booking_note', resource_id: 'bk-far' })).toHaveLength(1);
  });
});

describe('Announcements', () => {
  test('S53: an announcement to active sitters reaches only them, after a confirm step', async () => {
    render(<AdminBroadcast />);
    await screen.findByText(/Will reach/);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Diwali week' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Extra bookings expected, keep evenings open.' } });
    expect(screen.getByText(/Will reach/).textContent).toMatch(/3 people/);
    fireEvent.click(screen.getByText('Review and send'));
    fireEvent.click(screen.getByText('Yes, send'));
    expect(await screen.findByText('Sent to 3 people.')).toBeInTheDocument();
    const got = db.rows('notifications', { type: 'announcement' }).map(n => n.user_id).sort();
    expect(got).toEqual([IDS.priyaUser, IDS.ramUser, IDS.sunitaUser].sort());
  });
});
