import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import SitterDashboard from '../SitterDashboard';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));

beforeEach(() => {
  db.reset(buildSeed());
  window.alert = jest.fn();
  db.insert('broadcast_requests', { id: 'req-1', pet_parent_id: IDS.meera, city_id: IDS.gurgaon, service_type: 'walk30', status: 'open', notes: 'Evening walk for Sheru' });
});

test('S43: an approved sitter sees an open request and answers it at her own price', async () => {
  db.signInAs(IDS.priyaUser);
  render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
  fireEvent.click(await screen.findByText('1 open request near you'));
  expect(screen.getAllByText('Request a walker').length).toBeGreaterThan(0);
  const respond = await screen.findByText(/Accept this request/i);
  fireEvent.click(respond);
  await waitFor(() => expect(db.rows('broadcast_responses', { request_id: 'req-1' })).toHaveLength(1));
  expect(db.rows('broadcast_responses', { request_id: 'req-1' })[0]).toMatchObject({ sitter_id: IDS.priya, offered_price: 40000 });
});

test('S44: a sitter still under review does not see open requests', async () => {
  db.one('sitter_profiles', { id: IDS.vikram }).city_id = IDS.gurgaon;
  db.signInAs(IDS.vikramUser);
  render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
  await screen.findAllByText(/Vikram/);
  expect(screen.queryByText(/Accept this request/i)).toBeNull();
});
