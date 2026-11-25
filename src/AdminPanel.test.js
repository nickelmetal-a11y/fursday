/**
 * Unit tests for AdminPanel.js. Covers the access gate (real Supabase
 * is_admin check -> dashboard; no client-side password) and the
 * sitter_profiles.id vs users.id notification-routing fixes in
 * approveSitter/markPayoutPaid. See CLAUDE.md Session 10.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';

let mockUser, updateCalls;

jest.mock('./AdminAuditLogs', () => () => <div>Audit logs</div>);
jest.mock('./AdminDisputes', () => () => <div>Disputes</div>);

jest.mock('./auditService', () => ({
  logSitterApproved: jest.fn().mockResolvedValue(undefined),
  logSitterRejected: jest.fn().mockResolvedValue(undefined),
  logSitterSuspended: jest.fn().mockResolvedValue(undefined),
  logTopSitterToggled: jest.fn().mockResolvedValue(undefined),
  logPayoutMarkedPaid: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
  notifySitterRejected: jest.fn().mockResolvedValue(undefined),
  notifySitterSuspended: jest.fn().mockResolvedValue(undefined),
  notifyTopSitterAwarded: jest.fn().mockResolvedValue(undefined),
  notifyPayoutMarked: jest.fn().mockResolvedValue(undefined),
  notifyReferralBonusPaid: jest.fn().mockResolvedValue(undefined),
  notifyAdminAction: jest.fn().mockResolvedValue(undefined),
  notifyPerformanceBadge: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('./supabase', () => {
  // A single sitter_profiles.select() call shape routes to one of these
  // canned single-row lookups; '*, users(name)...' (the initial list load)
  // instead resolves as an awaitable array via .order().
  const singleRowChains = {
    'users(id, name)': { data: { users: { id: 'sitter-user-9', name: 'Priya' } } },
    'users(id)': { data: { users: { id: 'sitter-user-9' } } },
    'user_id, users(name)': { data: { user_id: 'sitter-user-9', users: { name: 'Priya' } } },
    'sitter_id': { data: { sitter_id: 'sitter-profile-9' } },
  };

  const makeSingleChain = (resolveValue) => ({
    eq: () => makeSingleChain(resolveValue),
    single: () => Promise.resolve(resolveValue),
  });

  const sitterProfilesTable = {
    select: (cols) => {
      if (cols.includes('cities(name)')) {
        return { order: () => Promise.resolve({ data: global.__pendingSitters }) };
      }
      return makeSingleChain(singleRowChains[cols] || { data: null });
    },
    update: (fields) => { global.__updateCalls.push({ table: 'sitter_profiles', fields }); return { eq: () => Promise.resolve({ error: null }) }; },
  };

  const bookingsTable = {
    select: (cols) => {
      if (cols === 'sitter_id') return makeSingleChain(singleRowChains['sitter_id']);
      return { order: () => ({ limit: () => Promise.resolve({ data: global.__unpaidBookings }) }) };
    },
    update: (fields) => { global.__updateCalls.push({ table: 'bookings', fields }); return { eq: () => Promise.resolve({ error: null }) }; },
  };

  const referralBonusesTable = {
    select: () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: global.__pendingBonus }) }) }) }),
    update: (fields) => { global.__updateCalls.push({ table: 'referral_bonuses', fields }); return { eq: () => Promise.resolve({ error: null }) }; },
  };

  const usersTable = {
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { is_admin: global.__isAdmin } }) }) }),
  };

  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: global.__mockUser } }) },
      from: (table) => {
        if (table === 'sitter_profiles') return sitterProfilesTable;
        if (table === 'bookings') return bookingsTable;
        if (table === 'referral_bonuses') return referralBonusesTable;
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

const AdminPanel = require('./AdminPanel').default;

function renderAdminPanel() {
  return render(<AdminPanel />);
}

beforeEach(() => {
  mockUser = { id: 'admin-1' };
  global.__mockUser = mockUser;
  global.__isAdmin = true;
  global.__rpcCalls = [];
  global.__updateCalls = [];
  global.__pendingSitters = [];
  global.__unpaidBookings = [];
  global.__pendingBonus = null;
  updateCalls = global.__updateCalls;
});

describe('AdminPanel access gate', () => {

  test('there is no password screen', () => {
    renderAdminPanel();
    expect(screen.queryByPlaceholderText('Admin password')).not.toBeInTheDocument();
  });

  test('a logged-in account without is_admin is blocked', async () => {
    global.__isAdmin = false;
    renderAdminPanel();
    expect(await screen.findByText('Not signed in as an admin')).toBeInTheDocument();
  });

  test('no logged-in Supabase session is blocked', async () => {
    global.__mockUser = null;
    renderAdminPanel();
    expect(await screen.findByText('Not signed in as an admin')).toBeInTheDocument();
  });

  test('a real is_admin account goes straight to the dashboard', async () => {
    renderAdminPanel();
    expect(await screen.findByText('Fursday Admin')).toBeInTheDocument();
    expect(screen.getByText('No pending applications')).toBeInTheDocument();
  });
});

describe('AdminPanel sitter actions', () => {
  const signIn = async () => {
    renderAdminPanel();
    await screen.findByText('Fursday Admin');
  };

  test('approving a sitter notifies them at their real users.id, not sitter_profiles.id', async () => {
    global.__pendingSitters = [{
      id: 'sitter-profile-9',
      user_id: 'sitter-user-9',
      status: 'pending',
      users: { name: 'Priya' },
      cities: { name: 'Gurgaon' },
      sitter_services: [],
      created_at: new Date().toISOString(),
    }];
    await signIn();

    fireEvent.click(await screen.findByText('Approve'));

    const { createNotification } = require('./notificationService');
    await waitFor(() => expect(createNotification).toHaveBeenCalledWith(
      'sitter-user-9', 'sitter_approved', '🎉 Account Approved!', expect.any(String)
    ));
    expect(updateCalls).toContainEqual({ table: 'sitter_profiles', fields: { status: 'active' } });
  });

  test('marking a payout paid resolves the sitter real users.id for both the payout and any pending referral bonus', async () => {
    global.__unpaidBookings = [{
      id: 'booking-1',
      booking_ref: 'FUR123456',
      status: 'completed',
      payout_status: 'pending',
      service_type: 'walk30',
      gross_amount_paise: 34900,
      created_at: new Date().toISOString(),
      cities: { name: 'Gurgaon' },
    }];
    global.__pendingBonus = { id: 'bonus-1', amount: 100 };
    await signIn();

    fireEvent.click(screen.getByRole('button', { name: /Payouts \(/ }));
    fireEvent.click(await screen.findByText('Mark paid'));

    const { notifyPayoutMarked, notifyReferralBonusPaid } = require('./notificationService');
    // 34900 paise gross * 0.85 (flat 15% commission) = 29665 paise net,
    // rounded to the nearest rupee by markPayoutPaid's caller -> 29700.
    await waitFor(() => expect(notifyPayoutMarked).toHaveBeenCalledWith(
      'sitter-user-9', 'sitter@test.com', '9111111111', 29700, 1, expect.any(String)
    ));
    await waitFor(() => expect(notifyReferralBonusPaid).toHaveBeenCalledWith(
      'sitter-user-9', 'sitter@test.com', '9111111111', 100, 'Someone'
    ));
    expect(updateCalls).toContainEqual({ table: 'bookings', fields: { payout_status: 'paid' } });
    expect(updateCalls).toContainEqual({ table: 'referral_bonuses', fields: { status: 'paid' } });
  });
});
