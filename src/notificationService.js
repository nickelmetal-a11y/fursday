import { supabase } from './supabase';
import { sendBookingConfirmationEmail, sendReviewReceivedEmail, sendPayoutNotificationEmail, sendCancellationEmail, sendPhotosUploadedEmail } from './emailService';
import { sendBookingReminderSMS, sendPayoutNotificationSMS, sendPhotosUploadedSMS } from './smsService';

export const createNotification = async (userId, type, title, body, actionUrl = null, bookingId = null) => {
  try {
    const { data: prefs } = await supabase.from('notification_preferences').select('push_enabled').eq('user_id', userId).single();
    if (prefs && prefs.push_enabled === false) return null;

    const { data, error } = await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      action_url: actionUrl,
      booking_id: bookingId,
    }).select().single();
    if (error) throw error;
    return data || null;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

const getNotificationPrefs = async (userId) => {
  if (!userId) return { email: true, sms: true };
  try {
    const { data } = await supabase.from('notification_preferences').select('email_enabled, sms_enabled').eq('user_id', userId).single();
    return { email: data?.email_enabled !== false, sms: data?.sms_enabled !== false };
  } catch (error) {
    console.error('Failed to load notification preferences, defaulting to sending:', error);
    return { email: true, sms: true };
  }
};

export const notifyBookingConfirmed = async (bookingData) => {
  const { sitterId, sitterEmail, sitterPhone, petParentId, petParentEmail, petParentPhone, petName, sitterName, serviceType, dateTime, amount, bookingRef } = bookingData;
  const petParentPrefs = await getNotificationPrefs(petParentId);
  const sitterPrefs = await getNotificationPrefs(sitterId);

  // In-app notification to sitter
  await createNotification(sitterId, 'booking_confirmed', `New booking: ${petName}`, `Walk scheduled for ${dateTime}`);

  // In-app notification to pet parent
  await createNotification(petParentId, 'booking_confirmed', `Booking confirmed with ${sitterName}`, `Your booking has been confirmed`);

  // Email to pet parent
  if (petParentEmail && petParentPrefs.email) {
    await sendBookingConfirmationEmail(petParentEmail, {
      bookingRef,
      sitterName,
      petName,
      serviceType,
      dateTime,
      amount: Math.round(amount / 100),
      cancellationDeadline: new Date(new Date(dateTime).getTime() - 24*60*60*1000).toLocaleDateString('en-IN'),
    });
  }

  // SMS to pet parent (booking reminder)
  if (petParentPhone && petParentPrefs.sms) {
    await sendBookingReminderSMS(petParentPhone, { sitterName, petName, dateTime });
  }

  // SMS to sitter (new booking alert)
  if (sitterPhone && sitterPrefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: 'You have a new booking!', petName, dateTime });
  }
};

export const notifyReviewReceived = async (sitterId, sitterEmail, rating, petParentName, petName, reviewText) => {
  const stars = '⭐'.repeat(rating);
  const prefs = await getNotificationPrefs(sitterId);

  // In-app notification
  await createNotification(sitterId, 'review_received', `Review from ${petParentName}`, `${stars} (${rating}/5)`);

  // Email notification
  if (sitterEmail && prefs.email) {
    await sendReviewReceivedEmail(sitterEmail, { sitterName: sitterId, rating, petName, reviewText });
  }
};

export const notifyMessageReceived = async (userId, userEmail, senderName) => {
  // In-app notification
  await createNotification(userId, 'message_received', `New message from ${senderName}`, 'Tap to reply');

  // Email notification (optional, could be too spammy)
  // await sendMessageEmail(userEmail, { senderName });
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
  const prefs = await getNotificationPrefs(petParentId);

  // In-app notification
  await createNotification(petParentId, 'walk_proof', `Walk photos uploaded by ${sitterName}`, 'View the proof of service');

  // Email notification
  if (petParentEmail && prefs.email) {
    await sendPhotosUploadedEmail(petParentEmail, { sitterName });
  }

  // SMS notification
  if (petParentPhone && prefs.sms) {
    await sendPhotosUploadedSMS(petParentPhone, sitterName);
  }
};

export const notifyBookingCompleted = async (userId, sitterName, petName) => {
  await createNotification(userId, 'booking_completed', 'Walk completed', `${sitterName} finished the walk with ${petName}`);
};

