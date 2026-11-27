// A parent picks a sitter's offer on a nearby request; booking opens with the
// request's date, time, pet and the agreed price, and starts confirmed.
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import BookingFlow from '../BookingFlow';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../paymentsClient', () => require('../testing/fakePayments'));

const PRIYA = { id: IDS.priya, name: 'Priya Kapoor', area: 'Gurgaon', services: [{ service_type: 'walk30', price_paise: 40000 }] };
const localISO = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  window.alert = jest.fn();
});

test('the chosen offer pre-fills the booking, uses the agreed price and links the request', async () => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); // Priya works Mon–Fri
  db.insert('broadcast_requests', { id: 'req-1', pet_parent_id: IDS.ananya, service_type: 'walk30', scheduled_date: localISO(d), scheduled_time: '7:00 AM', status: 'filled', chosen_sitter_id: IDS.priya });
  db.signInAs(IDS.ananya);
  render(<BookingFlow onBack={jest.fn()} sitter={PRIYA} city="Gurgaon" initialService="walk30"
    repeatBooking={{ service_type: 'walk30', pet_id: IDS.bruno }}
    initialDate={localISO(d)} initialTime="7:00 AM" agreedPriceRupees={350} broadcastRequestId="req-1" />);

  await screen.findByText('Pick a time');
  await new Promise(r => setTimeout(r, 30));
  expect(screen.getByText('7:00 AM').closest('button')).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Which pet?');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Review booking');
  expect(screen.getByText('Total').parentElement.textContent).toMatch(/Rs\.350/);

  fireEvent.click(screen.getByText('Request booking 🐾'));
  await waitFor(() => expect(db.rows('bookings', { pet_parent_id: IDS.ananya, booking_date: localISO(d), time_slot: '7:00 AM' })).toHaveLength(1));
  const [row] = db.rows('bookings', { pet_parent_id: IDS.ananya, booking_date: localISO(d), time_slot: '7:00 AM' });
  expect(row).toMatchObject({ status: 'confirmed', sitter_id: IDS.priya, pet_id: IDS.bruno, gross_amount_paise: 35000, sitter_payout_paise: 35000 });
  await waitFor(() => expect(db.one('broadcast_requests', { id: 'req-1' }).booking_id).toBe(row.id));
});
