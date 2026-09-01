import { supabase } from './supabase';

export const logAdminAction = async (adminId, action, resourceType, resourceId, oldValue = null, newValue = null, reason = null) => {
  try {
    const userAgent = navigator.userAgent;

    await supabase.from('admin_audit_logs').insert({
      admin_id: adminId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      reason,
      user_agent: userAgent,
      status: 'success',
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Log error but don't throw - don't block user action if logging fails
    await supabase.from('admin_audit_logs').insert({
      admin_id: adminId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      status: 'error',
      error_message: error.message,
      user_agent: navigator.userAgent,
    }).catch(e => console.error('Critical: Failed to log action error', e));
  }
};

export const logAdminActionFailed = async (adminId, action, resourceType, resourceId, errorMessage) => {
  try {
    await supabase.from('admin_audit_logs').insert({
      admin_id: adminId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      status: 'failed',
      error_message: errorMessage,
      user_agent: navigator.userAgent,
    });
  } catch (error) {
    console.error('Failed to log admin error action:', error);
  }
};

// Helper functions for specific actions
export const logSitterApproved = (adminId, sitterId) => logAdminAction(adminId, 'approve_sitter', 'sitter_profiles', sitterId, { status: 'pending' }, { status: 'active' });
export const logSitterRejected = (adminId, sitterId) => logAdminAction(adminId, 'reject_sitter', 'sitter_profiles', sitterId, { status: 'pending' }, { status: 'rejected' });
export const logSitterSuspended = (adminId, sitterId, suspended) => logAdminAction(adminId, suspended ? 'suspend_sitter' : 'reinstate_sitter', 'sitter_profiles', sitterId);
export const logTopSitterToggled = (adminId, sitterId, isTopSitter) => logAdminAction(adminId, 'toggle_top_sitter', 'sitter_profiles', sitterId, { is_top_sitter: !isTopSitter }, { is_top_sitter: isTopSitter });
export const logPayoutMarkedPaid = (adminId, bookingId, amount) => logAdminAction(adminId, 'mark_payout_paid', 'bookings', bookingId, { payout_status: 'pending' }, { payout_status: 'paid' }, `Marked Rs.${amount} as paid`);
