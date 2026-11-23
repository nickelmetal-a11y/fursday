# Fursday - Production Deployment Roadmap

**Date Created:** 2026-11-02  
**Target Deployment:** After Phase 1 & Phase 2 completion  
**Current Status:** Phase 1 MVP complete (32/37 core features done)  
**New Features Added:** 7 critical + high-priority from competitive analysis

---

## 📊 ROADMAP OVERVIEW

This roadmap outlines implementation of 7 critical and high-priority features identified from competitive analysis. Features are grouped into two phases with staggered deployment.

| Phase | Name | Features | Est. Time | Deployment |
|-------|------|----------|-----------|------------|
| **PHASE 1** | **CRITICAL** | GPS Tracking, Multi-Payment, Enhanced Reviews | **5-6 days** | **Pre-production** |
| **PHASE 2** | **HIGH PRIORITY** | Subscriptions, Additional Services, Real-time Updates, Enhanced Verification | **7-8 days** | **Post-phase-1** |
| **TOTAL** | | 7 features | **12-14 days** | Production-ready |

---

## 🔴 PHASE 1: CRITICAL FEATURES (5-6 Days)

### Feature 1.1: GPS Tracking During Service (Real-time Sitter Location)

**Priority:** CRITICAL  
**Estimated Time:** 2 days  
**Deployment Risk:** Medium (location privacy)

#### 1.1.1 Business Requirements
- Sitter's real-time location visible to pet parent during active walk/service
- Location updates every 10-30 seconds during active booking
- Map view shows sitter path history
- Parent can request live location anytime
- Battery-efficient tracking (stop after service ends)
- Privacy: Location only shared during booked service window

#### 1.1.2 Database Schema Updates

**New Migration: `014_gps_tracking.sql`**

```sql
-- GPS location tracking table (high-volume inserts)
create table if not exists public.gps_tracking (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  latitude decimal(10, 8) not null,
  longitude decimal(11, 8) not null,
  accuracy_meters int,
  battery_percent int,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast queries by booking + timestamp
create index idx_gps_tracking_booking_ts on public.gps_tracking(booking_id, timestamp desc);
create index idx_gps_tracking_sitter_ts on public.gps_tracking(sitter_id, timestamp desc);

-- Enable RLS
alter table public.gps_tracking enable row level security;

-- RLS: Sitters insert own location
create policy "Sitters insert own GPS data"
  on public.gps_tracking for insert
  with check (sitter_id = (select id from public.sitter_profiles where user_id = auth.uid() limit 1));

-- RLS: Pet parents & sitters view during active booking
create policy "Users view GPS during active booking"
  on public.gps_tracking for select
  using (
    booking_id in (
      select id from public.bookings 
      where (user_id = auth.uid() or sitter_id = (select id from public.sitter_profiles where user_id = auth.uid() limit 1))
      and status = 'accepted'
    )
  );

-- Add tracking_enabled & last_location_update to bookings table
alter table if exists public.bookings add column if not exists tracking_enabled boolean default true;
alter table if exists public.bookings add column if not exists last_location_update timestamp with time zone;
```

#### 1.1.3 Frontend Components

**New File: `src/gpsTrackingService.js` (Enhanced version)**
```javascript
// Already exists but needs enhancement:
// - Add real-time location streaming (WebSocket or polling)
// - Calculate distance traveled
// - Detect pause/resume of tracking
// - Battery monitoring

export const startTracking = async (bookingId, updateInterval = 15000) => {
  // Start sending location every 15 seconds
  // Returns a cleanup function to stop tracking
};

export const stopTracking = async (bookingId) => {
  // Stop sending location updates
  // Store final location
};

export const getLocationHistory = async (bookingId) => {
  // Fetch all GPS points for a booking
  // Return as array of {lat, lng, timestamp}
};
```

**Update: `src/BookingsDashboard.js`**
- Add "Live Track" button for active bookings (if tracking_enabled = true)
- Embed map component showing real-time sitter location
- Show distance traveled & ETA based on route
- Update every 10 seconds via polling or WebSocket

**New File: `src/LiveTrackingMap.js`**
```javascript
// Component to display:
// - Google Map with sitter's current position
// - Polyline of route traveled
// - Walk duration & distance
// - Pet parent location (optional, if shared)
// - "Request location now" button
// - Battery indicator for sitter's phone
```

**Update: `src/SitterDashboard.js`**
- Add toggle: "Share location with pet parent" (during active service only)
- Show battery percentage
- Show tracking status (active/paused/stopped)
- Enable/disable tracking with confirmation
- Battery warning at <20%

#### 1.1.4 API Integration Points

**Supabase Real-time (using existing setup):**
```javascript
// Subscribe to GPS updates in real-time
supabase
  .from(`gps_tracking:booking_id=eq.${bookingId}`)
  .on('INSERT', (payload) => {
    // Update map with new location
  })
  .subscribe();
```

**Alternative: Polling (if real-time too expensive)**
```javascript
// Poll every 15 seconds during active booking
const locationPoll = setInterval(async () => {
  const latest = await supabase
    .from('gps_tracking')
    .select('latitude, longitude, accuracy_meters, battery_percent')
    .eq('booking_id', bookingId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single();
  
  updateMapMarker(latest);
}, 15000);
```

#### 1.1.5 React Component Changes

**File: `src/BookingsDashboard.js` (lines ~250-300)**
```javascript
// Add inside booking card for active bookings
{booking.status === 'accepted' && booking.tracking_enabled && (
  <div className="live-tracking-section">
    <button onClick={() => setShowLiveTracking(true)}>
      📍 Live Track Sitter ({distanceTraveled}km)
    </button>
  </div>
)}

// Add modal
{showLiveTracking && (
  <LiveTrackingMap 
    bookingId={booking.id}
    onClose={() => setShowLiveTracking(false)}
  />
)}
```

**File: `src/SitterDashboard.js` (lines ~150-200)**
```javascript
// Add in accepted booking section
{booking.status === 'accepted' && (
  <div className="sitter-tracking-controls">
    <label>
      <input 
        type="checkbox" 
        checked={booking.tracking_enabled}
        onChange={() => toggleTracking(booking.id)}
      />
      Share location with pet parent
    </label>
    {navigator.deviceMemory && navigator.deviceMemory < 2 && (
      <div className="warning">⚠️ Low battery detected</div>
    )}
  </div>
)}
```

#### 1.1.6 Tests to Add

**New File: `src/gpsTrackingService.test.js`**
```javascript
describe('GPS Tracking Service', () => {
  test('startTracking() sends location every 15 seconds', async () => {
    // Mock geolocation
    // Call startTracking()
    // Verify insert calls to gps_tracking table
    // Expect at least 2 inserts within 30 seconds
  });

  test('stopTracking() stops sending updates', async () => {
    // Start tracking
    // Stop tracking
    // Wait 30 seconds
    // Verify no new inserts after stop
  });

  test('getLocationHistory() returns all points for booking', async () => {
    // Insert 10 GPS points
    // Call getLocationHistory(bookingId)
    // Expect array of 10 points with lat/lng/timestamp
  });

  test('Battery <20% triggers warning notification', () => {
    // Mock low battery status
    // Verify warning toast shown to sitter
  });

  test('Location only shared during active booking', () => {
    // Verify RLS policy: parent can only see during 'accepted' status
    // Verify denied after booking completes
  });
});
```

