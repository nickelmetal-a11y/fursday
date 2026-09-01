import { supabase } from './supabase';
import { sendBookingConfirmationEmail, sendReviewReceivedEmail, sendPayoutNotificationEmail, sendCancellationEmail } from './emailService';
import { sendBookingReminderSMS, sendPayoutNotificationSMS, sendPhotosUploadedSMS } from './smsService';

export const createNotification = async (userId, type, title, body, actionUrl = null, bookingId = null) => {
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      action_url: actionUrl,
      booking_id: bookingId,
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

export const notifyBookingConfirmed = async (bookingData) => {
  const { sitterId, sitterEmail, sitterPhone, petParentId, petParentEmail, petParentPhone, petName, sitterName, serviceType, dateTime, amount, bookingRef } = bookingData;

  // In-app notification to sitter
  await createNotification(sitterId, 'booking_confirmed', `New booking: ${petName}`, `Walk scheduled for ${dateTime}`);

  // In-app notification to pet parent
  await createNotification(petParentId, 'booking_confirmed', `Booking confirmed with ${sitterName}`, `Your booking has been confirmed`);

  // Email to pet parent
  if (petParentEmail) {
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
  if (petParentPhone) {
    await sendBookingReminderSMS(petParentPhone, { sitterName, petName, dateTime });
  }

  // SMS to sitter (new booking alert)
  if (sitterPhone) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: 'You have a new booking!', petName, dateTime });
  }
};

export const notifyReviewReceived = async (sitterId, sitterEmail, rating, petParentName, petName, reviewText) => {
  const stars = '⭐'.repeat(rating);

  // In-app notification
  await createNotification(sitterId, 'review_received', `Review from ${petParentName}`, `${stars} (${rating}/5)`);

  // Email notification
  if (sitterEmail) {
    await sendReviewReceivedEmail(sitterEmail, { sitterName: sitterId, rating, petName, reviewText });
  }
};

export const notifyMessageReceived = async (userId, userEmail, senderName) => {
  // In-app notification
  await createNotification(userId, 'message_received', `New message from ${senderName}`, 'Tap to reply');

  // Email notification (optional, could be too spammy)
  // await sendMessageEmail(userEmail, { senderName });
};

export const notifyWalkProofReceived = async (petParentId, petParentEmail, petParentPhone, sitterName) => {
  // In-app notification
  await createNotification(petParentId, 'walk_proof', `Walk photos uploaded by ${sitterName}`, 'View the proof of service');

  // Email notification
  if (petParentEmail) {
    await sendPhotosUploadedEmail(petParentEmail, { sitterName });
  }

  // SMS notification
  if (petParentPhone) {
    await sendPhotosUploadedSMS(petParentPhone, sitterName);
  }
};

export const notifyBookingCompleted = async (userId, sitterName, petName) => {
  await createNotification(userId, 'booking_completed', 'Walk completed', `${sitterName} finished the walk with ${petName}`);
};

export const notifyBookingCancelled = async (cancellationData) => {
  const { userId, userEmail, userPhone, otherUserName, reason, refundAmount, refundStatus, bookingRef } = cancellationData;

  // In-app notification
  await createNotification(userId, 'booking_cancelled', `${otherUserName} cancelled the booking`, reason || 'The booking has been cancelled');

  // Email with refund details
  if (userEmail) {
    await sendCancellationEmail(userEmail, { bookingRef, reason, refundAmount, refundStatus });
  }
};

export const notifyPayoutMarked = async (sitterId, sitterEmail, sitterPhone, amount, bookingCount, payoutDate) => {
  // In-app notification
  await createNotification(sitterId, 'payout_marked', 'Payout processed!', `Rs. ${amount} marked as paid`);

  // Email notification
  if (sitterEmail) {
    await sendPayoutNotificationEmail(sitterEmail, { sitterName: sitterId, amount: Math.round(amount / 100), bookingCount, payoutDate });
  }

  // SMS notification
  if (sitterPhone) {
    await sendPayoutNotificationSMS(sitterPhone, Math.round(amount / 100));
  }
};

// TIER 2: Walk Start Notification
export const notifyWalkStarted = async (sitterId, sitterPhone, petParentId, petParentPhone, petName, sitterName) => {
  // Notify sitter
  await createNotification(sitterId, 'walk_started', `🚶 Walk started with ${petName}`, 'Enjoy the time with your furry friend!');

  // Notify pet parent
  await createNotification(petParentId, 'walk_started', `Walk started 🚶`, `${sitterName} started the walk with ${petName}`);

  // SMS to both (if available)
  if (sitterPhone) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: 'Walk started!', petName, dateTime: 'Now' });
  }
  if (petParentPhone) {
    await sendBookingReminderSMS(petParentPhone, { sitterName, petName: `Walk with ${petName}`, dateTime: 'Just started' });
  }
};

