/**
 * Unit tests for DisputeForm.js — filing a dispute was completely broken
 * before this session (insert referenced columns that didn't exist: see
 * CLAUDE.md Session 10). These tests lock in the fix.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DisputeForm from './DisputeForm';

let insertedRows, rpcCalls;
let notifyDisputeFiledMock;

jest.mock('./notificationService', () => ({
  notifyDisputeFiled: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./supabase', () => {
  const disputesTable = {
    insert: (row) => { global.__insertedRows.push(row); return disputesTable; },
    select: () => disputesTable,
    single: () => Promise.resolve({ data: {}, error: null }),
  };
  const sitterTable = {
    select: () => sitterTable,
    eq: () => sitterTable,
    single: () => Promise.resolve({ data: { users: { id: 'sitter-user-9', name: 'Priya' } } }),
  };
  return {
    supabase: {
      auth: {
        getUser: () => Promise.resolve({ data: { user: { id: 'parent-1' } } }),
      },
      from: (table) => {
        if (table === 'disputes') return disputesTable;
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

const booking = { id: 'booking-1', sitter_id: 'sitter-profile-9' };

beforeEach(() => {
  global.__insertedRows = [];
  global.__rpcCalls = [];
  insertedRows = global.__insertedRows;
  rpcCalls = global.__rpcCalls;
  notifyDisputeFiledMock = require('./notificationService').notifyDisputeFiled;
  notifyDisputeFiledMock.mockClear();
  window.alert = jest.fn();
});

describe('DisputeForm', () => {

  test('shows the sitter name in the title', () => {
    render(<DisputeForm booking={booking} sitterName="Priya" onClose={() => {}} />);
    expect(screen.getByText('File Dispute with Priya')).toBeInTheDocument();
  });

  test('refuses to file with missing fields', () => {
    render(<DisputeForm booking={booking} sitterName="Priya" onClose={() => {}} />);
    fireEvent.click(screen.getByText('File Dispute'));
    expect(window.alert).toHaveBeenCalledWith('Please fill in all fields');
    expect(insertedRows).toHaveLength(0);
  });

  test('a complete dispute inserts the right row and notifies the sitter', async () => {
    const onDisputeFiled = jest.fn();
    const onClose = jest.fn();
    render(<DisputeForm booking={booking} sitterName="Priya" onClose={onClose} onDisputeFiled={onDisputeFiled} />);

    fireEvent.click(screen.getByText('⭐ Quality Issue'));
    fireEvent.change(screen.getByPlaceholderText('Brief title of issue'), { target: { value: 'Dog came back dirty' } });
    fireEvent.change(screen.getByPlaceholderText('Describe what happened...'), { target: { value: 'Was not bathed as promised' } });
    fireEvent.click(screen.getByText('File Dispute'));

    await waitFor(() => expect(insertedRows).toHaveLength(1));
    expect(insertedRows[0]).toMatchObject({
      booking_id: 'booking-1',
      reported_user_id: 'sitter-profile-9', // who the dispute is against
      reported_by: 'parent-1',               // who filed it (not "reporter_id" - that column never existed)
      dispute_type: 'quality_complaint',
      title: 'Dog came back dirty',
      description: 'Was not bathed as promised',
      status: 'open',
    });

    // notification must target the sitter's real users.id, not sitter_profiles.id
    await waitFor(() => expect(notifyDisputeFiledMock).toHaveBeenCalledWith(
      'sitter-user-9',
      'sitter@test.com',
      '9111111111',
      'Pet Parent',
      'quality_complaint',
      'Dog came back dirty'
    ));
    expect(rpcCalls[0]).toMatchObject({ fn: 'get_user_contact', args: { target_id: 'sitter-user-9' } });

    await waitFor(() => expect(onDisputeFiled).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  test('Cancel closes without filing anything', () => {
    const onClose = jest.fn();
    render(<DisputeForm booking={booking} sitterName="Priya" onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
    expect(insertedRows).toHaveLength(0);
  });
});