export const notifyBookingCancelled = async (cancellationData) => {
  const { userId, userEmail, userPhone, otherUserName, reason, refundAmount, refundStatus, bookingRef } = cancellationData;
  const prefs = await getNotificationPrefs(userId);

  // In-app notification
  await createNotification(userId, 'booking_cancelled', `${otherUserName} cancelled the booking`, reason || 'The booking has been cancelled');

  // Email with refund details
  if (userEmail && prefs.email) {
    await sendCancellationEmail(userEmail, { bookingRef, reason, refundAmount, refundStatus });
  }
};

export const notifyPayoutMarked = async (sitterId, sitterEmail, sitterPhone, amount, bookingCount, payoutDate) => {
  const prefs = await getNotificationPrefs(sitterId);

  // In-app notification
  await createNotification(sitterId, 'payout_marked', 'Payout processed!', `Rs. ${amount} marked as paid`);

  // Email notification
  if (sitterEmail && prefs.email) {
    await sendPayoutNotificationEmail(sitterEmail, { sitterName: sitterId, amount: Math.round(amount / 100), bookingCount, payoutDate });
  }

  // SMS notification
  if (sitterPhone && prefs.sms) {
    await sendPayoutNotificationSMS(sitterPhone, Math.round(amount / 100));
  }
};

// TIER 2: Walk Start Notification
export const notifyWalkStarted = async (sitterId, sitterPhone, petParentId, petParentPhone, petName, sitterName) => {
  const sitterPrefs = await getNotificationPrefs(sitterId);
  const petParentPrefs = await getNotificationPrefs(petParentId);

  // Notify sitter
  await createNotification(sitterId, 'walk_started', `🚶 Walk started with ${petName}`, 'Enjoy the time with your furry friend!');

  // Notify pet parent
  await createNotification(petParentId, 'walk_started', `Walk started 🚶`, `${sitterName} started the walk with ${petName}`);

  // SMS to both (if available)
  if (sitterPhone && sitterPrefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: 'Walk started!', petName, dateTime: 'Now' });
  }
  if (petParentPhone && petParentPrefs.sms) {
    await sendBookingReminderSMS(petParentPhone, { sitterName, petName: `Walk with ${petName}`, dateTime: 'Just started' });
  }
};

// TIER 2: Walk Complete Notification
export const notifyWalkCompleted = async (sitterId, sitterEmail, sitterPhone, petParentId, petParentEmail, petParentPhone, petName, sitterName) => {
  const sitterPrefs = await getNotificationPrefs(sitterId);
  const petParentPrefs = await getNotificationPrefs(petParentId);

  // Notify sitter
  await createNotification(sitterId, 'walk_completed', `Walk complete with ${petName}`, 'Great job! Please upload photos if you have any.');

  // Notify pet parent
  await createNotification(petParentId, 'walk_completed', `Walk completed ✓`, `${sitterName} finished the walk with ${petName}`);

  // Email to pet parent
  if (petParentEmail && petParentPrefs.email) {
    await sendBookingConfirmationEmail(petParentEmail, {
      bookingRef: 'Walk Completion',
      sitterName,
      petName,
      serviceType: 'Walk',
      dateTime: new Date().toLocaleString('en-IN'),
      amount: 0,
      cancellationDeadline: 'N/A'
    });
  }

  // SMS to both
  if (sitterPhone && sitterPrefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: 'Walk complete!', petName, dateTime: '✅ Upload photos' });
  }
  if (petParentPhone && petParentPrefs.sms) {
    await sendBookingReminderSMS(petParentPhone, { sitterName, petName, dateTime: 'Walk finished ✓' });
  }
};

// TIER 2: Sitter Rejected Notification
export const notifySitterRejected = async (sitterId, sitterEmail, reason) => {
  const prefs = await getNotificationPrefs(sitterId);

  // In-app notification
  await createNotification(sitterId, 'sitter_rejected', '❌ Application Not Approved', reason || 'Your application did not meet our requirements. Please reapply with improvements.');

  // Email notification
  if (sitterEmail && prefs.email) {
    await sendCancellationEmail(sitterEmail, {
      bookingRef: 'Application Status',
      reason: reason || 'Your application is under review or did not meet our standards.',
      refundAmount: 0,
      refundStatus: 'N/A'
    });
  }
};

