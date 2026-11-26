import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db, supabase } from '../testing/fakeSupabase';
import { buildSeed, buildPuneSeed, IDS } from '../testing/seed';
import AdminPanel from '../AdminPanel';
import AdminReferrals from '../AdminReferrals';
import AdminSettings from '../AdminSettings';
import AdminBookings from '../AdminBookings';
import { payoutGroups, weekOverWeek } from '../adminInsights';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../emailService', () => ({
  ...jest.requireActual('../emailService'),
  sendPayoutNotificationEmail: jest.fn(),
}));

const DAY = 24 * 3600 * 1000;
const isoDate = (offsetMs) => new Date(Date.now() + offsetMs).toISOString().split('T')[0];

beforeEach(() => {
  db.reset(buildSeed());
  db.signInAs(IDS.admin);
  window.prompt = jest.fn(() => null);
});

async function openAdmin() {
  db.signInAs(IDS.admin);
  render(<AdminPanel />);
  await screen.findByText(/^Sitters \([1-9]\d*\)$/);
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
}

// Rohit signs up with Ananya's code through the real redemption RPC.
async function rohitRedeemsAnanyasCode() {
  db.insert('referrals', { id: 'ref-code', referrer_id: IDS.ananya, referral_code: 'ANANYA50', status: 'active' });
  db.signInAs(IDS.rohit);
  const { data } = await supabase.rpc('apply_referral_code', { p_code: 'ananya50' });
  db.signInAs(IDS.admin);
  return data;
}

