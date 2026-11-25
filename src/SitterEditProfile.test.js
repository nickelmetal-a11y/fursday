/**
 * Unit tests for SitterEditProfile.js. Covers loadProfile's rendering and
 * handleSave's persistence (bio/services/photos). Avatar/portfolio photo
 * upload (compressImage via FileReader/canvas) isn't covered here — jsdom
 * has no canvas implementation, and neither was touched this session
 * (only an unused phone field was dropped from the profile select).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SitterEditProfile from './SitterEditProfile';

let deleteCalls, insertCalls, updateCalls;

const sitterProfileRow = {
  id: 'sitter-profile-9',
  user_id: 'sitter-user-9',
  status: 'active',
  bio: 'Experienced dog walker',
  languages: ['Hindi', 'English'],
  is_paused: false,
  aadhaar_number: '123412341234',
  users: { name: 'Priya' },
};

jest.mock('./supabase', () => {
  const makeSingleChain = (resolveValue) => ({
    eq: () => makeSingleChain(resolveValue),
    single: () => Promise.resolve(resolveValue),
    maybeSingle: () => Promise.resolve(resolveValue),
  });
  const sitterProfilesTable = {
    select: () => ({ eq: () => makeSingleChain({ data: global.__sitterProfile }) }),
    update: (fields) => { global.__updateCalls.push({ table: 'sitter_profiles', fields }); return { eq: () => Promise.resolve({ error: null }) }; },
  };
  const sitterPiiTable = {
    select: () => ({ eq: () => makeSingleChain({ data: { aadhaar_number: global.__sitterProfile?.aadhaar_number, upi_id: 'priya@upi' } }) }),
    upsert: (fields) => { global.__insertCalls.push({ table: 'sitter_pii', fields }); return Promise.resolve({ error: null }); },
  };
  const photosTable = {
    select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [] }) }) }),
    delete: () => { global.__deleteCalls.push('sitter_profile_photos'); return { eq: () => Promise.resolve({ error: null }) }; },
    insert: (rows) => { global.__insertCalls.push({ table: 'sitter_profile_photos', rows }); return Promise.resolve({ error: null }); },
  };
  const servicesTable = {
    select: () => ({ eq: () => Promise.resolve({ data: [] }) }),
    delete: () => { global.__deleteCalls.push('sitter_services'); return { eq: () => Promise.resolve({ error: null }) }; },
    insert: (rows) => { global.__insertCalls.push({ table: 'sitter_services', rows }); return Promise.resolve({ error: null }); },
  };
  const bookingsTable = { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };

  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'sitter-user-9' } } }) },
      from: (table) => {
        if (table === 'sitter_profiles') return sitterProfilesTable;
        if (table === 'sitter_pii') return sitterPiiTable;
        if (table === 'sitter_profile_photos') return photosTable;
        if (table === 'sitter_services') return servicesTable;
        if (table === 'bookings') return bookingsTable;
        throw new Error('unexpected table: ' + table);
      },
    },
  };
});

beforeEach(() => {
  global.__sitterProfile = sitterProfileRow;
  global.__deleteCalls = [];
  global.__insertCalls = [];
  global.__updateCalls = [];
  deleteCalls = global.__deleteCalls;
  insertCalls = global.__insertCalls;
  updateCalls = global.__updateCalls;
});

describe('SitterEditProfile', () => {

  test('shows the sitter name and live status once loaded', async () => {
    render(<SitterEditProfile onBack={() => {}} city="Gurgaon" />);
    expect(await screen.findByText('Priya')).toBeInTheDocument();
    expect(screen.getByText(/Live 🟢/)).toBeInTheDocument();
  });

  test('saving persists bio/profile fields to sitter_profiles', async () => {
    render(<SitterEditProfile onBack={() => {}} city="Gurgaon" />);
    await screen.findByText('Priya');

    fireEvent.change(screen.getByPlaceholderText('Tell pet parents about yourself...'), { target: { value: 'Updated bio text here' } });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(updateCalls).toContainEqual(expect.objectContaining({
      table: 'sitter_profiles',
      fields: expect.objectContaining({ bio: 'Updated bio text here' }),
    })));
    expect(await screen.findByText('✓ Changes saved!')).toBeInTheDocument();
  });

  test('toggling a service on and saving inserts it with a price', async () => {
    render(<SitterEditProfile onBack={() => {}} city="Gurgaon" />);
    await screen.findByText('Priya');

    fireEvent.click(screen.getByText('Services'));
    fireEvent.click(screen.getByRole('switch', { name: 'Request a walker toggle' }));
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => expect(deleteCalls).toContain('sitter_services'));
    expect(insertCalls).toContainEqual(expect.objectContaining({
      table: 'sitter_services',
      rows: [expect.objectContaining({ sitter_id: 'sitter-profile-9', service_type: 'walk30' })],
    }));
  });

  test('a valid UPI id shows a confirmation checkmark', async () => {
    render(<SitterEditProfile onBack={() => {}} city="Gurgaon" />);
    await screen.findByText('Priya');

    fireEvent.click(screen.getByText('Payout'));
    fireEvent.change(screen.getByPlaceholderText('e.g. yourname@paytm'), { target: { value: 'priya@paytm' } });
    expect(await screen.findByText('UPI ID looks good')).toBeInTheDocument();
  });
});