// TIER 2: Sitter Suspended Notification
export const notifySitterSuspended = async (sitterId, sitterEmail, sitterPhone, reason) => {
  const prefs = await getNotificationPrefs(sitterId);

  // In-app notification
  await createNotification(sitterId, 'sitter_suspended', '⚠️ Account Suspended', reason || 'Your account has been temporarily suspended. Contact support for details.');

  // Email notification
  if (sitterEmail && prefs.email) {
    await sendCancellationEmail(sitterEmail, {
      bookingRef: 'Account Status',
      reason: reason || 'Your account has been suspended. Please contact support.',
      refundAmount: 0,
      refundStatus: 'N/A'
    });
  }

  // SMS notification (high priority)
  if (sitterPhone && prefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: '⚠️ Account Suspended', petName: 'Please contact support', dateTime: 'Urgent' });
  }
};

// TIER 2: Top Sitter Badge Notification
export const notifyTopSitterAwarded = async (sitterId, sitterEmail, sitterPhone) => {
  const prefs = await getNotificationPrefs(sitterId);

  // In-app notification
  await createNotification(sitterId, 'top_sitter_awarded', '🌟 TOP SITTER Badge!', 'You have been awarded the prestigious TOP SITTER badge! This will boost your profile visibility.');

  // Email notification
  if (sitterEmail && prefs.email) {
    await sendBookingConfirmationEmail(sitterEmail, {
      bookingRef: 'Achievement Unlocked',
      sitterName: 'Congratulations!',
      petName: 'TOP SITTER Badge',
      serviceType: 'Awarded',
      dateTime: new Date().toLocaleDateString('en-IN'),
      amount: 0,
      cancellationDeadline: 'Badge valid indefinitely'
    });
  }

  // SMS notification (celebratory)
  if (sitterPhone && prefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: '🌟 TOP SITTER!', petName: 'Badge awarded', dateTime: 'Congratulations' });
  }
};

// TIER 2: Dispute Filed Notification
export const notifyDisputeFiled = async (reportedUserId, reportedUserEmail, reportedUserPhone, reporterName, disputeType, title) => {
  const prefs = await getNotificationPrefs(reportedUserId);

  // Notify reported user
  await createNotification(reportedUserId, 'dispute_filed', `⚠️ Dispute Filed Against You`, `${reporterName} filed a ${disputeType} dispute: "${title}"`);

  // Email to reported user
  if (reportedUserEmail && prefs.email) {
    await sendCancellationEmail(reportedUserEmail, {
      bookingRef: 'Dispute Notice',
      reason: `A dispute has been filed: ${title}. Our team will review and contact you shortly.`,
      refundAmount: 0,
      refundStatus: 'Under Review'
    });
  }

  // SMS to reported user (high priority)
  if (reportedUserPhone && prefs.sms) {
    await sendBookingReminderSMS(reportedUserPhone, { sitterName: 'Dispute Filed', petName: 'Check app for details', dateTime: 'Action needed' });
  }
};

// TIER 2: Dispute Resolved Notification
export const notifyDisputeResolved = async (reportedUserId, reportedUserEmail, reportedUserPhone, reporterName, resolution, refundAmount) => {
  const refundText = refundAmount > 0 ? `Refund: Rs.${Math.round(refundAmount / 100)}` : 'No refund';
  const prefs = await getNotificationPrefs(reportedUserId);

  // Notify reported user
  await createNotification(reportedUserId, 'dispute_resolved', `✅ Dispute Resolved`, `Decision: ${resolution}. ${refundText}`);

  // Email to reported user
  if (reportedUserEmail && prefs.email) {
    await sendCancellationEmail(reportedUserEmail, {
      bookingRef: 'Dispute Resolution',
      reason: `Your dispute has been resolved. Decision: ${resolution}`,
      refundAmount: Math.round(refundAmount / 100),
      refundStatus: 'Processed'
    });
  }

  // SMS to reported user
  if (reportedUserPhone && prefs.sms) {
    await sendBookingReminderSMS(reportedUserPhone, { sitterName: 'Dispute Resolved ✅', petName: resolution, dateTime: refundText });
  }
};

