/**
 * Unit tests for auditService.js. The insert() error was previously
 * unchecked — Supabase resolves {data, error} rather than throwing on an
 * RLS/DB failure, so a denied audit-log write was silently swallowed with
 * no fallback record at all. See CLAUDE.md Session 10.
 */

import {
  logAdminAction,
  logAdminActionFailed,
  logSitterApproved,
  logSitterRejected,
  logSitterSuspended,
  logTopSitterToggled,
  logPayoutMarkedPaid,
} from './auditService';

let insertedRows;

jest.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      insert: (row) => {
        global.__insertedRows.push(row);
        return Promise.resolve({ data: null, error: global.__insertError });
      },
    }),
  },
}));

beforeEach(() => {
  global.__insertedRows = [];
  global.__insertError = null;
  insertedRows = global.__insertedRows;
});

describe('auditService', () => {

  test('logAdminAction writes a success row with JSON-stringified old/new values', async () => {
    await logAdminAction('admin-1', 'approve_sitter', 'sitter_profiles', 'sitter-1', { status: 'pending' }, { status: 'active' }, 'looks good');
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      admin_id: 'admin-1',
      action: 'approve_sitter',
      resource_type: 'sitter_profiles',
      resource_id: 'sitter-1',
      old_value: JSON.stringify({ status: 'pending' }),
      new_value: JSON.stringify({ status: 'active' }),
      reason: 'looks good',
      status: 'success',
    });
  });

  test('a denied insert (RLS error, not a thrown exception) falls back to an error-status row', async () => {
    global.__insertError = { message: 'permission denied' };
    await logAdminAction('admin-1', 'approve_sitter', 'sitter_profiles', 'sitter-1');

    expect(insertedRows).toHaveLength(2); // the failed attempt, then the fallback
    expect(insertedRows[1]).toMatchObject({
      admin_id: 'admin-1',
      action: 'approve_sitter',
      status: 'error',
      error_message: 'permission denied',
    });
  });

  test('logAdminActionFailed writes a failed-status row', async () => {
    await logAdminActionFailed('admin-1', 'mark_payout_paid', 'bookings', 'booking-1', 'network timeout');
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({
      admin_id: 'admin-1',
      action: 'mark_payout_paid',
      resource_type: 'bookings',
      resource_id: 'booking-1',
      status: 'failed',
      error_message: 'network timeout',
    });
  });

  test.each([
    ['logSitterApproved', () => logSitterApproved('admin-1', 'sitter-1'), 'approve_sitter', { status: 'pending' }, { status: 'active' }],
    ['logSitterRejected', () => logSitterRejected('admin-1', 'sitter-1'), 'reject_sitter', { status: 'pending' }, { status: 'rejected' }],
  ])('%s logs the right action and before/after values', async (_name, call, action, oldVal, newVal) => {
    await call();
    expect(insertedRows[0]).toMatchObject({
      action,
      old_value: JSON.stringify(oldVal),
      new_value: JSON.stringify(newVal),
    });
  });

  test('logSitterSuspended logs suspend_sitter or reinstate_sitter depending on the flag', async () => {
    await logSitterSuspended('admin-1', 'sitter-1', true);
    expect(insertedRows[0]).toMatchObject({ action: 'suspend_sitter' });

    await logSitterSuspended('admin-1', 'sitter-1', false);
    expect(insertedRows[1]).toMatchObject({ action: 'reinstate_sitter' });
  });

  test('logTopSitterToggled logs the opposite of "current" as old, and the new value as new', async () => {
    await logTopSitterToggled('admin-1', 'sitter-1', true); // awarding the badge
    expect(insertedRows[0]).toMatchObject({
      action: 'toggle_top_sitter',
      old_value: JSON.stringify({ is_top_sitter: false }),
      new_value: JSON.stringify({ is_top_sitter: true }),
    });
  });

  test('logPayoutMarkedPaid includes the amount in the reason text', async () => {
    await logPayoutMarkedPaid('admin-1', 'booking-1', 349);
    expect(insertedRows[0]).toMatchObject({
      action: 'mark_payout_paid',
      resource_type: 'bookings',
      resource_id: 'booking-1',
      reason: 'Marked Rs.349 as paid',
    });
  });
});
