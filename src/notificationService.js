import { supabase } from './supabase';

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

export const notifyBookingConfirmed = async (sitterId, petParentId, petName, sitterName) => {
  // Notify sitter
  await createNotification(sitterId, 'booking_confirmed', `New booking from ${petParentId}`, `Walk with ${petName}`);
  // Notify pet parent
  await createNotification(petParentId, 'booking_confirmed', `Booking with ${sitterName}`, `Your booking has been confirmed`);
};

export const notifyReviewReceived = async (sitterId, rating, petParentName) => {
  const stars = '⭐'.repeat(rating);
  await createNotification(sitterId, 'review_received', `${petParentName} left a review`, `${stars} (${rating}/5)`);
};

export const notifyMessageReceived = async (userId, senderName) => {
  await createNotification(userId, 'message_received', `New message from ${senderName}`, 'Tap to reply');
};

export const notifyWalkProofReceived = async (petParentId, sitterName) => {
  await createNotification(petParentId, 'walk_proof', `${sitterName} uploaded walk photos`, 'View the proof of service');
};

export const notifyBookingCompleted = async (userId, sitterName, petName) => {
  await createNotification(userId, 'booking_completed', 'Walk completed', `${sitterName} finished the walk with ${petName}`);
};

export const notifyBookingCancelled = async (userId, otherUserName, reason = null) => {
  await createNotification(userId, 'booking_cancelled', `${otherUserName} cancelled the booking`, reason || 'The booking has been cancelled');
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
