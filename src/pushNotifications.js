import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

// Registers this device for real OS push notifications (not just the
// in-app notification feed) and stores the resulting device token so a
// backend job can target it later. No-op on web (Capacitor.isNativePlatform()
// is false there) since browsers need a different (service-worker) flow.
export const enablePushNotifications = async (userId) => {
  if (!Capacitor.isNativePlatform() || !userId) return { granted: false };

  const { PushNotifications } = await import('@capacitor/push-notifications');

  const permStatus = await PushNotifications.checkPermissions();
  let { receive } = permStatus;
  if (receive === 'prompt' || receive === 'prompt-with-rationale') {
    ({ receive } = await PushNotifications.requestPermissions());
  }
  if (receive !== 'granted') return { granted: false };

  return new Promise((resolve) => {
    PushNotifications.addListener('registration', async (token) => {
      await supabase.from('notification_preferences').upsert(
        { user_id: userId, push_token: token.value, push_platform: Capacitor.getPlatform() },
        { onConflict: 'user_id' }
      );
      resolve({ granted: true, token: token.value });
    });
    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration failed:', err);
      resolve({ granted: false, error: err });
    });
    PushNotifications.register();
  });
};

export const disablePushNotifications = async (userId) => {
  if (!Capacitor.isNativePlatform() || !userId) return;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.removeAllListeners();
  await supabase.from('notification_preferences').upsert(
    { user_id: userId, push_token: null },
    { onConflict: 'user_id' }
  );
};
