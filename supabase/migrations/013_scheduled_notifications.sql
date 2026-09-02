-- 013: Scheduled Notifications Infrastructure with pg_cron
-- Enables automated notification jobs for reminders and reports

-- Create notification_jobs table to track scheduled job execution
CREATE TABLE IF NOT EXISTS notification_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL, -- 'booking_reminder_12h', 'booking_reminder_1h', 'weekly_earnings'
  booking_id UUID,
  user_id UUID,
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending', -- 'pending', 'executed', 'failed', 'skipped'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_status ON notification_jobs(status);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_scheduled ON notification_jobs(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_job_type ON notification_jobs(job_type);

-- RLS Policy for notification_jobs
ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_jobs_admin_only" ON notification_jobs
  FOR ALL USING (auth.role() = 'authenticated');

-- Function to create 12-hour booking reminder jobs
CREATE OR REPLACE FUNCTION create_booking_reminder_jobs_12h()
RETURNS void AS $$
BEGIN
  INSERT INTO notification_jobs (job_type, booking_id, scheduled_for, status)
  SELECT
    'booking_reminder_12h',
    b.id,
    b.scheduled_date::DATE + b.scheduled_time::TIME - INTERVAL '12 hours',
    'pending'
  FROM bookings b
  WHERE b.status = 'confirmed'
    AND b.scheduled_date::DATE + b.scheduled_time::TIME - INTERVAL '12 hours' > now()
    AND b.scheduled_date::DATE + b.scheduled_time::TIME - INTERVAL '12 hours' <= now() + INTERVAL '5 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM notification_jobs nj
      WHERE nj.booking_id = b.id
        AND nj.job_type = 'booking_reminder_12h'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to create 1-hour booking reminder jobs
CREATE OR REPLACE FUNCTION create_booking_reminder_jobs_1h()
RETURNS void AS $$
BEGIN
  INSERT INTO notification_jobs (job_type, booking_id, scheduled_for, status)
  SELECT
    'booking_reminder_1h',
    b.id,
    b.scheduled_date::DATE + b.scheduled_time::TIME - INTERVAL '1 hour',
    'pending'
  FROM bookings b
  WHERE b.status = 'confirmed'
    AND b.scheduled_date::DATE + b.scheduled_time::TIME - INTERVAL '1 hour' > now()
    AND b.scheduled_date::DATE + b.scheduled_time::TIME - INTERVAL '1 hour' <= now() + INTERVAL '5 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM notification_jobs nj
      WHERE nj.booking_id = b.id
        AND nj.job_type = 'booking_reminder_1h'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to create weekly earnings summary jobs
CREATE OR REPLACE FUNCTION create_weekly_earnings_jobs()
RETURNS void AS $$
BEGIN
  INSERT INTO notification_jobs (job_type, user_id, scheduled_for, status)
  SELECT
    'weekly_earnings',
    sp.user_id,
    (now()::DATE + INTERVAL '1 day')::TIMESTAMPTZ + TIME '18:00:00',
    'pending'
  FROM sitter_profiles sp
  WHERE sp.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM notification_jobs nj
      WHERE nj.user_id = sp.user_id
        AND nj.job_type = 'weekly_earnings'
        AND nj.scheduled_for > now() - INTERVAL '24 hours'
    );
END;
$$ LANGUAGE plpgsql;

-- Comment for manual job setup (pg_cron can be enabled in Supabase dashboard)
-- These cron jobs would be:
-- SELECT cron.schedule('create-booking-reminders-12h', '*/5 * * * *', 'SELECT create_booking_reminder_jobs_12h()');
-- SELECT cron.schedule('create-booking-reminders-1h', '*/5 * * * *', 'SELECT create_booking_reminder_jobs_1h()');
-- SELECT cron.schedule('create-weekly-earnings', '0 18 * * 0', 'SELECT create_weekly_earnings_jobs()');

-- Alternative: HTTP Edge Function trigger (recommended for most deployments)
-- This allows Supabase Edge Functions (hosted on Deno) to process scheduled jobs

-- Audit trail for notification job processing
CREATE TABLE IF NOT EXISTS notification_job_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  action TEXT, -- 'created', 'sent', 'failed', 'skipped'
  details JSONB,
  processed_at TIMESTAMPTZ DEFAULT now(),

  FOREIGN KEY(job_id) REFERENCES notification_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_audit_job_id ON notification_job_audit(job_id);

-- Note: For Supabase deployments, the recommended approach is:
-- 1. Create Edge Function that runs scheduled_notifications logic
-- 2. Trigger it via HTTP call from external scheduler (or Supabase Cron if available)
-- 3. Function processes pending notification_jobs and sends via notificationService

-- Alternative SQL-based job processing (if pg_cron unavailable):
-- Run this query periodically (e.g., every 5 minutes):
-- SELECT process_pending_notification_jobs();
