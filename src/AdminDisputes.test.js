/**
 * Unit tests for AdminDisputes.js. Before this session, `disputes` had no
 * UPDATE policy at all, so resolveDispute()'s update was silently denied by
 * RLS while the UI still said "Dispute resolved!" — the unchecked error was
 * fixed to throw/surface instead. See CLAUDE.md Session 10.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminDisputes from './AdminDisputes';

let updateCalls, updateError, rpcCalls;
let notifyDisputeResolvedMock;

jest.mock('./notificationService', () => ({
  notifyDisputeResolved: jest.fn().mockResolvedValue(undefined),
}));

const sampleDispute = {
  id: 'dispute-1',
  booking_id: 'booking-1',
  dispute_type: 'quality_complaint',
  title: 'Dog came back dirty',
  description: 'Was not bathed as promised',
  status: 'open',
  reported_user_id: 'sitter-user-9',
  created_at: new Date().toISOString(),
  bookings: { booking_ref: 'FUR123456', gross_amount_paise: 34900 },
};

jest.mock('./supabase', () => {
  // Two separate chain shapes, matching the two separate things this
  // component does with `disputes`: reading (select/order/eq, optionally
  // narrowed with .single()) and writing (update().eq()). Keeping them
  // distinct avoids ambiguity over what a bare `await` on the chain means.
  const listChain = {
    select: () => listChain,
    order: () => listChain,
    eq: () => listChain,
    single: () => Promise.resolve({ data: { reported_by: 'parent-user-1', reported_user_id: 'sitter-user-9' } }),
    then: (resolve) => resolve({ data: global.__disputes, error: null }),
  };
  const updateChain = {
    eq: () => Promise.resolve({ error: global.__updateError }),
  };
  const disputesTable = {
    select: () => listChain,
    update: (fields) => { global.__updateCalls.push(fields); return updateChain; },
  };
  const usersTable = {
    select: () => usersTable,
    eq: () => usersTable,
    single: () => Promise.resolve({ data: { name: 'Priya' } }),
  };
  return {
    supabase: {
      from: (table) => {
        if (table === 'disputes') return disputesTable;
        if (table === 'users') return usersTable;
        throw new Error('unexpected table: ' + table);
      },
      rpc: (fn, args) => {
        global.__rpcCalls.push({ fn, args });
        return Promise.resolve({ data: [{ email: 'sitter@test.com', phone: '9111111111' }], error: null });
      },
    },
  };
});

beforeEach(() => {
  global.__disputes = [sampleDispute];
  global.__updateCalls = [];
  global.__updateError = null;
  global.__rpcCalls = [];
  updateCalls = global.__updateCalls;
  rpcCalls = global.__rpcCalls;
  notifyDisputeResolvedMock = require('./notificationService').notifyDisputeResolved;
  notifyDisputeResolvedMock.mockClear();
  window.alert = jest.fn();
});

describe('AdminDisputes', () => {

  test('lists open disputes with their booking ref', async () => {
    render(<AdminDisputes />);
    await waitFor(() => expect(screen.getByText('Dog came back dirty · FUR123456')).toBeInTheDocument());
  });

  test('selecting a dispute shows its detail and a resolution form', async () => {
    render(<AdminDisputes />);
    await waitFor(() => screen.getByText(/Dog came back dirty/));
    fireEvent.click(screen.getByText(/Dog came back dirty/));
    expect(screen.getByText('Resolution')).toBeInTheDocument();
  });

  test('requires picking a resolution before resolving', async () => {
    render(<AdminDisputes />);
    await waitFor(() => screen.getByText(/Dog came back dirty/));
    fireEvent.click(screen.getByText(/Dog came back dirty/));
    fireEvent.click(screen.getByText('Resolve Dispute'));
    expect(window.alert).toHaveBeenCalledWith('Please select a resolution');
    expect(updateCalls).toHaveLength(0);
  });

  test('resolving with a refund updates the dispute and tells both the parent (with the refund) and the sitter', async () => {
    render(<AdminDisputes />);
    await waitFor(() => screen.getByText(/Dog came back dirty/));
    fireEvent.click(screen.getByText(/Dog came back dirty/));

    fireEvent.click(screen.getByLabelText('100% Refund') || screen.getByDisplayValue('refund_full'));
    fireEvent.change(screen.getByPlaceholderText('Refund amount (Rs.)'), { target: { value: '349' } });
    fireEvent.click(screen.getByText('Resolve Dispute'));

    await waitFor(() => expect(updateCalls).toHaveLength(1));
    expect(updateCalls[0]).toMatchObject({ status: 'resolved', resolution: 'refund_full', refund_amount: 349 });

    await waitFor(() => expect(notifyDisputeResolvedMock).toHaveBeenCalledTimes(2));
    expect(notifyDisputeResolvedMock).toHaveBeenCalledWith('parent-user-1', expect.anything(), expect.anything(), 'Fursday', 'refund_full', 34900);
    expect(notifyDisputeResolvedMock).toHaveBeenCalledWith('sitter-user-9', 'sitter@test.com', '9111111111', 'Fursday', 'refund_full', 0);
    expect(rpcCalls.map(c => c.args.target_id)).toEqual(['parent-user-1', 'sitter-user-9']);
    expect(window.alert).toHaveBeenCalledWith('Dispute resolved!');
  });

  test('if the update is denied by RLS, the error surfaces instead of claiming success', async () => {
    global.__updateError = { message: 'permission denied' };
    render(<AdminDisputes />);
    await waitFor(() => screen.getByText(/Dog came back dirty/));
    fireEvent.click(screen.getByText(/Dog came back dirty/));

    fireEvent.click(screen.getByDisplayValue('no_refund'));
    fireEvent.click(screen.getByText('Resolve Dispute'));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Error resolving dispute: permission denied'));
    expect(window.alert).not.toHaveBeenCalledWith('Dispute resolved!');
  });
});
