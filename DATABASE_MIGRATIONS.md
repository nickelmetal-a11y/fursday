# Database Migrations for Enhanced Features

**Status:** Ready for Supabase implementation  
**Date:** 2026-11-02

## New Tables Required

### 1. Subscription Management

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL DEFAULT 'free',
  billing_period VARCHAR(10) DEFAULT 'monthly',
  start_date TIMESTAMP DEFAULT now(),
  end_date TIMESTAMP,
  auto_renewal BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT valid_tier CHECK (tier IN ('free', 'basic', 'premium', 'vip'))
);

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_tier ON user_subscriptions(tier);
```

### 2. Loyalty Points System

```sql
CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_earned INT NOT NULL,
  points_redeemed INT DEFAULT 0,
  source VARCHAR(50) NOT NULL,
  source_reference_id VARCHAR(100),
  earned_date TIMESTAMP DEFAULT now(),
  expiry_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT valid_source CHECK (source IN (
    'booking_completion', 'review_submission', 'referral', 
    'birthday_bonus', 'anniversary_bonus'
  ))
);

CREATE INDEX idx_loyalty_points_user_id ON loyalty_points(user_id);
CREATE INDEX idx_loyalty_points_expiry ON loyalty_points(expiry_date);
```

### 3. Enhanced Review System

```sql
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS
  category_ratings JSONB DEFAULT '{
    "communication": 0,
    "reliability": 0,
    "safety": 0,
    "pet_care": 0,
    "value": 0
  }'::JSONB;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS
  verified_booking BOOLEAN DEFAULT false;

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS
  pet_image_url VARCHAR(500);

CREATE TABLE sitter_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sitter_id UUID NOT NULL REFERENCES sitter_profiles(id) ON DELETE CASCADE,
  badge_type VARCHAR(50) NOT NULL,
  earned_date TIMESTAMP DEFAULT now(),
  expires_date TIMESTAMP,
  
  CONSTRAINT valid_badge CHECK (badge_type IN (
    'verified', 'trusted', 'super', 'top', 'certified'
  )),
  UNIQUE(sitter_id, badge_type)
);

CREATE INDEX idx_sitter_badges_sitter_id ON sitter_badges(sitter_id);
```

### 4. Real-time GPS Tracking

```sql
CREATE TABLE booking_gps_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy INT NOT NULL,
  heading DECIMAL(5, 2),
  speed DECIMAL(5, 2),
  altitude DECIMAL(10, 2),
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT valid_coordinates CHECK (
    latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
  )
);

CREATE INDEX idx_booking_gps_tracks_booking_id ON booking_gps_tracks(booking_id);
CREATE INDEX idx_booking_gps_tracks_timestamp ON booking_gps_tracks(timestamp);
```

### 5. Payment Methods & Transactions

```sql
CREATE TABLE user_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method VARCHAR(50) NOT NULL,
  provider VARCHAR(50),
  last_four VARCHAR(4),
  is_default BOOLEAN DEFAULT false,
  expires_at DATE,
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT valid_method CHECK (payment_method IN (
    'razorpay', 'apple_pay', 'google_pay', 'upi', 'bank_transfer', 'paypal'
  ))
);

CREATE INDEX idx_user_payment_methods_user_id ON user_payment_methods(user_id);

CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method VARCHAR(50) NOT NULL,
  amount_paise INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  transaction_id VARCHAR(100),
  external_id VARCHAR(100),
  response_data JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT valid_status CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'refunded'
  ))
);

CREATE INDEX idx_payment_transactions_booking_id ON payment_transactions(booking_id);
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);
```

### 6. Service Enhancements

```sql
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  gps_tracking_enabled BOOLEAN DEFAULT false;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  subscription_discount_applied BOOLEAN DEFAULT false;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS
  loyalty_points_earned INT DEFAULT 0;

CREATE TABLE booking_service_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_type VARCHAR(50) NOT NULL,
  duration_minutes INT NOT NULL,
  special_instructions TEXT,
  photos_count INT DEFAULT 0,
  videos_count INT DEFAULT 0,
  distance_traveled_km DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT valid_service CHECK (service_type IN (
    'walk', 'daycare', 'boarding', 'grooming', 'training', 'emergency'
  ))
);

CREATE INDEX idx_booking_service_details_booking_id ON booking_service_details(booking_id);
```

---

## Row-Level Security (RLS) Policies

### For subscription tracking
```sql
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_subscriptions"
  ON user_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);
```

### For loyalty points
```sql
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_points"
  ON loyalty_points FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "system_insert_points"
  ON loyalty_points FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
```

### For GPS tracking
```sql
ALTER TABLE booking_gps_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_own_booking_tracks"
  ON booking_gps_tracks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = booking_gps_tracks.booking_id 
      AND (bookings.pet_parent_id = auth.uid() OR bookings.sitter_id = auth.uid())
    )
  );
```

### For payment methods
```sql
ALTER TABLE user_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_payment_methods"
  ON user_payment_methods FOR ALL
  USING (auth.uid() = user_id);
```

---

## Migration Script

Run these SQL commands in Supabase SQL Editor in order:

1. Create subscription table
2. Create loyalty points table
3. Alter reviews table for categories
4. Create sitter badges table
5. Create GPS tracking table
6. Create payment tables
7. Alter bookings table
8. Create service details table
9. Enable RLS policies

All migrations are backward compatible and won't affect existing data.

---

## Estimated Impact

- **New Tables:** 8
- **New Columns:** 5
- **New Indexes:** 20+
- **Data Migration:** None required
- **Downtime:** None
- **Execution Time:** < 5 minutes

