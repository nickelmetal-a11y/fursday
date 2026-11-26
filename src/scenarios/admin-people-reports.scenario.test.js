import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import AdminUsers from '../AdminUsers';
import AdminReports, { platformTake, toCsv, weekStart } from '../AdminReports';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));

beforeEach(() => {
  db.reset(buildSeed());
  db.signInAs(IDS.admin);
  window.confirm = jest.fn(() => true);
});

test('S45: People lists everyone with role, and contact is shown only on request', async () => {
  render(<AdminUsers />);
  expect(await screen.findByText('Ananya Sharma')).toBeInTheDocument();
  expect(screen.getByText('Sitter · pending')).toBeInTheDocument();
  expect(screen.queryByText(/ananya@test.example/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Pet parents' }));
  expect(screen.queryByText('Priya Kapoor')).toBeNull();
  expect(screen.getByText('Rohit Verma')).toBeInTheDocument();
});

test('S46: an open account deletion request is shown oldest first and can be completed', async () => {
  db.insert('account_deletion_requests', { user_id: IDS.rohit, status: 'requested', reason: 'Moving abroad', requested_at: new Date(Date.now() - 27 * 86400000).toISOString() });
  render(<AdminUsers />);
  expect(await screen.findByText('Account deletion requests (1)')).toBeInTheDocument();
  expect(screen.getByText(/due within 30 days/)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Mark deleted'));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, mark deleted' }));
  await waitFor(() => expect(db.rows('account_deletion_requests', { user_id: IDS.rohit })[0].status).toBe('completed'));
});

test('S47: Reports compute GMV and Fursday revenue correctly, honouring Founding Sitters and promos', async () => {
  const promoBooking = db.one('bookings', { id: 'bk-done' });
  promoBooking.gross_amount_paise = 30000; // parent paid Rs.300 after a Rs.100 promo on Priya's Rs.400
  render(<AdminReports />);
  expect(await screen.findByText('Completed bookings')).toBeInTheDocument();
  // bk-done: Rs.300 paid, Priya keeps 85% of 400 = 340 -> Fursday -40. bk-done-hi (Ram): 400 paid, take 60.
  expect(screen.getByText('GMV (completed)').nextSibling.textContent).toBe('Rs.700');
  expect(screen.getByText('Fursday revenue').nextSibling.textContent).toBe('Rs.20');
});

test('platform take: Founding Sitter keeps everything', () => {
  expect(platformTake({ gross_amount_paise: 40000, sitter_payout_paise: 40000 }, 0)).toBe(0);
  expect(platformTake({ gross_amount_paise: 40000, sitter_payout_paise: 40000 }, 0.15)).toBe(6000);
});

test('CSV escapes commas and quotes', () => {
  const csv = toCsv([{ booking_ref: 'FUR-1', parent_notes: 'x', service_type: 'walk30', cities: { name: 'Gurgaon, HR' }, gross_amount_paise: 40000 }]);
  expect(csv.split('\n')[1]).toContain('"Gurgaon, HR"');
});

test('weeks start on Monday', () => {
  expect(weekStart('2026-11-26T10:00:00')).toBe('2026-11-23');
});
