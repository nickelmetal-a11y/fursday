/**
 * Unit tests for BroadcastRequest.js — covers the 3-step wizard and the
 * loadResponses contact-merging fix from this session (sitter phone
 * switched from a direct users(phone) embed to the get_user_contact() RPC,
 * extended to also authorize the pre-booking bidding case — see CLAUDE.md
 * Session 10).
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BroadcastRequest from './BroadcastRequest';

let insertedRequest, updateCalls, rpcCalls;

jest.mock('./supabase', () => {
  const makeSingleChain = (resolveValue) => ({
    eq: () => makeSingleChain(resolveValue),
    single: () => Promise.resolve(resolveValue),
  });
  const citiesTable = { select: () => makeSingleChain({ data: { id: 'city-1' } }) };
  const broadcastRequestsTable = {
    insert: (row) => { global.__insertedRequest = row; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'request-1' } }) }) }; },
    update: (fields) => { global.__updateCalls.push({ table: 'broadcast_requests', fields }); return { eq: () => Promise.resolve({ error: null }) }; },
  };
  const broadcastResponsesTable = {
    select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: global.__responses }) }) }),
    update: (fields) => { global.__updateCalls.push({ table: 'broadcast_responses', fields }); return { eq: () => Promise.resolve({ error: null }) }; },
  };

  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'parent-1' } } }) },
      from: (table) => {
        if (table === 'cities') return citiesTable;
        if (table === 'broadcast_requests') return broadcastRequestsTable;
        if (table === 'broadcast_responses') return broadcastResponsesTable;
        throw new Error('unexpected table: ' + table);
      },
      rpc: (fn, args) => {
        global.__rpcCalls.push({ fn, args });
        return Promise.resolve({ data: [{ phone: '9111111111', email: 'sitter@test.com' }], error: null });
      },
    },
  };
});

beforeEach(() => {
  global.__insertedRequest = null;
  global.__updateCalls = [];
  global.__responses = [];
  global.__rpcCalls = [];
  updateCalls = global.__updateCalls;
  rpcCalls = global.__rpcCalls;
});

const submitWizard = async () => {
  fireEvent.click(screen.getByText('Request a walker'));
  fireEvent.click(screen.getByText('Continue →'));
  fireEvent.click(await screen.findByText('6:00 AM'));
  fireEvent.click(screen.getByText('Continue →'));
  fireEvent.click(await screen.findByText('Other'));
  fireEvent.click(screen.getByText('📢 Send to all sitters'));
};

describe('BroadcastRequest', () => {

  test('submitting the wizard creates an open broadcast request for the right service/time/area', async () => {
    render(<BroadcastRequest onBack={() => {}} city="Gurgaon" />);
    await submitWizard();

    await waitFor(() => expect(global.__insertedRequest).toMatchObject({
      pet_parent_id: 'parent-1',
      city_id: 'city-1',
      service_type: 'walk30',
      scheduled_time: '6:00 AM',
      area: 'Other',
      status: 'open',
    }));
    expect(await screen.findByText('Request sent to all sitters!')).toBeInTheDocument();
  });

  test('resolves a responding sitter\'s phone via get_user_contact, not a direct embed', async () => {
    global.__responses = [{
      id: 'response-1',
      sitter_id: 'sitter-profile-9',
      offered_price: 349,
      sitter_profiles: { user_id: 'sitter-user-9', users: { name: 'Priya' } },
    }];
    render(<BroadcastRequest onBack={() => {}} city="Gurgaon" />);
    await submitWizard();

    expect(await screen.findByText('Priya')).toBeInTheDocument();
    await waitFor(() => expect(rpcCalls).toContainEqual({ fn: 'get_user_contact', args: { target_id: 'sitter-user-9' } }));
  });

  test('accepting a sitter marks the request filled and the response chosen', async () => {
    global.__responses = [{
      id: 'response-1',
      sitter_id: 'sitter-profile-9',
      offered_price: 349,
      sitter_profiles: { user_id: 'sitter-user-9', users: { name: 'Priya' } },
    }];
    const onBack = jest.fn();
    const onSitterAccepted = jest.fn();
    render(<BroadcastRequest onBack={onBack} city="Gurgaon" onSitterAccepted={onSitterAccepted} />);
    await submitWizard();

    fireEvent.click(await screen.findByText('Book this sitter'));

    await waitFor(() => expect(updateCalls).toContainEqual({ table: 'broadcast_requests', fields: { status: 'filled', chosen_sitter_id: 'sitter-profile-9' } }));
    expect(updateCalls).toContainEqual({ table: 'broadcast_responses', fields: { status: 'chosen' } });
    expect(onSitterAccepted).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});