// TIER 2: Walk Complete Notification
export const notifyWalkCompleted = async (sitterId, sitterEmail, sitterPhone, petParentId, petParentEmail, petParentPhone, petName, sitterName) => {
  // Notify sitter
  await createNotification(sitterId, 'walk_completed', `Walk complete with ${petName}`, 'Great job! Please upload photos if you have any.');

  // Notify pet parent
  await createNotification(petParentId, 'walk_completed', `Walk completed ✓`, `${sitterName} finished the walk with ${petName}`);

  // Email to pet parent
  if (petParentEmail) {
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
  if (sitterPhone) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: 'Walk complete!', petName, dateTime: '✅ Upload photos' });
  }
  if (petParentPhone) {
    await sendBookingReminderSMS(petParentPhone, { sitterName, petName, dateTime: 'Walk finished ✓' });
  }
};

// TIER 2: Sitter Rejected Notification
export const notifySitterRejected = async (sitterId, sitterEmail, reason) => {
  // In-app notification
  await createNotification(sitterId, 'sitter_rejected', '❌ Application Not Approved', reason || 'Your application did not meet our requirements. Please reapply with improvements.');

  // Email notification
  if (sitterEmail) {
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
  // In-app notification
  await createNotification(sitterId, 'sitter_suspended', '⚠️ Account Suspended', reason || 'Your account has been temporarily suspended. Contact support for details.');

  // Email notification
  if (sitterEmail) {
    await sendCancellationEmail(sitterEmail, {
      bookingRef: 'Account Status',
      reason: reason || 'Your account has been suspended. Please contact support.',
      refundAmount: 0,
      refundStatus: 'N/A'
    });
  }

  // SMS notification (high priority)
  if (sitterPhone) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: '⚠️ Account Suspended', petName: 'Please contact support', dateTime: 'Urgent' });
  }
};

// TIER 2: Top Sitter Badge Notification
export const notifyTopSitterAwarded = async (sitterId, sitterEmail, sitterPhone) => {
  // In-app notification
  await createNotification(sitterId, 'top_sitter_awarded', '🌟 TOP SITTER Badge!', 'You have been awarded the prestigious TOP SITTER badge! This will boost your profile visibility.');

  // Email notification
  if (sitterEmail) {
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
  if (sitterPhone) {
    await sendBookingReminderSMS(sitterPhone, { sitterName: '🌟 TOP SITTER!', petName: 'Badge awarded', dateTime: 'Congratulations' });
  }
};

// TIER 2: Dispute Filed Notification
export const notifyDisputeFiled = async (reportedUserId, reportedUserEmail, reportedUserPhone, reporterName, disputeType, title) => {
  // Notify reported user
  await createNotification(reportedUserId, 'dispute_filed', `⚠️ Dispute Filed Against You`, `${reporterName} filed a ${disputeType} dispute: "${title}"`);

  // Email to reported user
  if (reportedUserEmail) {
    await sendCancellationEmail(reportedUserEmail, {
      bookingRef: 'Dispute Notice',
      reason: `A dispute has been filed: ${title}. Our team will review and contact you shortly.`,
      refundAmount: 0,
      refundStatus: 'Under Review'
    });
  }

  // SMS to reported user (high priority)
  if (reportedUserPhone) {
    await sendBookingReminderSMS(reportedUserPhone, { sitterName: 'Dispute Filed', petName: 'Check app for details', dateTime: 'Action needed' });
  }
};

// TIER 2: Dispute Resolved Notification
export const notifyDisputeResolved = async (reportedUserId, reportedUserEmail, reportedUserPhone, reporterName, resolution, refundAmount) => {
  const refundText = refundAmount > 0 ? `Refund: Rs.${Math.round(refundAmount / 100)}` : 'No refund';

  // Notify reported user
  await createNotification(reportedUserId, 'dispute_resolved', `✅ Dispute Resolved`, `Decision: ${resolution}. ${refundText}`);

  // Email to reported user
  if (reportedUserEmail) {
    await sendCancellationEmail(reportedUserEmail, {
      bookingRef: 'Dispute Resolution',
      reason: `Your dispute has been resolved. Decision: ${resolution}`,
      refundAmount: Math.round(refundAmount / 100),
      refundStatus: 'Processed'
    });
  }

  // SMS to reported user
  if (reportedUserPhone) {
    await sendBookingReminderSMS(reportedUserPhone, { sitterName: 'Dispute Resolved ✅', petName: resolution, dateTime: refundText });
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

// Helper function to send photos uploaded email
async function sendPhotosUploadedEmail(email, { sitterName }) {
  // This could be implemented in emailService.js
  // For now, we'll log it
  console.log('Photos uploaded email would be sent to:', email);
}
