import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import SitterDashboard from '../SitterDashboard';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));

beforeEach(() => {
  db.reset(buildSeed());
  window.alert = jest.fn();
  db.insert('broadcast_requests', { id: 'req-1', pet_parent_id: IDS.meera, city_id: IDS.gurgaon, service_type: 'walk30', status: 'open', mode: 'compare', notes: 'Evening walk for Sheru' });
});

test('S43: an approved sitter invited to a request sees it and answers it at her own price', async () => {
  db.insert('broadcast_recipients', { request_id: 'req-1', sitter_id: IDS.priya, wave: 1 });
  db.signInAs(IDS.priyaUser);
  render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
  fireEvent.click(await screen.findByText('1 open request near you'));
  expect((await screen.findAllByText('Request a walker')).length).toBeGreaterThan(0);
  expect(screen.getByText('Evening walk for Sheru')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Accept at my price/ }));
  await waitFor(() => expect(db.rows('broadcast_responses', { request_id: 'req-1' })).toHaveLength(1));
  expect(db.rows('broadcast_responses', { request_id: 'req-1' })[0]).toMatchObject({ sitter_id: IDS.priya, offered_price: 40000, status: 'accepted' });
});

test('S43b: an open request in her city that she was not invited to stays hidden', async () => {
  db.signInAs(IDS.priyaUser);
  render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Open requests (0)' }));
  expect(await screen.findByText('No requests right now')).toBeInTheDocument();
  expect(screen.queryByText('Evening walk for Sheru')).toBeNull();
});

test('S44: a sitter still under review does not see open requests', async () => {
  db.one('sitter_profiles', { id: IDS.vikram }).city_id = IDS.gurgaon;
  db.signInAs(IDS.vikramUser);
  render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
  await screen.findAllByText(/Vikram/);
  expect(screen.queryByText(/Accept at my price/i)).toBeNull();
});