**Update: `src/BookingsDashboard.test.js`**
- Add test for "Live Track" button visibility
- Add test for map component renders
- Add test for location updates every 15 seconds

#### 1.1.7 Completion Checklist
- [ ] Migration `014_gps_tracking.sql` created & applied
- [ ] `gpsTrackingService.js` enhanced with real-time updates
- [ ] `LiveTrackingMap.js` component built (Google Maps API)
- [ ] `BookingsDashboard.js` updated with live tracking button
- [ ] `SitterDashboard.js` updated with tracking toggle
- [ ] RLS policies verified (parent can only see during active booking)
- [ ] Tests pass (8+ test cases)
- [ ] Staging deployed & tested with real location data
- [ ] Privacy audit: Location only stored during service
- [ ] Battery monitoring implemented

**Estimated Time:** 2 days (1 day dev + 0.5 day testing + 0.5 day deployment)

---

### Feature 1.2: Multi-Payment Methods

**Priority:** CRITICAL  
**Estimated Time:** 2 days  
**Deployment Risk:** High (payment security, compliance)

#### 1.2.1 Business Requirements
- Keep existing Razorpay integration as primary
- Add Apple Pay (iOS only)
- Add Google Pay (Android only)
- Add UPI (India-specific, direct bank link)
- Add Bank Transfer option (scheduled payout integration)
- Unified payment UI showing all available methods
- PCI-DSS compliance for all payment methods

#### 1.2.2 Database Schema Updates

**New Migration: `015_multi_payment_methods.sql`**

```sql
-- Store payment method preferences per user
create table if not exists public.payment_methods (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  method_type text not null check (method_type in ('razorpay', 'apple_pay', 'google_pay', 'upi', 'bank_transfer')),
  is_primary boolean default false,
  is_active boolean default true,
  
  -- Payment method specific data (encrypted in Supabase)
  razorpay_customer_id text,
  apple_pay_token text,  -- Tokenized, not raw card data
  google_pay_token text, -- Tokenized, not raw card data
  upi_id text,           -- Format: phone@bankname
  bank_account_id text,  -- Reference to bank transfer details (stored separately in encrypted table)
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, method_type)
);

-- Bank account details (highly sensitive - separate table)
create table if not exists public.bank_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_holder_name text not null,
  account_number text not null,  -- Encrypted
  ifsc_code text not null,        -- Bank code
  bank_name text not null,
  account_type text not null check (account_type in ('savings', 'current')),
  is_verified boolean default false,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Payment transactions (audit trail)
create table if not exists public.payment_transactions (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount decimal(10, 2) not null,
  payment_method text not null,
  payment_status text not null check (payment_status in ('pending', 'success', 'failed', 'refunded')),
  transaction_id text unique,       -- From payment gateway
  gateway_response jsonb,           -- Full response for debugging
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index idx_payment_methods_user on public.payment_methods(user_id);
create index idx_bank_accounts_user on public.bank_accounts(user_id);
create index idx_payment_transactions_booking on public.payment_transactions(booking_id);
create index idx_payment_transactions_user on public.payment_transactions(user_id);

-- RLS
alter table public.payment_methods enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.payment_transactions enable row level security;

-- RLS: Users can only view their own payment methods
create policy "Users view own payment methods"
  on public.payment_methods for select
  using (user_id = auth.uid());

create policy "Users insert own payment methods"
  on public.payment_methods for insert
  with check (user_id = auth.uid());

create policy "Users update own payment methods"
  on public.payment_methods for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- RLS: Bank accounts
create policy "Users view own bank accounts"
  on public.bank_accounts for select
  using (user_id = auth.uid());

create policy "Users insert own bank accounts"
  on public.bank_accounts for insert
  with check (user_id = auth.uid());

-- RLS: Payment transactions
create policy "Users view own transactions"
  on public.payment_transactions for select
  using (user_id = auth.uid() or booking_id in (select id from public.bookings where sitter_id = (select id from public.sitter_profiles where user_id = auth.uid() limit 1)));

create policy "Admins view all transactions"
  on public.payment_transactions for select
  using (auth.jwt() ->> 'role' = 'admin');
```

#### 1.2.3 Frontend Components

**Update: `src/PaymentScreen.js`**
```javascript
// Current implementation only supports Razorpay
// Refactor to:
// 1. Show all available payment methods based on device/region
// 2. Select payment method UI (radio buttons or cards)
// 3. Handle different payment flows

// For iOS: Show Apple Pay option
// For Android: Show Google Pay option
// For all: Show UPI option (India)
// For all: Show Bank Transfer option
```

**New File: `src/PaymentMethodSelector.js`**
```javascript
// Component to display payment method options
// - Razorpay (credit/debit card)
// - Apple Pay (if iOS && apple_pay_installed)
// - Google Pay (if Android && google_pay_installed)
// - UPI (if India && upi_installed)
// - Bank Transfer (all regions, for future payout)
// - Wallet (if balance > 0)

// Shows primary method as default
// Allow selection of secondary methods
// Show saved payment methods with masked details
```

**New File: `src/UPIPaymentFlow.js`**
```javascript
// Handle UPI-specific payment flow
// 1. User enters UPI ID or selects saved UPI
// 2. Initiate UPI payment via Razorpay (UPI collect/intent)
// 3. Redirect to UPI app (PhonePe, Google Pay, Paytm, etc.)
// 4. Return to app with payment status
// 5. Verify payment status from Razorpay webhook

// UPI format: phone@bankname
// Example: 9876543210@okhdfcbank, 9876543210@okaxis, 9876543210@okicici
```

**New File: `src/BankTransferFlow.js`**
```javascript
// Handle bank transfer payment option
// 1. Show payment details (Fursday's bank account)
// 2. User completes payment outside app
// 3. Booking set to 'pending_payment_confirmation'
// 4. Admin confirms payment from bank statement
// 5. Booking moved to 'confirmed'

// For now: Manual payment via account details
// Future: Razorpay Transfer for sitter payouts
```

**New File: `src/PaymentMethodManager.js`**
```javascript
// Component for users to manage saved payment methods
// - Add new payment method
// - Delete saved method
// - Mark as primary
// - View payment history
// - Delete transaction records

// Integrated in SettingsScreen
```

#### 1.2.4 API Integration Points

**Razorpay Integration (already exists, needs enhancement):**
```javascript
// Keep existing Razorpay payment
// Add UPI support via Razorpay UPI method
const razorpayOptions = {
  // ... existing options
  method: {
    netbanking: 1,
    card: 1,
    upi: 1,  // Enable UPI
    wallet: 1,
    emandate: 0,
    recurring: 0
  }
};
```

**Apple Pay Integration (iOS only):**
```javascript
// Check availability
if (window.ApplePaySession && ApplePaySession.canMakePayments()) {
  // Create Apple Pay payment request
  const applePayRequest = {
    countryCode: 'IN',
    currencyCode: 'INR',
    supportedNetworks: ['visa', 'mastercard'],
    merchantCapabilities: ['supports3DS'],
    total: { label: 'Fursday', amount: totalAmount.toString() }
  };
  
  // Process payment
}
```