// TIER 3: Heat Advisory Alert
export const notifyHeatAdvisory = async (sitterId, sitterPhone, petParentId, petParentPhone, petName, bookingDate) => {
  const sitterPrefs = await getNotificationPrefs(sitterId);
  const petParentPrefs = await getNotificationPrefs(petParentId);

  // Notify sitter
  await createNotification(sitterId, 'heat_advisory', '🔥 Heat Advisory', `Heads up: ${bookingDate} may be hot. Stay hydrated during ${petName}'s walk!`);

  // Notify pet parent
  await createNotification(petParentId, 'heat_advisory', '🔥 Heat Advisory for Your Walk', `${bookingDate} looks hot. Consider a shorter walk or reschedule if needed.`);

  // SMS to both (high priority for urgent alert)
  if (sitterPhone && sitterPrefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: '🔥 Heat Advisory', petName, dateTime: 'Stay hydrated' });
  }
  if (petParentPhone && petParentPrefs.sms) {
    await sendBookingReminderSMS(petParentPhone, { sitterName: '🔥 Heat Advisory', petName: 'Hot day warning', dateTime: 'Consider rescheduling' });
  }
};

// TIER 3: Booking Reminder (12 hours before)
export const notifyBookingReminder12h = async (sitterId, sitterPhone, petParentId, petParentPhone, petName, sitterName, dateTime) => {
  const sitterPrefs = await getNotificationPrefs(sitterId);
  const petParentPrefs = await getNotificationPrefs(petParentId);

  // Notify sitter
  await createNotification(sitterId, 'booking_reminder_12h', '⏰ Booking Tomorrow', `Don't forget: ${petName}'s walk tomorrow at ${dateTime}`);

  // Notify pet parent
  await createNotification(petParentId, 'booking_reminder_12h', '⏰ Walk Tomorrow', `${sitterName} is confirmed for ${petName} tomorrow at ${dateTime}`);

  // SMS to both
  if (sitterPhone && sitterPrefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: 'Reminder', petName, dateTime });
  }
  if (petParentPhone && petParentPrefs.sms) {
    await sendBookingReminderSMS(petParentPhone, { sitterName, petName, dateTime });
  }
};

// TIER 3: Booking Reminder (1 hour before)
export const notifyBookingReminder1h = async (sitterId, sitterPhone, petParentId, petParentPhone, petName, sitterName, dateTime) => {
  const sitterPrefs = await getNotificationPrefs(sitterId);
  const petParentPrefs = await getNotificationPrefs(petParentId);

  // Notify sitter (urgent reminder)
  await createNotification(sitterId, 'booking_reminder_1h', '🚶 Walk Starting Soon', `${petName}'s walk is in 1 hour at ${dateTime}. Please be ready!`);

  // Notify pet parent
  await createNotification(petParentId, 'booking_reminder_1h', '🚶 Sitter Arriving Soon', `${sitterName} will arrive in about 1 hour for ${petName}'s walk`);

  // SMS to both (high priority, imminent)
  if (sitterPhone && sitterPrefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: '1 hour until walk!', petName, dateTime });
  }
  if (petParentPhone && petParentPrefs.sms) {
    await sendBookingReminderSMS(petParentPhone, { sitterName, petName: `${petName} walk`, dateTime: 'Starting in 1 hour' });
  }
};

// TIER 3: Weekly Earnings Summary
export const notifyWeeklyEarnings = async (sitterId, sitterEmail, sitterPhone, weeklyEarnings, walkCount, avgRating) => {
  const prefs = await getNotificationPrefs(sitterId);

  // In-app notification
  await createNotification(sitterId, 'weekly_earnings', '📊 Weekly Summary', `This week: ${walkCount} walks, Rs.${Math.round(weeklyEarnings)} earned, ${avgRating.toFixed(1)}⭐`);

  // Email with detailed summary
  if (sitterEmail && prefs.email) {
    await sendBookingConfirmationEmail(sitterEmail, {
      bookingRef: 'Weekly Earnings',
      sitterName: 'Weekly Summary',
      petName: `${walkCount} walks completed`,
      serviceType: 'Earnings Report',
      dateTime: new Date().toLocaleDateString('en-IN'),
      amount: Math.round(weeklyEarnings / 100),
      cancellationDeadline: `Rating: ${avgRating.toFixed(1)}⭐`
    });
  }

  // SMS with quick summary
  if (sitterPhone && prefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: '📊 Weekly Stats', petName: `${walkCount} walks`, dateTime: `Rs.${Math.round(weeklyEarnings)}` });
  }
};

