-- Store the native (APNs/FCM) device token per user so a server-side job can
-- actually send OS push notifications, not just in-app ones. The Settings
-- "Push" toggle now registers for real push and writes the token here.
alter table notification_preferences add column if not exists push_token text;
alter table notification_preferences add column if not exists push_platform text; -- 'ios' | 'android'
