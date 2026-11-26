// Booking respects the sitter's availability: weekly days off, blocked dates
// and per-day slots from the calendar are crossed out and can't be picked.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import { toISODate } from '../AvailabilityCalendar';
import BookingFlow from '../BookingFlow';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));

const SUNITA = { id: IDS.sunita, name: 'सुनीता देवी', area: 'Gurgaon' };
const dayFrom = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const tileFor = (d) => screen.getAllByText(String(d.getDate()))[0].closest('[role="button"]');

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  db.signInAs(IDS.ananya);
  window.alert = jest.fn();
});

async function openDates() {
  render(<BookingFlow sitter={SUNITA} city="Gurgaon" onBack={jest.fn()} onNav={jest.fn()} />);
  fireEvent.click(await screen.findByText('Request a walker'));
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Pick a time');
}

test('CB1: a blocked date is crossed out and cannot be picked; other days still can', async () => {
  // Sunita has no weekly days set, so every day is open except the blocked one.
  db.insert('sitter_availability', { id: 'av-1', sitter_id: IDS.sunita, date: toISODate(dayFrom(2)), is_available: false, time_slots: [] });
  await openDates();
  await waitFor(() => expect(tileFor(dayFrom(2))).toHaveAttribute('aria-disabled', 'true'));
  expect(screen.getByText(/Crossed-out days and times/)).toBeInTheDocument();
  fireEvent.click(tileFor(dayFrom(2)));
  expect(tileFor(dayFrom(2))).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(tileFor(dayFrom(3)));
  expect(tileFor(dayFrom(3))).toHaveAttribute('aria-pressed', 'true');
});

test('CB2: an evening-only day disables morning times; evening times stay bookable', async () => {
  db.insert('sitter_availability', { id: 'av-2', sitter_id: IDS.sunita, date: toISODate(dayFrom(1)), is_available: true, time_slots: ['evening'] });
  await openDates();
  await waitFor(() => expect(tileFor(dayFrom(1))).not.toHaveAttribute('aria-disabled'));
  fireEvent.click(tileFor(dayFrom(1)));
  await waitFor(() => expect(screen.getByText('7:00 AM')).toBeDisabled());
  expect(screen.getByText('6:00 PM')).not.toBeDisabled();
  fireEvent.click(screen.getByText('6:00 PM'));
  expect(screen.getByText('6:00 PM')).toHaveAttribute('aria-pressed', 'true');
});

test('CB3: a weekly day off (Priya works Mon–Fri) is crossed out', async () => {
  render(<BookingFlow sitter={{ id: IDS.priya, name: 'Priya Kapoor', area: 'Gurgaon' }} city="Gurgaon" onBack={jest.fn()} onNav={jest.fn()} />);
  fireEvent.click(await screen.findByText('Request a walker'));
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Pick a time');
  const weekendOffset = [0, 1, 2, 3, 4, 5, 6].find(n => [0, 6].includes(dayFrom(n).getDay()));
  await waitFor(() => expect(tileFor(dayFrom(weekendOffset))).toHaveAttribute('aria-disabled', 'true'));
  const weekdayOffset = [0, 1, 2, 3, 4, 5, 6].find(n => ![0, 6].includes(dayFrom(n).getDay()));
  expect(tileFor(dayFrom(weekdayOffset))).not.toHaveAttribute('aria-disabled');
});
