-- Fix bookings.pet_id FK: it pointed at the unused `pets` table while every
-- app code path reads/writes `pet_profiles` (which already holds real
-- production data). No booking could ever succeed until this is repointed.
ALTER TABLE public.bookings DROP CONSTRAINT bookings_pet_id_fkey;
ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_pet_id_fkey FOREIGN KEY (pet_id) REFERENCES public.pet_profiles(id);

-- Add refund tracking columns that the cancellation flow needs but never had.
-- Kept on `bookings` directly (1:1 with a cancelled booking) rather than a
-- separate `refunds` table, since there's no multi-partial-refund use case.
ALTER TABLE public.bookings
  ADD COLUMN cancelled_at timestamp with time zone,
  ADD COLUMN refund_percentage numeric,
  ADD COLUMN refund_amount_paise integer;