describe('Admin: referrals', () => {
  test('G1: Referrals lists used referrals and pending credits; "Mark applied" applies one and tells the person', async () => {
    await rohitRedeemsAnanyasCode();
    render(<AdminReferrals />);

    const used = await screen.findByRole('table', { name: 'Referrals used' });
    const usedRows = within(used).getAllByRole('row').slice(1);
    expect(usedRows).toHaveLength(1); // the unused code row is not a referral yet
    expect(within(usedRows[0]).getByText('Ananya Sharma')).toBeInTheDocument();
    expect(within(usedRows[0]).getByText('Rohit Verma')).toBeInTheDocument();

    const credits = screen.getByRole('table', { name: 'Referral credits' });
    expect(within(credits).getAllByRole('row').slice(1)).toHaveLength(2);
    const ananyaRow = within(credits).getByText('Ananya Sharma').closest('tr');
    expect(within(ananyaRow).getByText('Rs.100')).toBeInTheDocument();
    expect(within(ananyaRow).getByText('Referrer reward')).toBeInTheDocument();

    fireEvent.click(within(ananyaRow).getByRole('button', { name: 'Mark applied' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Yes, mark applied' }));

    await waitFor(() => expect(db.one('referral_bonuses', { user_id: IDS.ananya }).status).toBe('applied'));
    expect(db.one('referral_bonuses', { user_id: IDS.ananya }).applied_at).toBeTruthy();
    expect(db.one('referral_bonuses', { user_id: IDS.rohit }).status).toBe('pending');
    expect(db.rows('notifications', { user_id: IDS.ananya, type: 'referral_bonus_applied' })).toHaveLength(1);
    expect(db.rows('admin_audit_logs', { action: 'referral_bonus_applied' })).toHaveLength(1);
    // The pending filter now shows only Rohit's credit.
    await waitFor(() => expect(within(screen.getByRole('table', { name: 'Referral credits' })).queryByText('Ananya Sharma')).toBeNull());
    expect(screen.getByRole('button', { name: 'Pending (1)' })).toBeInTheDocument();
  });

  test('G2: referral amounts are edited in Settings and used by the next redemption', async () => {
    render(<AdminSettings />);
    fireEvent.change(await screen.findByLabelText('Referrer reward (Rs.)'), { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('New person credit (Rs.)'), { target: { value: 'fifty' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save referral amounts' }));
    expect(await screen.findByText(/must be a whole number/)).toBeInTheDocument();
    expect(db.one('app_settings', { key: 'referral_reward_rs' })).toBeUndefined();

    fireEvent.change(screen.getByLabelText('New person credit (Rs.)'), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save referral amounts' }));
    expect(await screen.findByText(/Referral amounts saved/)).toBeInTheDocument();
    expect(db.one('app_settings', { key: 'referral_reward_rs' }).value).toBe('150');
    expect(db.one('app_settings', { key: 'referral_signup_rs' }).value).toBe('75');
    expect(db.one('app_settings', { key: 'support_phone' }).value).toBe('919315578325');

    const res = await rohitRedeemsAnanyasCode();
    expect(res).toMatchObject({ ok: true, reward: 150, signup: 75 });
  });
});

describe('Admin: payouts grouped by sitter', () => {
  test('G3: two unpaid jobs for Priya are one group; "Mark all paid" pays both and sends one notification', async () => {
    db.insert('bookings', {
      id: 'bk-done-2', booking_ref: 'FUR-PRI2', city_id: IDS.gurgaon, service_type: 'walk30', time_slot: '07:00 AM',
      pet_parent_id: IDS.rohit, sitter_id: IDS.priya, pet_id: IDS.coco, status: 'completed', payment_status: 'paid',
      gross_amount_paise: 40000, sitter_payout_paise: 40000, booking_date: isoDate(-DAY),
    });
    await openAdmin();
    fireEvent.click(screen.getByText(/^Payouts \(/));

    const priya = screen.getByRole('region', { name: 'Payouts for Priya Kapoor' });
    expect(within(priya).getAllByRole('button', { name: 'Mark paid' })).toHaveLength(2);
    expect(within(priya).getByText('Rs.680')).toBeInTheDocument();
    const ram = screen.getByRole('region', { name: 'Payouts for राम सिंह' });
    expect(within(ram).queryByRole('button', { name: /Mark all paid/ })).toBeNull();

    fireEvent.click(within(priya).getByRole('button', { name: 'Mark all paid (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, mark Rs.680 paid' }));

    await waitFor(() => expect(db.one('bookings', { id: 'bk-done-2' }).payout_status).toBe('paid'));
    expect(db.one('bookings', { id: 'bk-done' }).payout_status).toBe('paid');
    expect(db.one('bookings', { id: 'bk-done-hi' }).payout_status).toBeUndefined();
    const notes = db.rows('notifications', { user_id: IDS.priyaUser, type: 'payout_marked' });
    expect(notes).toHaveLength(1);
    expect(notes[0].body).toMatch(/Rs\.? ?680\b/);
    expect(db.rows('admin_audit_logs', { action: 'mark_payout_paid' }).map(r => r.reason).sort()).toEqual(['Marked Rs.340 as paid', 'Marked Rs.340 as paid']);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Payouts for Priya Kapoor' })).toBeNull());
    expect(screen.getByRole('region', { name: 'Payouts for राम सिंह' })).toBeInTheDocument();
  });

  test('payoutGroups: nets each job by the sitter rate and sorts by amount owed', () => {
    const sitters = [{ id: 'a', is_founding_sitter: true }, { id: 'b' }];
    const bookings = [
      { id: '1', sitter_id: 'a', status: 'completed', sitter_payout_paise: 30000 },
      { id: '2', sitter_id: 'b', status: 'completed', sitter_payout_paise: 40000 },
      { id: '3', sitter_id: 'b', status: 'completed', sitter_payout_paise: 40000 },
      { id: '4', sitter_id: 'b', status: 'completed', payout_status: 'paid', sitter_payout_paise: 40000 },
      { id: '5', sitter_id: 'a', status: 'confirmed', sitter_payout_paise: 40000 },
    ];
    const g = payoutGroups(bookings, sitters);
    expect(g.map(x => [x.sitterId, x.items.length, x.total])).toEqual([['b', 2, 680], ['a', 1, 300]]);
  });
});

describe('Admin: filters and the sitter detail drawer', () => {
  test('G4: Sitters can be filtered by city, status and search', async () => {
    await openAdmin();
    fireEvent.click(screen.getByText(/^Sitters \(/));
    fireEvent.change(screen.getByLabelText('Filter sitters by city'), { target: { value: 'Pune' } });
    expect(screen.getByText('Vikram Rao')).toBeInTheDocument();
    expect(screen.queryByText('Priya Kapoor')).toBeNull();
    fireEvent.change(screen.getByLabelText('Filter sitters by status'), { target: { value: 'active' } });
    expect(screen.getByText('No sitters match')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter sitters by city'), { target: { value: 'all' } });
    expect(screen.getByText('Priya Kapoor')).toBeInTheDocument();
    expect(screen.queryByText('Vikram Rao')).toBeNull();
    fireEvent.change(screen.getByLabelText('Search sitters'), { target: { value: 'priya' } });
    expect(within(screen.getByRole('table', { name: 'Sitters' })).getAllByRole('row')).toHaveLength(2);
  });

  test('G5: the sitter drawer shows a masked Aadhaar, services, recent bookings and admin history', async () => {
    await openAdmin();
    fireEvent.click(screen.getByText(/^Sitters \(/));
    fireEvent.click(screen.getByRole('button', { name: 'Open Priya Kapoor' }));
    const drawer = screen.getByRole('dialog', { name: 'Priya Kapoor' });
    expect(within(drawer).getByText('XXXX XXXX 3333')).toBeInTheDocument();
    expect(within(drawer).queryByText(/1111 2222 3333|111122223333/)).toBeNull();
    expect(within(drawer).getByText('priya@okaxis')).toBeInTheDocument();
    expect(within(drawer).getByText('Boarding')).toBeInTheDocument();
    expect(within(drawer).getByText('FUR-DONE')).toBeInTheDocument();
    expect(await within(drawer).findByText('No admin actions yet.')).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: /Give Top Badge/ }));
    await waitFor(() => expect(db.one('sitter_profiles', { id: IDS.priya }).is_top_sitter).toBe(true));
    expect(await within(screen.getByRole('dialog', { name: 'Priya Kapoor' })).findByText('Top Sitter badge changed')).toBeInTheDocument();
  });

  test('G6: Bookings can be narrowed by city and by a date range', async () => {
    db.reset(buildPuneSeed());
    db.signInAs(IDS.admin);
    const bookings = db.table('bookings').map(b => ({ ...b, users: db.one('users', { id: b.pet_parent_id }), cities: db.one('cities', { id: b.city_id }) }));
    const sitters = db.table('sitter_profiles').map(s => ({ ...s, users: db.one('users', { id: s.user_id }) }));
    render(<AdminBookings bookings={bookings} sitters={sitters} onChanged={() => {}} />);
    expect(screen.getByText('13 of 13 bookings')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: IDS.pune } });
    expect(screen.getByText('6 of 13 bookings')).toBeInTheDocument();
    expect(screen.queryByText('FUR-DONE')).toBeNull();
    expect(screen.getByText('PUN-DONE')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by city'), { target: { value: IDS.gurgaon } });
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: isoDate(2 * DAY) } });
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: isoDate(4 * DAY) } });
    expect(screen.getByText('3 of 13 bookings')).toBeInTheDocument(); // mid (+2d), unpaid (+3d), pending (+4d)

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByText('13 of 13 bookings')).toBeInTheDocument();
  });
});

describe('Admin: overview week-over-week', () => {
  test('weekOverWeek counts bookings, GMV, new parents, new sitters and cancellation rate per 7-day window', () => {
    const now = new Date('2026-11-26T12:00:00Z');
    const ago = (d) => new Date(now.getTime() - d * DAY).toISOString();
    const r = weekOverWeek({
      now,
      bookings: [
        { created_at: ago(1), status: 'completed', completed_at: ago(1), gross_amount_paise: 40000 },
        { created_at: ago(2), status: 'cancelled' },
        { created_at: ago(9), status: 'completed', completed_at: ago(9), gross_amount_paise: 30000 },
      ],
      sitters: [{ user_id: 's1', status: 'pending', created_at: ago(3) }, { user_id: 's2', status: 'draft', created_at: ago(3) }],
      users: [{ id: 'p1', created_at: ago(1) }, { id: 's1', created_at: ago(3) }, { id: 'p2', created_at: ago(10) }],
    });
    expect(r.current).toEqual({ bookings: 2, gmv: 400, newParents: 1, newSitters: 1, cancelRate: 50 });
    expect(r.previous).toEqual({ bookings: 1, gmv: 300, newParents: 1, newSitters: 0, cancelRate: 0 });
  });

  test('G7: Overview shows the 7-day tiles with a comparison', async () => {
    await openAdmin();
    fireEvent.click(screen.getByText(/^Overview$/));
    expect(await screen.findByText('New bookings')).toBeInTheDocument();
    expect(screen.getByText('GMV completed')).toBeInTheDocument();
    expect(screen.getByText('New parents')).toBeInTheDocument();
    expect(screen.getByText('New sitters')).toBeInTheDocument();
    expect(screen.getAllByText(/vs previous 7 days/).length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText('Needs attention')).toBeInTheDocument();
  });
});