**Google Pay Integration (Android):**
```javascript
// Check availability
async function checkGooglePayAvailable() {
  const paymentsClient = new google.payments.api.PaymentsClient({
    environment: 'PRODUCTION' // or TEST
  });
  
  const isReadyToPay = await paymentsClient.isReadyToPay(baseRequest);
  return isReadyToPay.result;
}

// Create payment request
const googlePayRequest = {
  apiVersion: 2,
  apiVersionMinor: 0,
  allowedPaymentMethods: [{
    type: 'CARD',
    parameters: {
      allowedCardNetworks: ['VISA', 'MASTERCARD'],
      allowedAuthMethods: ['PAN_ONLY', '3DS']
    }
  }],
  transactionInfo: {
    totalPriceStatus: 'FINAL',
    totalPrice: amount.toString(),
    currencyCode: 'INR'
  }
};
```

**UPI Payment via Razorpay:**
```javascript
// Use Razorpay UPI VPA method
const upiPayment = {
  key: process.env.REACT_APP_RAZORPAY_KEY_ID,
  amount: totalAmount * 100, // Convert to paise
  currency: 'INR',
  order_id: orderId, // Created via Razorpay API
  customer_id: customerId,
  receipt: 'receipt#1',
  method: 'upi', // Razorpay will handle VPA collection
  vpa: userUpiId // Format: 9876543210@okhdfcbank
};
```

#### 1.2.5 React Component Changes

**File: `src/PaymentScreen.js` (complete refactor)**
```javascript
// Current: Lines ~1-200
// Changes:
// 1. Add payment method selector component
// 2. Show different UIs based on selected method
// 3. Handle Razorpay, Apple Pay, Google Pay, UPI flows
// 4. Add error handling for each payment method
// 5. Add payment method saving option

const PaymentScreen = ({ booking, onPaymentSuccess }) => {
  const [selectedMethod, setSelectedMethod] = useState('razorpay');
  const [savedMethods, setSavedMethods] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Load saved payment methods
    loadSavedPaymentMethods();
  }, []);

  const handlePayment = async () => {
    switch(selectedMethod) {
      case 'razorpay':
        return processRazorpayPayment();
      case 'apple_pay':
        return processApplePayPayment();
      case 'google_pay':
        return processGooglePayPayment();
      case 'upi':
        return processUPIPayment();
      case 'bank_transfer':
        return processBankTransferPayment();
      default:
        return;
    }
  };

  return (
    <div className="payment-screen">
      <PaymentMethodSelector 
        methods={availableMethods}
        selected={selectedMethod}
        onSelect={setSelectedMethod}
      />
      
      {selectedMethod === 'razorpay' && <RazorpayPayment />}
      {selectedMethod === 'apple_pay' && <ApplePayPayment />}
      {selectedMethod === 'google_pay' && <GooglePayPayment />}
      {selectedMethod === 'upi' && <UPIPaymentFlow />}
      {selectedMethod === 'bank_transfer' && <BankTransferFlow />}
      
      <button onClick={handlePayment} disabled={isProcessing}>
        {isProcessing ? 'Processing...' : `Pay ₹${booking.total_price}`}
      </button>
    </div>
  );
};
```

#### 1.2.6 Tests to Add

**New File: `src/PaymentScreen.test.js`**
```javascript
describe('Multi-Payment Methods', () => {
  test('Shows Razorpay option on all platforms', () => {
    // Render PaymentScreen
    // Verify Razorpay option visible
  });

  test('Shows Apple Pay only on iOS', () => {
    // Mock iOS user agent
    // Verify Apple Pay option visible
  });

  test('Shows Google Pay only on Android', () => {
    // Mock Android user agent
    // Verify Google Pay option visible
  });

  test('Shows UPI option for India region', () => {
    // Mock India geolocation
    // Verify UPI option visible
  });

  test('Razorpay payment processes successfully', async () => {
    // Mock Razorpay
    // Click Pay button
    // Verify payment processed
    // Verify booking status updated
  });

  test('UPI payment redirects to UPI app', () => {
    // Mock UPI payment
    // Verify redirect to UPI app
  });

  test('Saved payment methods loaded', async () => {
    // Create 2 saved payment methods
    // Render PaymentScreen
    // Verify both methods shown
  });

  test('Can select different payment method', () => {
    // Render with 2 methods
    // Click second method
    // Verify selected
  });
});
```

**Update: `src/PaymentMethodManager.test.js`** (new file)
```javascript
describe('Payment Method Manager', () => {
  test('Add new payment method', async () => {
    // Verify method added to database
  });

  test('Delete payment method', async () => {
    // Verify method deleted
  });

  test('Mark as primary payment method', async () => {
    // Verify is_primary = true
    // Verify previous primary = false
  });

  test('View payment history', () => {
    // Show all transactions
  });
});
```

#### 1.2.7 Backend Enhancements

**New File: `src/paymentService.js` (enhanced)**
```javascript
// Consolidate all payment gateway integrations
export const processPayment = async (booking, paymentMethod, paymentDetails) => {
  switch(paymentMethod) {
    case 'razorpay':
      return processRazorpayPayment(booking, paymentDetails);
    case 'apple_pay':
      return processApplePayPayment(booking, paymentDetails);
    case 'google_pay':
      return processGooglePayPayment(booking, paymentDetails);
    case 'upi':
      return processUPIPayment(booking, paymentDetails);
    case 'bank_transfer':
      return processBankTransferPayment(booking, paymentDetails);
  }
};

// UPI payment handler
export const processUPIPayment = async (booking, upiDetails) => {
  // Call Razorpay UPI API
  // Return payment link for user to complete
};

// Apple Pay handler
export const processApplePayPayment = async (booking, applePayToken) => {
  // Process Apple Pay token with Razorpay
  // Or call Apple Pay validation service
};

// Bank transfer handler
export const processBankTransferPayment = async (booking) => {
  // Return Fursday bank details
  // Create pending payment record
  // Return reference number for user
};
```

#### 1.2.8 Security Considerations

- [ ] PCI-DSS compliance: No raw card data stored
- [ ] Encryption: Bank account details encrypted in Supabase
- [ ] Tokenization: Apple Pay, Google Pay, UPI use tokens only
- [ ] RLS: Users can only view own payment methods
- [ ] Webhook validation: Verify payment gateway signatures
- [ ] Rate limiting: Limit payment attempts per user
- [ ] Fraud detection: Monitor multiple failed payments

#### 1.2.9 Completion Checklist
- [ ] Migration `015_multi_payment_methods.sql` created & applied
- [ ] `PaymentScreen.js` refactored to support multiple methods
- [ ] `PaymentMethodSelector.js` component built
- [ ] `UPIPaymentFlow.js` integrated with Razorpay
- [ ] `ApplePayPayment.js` component built (iOS)
- [ ] `GooglePayPayment.js` component built (Android)
- [ ] `BankTransferFlow.js` component built
- [ ] `PaymentMethodManager.js` integrated in Settings
- [ ] `paymentService.js` consolidated with all gateways
- [ ] Tests pass (10+ test cases)
- [ ] Security audit: PCI-DSS compliance verified
- [ ] Razorpay webhook handlers updated
- [ ] Staging deployed & tested with all payment methods
- [ ] Documentation: Payment method setup guide

**Estimated Time:** 2 days (1 day dev + 0.5 day security review + 0.5 day testing & deployment)

---

### Feature 1.3: Enhanced Review System

**Priority:** CRITICAL  
**Estimated Time:** 1.5 days  
**Deployment Risk:** Low

