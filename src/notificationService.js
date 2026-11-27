import { supabase } from './supabase';
import { apiBase } from './paymentsClient';

// Every alert is an in-app notification row. /api/notify then delivers it to
// a closed phone too (email and push) by the recipient's preferences; the
// browser holds no email or SMS keys.

const uuid = () => {
  const c = typeof window !== 'undefined' ? window.crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
};

const deliverOutsideApp = (notificationId) => {
  (async () => {
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    await fetch(apiBase() + '/api/notify', {
      method: 'POST',
      keepalive: true,
      headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ notification_id: notificationId }),
    });
  })().catch(() => {});
};

// The id is made here and the row is inserted without reading it back:
// RLS only lets the recipient read a notification, so asking for the new row
// would fail whenever someone else is being notified.
export const createNotification = async (userId, type, title, body, actionUrl = null, bookingId = null) => {
  if (!userId) return null;
  const row = { id: uuid(), user_id: userId, type, title, body, action_url: actionUrl, booking_id: bookingId };
  try {
    const { error } = await supabase.from('notifications').insert(row);
    if (error) throw error;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
  deliverOutsideApp(row.id);
  return row;
};

export const notifyBookingConfirmed = async ({ sitterId, petParentId, petName, sitterName, dateTime }) => {
  await createNotification(sitterId, 'booking_confirmed', `New booking: ${petName}`, `Scheduled for ${dateTime}`);
  await createNotification(petParentId, 'booking_confirmed', `Booking confirmed with ${sitterName}`, 'Your booking has been confirmed');
};

export const notifyReviewReceived = async (sitterId, sitterEmail, rating, petParentName) => {
  await createNotification(sitterId, 'review_received', `Review from ${petParentName}`, `${'⭐'.repeat(rating)} (${rating}/5)`);
};

export const notifyMessageReceived = async (userId, userEmail, senderName, bookingId = null) => {
  await createNotification(userId, 'message_received', `New message from ${senderName}`, 'Tap to reply', null, bookingId);
};

export const notifyScheduleProposed = async (userId, proposerName, date, time) => {
  await createNotification(userId, 'schedule_proposed', `${proposerName} proposed a new time`, `${date} at ${time} — open the chat to confirm`);
};

export const notifySitterArriving = async (petParentId, sitterName, status) => {
  const isArrived = status === 'arrived';
  await createNotification(
    petParentId,
    isArrived ? 'sitter_arrived' : 'sitter_on_way',
    isArrived ? `${sitterName} has arrived` : `${sitterName} is on the way`,
    isArrived ? 'Your sitter is at the location now.' : 'Your sitter is heading over for the booking.'
  );
};

export const notifyWalkProofReceived = async (petParentId, petParentEmail, petParentPhone, sitterName) => {
  await createNotification(petParentId, 'walk_proof', `Walk photos uploaded by ${sitterName}`, 'View the proof of service');
};

export const notifyBookingCompleted = async (userId, sitterName, petName) => {
  await createNotification(userId, 'booking_completed', 'Walk completed', `${sitterName} finished the walk with ${petName}`);
};

export const notifyBookingCancelled = async ({ userId, otherUserName, reason }) => {
  await createNotification(userId, 'booking_cancelled', `${otherUserName} cancelled the booking`, reason || 'The booking has been cancelled');
};

export const notifyPayoutMarked = async (sitterId, sitterEmail, sitterPhone, amount) => {
  await createNotification(sitterId, 'payout_marked', 'Payout processed!', `Rs. ${Math.round(amount / 100)} marked as paid`);
};

export const notifyWalkStarted = async (sitterId, sitterPhone, petParentId, petParentPhone, petName, sitterName) => {
  await createNotification(sitterId, 'walk_started', `🚶 Walk started with ${petName}`, 'Enjoy the time with your furry friend!');
  await createNotification(petParentId, 'walk_started', 'Walk started 🚶', `${sitterName} started the walk with ${petName}`);
};

export const notifyWalkCompleted = async (sitterId, sitterEmail, sitterPhone, petParentId, petParentEmail, petParentPhone, petName, sitterName) => {
  await createNotification(sitterId, 'walk_completed', `Walk complete with ${petName}`, 'Great job! Please upload photos if you have any.');
  await createNotification(petParentId, 'walk_completed', 'Walk completed ✓', `${sitterName} finished the walk with ${petName}`);
};

export const notifySitterRejected = async (sitterId, sitterEmail, reason) => {
  await createNotification(sitterId, 'sitter_rejected', '❌ Application Not Approved', reason || 'Your application did not meet our requirements. Please reapply with improvements.');
};

export const notifySitterSuspended = async (sitterId, sitterEmail, sitterPhone, reason) => {
  await createNotification(sitterId, 'sitter_suspended', '⚠️ Account Suspended', reason || 'Your account has been temporarily suspended. Contact support for details.');
};

export const notifyTopSitterAwarded = async (sitterId) => {
  await createNotification(sitterId, 'top_sitter_awarded', '🌟 TOP SITTER Badge!', 'You have been awarded the prestigious TOP SITTER badge! This will boost your profile visibility.');
};

export const notifyDisputeFiled = async (reportedUserId, reportedUserEmail, reportedUserPhone, reporterName, disputeType, title) => {
  await createNotification(reportedUserId, 'dispute_filed', '⚠️ Dispute Filed Against You', `${reporterName} filed a ${disputeType} dispute: "${title}"`);
};

export const notifyDisputeResolved = async (reportedUserId, reportedUserEmail, reportedUserPhone, reporterName, resolution, refundAmount) => {
  const refundText = refundAmount > 0 ? `Refund: Rs.${Math.round(refundAmount / 100)}` : 'No refund';
  await createNotification(reportedUserId, 'dispute_resolved', '✅ Dispute Resolved', `Decision: ${resolution}. ${refundText}`);
};

export const notifyHeatAdvisory = async (sitterId, sitterPhone, petParentId, petParentPhone, petName, bookingDate) => {
  await createNotification(sitterId, 'heat_advisory', '🔥 Heat Advisory', `Heads up: ${bookingDate} may be hot. Stay hydrated during ${petName}'s walk!`);
  await createNotification(petParentId, 'heat_advisory', '🔥 Heat Advisory for Your Walk', `${bookingDate} looks hot. Consider a shorter walk or reschedule if needed.`);
};

export const notifyBookingReminder12h = async (sitterId, sitterPhone, petParentId, petParentPhone, petName, sitterName, dateTime) => {
  await createNotification(sitterId, 'booking_reminder_12h', '⏰ Booking Tomorrow', `Don't forget: ${petName}'s walk tomorrow at ${dateTime}`);
  await createNotification(petParentId, 'booking_reminder_12h', '⏰ Walk Tomorrow', `${sitterName} is confirmed for ${petName} tomorrow at ${dateTime}`);
};

export const notifyBookingReminder1h = async (sitterId, sitterPhone, petParentId, petParentPhone, petName, sitterName, dateTime) => {
  await createNotification(sitterId, 'booking_reminder_1h', '🚶 Walk Starting Soon', `${petName}'s walk is in 1 hour at ${dateTime}. Please be ready!`);
  await createNotification(petParentId, 'booking_reminder_1h', '🚶 Sitter Arriving Soon', `${sitterName} will arrive in about 1 hour for ${petName}'s walk`);
};

export const notifyWeeklyEarnings = async (sitterId, sitterEmail, sitterPhone, weeklyEarnings, walkCount, avgRating) => {
  await createNotification(sitterId, 'weekly_earnings', '📊 Weekly Summary', `This week: ${walkCount} walks, Rs.${Math.round(weeklyEarnings)} earned, ${avgRating.toFixed(1)}⭐`);
};

export const notifyRatingUpdate = async (sitterId, sitterPhone, oldRating, newRating) => {
  const change = newRating > oldRating ? '📈 up' : '📉 down';
  await createNotification(sitterId, 'rating_updated', `Your rating ${change}`, `${oldRating.toFixed(1)} → ${newRating.toFixed(1)} ${'⭐'.repeat(Math.round(newRating))}`);
};

export const notifyNoShow = async (userId, userEmail, userPhone, otherPartyName, bookingRef) => {
  await createNotification(userId, 'no_show_alert', '❌ No Show Reported', `${otherPartyName} didn't show up for booking ${bookingRef}`);
};

export const notifyCancellationReminder = async (userId, userEmail, userPhone, otherPartyName, hoursUntilRefundDeadline) => {
  const refundPct = hoursUntilRefundDeadline > 72 ? '100%' : hoursUntilRefundDeadline > 24 ? '75%' : '0%';
  await createNotification(userId, 'cancellation_reminder', '⏰ Cancellation Deadline', `Cancel within ${hoursUntilRefundDeadline}h for ${refundPct} refund`);
};

export const notifyPaymentFailed = async (userId, userEmail, userPhone, reason) => {
  await createNotification(userId, 'payment_failed', '❌ Payment Failed', reason || 'Your payment could not be processed. Please try again.');
};

export const notifyResponseTimeout = async (sitterId, sitterPhone, petParentName, minutesRemaining) => {
  await createNotification(sitterId, 'response_timeout', '⏰ Booking Expiring', `${petParentName}'s request expires in ${minutesRemaining} minutes. Accept now!`);
};

export const notifySitterUnavailable = async (petParentId, petParentEmail, petParentPhone, sitterName, bookingDate) => {
  await createNotification(petParentId, 'sitter_unavailable', '❌ Sitter Unavailable', `${sitterName} is no longer available for ${bookingDate}. Please book another sitter.`);
};

export const notifyReferralBonusPaid = async (userId, userEmail, userPhone, bonusAmount, referredName) => {
  await createNotification(userId, 'referral_bonus_paid', '💰 Referral Bonus Paid!', `Rs.${Math.round(bonusAmount / 100)} credited for referring ${referredName}`);
};

const BADGES = {
  lightning_response: '⚡ Lightning Response - Fastest responder',
  completion_star: '✅ Completion Star - 100% completion rate',
  five_star_master: '🌟 Five Star Master - Maintained 5.0 rating',
  reliable_pro: '🎖️ Reliable Pro - 50+ bookings completed',
  pet_expert: '🐾 Pet Expert - Multiple pet types handled',
};

export const notifyPerformanceBadge = async (sitterId, sitterEmail, sitterPhone, badgeType) => {
  const badgeText = BADGES[badgeType] || badgeType;
  await createNotification(sitterId, 'performance_badge', `🏆 ${badgeText.split('-')[0]}`, badgeText);
};

const ADMIN_ACTIONS = {
  warning: '⚠️ Account Warning Issued',
  restriction: '🚫 Temporary Restriction',
  verification_needed: '✓ Verification Required',
  compliance_notice: '📋 Compliance Notice',
};

export const notifyAdminAction = async (sitterId, sitterEmail, sitterPhone, actionType, details) => {
  await createNotification(sitterId, 'admin_action', ADMIN_ACTIONS[actionType] || actionType, details || 'An admin action has been taken on your account.');
};

export const getUserUnreadNotificationCount = async (userId) => {
  try {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .eq('read', false);
    return count || 0;
  } catch (error) {
    console.error('Failed to get unread count:', error);
    return 0;
  }
};
