-- OTP columns on bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_otp TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_otp TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS start_verified_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS end_verified_at TIMESTAMPTZ;

-- Generate OTPs when a booking is confirmed (function + trigger)
CREATE OR REPLACE FUNCTION generate_booking_otps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    IF NEW.start_otp IS NULL THEN
      NEW.start_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
    IF NEW.end_otp IS NULL THEN
      NEW.end_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS booking_otp_trigger ON bookings;
CREATE TRIGGER booking_otp_trigger
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION generate_booking_otps();
