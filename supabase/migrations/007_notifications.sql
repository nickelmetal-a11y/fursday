-- Notifications table for push/email alerts
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  type text not null, -- booking_confirmed, review_received, message, cancellation, etc.
  title text not null,
  body text,
  action_url text, -- URL to open when notification clicked
  booking_id uuid references bookings(id) on delete cascade,
  read boolean default false,
  sent_at timestamp default now(),
  read_at timestamp
);

-- Notification preferences per user
create table if not exists notification_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null unique references users(id) on delete cascade,
  booking_alerts boolean default true,
  review_alerts boolean default true,
  message_alerts boolean default true,
  push_enabled boolean default true,
  email_enabled boolean default false,
  created_at timestamp default now()
);

-- Enable RLS
alter table notifications enable row level security;
alter table notification_preferences enable row level security;

-- RLS Policies for notifications
drop policy if exists "Users can view their notifications" on notifications;
drop policy if exists "System can create notifications" on notifications;
drop policy if exists "Users can mark notifications read" on notifications;

create policy "Users can view their notifications" on notifications for select using (user_id = auth.uid());
create policy "System can create notifications" on notifications for insert with check (true);
create policy "Users can mark notifications read" on notifications for update using (user_id = auth.uid());

-- RLS Policies for notification preferences
drop policy if exists "Users can view their preferences" on notification_preferences;
drop policy if exists "Users can update their preferences" on notification_preferences;
drop policy if exists "Users can insert their preferences" on notification_preferences;

create policy "Users can view their preferences" on notification_preferences for select using (user_id = auth.uid());
create policy "Users can update their preferences" on notification_preferences for update using (user_id = auth.uid());
create policy "Users can insert their preferences" on notification_preferences for insert with check (user_id = auth.uid());