// TIER 3: Rating Update Notification
export const notifyRatingUpdate = async (sitterId, sitterPhone, oldRating, newRating) => {
  const stars = '⭐'.repeat(Math.round(newRating));
  const change = newRating > oldRating ? '📈 up' : '📉 down';
  const prefs = await getNotificationPrefs(sitterId);

  // In-app notification
  await createNotification(sitterId, 'rating_updated', `Your rating ${change}`, `${oldRating.toFixed(1)} → ${newRating.toFixed(1)} ${stars}`);

  // SMS with quick update
  if (sitterPhone && prefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: '⭐ Rating Updated', petName: `${oldRating.toFixed(1)} → ${newRating.toFixed(1)}`, dateTime: change });
  }
};

// TIER 3: No-Show Alert
export const notifyNoShow = async (userId, userEmail, userPhone, otherPartyName, bookingRef) => {
  const prefs = await getNotificationPrefs(userId);

  // In-app notification
  await createNotification(userId, 'no_show_alert', '❌ No Show Reported', `${otherPartyName} didn't show up for booking ${bookingRef}`);

  // Email
  if (userEmail && prefs.email) {
    await sendCancellationEmail(userEmail, {
      bookingRef,
      reason: `${otherPartyName} did not show up for this booking. Our team will investigate.`,
      refundAmount: 0,
      refundStatus: 'Under Review'
    });
  }

  // SMS (urgent)
  if (userPhone && prefs.sms) {
    await sendBookingReminderSMS(userPhone, { sitterName: 'No-Show Alert', petName: bookingRef, dateTime: 'Review in app' });
  }
};

// TIER 3: Cancellation Reminder
export const notifyCancellationReminder = async (userId, userEmail, userPhone, otherPartyName, hoursUntilRefundDeadline) => {
  const refundPct = hoursUntilRefundDeadline > 72 ? '100%' : hoursUntilRefundDeadline > 24 ? '75%' : '0%';
  const prefs = await getNotificationPrefs(userId);

  // In-app notification
  await createNotification(userId, 'cancellation_reminder', '⏰ Cancellation Deadline', `Cancel within ${hoursUntilRefundDeadline}h for ${refundPct} refund`);

  // Email
  if (userEmail && prefs.email) {
    await sendBookingConfirmationEmail(userEmail, {
      bookingRef: 'Cancellation Deadline',
      sitterName: 'Refund Policy Reminder',
      petName: `${refundPct} refund available`,
      serviceType: 'Cancellation Info',
      dateTime: `${hoursUntilRefundDeadline} hours remaining`,
      amount: 0,
      cancellationDeadline: 'Check refund policy'
    });
  }

  // SMS (urgent if time running out)
  if (hoursUntilRefundDeadline < 6 && userPhone && prefs.sms) {
    await sendBookingReminderSMS(userPhone, { sitterName: '⏰ Cancellation Deadline', petName: `${hoursUntilRefundDeadline}h left`, dateTime: `${refundPct} refund` });
  }
};

// TIER 3: Payment Failed Alert
export const notifyPaymentFailed = async (userId, userEmail, userPhone, reason) => {
  const prefs = await getNotificationPrefs(userId);

  // In-app notification
  await createNotification(userId, 'payment_failed', '❌ Payment Failed', reason || 'Your payment could not be processed. Please try again.');

  // Email
  if (userEmail && prefs.email) {
    await sendCancellationEmail(userEmail, {
      bookingRef: 'Payment Failed',
      reason: reason || 'Your payment was declined. Please update your payment method and retry.',
      refundAmount: 0,
      refundStatus: 'N/A'
    });
  }

  // SMS (urgent)
  if (userPhone && prefs.sms) {
    await sendBookingReminderSMS(userPhone, { sitterName: '❌ Payment Failed', petName: 'Retry payment', dateTime: 'Action needed' });
  }
};

// TIER 3: Response Timeout Warning
export const notifyResponseTimeout = async (sitterId, sitterPhone, petParentName, minutesRemaining) => {
  const prefs = await getNotificationPrefs(sitterId);

  // In-app notification
  await createNotification(sitterId, 'response_timeout', '⏰ Booking Expiring', `${petParentName}'s request expires in ${minutesRemaining} minutes. Accept now!`);

  // SMS (urgent)
  if (sitterPhone && prefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: '⏰ Booking Expiring', petName: `${minutesRemaining}m left`, dateTime: 'Accept now' });
  }
};