#### 1.3.1 Business Requirements
- Add review categories (safety, punctuality, cleanliness, communication, pet care)
- Award sitter badges based on ratings: Trusted (3.5+), Super (4.5+), Top (4.8+)
- Display badges on sitter profile & explore screen
- Category-specific ratings help parents decide
- Badges update dynamically based on recent reviews

#### 1.3.2 Database Schema Updates

**New Migration: `016_enhanced_reviews.sql`**

```sql
-- Review categories for more detailed feedback
create table if not exists public.review_categories (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert default categories
insert into public.review_categories (name, description) values
  ('Safety', 'Pet safety and handling'),
  ('Punctuality', 'Arrival and departure times'),
  ('Cleanliness', 'Hygiene and property care'),
  ('Communication', 'Updates and responsiveness'),
  ('Pet Care', 'Attention and interaction with pet');

-- Update reviews table to include category ratings
alter table if exists public.reviews 
  add column if not exists safety_rating int check (safety_rating between 1 and 5),
  add column if not exists punctuality_rating int check (punctuality_rating between 1 and 5),
  add column if not exists cleanliness_rating int check (cleanliness_rating between 1 and 5),
  add column if not exists communication_rating int check (communication_rating between 1 and 5),
  add column if not exists pet_care_rating int check (pet_care_rating between 1 and 5);

-- Sitter badges table
create table if not exists public.sitter_badges (
  id uuid default gen_random_uuid() primary key,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  badge_type text not null check (badge_type in ('trusted', 'super', 'top', 'responsive', 'photo_pro', 'reliable')),
  earned_at timestamp with time zone default timezone('utc'::text, now()) not null,
  criteria_met text,  -- e.g., "avg_rating >= 4.5, reviews >= 10"
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(sitter_id, badge_type)
);

-- Badge definitions
create table if not exists public.badge_definitions (
  id uuid default gen_random_uuid() primary key,
  badge_type text not null unique check (badge_type in ('trusted', 'super', 'top', 'responsive', 'photo_pro', 'reliable')),
  display_name text not null,
  description text,
  icon_emoji text,
  min_rating decimal(3, 1),
  min_reviews int,
  min_completion_percent int,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert badge definitions
insert into public.badge_definitions (badge_type, display_name, description, icon_emoji, min_rating, min_reviews, min_completion_percent) values
  ('trusted', 'Trusted Sitter', 'Rated 3.5+ with 5+ reviews', '✓', 3.5, 5, 90),
  ('super', 'Super Sitter', 'Rated 4.5+ with 15+ reviews', '⭐', 4.5, 15, 95),
  ('top', 'Top Sitter', 'Rated 4.8+ with 25+ reviews', '🏆', 4.8, 25, 99),
  ('responsive', 'Quick Responder', 'Accepts >80% of bookings within 2 mins', '⚡', null, null, null),
  ('photo_pro', 'Photo Pro', 'All bookings include walk photos', '📸', null, null, null),
  ('reliable', 'Reliable', '100% completion rate (30+ bookings)', '🎯', null, 30, 100);

-- Indexes
create index idx_sitter_badges_sitter on public.sitter_badges(sitter_id);
create index idx_sitter_badges_type on public.sitter_badges(badge_type);

-- RLS
alter table public.sitter_badges enable row level security;
alter table public.badge_definitions enable row level security;

-- RLS: Everyone can view badge definitions
create policy "Anyone view badge definitions"
  on public.badge_definitions for select
  using (true);

-- RLS: Everyone can view sitter badges
create policy "Anyone view sitter badges"
  on public.sitter_badges for select
  using (true);

-- Store category-wise ratings summary on sitter profile
alter table if exists public.sitter_profiles 
  add column if not exists avg_safety_rating decimal(3, 2),
  add column if not exists avg_punctuality_rating decimal(3, 2),
  add column if not exists avg_cleanliness_rating decimal(3, 2),
  add column if not exists avg_communication_rating decimal(3, 2),
  add column if not exists avg_pet_care_rating decimal(3, 2),
  add column if not exists total_reviews int default 0,
  add column if not exists completion_rate_percent int default 0,
  add column if not exists badges_earned text[]; -- Array of badge types
```

#### 1.3.3 Frontend Components

**Update: `src/ReviewModal.js`**
```javascript
// Current: Only shows overall 5-star rating + text
// Changes:
// 1. Add category ratings (5 stars each: Safety, Punctuality, etc.)
// 2. Calculate and display average category rating
// 3. Show badge eligibility preview ("You're close to Super Sitter!")
// 4. Add category-specific questions/hints

const ReviewModal = ({ booking, onSubmit }) => {
  const [overallRating, setOverallRating] = useState(0);
  const [categories, setCategories] = useState({
    safety: 0,
    punctuality: 0,
    cleanliness: 0,
    communication: 0,
    pet_care: 0
  });
  const [reviewText, setReviewText] = useState('');

  const handleSubmit = async () => {
    const review = {
      booking_id: booking.id,
      sitter_id: booking.sitter_id,
      user_id: auth.user().id,
      rating: overallRating,
      review_text: reviewText,
      safety_rating: categories.safety,
      punctuality_rating: categories.punctuality,
      cleanliness_rating: categories.cleanliness,
      communication_rating: categories.communication,
      pet_care_rating: categories.pet_care,
      created_at: new Date()
    };
    
    await supabase.from('reviews').insert([review]);
    
    // Trigger badge calculation
    await updateSitterBadges(booking.sitter_id);
    
    onSubmit();
  };

  return (
    <div className="review-modal">
      <h2>How was {booking.sitter_name}?</h2>
      
      {/* Overall rating */}
      <StarRating 
        value={overallRating} 
        onChange={setOverallRating}
        label="Overall Experience"
      />
      
      {/* Category ratings */}
      <div className="category-ratings">
        {Object.entries(categories).map(([category, rating]) => (
          <div key={category} className="category-item">
            <label>{capitalizeFirst(category.replace('_', ' '))}</label>
            <StarRating 
              value={rating} 
              onChange={(v) => setCategories({...categories, [category]: v})}
              size="small"
            />
          </div>
        ))}
      </div>
      
      {/* Badge preview */}
      <BadgePreview 
        sitterId={booking.sitter_id}
        ratings={categories}
      />
      
      {/* Review text */}
      <textarea 
        value={reviewText}
        onChange={(e) => setReviewText(e.target.value)}
        placeholder="Share your experience (optional)"
        minLength="0"
      />
      
      <button onClick={handleSubmit}>Submit Review</button>
    </div>
  );
};
```

**New File: `src/BadgePreview.js`**
```javascript
// Shows badges user is close to earning
const BadgePreview = ({ sitterId, ratings }) => {
  const [eligibleBadges, setEligibleBadges] = useState([]);

  useEffect(() => {
    calculateEligibleBadges();
  }, [ratings]);

  const calculateEligibleBadges = async () => {
    // Get sitter's current stats
    const { data: sitter } = await supabase
      .from('sitter_profiles')
      .select('avg_rating, total_reviews')
      .eq('id', sitterId)
      .single();

    // Check which badges they might earn with this new review
    const avgRating = (sitter.avg_rating * sitter.total_reviews + (ratings.safety + ratings.punctuality + ratings.cleanliness + ratings.communication + ratings.pet_care) / 5) / (sitter.total_reviews + 1);

    if (avgRating >= 4.5 && sitter.total_reviews + 1 >= 15) {
      // Eligible for "Super" badge
    }
  };

  return (
    <div className="badge-preview">
      {eligibleBadges.length > 0 && (
        <>
          <p>🌟 You're on track for a badge!</p>
          {eligibleBadges.map(badge => (
            <span key={badge} className="badge-hint">{badge}</span>
          ))}
        </>
      )}
    </div>
  );
};
```

