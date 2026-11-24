/**
 * Unit tests for AdminPanel.js. Covers the three-stage access gate added
 * this session (password -> real Supabase admin check -> dashboard) and the
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

// AdminPanel.js reads REACT_APP_ADMIN_PASSWORD into a module-level const at
// import time, so it must be set before AdminPanel is required — and only
// once: jest.resetModules() (to re-read a different env value later) would
// force a second, separate copy of React alongside the one already bound to
// @testing-library/react's static import above, breaking every hook.
process.env.REACT_APP_ADMIN_PASSWORD = 'secret123';
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

  test('wrong password shows an error and does not get past the gate', () => {
    renderAdminPanel();
    fireEvent.change(screen.getByPlaceholderText('Admin password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByText('Sign in'));
    expect(screen.getByText('Wrong password')).toBeInTheDocument();
  });

  // The "REACT_APP_ADMIN_PASSWORD not configured" message (login() in
  // AdminPanel.js, for when env var is empty) isn't covered by a render
  // test here — ADMIN_PASSWORD is captured into a module-level const at
  // import time, and varying it per-test would require jest.resetModules(),
  // which breaks React's hook dispatcher across the forced re-import (see
  // the note above). It's a one-line ternary; low risk to leave unverified.

  test('correct password but not a real is_admin account blocks the dashboard', async () => {
    global.__isAdmin = false;
    renderAdminPanel();
    fireEvent.change(screen.getByPlaceholderText('Admin password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByText('Sign in'));
    expect(await screen.findByText('Not signed in as an admin')).toBeInTheDocument();
  });

  test('no logged-in Supabase session also blocks the dashboard, even with the right password', async () => {
    global.__mockUser = null;
    renderAdminPanel();
    fireEvent.change(screen.getByPlaceholderText('Admin password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByText('Sign in'));
    expect(await screen.findByText('Not signed in as an admin')).toBeInTheDocument();
  });

  test('correct password + a real is_admin account shows the dashboard', async () => {
    renderAdminPanel();
    fireEvent.change(screen.getByPlaceholderText('Admin password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByText('Sign in'));
    expect(await screen.findByText('Fursday Admin')).toBeInTheDocument();
    expect(screen.getByText('No pending applications')).toBeInTheDocument();
  });
});

describe('AdminPanel sitter actions', () => {
  const signIn = async () => {
    renderAdminPanel();
    fireEvent.change(screen.getByPlaceholderText('Admin password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByText('Sign in'));
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
    await waitFor(() => expect(notifyPayoutMarked).toHaveBeenCalledWith(
      'sitter-user-9', 'sitter@test.com', '9111111111', 34900, 1, expect.any(String)
    ));
    await waitFor(() => expect(notifyReferralBonusPaid).toHaveBeenCalledWith(
      'sitter-user-9', 'sitter@test.com', '9111111111', 100, 'Someone'
    ));
    expect(updateCalls).toContainEqual({ table: 'bookings', fields: { payout_status: 'paid' } });
    expect(updateCalls).toContainEqual({ table: 'referral_bonuses', fields: { status: 'paid' } });
  });
});