// TIER 3: Sitter Unavailable Alert
export const notifySitterUnavailable = async (petParentId, petParentEmail, petParentPhone, sitterName, bookingDate) => {
  const prefs = await getNotificationPrefs(petParentId);

  // In-app notification
  await createNotification(petParentId, 'sitter_unavailable', '❌ Sitter Unavailable', `${sitterName} is no longer available for ${bookingDate}. Please book another sitter.`);

  // Email
  if (petParentEmail && prefs.email) {
    await sendBookingConfirmationEmail(petParentEmail, {
      bookingRef: 'Sitter Unavailable',
      sitterName: `${sitterName} is unavailable`,
      petName: 'Please select another sitter',
      serviceType: 'Booking Status',
      dateTime: bookingDate,
      amount: 0,
      cancellationDeadline: 'Full refund provided'
    });
  }

  // SMS
  if (petParentPhone && prefs.sms) {
    await sendBookingReminderSMS(petParentPhone, { sitterName: `${sitterName} unavailable`, petName: 'Pick new sitter', dateTime: bookingDate });
  }
};

// TIER 3: Referral Bonus Paid
export const notifyReferralBonusPaid = async (userId, userEmail, userPhone, bonusAmount, referredName) => {
  const prefs = await getNotificationPrefs(userId);

  // In-app notification
  await createNotification(userId, 'referral_bonus_paid', '💰 Referral Bonus Paid!', `Rs.${Math.round(bonusAmount / 100)} credited for referring ${referredName}`);

  // Email
  if (userEmail && prefs.email) {
    await sendPayoutNotificationEmail(userEmail, { sitterName: 'Referral Bonus', amount: Math.round(bonusAmount / 100), bookingCount: 1, payoutDate: new Date().toLocaleDateString('en-IN') });
  }

  // SMS (celebratory)
  if (userPhone && prefs.sms) {
    await sendBookingReminderSMS(userPhone, { sitterName: '💰 Referral Bonus!', petName: `Rs.${Math.round(bonusAmount / 100)}`, dateTime: 'Paid' });
  }
};

// TIER 3: Sitter Performance Badge
export const notifyPerformanceBadge = async (sitterId, sitterEmail, sitterPhone, badgeType) => {
  const prefs = await getNotificationPrefs(sitterId);
  const badges = {
    lightning_response: '⚡ Lightning Response - Fastest responder',
    completion_star: '✅ Completion Star - 100% completion rate',
    five_star_master: '🌟 Five Star Master - Maintained 5.0 rating',
    reliable_pro: '🎖️ Reliable Pro - 50+ bookings completed',
    pet_expert: '🐾 Pet Expert - Multiple pet types handled'
  };

  const badgeText = badges[badgeType] || badgeType;

  // In-app notification
  await createNotification(sitterId, 'performance_badge', `🏆 ${badgeText.split('-')[0]}`, badgeText);

  // Email
  if (sitterEmail && prefs.email) {
    await sendBookingConfirmationEmail(sitterEmail, {
      bookingRef: 'Performance Badge',
      sitterName: 'Congratulations!',
      petName: badgeText,
      serviceType: 'Achievement Unlocked',
      dateTime: new Date().toLocaleDateString('en-IN'),
      amount: 0,
      cancellationDeadline: 'Shows on your profile'
    });
  }

  // SMS
  if (sitterPhone && prefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: '🏆 Badge Earned!', petName: badgeType, dateTime: 'Profile updated' });
  }
};

// TIER 3: Admin Action Alert
export const notifyAdminAction = async (sitterId, sitterEmail, sitterPhone, actionType, details) => {
  const actionMessages = {
    warning: '⚠️ Account Warning Issued',
    restriction: '🚫 Temporary Restriction',
    verification_needed: '✓ Verification Required',
    compliance_notice: '📋 Compliance Notice'
  };

  const message = actionMessages[actionType] || actionType;
  const prefs = await getNotificationPrefs(sitterId);

  // In-app notification
  await createNotification(sitterId, 'admin_action', message, details || 'An admin action has been taken on your account.');

  // Email (formal)
  if (sitterEmail && prefs.email) {
    await sendCancellationEmail(sitterEmail, {
      bookingRef: 'Account Update',
      reason: `${message}: ${details}`,
      refundAmount: 0,
      refundStatus: 'Review'
    });
  }

  // SMS if critical
  if (['warning', 'restriction'].includes(actionType) && sitterPhone && prefs.sms) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: message, petName: 'Check email', dateTime: 'Action needed' });
  }
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