**Update: `src/ExploreScreen.js`**
```javascript
// Current: Shows sitter card with name, rating, distance
// Changes:
// 1. Display earned badges on each sitter card
// 2. Highlight "Top" badge sitters with special styling
// 3. Add badge filter option

// In sitter card component
{sitter.badges_earned && sitter.badges_earned.map(badge => (
  <span key={badge} className={`badge badge-${badge}`}>
    {getBadgeIcon(badge)} {getBadgeLabel(badge)}
  </span>
))}
```

**Update: `src/SitterProfile.js`**
```javascript
// Current: Shows overall rating, review count, bio
// Changes:
// 1. Display all earned badges
// 2. Show category-specific rating bars
// 3. Show recent reviews with categories highlighted
// 4. Show badge progress (e.g., "1 more positive review to Super Sitter")

return (
  <div className="sitter-profile">
    {/* Badges section */}
    <div className="badges-section">
      {sitter.badges_earned?.map(badge => (
        <BadgeDisplay key={badge} badge={badge} />
      ))}
    </div>
    
    {/* Category ratings */}
    <div className="category-ratings-bar">
      <RatingBar label="Safety" value={sitter.avg_safety_rating} />
      <RatingBar label="Punctuality" value={sitter.avg_punctuality_rating} />
      <RatingBar label="Cleanliness" value={sitter.avg_cleanliness_rating} />
      <RatingBar label="Communication" value={sitter.avg_communication_rating} />
      <RatingBar label="Pet Care" value={sitter.avg_pet_care_rating} />
    </div>
    
    {/* Reviews */}
    <div className="reviews-section">
      {reviews.map(review => (
        <div key={review.id} className="review-item">
          <span>{review.author_name}</span>
          <StarRating value={review.rating} readOnly />
          <div className="category-badges">
            {review.safety_rating && <span>{review.safety_rating}★ Safety</span>}
            {/* ... other categories */}
          </div>
          <p>{review.review_text}</p>
        </div>
      ))}
    </div>
  </div>
);
```

**New File: `src/BadgeDisplay.js`**
```javascript
// Render individual badge with icon, name, description
const BadgeDisplay = ({ badge }) => {
  const badgeData = {
    'trusted': { icon: '✓', label: 'Trusted Sitter', color: 'blue' },
    'super': { icon: '⭐', label: 'Super Sitter', color: 'gold' },
    'top': { icon: '🏆', label: 'Top Sitter', color: 'purple' },
    'responsive': { icon: '⚡', label: 'Quick Responder', color: 'green' },
    'photo_pro': { icon: '📸', label: 'Photo Pro', color: 'orange' },
    'reliable': { icon: '🎯', label: 'Reliable', color: 'red' }
  };
  
  const data = badgeData[badge];
  
  return (
    <div className={`badge badge-${badge}`} title={data.label}>
      <span className="badge-icon">{data.icon}</span>
      <span className="badge-label">{data.label}</span>
    </div>
  );
};
```

#### 1.3.4 API Integration Points

**Backend Service: Badge Calculation (runs after review submission)**
```javascript
export const updateSitterBadges = async (sitterId) => {
  // Get sitter's stats
  const { data: sitter } = await supabase
    .from('sitter_profiles')
    .select('avg_rating, total_reviews, completion_rate_percent')
    .eq('id', sitterId)
    .single();

  // Get badge definitions
  const { data: badges } = await supabase
    .from('badge_definitions')
    .select('*');

  // Check each badge
  for (const badge of badges) {
    const isEligible = checkBadgeEligibility(sitter, badge);
    
    if (isEligible) {
      // Award badge if not already earned
      const { data: existing } = await supabase
        .from('sitter_badges')
        .select('id')
        .eq('sitter_id', sitterId)
        .eq('badge_type', badge.badge_type);
      
      if (!existing || existing.length === 0) {
        await supabase.from('sitter_badges').insert({
          sitter_id: sitterId,
          badge_type: badge.badge_type,
          criteria_met: `avg_rating=${sitter.avg_rating}, reviews=${sitter.total_reviews}`
        });
        
        // Notify sitter
        await notifyBadgeEarned(sitterId, badge.badge_type);
      }
    }
  }
};

const checkBadgeEligibility = (sitter, badgeDefinition) => {
  if (badgeDefinition.min_rating && sitter.avg_rating < badgeDefinition.min_rating) return false;
  if (badgeDefinition.min_reviews && sitter.total_reviews < badgeDefinition.min_reviews) return false;
  if (badgeDefinition.min_completion_percent && sitter.completion_rate_percent < badgeDefinition.min_completion_percent) return false;
  return true;
};
```

#### 1.3.5 React Component Changes

**File: `src/ReviewModal.js` (refactored)**
- Lines ~1-50: Import category definitions
- Lines ~50-100: Add category rating state
- Lines ~100-150: Render category rating inputs
- Lines ~150-200: Calculate average category ratings
- Lines ~200-250: Update submit handler to include category ratings

**File: `src/ExploreScreen.js` (updated)**
- Lines ~100-150: Update sitter card to show badges
- Lines ~150-200: Add badge styling

**File: `src/SitterProfile.js` (updated)**
- Add badges section (~30 lines)
- Add category ratings bar (~30 lines)
- Update reviews to show categories (~20 lines)

#### 1.3.6 Tests to Add

**New File: `src/ReviewModal.test.js` (enhanced)**
```javascript
describe('Enhanced Review System', () => {
  test('Shows category rating inputs', () => {
    // Render ReviewModal
    // Verify 5 category inputs visible
  });

  test('Submits review with category ratings', async () => {
    // Select ratings for all categories
    // Submit
    // Verify database has all ratings
  });

  test('Calculates average category rating', async () => {
    // Create 2 reviews
    // Verify avg_safety_rating calculated correctly
  });

  test('Awards "Trusted" badge at 3.5+ rating', async () => {
    // Set sitter avg_rating = 3.5, total_reviews = 5
    // Call updateSitterBadges()
    // Verify badge earned
  });

  test('Awards "Super" badge at 4.5+ rating + 15 reviews', async () => {
    // Set sitter avg_rating = 4.5, total_reviews = 15
    // Call updateSitterBadges()
    // Verify badge earned
  });

  test('Awards "Top" badge at 4.8+ rating + 25 reviews', async () => {
    // Set sitter avg_rating = 4.8, total_reviews = 25
    // Call updateSitterBadges()
    // Verify badge earned
  });

  test('Displays badges on sitter profile', () => {
    // Create sitter with 2 badges
    // Render SitterProfile
    // Verify both badges displayed
  });

  test('Shows badges on explore cards', () => {
    // Create sitter with "Top" badge
    // Render ExploreScreen
    // Verify badge shown on card
  });
});
```

