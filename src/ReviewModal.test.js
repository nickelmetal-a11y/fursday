/**
 * Unit tests for ReviewModal.js — the post-booking 5-star review flow.
 * Previously untested across several sessions (see CLAUDE.md).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReviewModal from './ReviewModal';

let insertedRows, rpcCalls;
let notifyReviewReceivedMock, notifyRatingUpdateMock;

jest.mock('./notificationService', () => ({
  notifyReviewReceived: jest.fn().mockResolvedValue(undefined),
  notifyRatingUpdate: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./supabase', () => {
  const reviewsTable = {
    insert: (row) => { global.__insertedRows.push(row); return Promise.resolve({ data: row, error: null }); },
  };
  const sitterTable = {
    select: () => sitterTable,
    eq: () => sitterTable,
    single: () => Promise.resolve({ data: { user_id: 'sitter-user-9', users: { name: 'Priya' }, rating: 4.5 } }),
  };
  return {
    supabase: {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'parent-1', user_metadata: { name: 'Rahul' } } } }),
      },
      from: (table) => {
        if (table === 'reviews') return reviewsTable;
        if (table === 'sitter_profiles') return sitterTable;
        throw new Error('unexpected table: ' + table);
      },
      rpc: (fn, args) => {
        global.__rpcCalls.push({ fn, args });
        return Promise.resolve({ data: [{ email: 'sitter@test.com', phone: '9111111111' }], error: null });
      },
    },
  };
});

function makeBooking(overrides = {}) {
  return {
    id: 'booking-1',
    sitter_id: 'sitter-profile-9',
    pet_parent_id: 'parent-1',
    sitter_name: 'Priya',
    pet_name: 'Bruno',
    ...overrides,
  };
}

beforeEach(() => {
  global.__insertedRows = [];
  global.__rpcCalls = [];
  insertedRows = global.__insertedRows;
  rpcCalls = global.__rpcCalls;
  notifyReviewReceivedMock = require('./notificationService').notifyReviewReceived;
  notifyRatingUpdateMock = require('./notificationService').notifyRatingUpdate;
  notifyReviewReceivedMock.mockClear();
  notifyRatingUpdateMock.mockClear();
});

describe('ReviewModal', () => {

  test('shows the sitter name in the prompt', () => {
    render(<ReviewModal booking={makeBooking()} onClose={() => {}} />);
    expect(screen.getByText(/How was your experience with Priya/)).toBeInTheDocument();
  });

  test('submit is disabled until a star rating is picked', () => {
    render(<ReviewModal booking={makeBooking()} onClose={() => {}} />);
    expect(screen.getByText('Submit review').closest('button')).toBeDisabled();
  });

  // The modal's close (X) button also renders an svg, so it matches the
  // same selector as the 5 star buttons — drop it to get just the stars.
  const getStarButtons = () => screen.getAllByRole('button').filter(b => b.querySelector('svg')).slice(1);

  test('picking a star enables submit and shows the rating label', () => {
    render(<ReviewModal booking={makeBooking()} onClose={() => {}} />);
    const stars = getStarButtons();
    fireEvent.click(stars[3]); // 4th star = rating 4
    expect(screen.getByText('Very good')).toBeInTheDocument();
    expect(screen.getByText('Submit review').closest('button')).not.toBeDisabled();
  });

  test('rejects a review shorter than 10 characters, no insert happens', async () => {
    const onSubmitted = jest.fn();
    render(<ReviewModal booking={makeBooking()} onClose={() => {}} onSubmitted={onSubmitted} />);
    const stars = getStarButtons();
    fireEvent.click(stars[4]);
    fireEvent.change(screen.getByPlaceholderText(/Tell other pet parents/i), { target: { value: 'too short' } });
    fireEvent.click(screen.getByText('Submit review'));

    expect(await screen.findByText('Review must be at least 10 characters')).toBeInTheDocument();
    expect(insertedRows).toHaveLength(0);
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  test('a valid review inserts the right row and notifies the sitter', async () => {
    const onSubmitted = jest.fn();
    render(<ReviewModal booking={makeBooking()} onClose={() => {}} onSubmitted={onSubmitted} />);
    const stars = getStarButtons();
    fireEvent.click(stars[4]); // 5 stars
    fireEvent.change(screen.getByPlaceholderText(/Tell other pet parents/i), { target: { value: 'Excellent care for Bruno!' } });
    fireEvent.click(screen.getByText('Submit review'));

    await waitFor(() => expect(insertedRows).toHaveLength(1));
    expect(insertedRows[0]).toMatchObject({
      booking_id: 'booking-1',
      sitter_id: 'sitter-profile-9',
      reviewer_id: 'parent-1',
      rating: 5,
      review_text: 'Excellent care for Bruno!',
    });

    // notifications must target the sitter's real users.id (sitter-user-9),
    // not sitter_profiles.id (sitter-profile-9) — notifications.user_id has
    // a hard FK to users, so the wrong id here means a silent insert failure.
    await waitFor(() => expect(notifyReviewReceivedMock).toHaveBeenCalledWith(
      'sitter-user-9',
      'sitter@test.com',
      5,
      'Rahul',
      'Bruno',
      'Excellent care for Bruno!'
    ));
    expect(notifyRatingUpdateMock).toHaveBeenCalledWith('sitter-user-9', '9111111111', 4.5, 5);
    expect(rpcCalls[0]).toMatchObject({ fn: 'get_user_contact', args: { target_id: 'sitter-user-9' } });

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
  });

  test('Skip closes without submitting anything', () => {
    const onClose = jest.fn();
    render(<ReviewModal booking={makeBooking()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Skip'));
    expect(onClose).toHaveBeenCalled();
    expect(insertedRows).toHaveLength(0);
  });
});
