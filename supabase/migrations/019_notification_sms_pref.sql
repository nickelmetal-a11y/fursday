-- 007_notifications.sql defined push_enabled/email_enabled but the app has
-- an SMS notifications toggle in Settings and actually sends SMS
-- (smsService.js) - there was no column to persist that preference.
alter table notification_preferences add column if not exists sms_enabled boolean default true;