**New File: `src/badgeService.test.js`**
```javascript
describe('Badge Service', () => {
  test('checkBadgeEligibility() checks all criteria', () => {
    // Verify min_rating checked
    // Verify min_reviews checked
    // Verify min_completion_percent checked
  });

  test('updateSitterBadges() awards multiple badges', async () => {
    // Set sitter with >4.8 rating and 25+ reviews
    // Call updateSitterBadges()
    // Verify "top" badge and other eligible badges awarded
  });

  test('Does not re-award already earned badge', async () => {
    // Create sitter with "trusted" badge
    // Call updateSitterBadges() again
    // Verify only 1 "trusted" badge exists
  });
});
```

#### 1.3.7 Completion Checklist
- [ ] Migration `016_enhanced_reviews.sql` created & applied
- [ ] `ReviewModal.js` updated with category ratings
- [ ] `BadgePreview.js` component built
- [ ] `BadgeDisplay.js` component built
- [ ] `ExploreScreen.js` updated to show badges
- [ ] `SitterProfile.js` updated with badges & category ratings
- [ ] Badge calculation service implemented
- [ ] Badge notification service integrated
- [ ] Tests pass (12+ test cases)
- [ ] Staging deployed & tested
- [ ] Sitter badge notifications working

**Estimated Time:** 1.5 days (1 day dev + 0.5 day testing & deployment)

---

## 🟡 PHASE 2: HIGH-PRIORITY FEATURES (7-8 Days)

### Feature 2.1: Subscription/Loyalty Program

**Priority:** HIGH  
**Estimated Time:** 2 days  
**Deployment Risk:** Medium

#### 2.1.1 Business Requirements
- Monthly subscription tiers: Basic (₹99), Premium (₹199), VIP (₹499)
- Each tier includes discount % on bookings + monthly loyalty points
- Points redeemable for discounts or cash
- Automatic renewal with opt-out option
- Referral bonuses convert to points

#### 2.1.2 Database Schema Updates

**New Migration: `017_subscriptions_loyalty.sql`**

```sql
-- Subscription tiers
create table if not exists public.subscription_tiers (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  monthly_price int not null,
  discount_percent decimal(5, 2) not null,
  monthly_points_earned int not null,
  features text[] not null,  -- Array of features (e.g., ['15% discount', '100 points/month'])
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User subscriptions
create table if not exists public.user_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tier_id uuid not null references public.subscription_tiers(id),
  status text not null check (status in ('active', 'paused', 'cancelled')),
  start_date timestamp with time zone default timezone('utc'::text, now()) not null,
  end_date timestamp with time zone not null,
  auto_renew boolean default true,
  payment_method text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id)  -- One active subscription per user
);

-- Loyalty points
create table if not exists public.loyalty_points (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  points_balance int default 0,
  lifetime_earned int default 0,
  lifetime_redeemed int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id)
);

-- Points transactions (audit trail)
create table if not exists public.points_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null,
  transaction_type text not null check (transaction_type in ('earned', 'redeemed', 'expired')),
  source text,  -- e.g., 'monthly_subscription', 'booking_completion', 'referral_bonus'
  booking_id uuid references public.bookings(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index idx_user_subscriptions_user on public.user_subscriptions(user_id);
create index idx_user_subscriptions_status on public.user_subscriptions(status);
create index idx_loyalty_points_user on public.loyalty_points(user_id);
create index idx_points_transactions_user on public.points_transactions(user_id);

-- RLS
alter table public.user_subscriptions enable row level security;
alter table public.loyalty_points enable row level security;
alter table public.points_transactions enable row level security;

-- RLS Policies
create policy "Users view own subscription"
  on public.user_subscriptions for select
  using (user_id = auth.uid());

create policy "Users view own loyalty points"
  on public.loyalty_points for select
  using (user_id = auth.uid());

create policy "Users view own points transactions"
  on public.points_transactions for select
  using (user_id = auth.uid());

-- Insert default tiers
insert into public.subscription_tiers (name, monthly_price, discount_percent, monthly_points_earned, features) values
  ('Basic', 99, 10, 50, ARRAY['10% discount on all bookings', '50 loyalty points monthly', 'Monthly digest email']),
  ('Premium', 199, 20, 150, ARRAY['20% discount on all bookings', '150 loyalty points monthly', 'Priority support', 'Early access to new sitters']),
  ('VIP', 499, 30, 300, ARRAY['30% discount on all bookings', '300 loyalty points monthly', 'Dedicated support', 'Exclusive VIP sitters', 'Free emergency bookings']);
```

#### 2.1.3 Frontend Components

