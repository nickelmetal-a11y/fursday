/**
 * Unit tests for SitterDashboard.js. This file had several phone/email
 * reads switched over to the get_user_contact() RPC this session (see
 * CLAUDE.md Session 10) — these tests cover the OTP-driven walk
 * start/complete flow, which is where most of that landed.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SitterDashboard from './SitterDashboard';

let updateCalls, rpcCalls;
let notifyWalkStartedMock, notifyWalkCompletedMock, notifySitterArrivingMock;

jest.mock('./SitterEarningsDashboard', () => () => <div>Earnings</div>);
jest.mock('./supportContact', () => ({
  useSupportContact: () => ({ whatsapp: null }),
  openWhatsAppSupport: jest.fn(),
}));

jest.mock('./notificationService', () => ({
  notifyWalkStarted: jest.fn().mockResolvedValue(undefined),
  notifyWalkCompleted: jest.fn().mockResolvedValue(undefined),
  notifySitterArriving: jest.fn().mockResolvedValue(undefined),
  createNotification: (...args) => { (global.__notifications = global.__notifications || []).push(args); return Promise.resolve(); },
}));

const sitterProfileRow = {
  id: 'sitter-profile-9',
  user_id: 'sitter-user-9',
  status: 'active',
  city_id: 'city-1',
  users: { name: 'Priya' },
};

jest.mock('./supabase', () => {
  const makeSingleChain = (resolveValue) => ({
    eq: () => makeSingleChain(resolveValue),
    single: () => Promise.resolve(resolveValue),
  });

  const sitterProfilesTable = {
    select: () => ({ eq: () => makeSingleChain({ data: global.__sitterProfile }) }),
  };
  const bookingsTable = {
    select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: global.__bookings }) }) }),
    update: (fields) => { global.__updateCalls.push(fields); return { eq: () => Promise.resolve({ error: global.__updateError }) }; },
  };
  const petProfilesTable = {
    select: () => makeSingleChain({ data: { name: 'Bruno' } }),
  };
  const broadcastRequestsTable = {
    select: () => ({ eq: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }),
  };
  const messagesTable = {
    select: () => ({ in: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }) }) }),
  };

  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'sitter-user-9' } } }) },
      from: (table) => {
        if (table === 'sitter_profiles') return sitterProfilesTable;
        if (table === 'bookings') return bookingsTable;
        if (table === 'pet_profiles') return petProfilesTable;
        if (table === 'broadcast_requests') return broadcastRequestsTable;
        if (table === 'messages') return messagesTable;
        throw new Error('unexpected table: ' + table);
      },
      rpc: (fn, args) => {
        global.__rpcCalls.push({ fn, args });
        const contact = args.target_id === 'sitter-user-9'
          ? { phone: '9111111111', email: 'sitter@test.com' }
          : { phone: '9000000000', email: 'parent@test.com' };
        return Promise.resolve({ data: [contact], error: null });
      },
    },
  };
});

function makeBooking(overrides = {}) {
  return {
    id: 'booking-1',
    status: 'confirmed',
    service_type: 'walk30',
    pet_parent_id: 'parent-1',
    pet_id: 'pet-1',
    start_otp: '1234',
    gross_amount_paise: 34900,
    booking_date: '2026-12-01',
    time_slot: '09:00',
    users: { name: 'Rahul' },
    ...overrides,
  };
}

beforeEach(() => {
  global.__sitterProfile = sitterProfileRow;
  global.__bookings = [];
  global.__updateCalls = [];
  global.__updateError = null;
  global.__rpcCalls = [];
  updateCalls = global.__updateCalls;
  rpcCalls = global.__rpcCalls;
  notifyWalkStartedMock = require('./notificationService').notifyWalkStarted;
  notifyWalkCompletedMock = require('./notificationService').notifyWalkCompleted;
  notifySitterArrivingMock = require('./notificationService').notifySitterArriving;
  notifyWalkStartedMock.mockClear();
  notifyWalkCompletedMock.mockClear();
  notifySitterArrivingMock.mockClear();
  window.alert = jest.fn();
});

describe('SitterDashboard', () => {

  test('greets the sitter by their first name once loaded', async () => {
    render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
    expect(await screen.findByText(/Hi, Priya/)).toBeInTheDocument();
  });

  test('shows an empty state when there are no new requests', async () => {
    render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
    expect(await screen.findByText('No new requests')).toBeInTheDocument();
  });

  test('entering the wrong start OTP shows an error and does not start the walk', async () => {
    global.__bookings = [makeBooking({ status: 'confirmed' })];
    render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
    fireEvent.click(await screen.findByText('Upcoming'));

    fireEvent.change(screen.getByPlaceholderText('0000'), { target: { value: '9999' } });
    fireEvent.click(screen.getByText('Start'));

    expect(screen.getByText(/^Wrong code/)).toBeInTheDocument();
    expect(updateCalls).toHaveLength(0);
  });

  test('entering the correct start OTP starts the walk and notifies both parties', async () => {
    global.__bookings = [makeBooking({ status: 'confirmed' })];
    render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
    fireEvent.click(await screen.findByText('Upcoming'));

    fireEvent.change(screen.getByPlaceholderText('0000'), { target: { value: '1234' } });
    fireEvent.click(screen.getByText('Start'));

    await waitFor(() => expect(updateCalls).toContainEqual(expect.objectContaining({ status: 'active' })));
    await waitFor(() => expect(notifyWalkStartedMock).toHaveBeenCalledWith(
      'sitter-user-9', // sitterProfile.user_id, not sitter_profiles.id
      '9111111111',
      'parent-1',
      '9000000000', // resolved via get_user_contact, not a raw users.phone read
      'Bruno',
      'Priya'
    ));
  });

  test('completing a walk notifies both parties with the real sitter user id', async () => {
    global.__bookings = [makeBooking({ status: 'active' })];
    render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
    fireEvent.click(await screen.findByText('Active'));
    fireEvent.click(screen.getByText('Complete walk ✓'));

    await waitFor(() => expect(updateCalls).toContainEqual(expect.objectContaining({ status: 'completed' })));
    await waitFor(() => expect(notifyWalkCompletedMock).toHaveBeenCalledWith(
      'sitter-user-9',
      'sitter@test.com',
      '9111111111',
      'parent-1',
      'parent@test.com',
      '9000000000',
      'Bruno',
      'Priya'
    ));
  });

  test('marking "On my way" notifies the pet parent', async () => {
    global.__bookings = [makeBooking({ status: 'confirmed' })];
    render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
    fireEvent.click(await screen.findByText('Upcoming'));
    fireEvent.click(screen.getByText('🚶 On my way'));

    await waitFor(() => expect(notifySitterArrivingMock).toHaveBeenCalledWith('parent-1', 'Priya', 'on_way'));
  });

  test('accepting a new booking marks it confirmed', async () => {
    global.__bookings = [makeBooking({ status: 'pending' })];
    render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
    fireEvent.click(await screen.findByText('Accept ✓'));
    await waitFor(() => expect(updateCalls).toContainEqual({ status: 'confirmed' }));
  });

  test('declining a new booking cancels it', async () => {
    global.__bookings = [makeBooking({ status: 'pending' })];
    render(<SitterDashboard onBack={() => {}} city="Gurgaon" />);
    fireEvent.click(await screen.findByText('Decline'));
    await waitFor(() => expect(updateCalls).toContainEqual(expect.objectContaining({ status: 'cancelled', cancellation_reason: 'Declined by sitter' })));
  });
});
