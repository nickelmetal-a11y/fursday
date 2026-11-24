-- Migration 014 added cancelled_at/refund_percentage/refund_amount_paise to
-- bookings, but wasn't written with "if not exists" guards, and a stale
-- comment in CancellationPolicyModal.js (written during an earlier audit)
-- claims none of these columns actually exist in production — contradicting
-- what the previous session's notes say was verified. Rather than guess
-- which account is right, this makes the columns' existence unconditional
-- and safe to run regardless of 014's real state.
alter table public.bookings add column if not exists cancelled_at timestamp with time zone;
alter table public.bookings add column if not exists refund_percentage numeric;
alter table public.bookings add column if not exists refund_amount_paise integer;
alter table public.bookings add column if not exists cancellation_reason text;