**New File: `src/SubscriptionTier.js`**
```javascript
// Show available subscription tiers with comparison table
const SubscriptionTier = ({ onSelectTier }) => {
  const [tiers, setTiers] = useState([]);

  useEffect(() => {
    loadSubscriptionTiers();
  }, []);

  const loadSubscriptionTiers = async () => {
    const { data } = await supabase.from('subscription_tiers').select('*');
    setTiers(data);
  };

  return (
    <div className="subscription-tiers">
      <h1>Choose Your Plan</h1>
      <div className="tiers-grid">
        {tiers.map(tier => (
          <div key={tier.id} className="tier-card">
            <h2>{tier.name}</h2>
            <p className="price">₹{tier.monthly_price}/month</p>
            <p className="discount">{tier.discount_percent}% discount on bookings</p>
            <p className="points">{tier.monthly_points_earned} points/month</p>
            <ul className="features">
              {tier.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
            <button onClick={() => onSelectTier(tier)}>
              Subscribe Now
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

**New File: `src/LoyaltyDashboard.js`**
```javascript
// Show points balance, redemption options, points history
const LoyaltyDashboard = () => {
  const [pointsBalance, setPointsBalance] = useState(0);
  const [subscription, setSubscription] = useState(null);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    loadLoyaltyData();
  }, []);

  const loadLoyaltyData = async () => {
    const userId = auth.user().id;
    
    // Load points
    const { data: points } = await supabase
      .from('loyalty_points')
      .select('*')
      .eq('user_id', userId)
      .single();
    setPointsBalance(points?.points_balance || 0);

    // Load subscription
    const { data: sub } = await supabase
      .from('user_subscriptions')
      .select('*, subscription_tiers(name, monthly_points_earned)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    setSubscription(sub);

    // Load transaction history
    const { data: trans } = await supabase
      .from('points_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    setTransactions(trans);
  };

  const handleRedeemPoints = async (pointsToRedeem) => {
    if (pointsToRedeem > pointsBalance) {
      alert('Insufficient points');
      return;
    }

    // Create redemption transaction
    await supabase.from('points_transactions').insert({
      user_id: auth.user().id,
      amount: pointsToRedeem,
      transaction_type: 'redeemed',
      source: 'manual_redemption'
    });

    // Deduct from balance
    await supabase
      .from('loyalty_points')
      .update({ points_balance: pointsBalance - pointsToRedeem })
      .eq('user_id', auth.user().id);

    // Add to wallet (1 point = ₹1 credit)
    const creditAmount = pointsToRedeem;
    // TODO: Add to user wallet

    loadLoyaltyData();
  };

  return (
    <div className="loyalty-dashboard">
      <div className="points-card">
        <h2>Your Points Balance</h2>
        <p className="balance">{pointsBalance} points</p>
        <p className="worth">≈ ₹{pointsBalance} credit</p>
      </div>

      {subscription && (
        <div className="subscription-card">
          <h3>{subscription.subscription_tiers.name} Plan</h3>
          <p>Earn {subscription.subscription_tiers.monthly_points_earned} points per month</p>
          <p>Expires: {new Date(subscription.end_date).toLocaleDateString()}</p>
          <button onClick={() => setShowRenewModal(true)}>
            Renew Subscription
          </button>
        </div>
      )}

      <div className="redemption-section">
        <h3>Redeem Points</h3>
        <input 
          type="number" 
          placeholder="Points to redeem"
          onChange={(e) => setRedeemAmount(parseInt(e.target.value))}
        />
        <button onClick={() => handleRedeemPoints(redeemAmount)}>
          Redeem
        </button>
      </div>

      <div className="transactions-section">
        <h3>Points History</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                <td>{tx.transaction_type}</td>
                <td className={tx.transaction_type === 'earned' ? 'positive' : 'negative'}>
                  {tx.transaction_type === 'earned' ? '+' : '-'}{tx.amount}
                </td>
                <td>{tx.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

**Update: `src/PaymentScreen.js`**
- Show discount applied if user has active subscription
- Deduct points before payment if user chooses
- Display points balance during checkout

#### 2.1.4 Tests to Add

**New File: `src/SubscriptionTier.test.js`**
```javascript
describe('Subscription Tiers', () => {
  test('Loads and displays all tiers', async () => {
    // Render SubscriptionTier
    // Verify 3 tiers displayed (Basic, Premium, VIP)
  });

  test('Shows correct price and features', () => {
    // Verify Basic = ₹99, 10% discount
    // Verify Premium = ₹199, 20% discount
    // Verify VIP = ₹499, 30% discount
  });

  test('Subscribe button triggers callback', () => {
    // Click subscribe on Premium
    // Verify callback fired with Premium tier data
  });
});
```

**New File: `src/LoyaltyDashboard.test.js`**
```javascript
describe('Loyalty Dashboard', () => {
  test('Displays points balance', async () => {
    // Create user with 500 points
    // Render LoyaltyDashboard
    // Verify balance shown
  });

  test('Shows active subscription', () => {
    // Create active Premium subscription
    // Verify subscription details displayed
  });

  test('Redeem points updates balance', async () => {
    // Create user with 500 points
    // Redeem 100 points
    // Verify balance = 400
  });

  test('Shows points transaction history', () => {
    // Create 5 transactions
    // Verify all shown in table
  });

  test('Prevents redeeming more than balance', () => {
    // Try to redeem 600 points with 500 balance
    // Verify error message
  });
});
```

#### 2.1.5 Completion Checklist
- [ ] Migration `017_subscriptions_loyalty.sql` created & applied
- [ ] `SubscriptionTier.js` component built
- [ ] `LoyaltyDashboard.js` component built
- [ ] Subscription selection flow integrated
- [ ] Points earning logic implemented (on booking completion)
- [ ] Points redemption logic implemented
- [ ] PaymentScreen integration for discount display
- [ ] Subscription renewal automation set up (Supabase cron job)
- [ ] Tests pass (8+ test cases)
- [ ] Staging deployed & tested

**Estimated Time:** 2 days

---

### Feature 2.2: Additional Services (Grooming, Training, Emergency)

**Priority:** HIGH  
**Estimated Time:** 1.5 days

#### 2.2.1 Database Schema Updates

**New Migration: `018_additional_services.sql`**

```sql
-- Extend services table
alter table if exists public.bookings 
  add column if not exists service_name text check (service_name in ('walk', 'daycare', 'boarding', 'grooming', 'training', 'emergency')),
  add column if not exists grooming_type text check (grooming_type in ('bath_only', 'full_grooming', 'nail_trim', 'ear_cleaning', 'dental_cleaning')),
  add column if not exists training_type text check (training_type in ('obedience', 'behavior_modification', 'socialization', 'agility')),
  add column if not exists emergency_service_type text check (emergency_service_type in ('urgent_vet_transport', 'lost_pet_search', 'injury_care', 'medication_administration'));

-- Service-specific pricing
create table if not exists public.service_pricing (
  id uuid default gen_random_uuid() primary key,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  service_name text not null check (service_name in ('walk', 'daycare', 'boarding', 'grooming', 'training', 'emergency')),
  base_price int not null,
  duration_minutes int,
  max_pets int,
  availability text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(sitter_id, service_name)
);

-- Sitter service offerings
create table if not exists public.sitter_services (
  id uuid default gen_random_uuid() primary key,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  service_name text not null,
  is_offered boolean default false,
  certification_or_experience text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(sitter_id, service_name)
);
```

#### 2.2.2 Frontend Changes

**Update: `src/BookingFlow.js`**
- Add step 1: Service selection (walk, daycare, boarding, grooming, training, emergency)
- Show sitters filtered by service offered
- Service-specific form fields (grooming_type for grooming, etc.)

**New File: `src/GroomingServiceFlow.js`**
- Select grooming type (bath only, full grooming, nail trim, etc.)
- Upload pet photos showing current condition
- Sitter can upload before/after photos

#### 2.2.3 Completion Checklist
- [ ] Migration `018_additional_services.sql` created
- [ ] `BookingFlow.js` updated with service selection
- [ ] Service-specific form components built
- [ ] Sitter service offerings updated in profile
- [ ] Tests pass
- [ ] Staging deployed

**Estimated Time:** 1.5 days

---

### Feature 2.3: Real-time Updates (Photo Auto-upload, Video Clips, Status Updates)

**Priority:** HIGH  
**Estimated Time:** 2 days

#### 2.3.1 Requirements
- Sitter can auto-upload photos during service
- Video clip support (up to 30 seconds)
- Real-time booking status updates
- Push notifications for updates

#### 2.3.2 Database & API Changes

**New Migration: `019_realtime_updates.sql`**

```sql
-- Booking status history
create table if not exists public.booking_status_history (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  previous_status text,
  new_status text not null,
  changed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  changed_by uuid references auth.users(id)
);

-- Walk media (photos & videos)
create table if not exists public.walk_media (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  media_type text not null check (media_type in ('photo', 'video')),
  storage_url text not null,
  file_size int,
  duration_seconds int,  -- For videos
  uploaded_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Booking status updates (real-time messages)
create table if not exists public.booking_updates (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  update_type text not null check (update_type in ('status_change', 'photo_uploaded', 'video_uploaded', 'location_update', 'note')),
  message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

#### 2.3.3 Frontend Components

**Update: `src/PhotoUploadModal.js`**
- Add video recording (max 30 seconds)
- Auto-upload as soon as captured
- Show upload progress

**New File: `src/RealtimeUpdates.js`**
- Subscribe to booking_updates via Supabase real-time
- Display status changes, photos, videos as they come in
- Show "Sitter is on the way", "Walk started", "Walk completed" etc.

#### 2.3.4 Completion Checklist
- [ ] Migration `019_realtime_updates.sql` created
- [ ] Photo auto-upload implemented
- [ ] Video recording & upload implemented
- [ ] Real-time status updates working
- [ ] Push notifications for updates
- [ ] Tests pass
- [ ] Staging deployed

**Estimated Time:** 2 days

---

### Feature 2.4: Enhanced Verification (Background Checks, ID Verification, Trust Scores)

**Priority:** HIGH  
**Estimated Time:** 1.5 days

#### 2.4.1 Requirements
- Mock background checks (display only, not real)
- ID verification (mock - shows verified badge)
- Trust score calculation based on multiple factors
- Verification status display on sitter profile

#### 2.4.2 Database Schema

**New Migration: `020_verification_trust.sql`**

```sql
-- Verification records
create table if not exists public.sitter_verification (
  id uuid default gen_random_uuid() primary key,
  sitter_id uuid not null references public.sitter_profiles(id) on delete cascade,
  id_verified boolean default false,
  id_verified_at timestamp with time zone,
  background_check_status text check (background_check_status in ('pending', 'passed', 'failed', 'expired')),
  background_check_date timestamp with time zone,
  email_verified boolean default false,
  phone_verified boolean default false,
  address_verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(sitter_id)
);

-- Trust score breakdown
alter table if exists public.sitter_profiles
  add column if not exists trust_score int default 0,
  add column if not exists verification_status text check (verification_status in ('not_started', 'in_progress', 'verified', 'failed'));
```

#### 2.4.3 Frontend Components

**New File: `src/VerificationBadge.js`**
- Show verification status: Not Verified, Verified, Trusted
- Color-coded: Red (not verified), Yellow (pending), Green (verified)
- Hover to show details

**Update: `src/SitterEditProfile.js`**
- Add button to start verification
- Show verification checklist
- Mock verification with success/failure (for demo)

**Update: `src/SitterProfile.js`**
- Display trust score prominently
- Show verification badges
- Explain how trust score calculated

#### 2.4.4 Trust Score Calculation

```javascript
// Factors:
// - Email verified: +10 points
// - Phone verified: +10 points
// - ID verified: +20 points
// - Background check passed: +30 points
// - No complaints: +10 points
// - 10+ bookings: +10 points
// - 4+ rating: +10 points
// Max = 100 points

const calculateTrustScore = (sitter) => {
  let score = 0;
  
  if (sitter.email_verified) score += 10;
  if (sitter.phone_verified) score += 10;
  if (sitter.id_verified) score += 20;
  if (sitter.background_check_status === 'passed') score += 30;
  if (sitter.complaint_count === 0) score += 10;
  if (sitter.total_bookings >= 10) score += 10;
  if (sitter.avg_rating >= 4.0) score += 10;
  
  return Math.min(score, 100);
};
```

#### 2.4.5 Completion Checklist
- [ ] Migration `020_verification_trust.sql` created
- [ ] `VerificationBadge.js` component built
- [ ] Mock verification flow implemented
- [ ] Trust score calculation implemented
- [ ] Tests pass
- [ ] Staging deployed

**Estimated Time:** 1.5 days

---

## 📋 COMPLETE IMPLEMENTATION CHECKLIST

### Phase 1: Critical (5-6 days)

#### Feature 1.1: GPS Tracking
- [ ] Migration created & applied
- [ ] Frontend components built
- [ ] Real-time tracking working
- [ ] Privacy verified (RLS correct)
- [ ] 8+ tests passing
- [ ] Deployed

#### Feature 1.2: Multi-Payment
- [ ] Migrations created & applied
- [ ] PaymentScreen refactored
- [ ] All payment methods integrated
- [ ] Security audit passed
- [ ] 10+ tests passing
- [ ] Deployed

#### Feature 1.3: Enhanced Reviews
- [ ] Migration created & applied
- [ ] Category ratings working
- [ ] Badge system working
- [ ] 12+ tests passing
- [ ] Deployed

**Phase 1 Total:** 5-6 days

### Phase 2: High Priority (7-8 days)

#### Feature 2.1: Subscriptions & Loyalty
- [ ] Migrations created & applied
- [ ] Subscription flow working
- [ ] Points earning & redemption working
- [ ] 8+ tests passing
- [ ] Deployed

#### Feature 2.2: Additional Services
- [ ] Migration created & applied
- [ ] Service selection working
- [ ] Service-specific flows built
- [ ] Tests passing
- [ ] Deployed

#### Feature 2.3: Real-time Updates
- [ ] Migrations created & applied
- [ ] Photo auto-upload working
- [ ] Video recording working
- [ ] Real-time updates working
- [ ] Deployed

#### Feature 2.4: Enhanced Verification
- [ ] Migrations created & applied
- [ ] Verification flow built
- [ ] Trust score working
- [ ] Tests passing
- [ ] Deployed

**Phase 2 Total:** 7-8 days

---

## 🚀 DEPLOYMENT TIMELINE

### Pre-Deployment Checklist
- [ ] All migrations applied to Supabase
- [ ] All tests passing (100+ total tests)
- [ ] Environment variables set in Vercel
- [ ] RLS policies verified for security
- [ ] Performance benchmarks met
- [ ] Accessibility audit passed
- [ ] Privacy policy updated
- [ ] User documentation written

### Deployment Steps
1. **Feature Branch Testing** (Vercel preview deployment)
2. **Staging Deployment** (Test with real data)
3. **Production Deployment** (via `vercel --prod`)
4. **Post-Deployment Monitoring** (Check logs, error rates)
5. **User Communications** (Email/in-app notifications about new features)

### Post-Deployment Tasks
- [ ] Monitor error logs for 24 hours
- [ ] Gather user feedback
- [ ] Fix any critical bugs
- [ ] Document any learnings in CLAUDE.md
- [ ] Plan Phase 3 features

---

## 📊 EFFORT ESTIMATES

| Feature | Dev | Testing | Deploy | Total |
|---------|-----|---------|--------|-------|
| GPS Tracking | 1.5 | 0.5 | 0.2 | 2 days |
| Multi-Payment | 1.5 | 0.5 | 0.2 | 2 days |
| Enhanced Reviews | 1 | 0.5 | 0.1 | 1.5 days |
| Subscriptions | 1.5 | 0.5 | 0.2 | 2 days |
| Additional Services | 1 | 0.3 | 0.1 | 1.5 days |
| Real-time Updates | 1.5 | 0.5 | 0.2 | 2 days |
| Verification | 1 | 0.3 | 0.1 | 1.5 days |
| **TOTAL** | **9** | **3** | **1** | **13 days** |

---

## 🎯 SUCCESS CRITERIA

✅ **All features must meet:**
1. 100% test coverage (unit + integration tests)
2. RLS security policies verified
3. Performance: Page load < 2 seconds
4. Accessibility: WCAG AA compliant
5. Mobile responsive design
6. No console errors in production
7. Documented code with inline comments where needed
8. Updated CLAUDE.md with status & next steps

---

## 📞 SUPPORT & TROUBLESHOOTING

### Common Issues

**Issue: RLS Policy blocks user query**
- Solution: Check auth.uid() context in policy
- Verify user role in Supabase JWT

**Issue: Real-time subscription not updating**
- Solution: Check Supabase real-time enabled on table
- Verify RLS policy allows select

**Issue: Payment gateway timeout**
- Solution: Increase timeout to 30 seconds
- Add retry logic with exponential backoff

**Issue: GPS tracking drains battery**
- Solution: Reduce update frequency to 30 seconds
- Stop tracking immediately after service ends

---

## 📚 REFERENCES

- Supabase Documentation: https://supabase.com/docs
- React Router: https://reactrouter.com
- Payment Gateway APIs:
  - Razorpay: https://razorpay.com/developers
  - Apple Pay: https://developer.apple.com/apple-pay
  - Google Pay: https://developers.google.com/pay
- WCAG Accessibility: https://www.w3.org/WAI/WCAG21/quickref

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-02  
**Next Review:** After Phase 1 completion  
**Status:** Ready for implementation

