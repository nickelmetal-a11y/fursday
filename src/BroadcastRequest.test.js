// Unit tests for the request builder (BroadcastRequest.js). The full
// parent ↔ sitter flow lives in src/scenarios/nearby-requests.scenario.test.js.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { db, supabase } from './testing/fakeSupabase';
import { buildSeed, IDS } from './testing/seed';
import BroadcastRequest from './BroadcastRequest';

jest.mock('./supabase', () => require('./testing/fakeSupabase'));

const continueButton = () => screen.getByRole('button', { name: 'Continue →' });

beforeEach(() => {
  db.reset(buildSeed());
  db.signInAs(IDS.ananya);
});

async function toWhereStep() {
  render(<BroadcastRequest onBack={() => {}} city="Gurgaon" />);
  expect(continueButton()).toBeDisabled();
  fireEvent.click(screen.getByText('Request a walker'));
  fireEvent.click(continueButton());
  expect(continueButton()).toBeDisabled();
  fireEvent.click(screen.getByText('8:00 AM'));
  fireEvent.click(continueButton());
  await screen.findByText('Bruno');
}

test('each step must be answered before moving on; the only pet is picked for you', async () => {
  await toWhereStep();
  expect(screen.getByRole('button', { name: /Bruno/ })).toHaveAttribute('aria-pressed', 'true');
  expect(continueButton()).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Sector 5' } });
  fireEvent.click(screen.getByRole('option', { name: /Sector 56/ }));
  expect(continueButton()).toBeEnabled();
});

test('urgent mode, budget and notes are saved; urgent closes within about 2 hours', async () => {
  await toWhereStep();
  fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Sector 56' } });
  fireEvent.click(screen.getByRole('option', { name: /Sector 56/ }));
  fireEvent.click(continueButton());
  fireEvent.click(screen.getByText('Urgent: first to accept gets it'));
  fireEvent.change(screen.getByLabelText('Max budget (optional)'), { target: { value: '6a00' } });
  fireEvent.change(screen.getByLabelText('Any notes for sitters?'), { target: { value: 'Bruno pulls on the lead' } });
  fireEvent.click(screen.getByText('Send to nearby carers'));
  await screen.findByText('Your request');
  const req = db.one('broadcast_requests', { pet_parent_id: IDS.ananya });
  expect(req).toMatchObject({ mode: 'urgent', budget_max_paise: 60000, notes: 'Bruno pulls on the lead', area: 'Sector 56', address_pincode: '122011', pet_id: IDS.bruno, scheduled_time: '8:00 AM' });
  expect(req.pet_summary).toMatchObject({ name: 'Bruno', size: 'large' });
  expect(Date.parse(req.expires_at) - Date.now()).toBeLessThanOrEqual(2 * 60 * 60 * 1000);
});

test('a saved address is offered first; only a rounded (~1 km) point of it is stored', async () => {
  db.insert('user_addresses', { id: 'addr-1', user_id: IDS.ananya, label: 'Home', area: 'Golf Course Road', pincode: '122002', lat: 28.452, lng: 77.099, is_default: true });
  await toWhereStep();
  expect(screen.getByRole('button', { name: /Home/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(continueButton());
  fireEvent.click(screen.getByText('Send to nearby carers'));
  await screen.findByText('Your request');
  expect(db.one('broadcast_requests', { pet_parent_id: IDS.ananya })).toMatchObject({ area: 'Golf Course Road', address_lat: 28.45, address_lng: 77.1, mode: 'compare' });
});

test('if the request cannot be saved the parent is told and stays on the form', async () => {
  const realFrom = supabase.from;
  supabase.from = (t) => {
    const b = realFrom(t);
    if (t === 'broadcast_requests') b.insert = () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'permission denied' } }) }) });
    return b;
  };
  try {
    await toWhereStep();
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Sector 56' } });
    fireEvent.click(screen.getByRole('option', { name: /Sector 56/ }));
    fireEvent.click(continueButton());
    fireEvent.click(screen.getByText('Send to nearby carers'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send your request');
    expect(screen.queryByText('Your request')).toBeNull();
    await waitFor(() => expect(screen.getByText('Send to nearby carers')).toBeEnabled());
  } finally {
    supabase.from = realFrom;
  }
});
