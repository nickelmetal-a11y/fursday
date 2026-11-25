/**
 * Unit tests for BookingFlow.js. Covers UT-BKG-01..09.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BookingFlow from './BookingFlow';

let bookingInserts, notifJobInserts;

jest.mock('./notificationService', () => ({
  notifyHeatAdvisory: (...args) => global.__notifyHeatAdvisoryImpl(...args),
}));

jest.mock('./supabase', () => {
  const petTable = {
    select: () => petTable,
    eq: () => Promise.resolve({ data: [{ id: 'pet-1', name: 'Bruno', breed: 'Labrador' }] }),
  };
  const sitterTable = {
    select: () => sitterTable,
    eq: () => sitterTable,
    single: () => Promise.resolve({ data: { users: { phone: '9111111111' } } }),
  };
  const citiesTable = {
    select: () => citiesTable,
    eq: () => citiesTable,
    single: () => Promise.resolve({ data: { id: 'city-1' } }),
  };
  const bookingsTable = {
    insert: (row) => {
      global.__bookingInserts.push(row);
      return {
        select: () => ({ single: () => Promise.resolve({ data: { id: 'booking-1' }, error: null }) }),
      };
    },
  };
  const jobsTable = { insert: (row) => { global.__notifJobInserts.push(row); return Promise.resolve({ data: row, error: null }); } };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'parent-1', phone: '9000000000' } } }) },
      from: (table) => {
        if (table === 'pet_profiles') return petTable;
        if (table === 'sitter_profiles') return sitterTable;
        if (table === 'cities') return citiesTable;
        if (table === 'bookings') return bookingsTable;
        if (table === 'notification_jobs') return jobsTable;
        throw new Error('unexpected table: ' + table);
      },
    },
  };
});

const sitter = { id: 'sitter-1', name: 'Priya', area: 'Sector 45' };

async function goToStep1() {
  render(<BookingFlow sitter={sitter} city="Gurgaon" onBack={() => {}} />);
  fireEvent.click(await screen.findByText('Request a walker'));
  fireEvent.click(screen.getByText('Continue →'));
  await waitFor(() => expect(screen.getByText(/Pick a date & time/i)).toBeInTheDocument());
}

async function goToStep2() {
  await goToStep1();
  // Select the date first — selecting the time before a date is picked
  // momentarily renders with selectedDay still null.
  const dateCells = document.querySelectorAll('div[style*="width: 54px"]');
  fireEvent.click(dateCells[0]); // today
  fireEvent.click(screen.getAllByText('10:00 AM')[0]);
  fireEvent.click(screen.getByText('Continue →'));
  await waitFor(() => expect(screen.getByText(/Which pet/i)).toBeInTheDocument());
}

beforeEach(() => {
  global.__bookingInserts = [];
  global.__notifJobInserts = [];
  bookingInserts = global.__bookingInserts;
  notifJobInserts = global.__notifJobInserts;
  global.__notifyHeatAdvisoryImpl = () => Promise.resolve();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('BookingFlow', () => {

  // UT-BKG-01
  test('cannot continue past Step 1 (service) without picking a service', async () => {
    render(<BookingFlow sitter={sitter} city="Gurgaon" onBack={() => {}} />);
    fireEvent.click(screen.getByText('Continue →'));
    // Still on the service step — never advanced.
    expect(screen.getByText('What do you need?')).toBeInTheDocument();
  });

  test('cannot continue past Step 2 (schedule) without a date/time', async () => {
    await goToStep1();
    fireEvent.click(screen.getByText('Continue →'));
    expect(screen.getByText('Please select a date')).toBeInTheDocument();
    expect(screen.getByText(/Pick a date & time/i)).toBeInTheDocument();
  });

  // UT-BKG-02 — the real bug: this used to advance anyway.
  test('cannot continue past Step 3 (pet) with the aggression box unchecked', async () => {
    await goToStep2();
    fireEvent.click(await screen.findByText('Bruno'));
    fireEvent.click(screen.getByText('Continue →'));
    expect(screen.getByText('Please confirm your dog does not have aggression issues')).toBeInTheDocument();
    expect(screen.getByText(/Which pet/i)).toBeInTheDocument(); // did NOT advance to Review
  });

  test('checking the aggression box allows continuing to Review', async () => {
    await goToStep2();
    fireEvent.click(await screen.findByText('Bruno'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByText(/Review booking/i)).toBeInTheDocument());
  });

  // UT-BKG-03 — there's no raw date-picker input to type a past date into;
  // the 14-day strip is generated starting from today, so verify it never
  // offers anything before today instead.
  test('the date picker never offers a day before today', async () => {
    await goToStep1();
    const today = new Date();
    const dateCells = document.querySelectorAll('div[style*="width: 54px"]');
    const firstCellDateNum = parseInt(dateCells[0].querySelector('div:nth-child(2)').textContent, 10);
    expect(firstCellDateNum).toBe(today.getDate());
    expect(dateCells.length).toBe(14); // today + next 13 days, nothing earlier
  });

  // UT-BKG-04
  test('service prices match the price table', async () => {
    render(<BookingFlow sitter={sitter} city="Gurgaon" onBack={() => {}} />);
    expect(await screen.findByText('Rs.349')).toBeInTheDocument(); // Request a walker
    expect(screen.getByText('Rs.849')).toBeInTheDocument(); // Home boarding
    expect(screen.getByText('Rs.649')).toBeInTheDocument(); // Doggy daycare
  });

  // UT-BKG-05
  test('shows the heat advisory when the booking date falls in a hot month', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-10T09:00:00'));
    await goToStep2();
    fireEvent.click(await screen.findByText('Bruno'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByText('Heat Advisory')).toBeInTheDocument());
  });

  // UT-BKG-06
  test('no heat advisory when the booking date falls in a cool month', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-10T09:00:00'));
    await goToStep2();
    fireEvent.click(await screen.findByText('Bruno'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByText(/Review booking/i)).toBeInTheDocument());
    expect(screen.queryByText('Heat Advisory')).not.toBeInTheDocument();
  });

  // UT-BKG-07
  test('dismissing the heat advisory hides it and it stays hidden', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-10T09:00:00'));
    await goToStep2();
    fireEvent.click(await screen.findByText('Bruno'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByText('Heat Advisory')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByText('Heat Advisory')).not.toBeInTheDocument();

    // Re-render-triggering interaction (typing, etc.) must not bring it back.
    fireEvent.click(screen.getByText('← Back'));
    fireEvent.click(screen.getByText('Continue →'));
    expect(screen.queryByText('Heat Advisory')).not.toBeInTheDocument();
  });

  // UT-BKG-08
  test('repeat booking pre-fills service and pet, skipping the service step', async () => {
    const repeatBooking = { service_type: 'walk30', pet_id: 'pet-1' };
    render(<BookingFlow sitter={sitter} city="Gurgaon" onBack={() => {}} repeatBooking={repeatBooking} />);
    // Starts straight on the schedule step, not "What do you need?"
    expect(screen.getByText(/Pick a date & time/i)).toBeInTheDocument();
    expect(screen.queryByText('What do you need?')).not.toBeInTheDocument();
  });

  // UT-BKG-09
  test('a failed heat-advisory notification does not block the booking from succeeding', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-10T09:00:00'));
    global.__notifyHeatAdvisoryImpl = () => Promise.reject(new Error('SMS provider down'));

    await goToStep2();
    fireEvent.click(await screen.findByText('Bruno'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Continue →'));
    await waitFor(() => expect(screen.getByText(/Review booking/i)).toBeInTheDocument());

    fireEvent.click(screen.getByText('Request booking 🐾'));

    await waitFor(() => expect(screen.getByText('Booking requested!')).toBeInTheDocument());
    expect(bookingInserts).toHaveLength(1);
  });
});
