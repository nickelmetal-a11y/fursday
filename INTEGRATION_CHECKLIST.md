# Integration Checklist - Wire-up Remaining Features

**Date:** 2026-09-01  
**Status:** 70% Complete  
**Remaining:** Core notification triggers + Auto-refund logic

---

## ✅ COMPLETED THIS SESSION

### Database Migrations
- [x] 010_referral_system.sql - Referral codes & bonuses
- [x] 011_sitter_availability.sql - Availability calendar
- [x] 012_promo_codes.sql - Promotional discounts

### Services & Components
- [x] emailService.js - SendGrid integration (booking, review, payout, cancellation emails)
- [x] smsService.js - MSG91 integration (booking reminder, payout, photos notifications)
- [x] notificationService.js - Rewritten with email/SMS hooks
- [x] SitterEarningsDashboard.js - Earnings view with monthly breakdown
- [x] SitterDashboard.js - Updated to show earnings tab

### Environment
- [x] .env.template - All required env variables documented

---

## 🟡 INTEGRATION TASKS (HIGH PRIORITY)

### TASK 1: Wire Notification Trigger in PaymentScreen.js
**File:** `src/PaymentScreen.js`  
**Action:** Line 54 (after `onSuccess` callback)

```javascript
// BEFORE (current):
if (onSuccess) onSuccess(response.razorpay_payment_id);

// AFTER (add this):
if (onSuccess) onSuccess(response.razorpay_payment_id);

// Add this new code:
try {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, sitter_profiles(users(name, email, phone)), users(name, email, phone)')
    .eq('booking_ref', bookingRef)
    .single();
  
  if (booking && user) {
    const { notifyBookingConfirmed } = await import('./notificationService');
    await notifyBookingConfirmed({
      sitterId: booking.sitter_id,
      sitterEmail: booking.sitter_profiles?.users?.email,
      sitterPhone: booking.sitter_profiles?.users?.phone,
      petParentId: user.id,
      petParentEmail: user.email,
      petParentPhone: user.phone,
      petName: booking.pet_name,
      sitterName: booking.sitter_profiles?.users?.name,
      serviceType: booking.service_type,
      dateTime: booking.scheduled_date + ' ' + booking.scheduled_time,
      amount: booking.gross_amount_paise,
      bookingRef: booking.booking_ref,
    });
  }
} catch (err) {
  console.error('Notification send failed:', err);
}
```

**Est. Time:** 15 minutes

---

### TASK 2: Wire Notification Trigger in ReviewModal.js
**File:** `src/ReviewModal.js`  
**Action:** After review is submitted to database

Find the code that does `supabase.from('reviews').insert(...)` and add after it:

```javascript
// After review created successfully:
try {
  const { notifyReviewReceived } = await import('./notificationService');
  await notifyReviewReceived(
    booking.sitter_id,           // sitterId
    sitterEmail,                 // sitter email from booking
    rating,                      // the star rating
    petParentName,              // who left the review
    booking.pet_name,           // pet name
    reviewText                  // review content
  );
} catch (err) {
  console.error('Review notification failed:', err);
}
```

**Est. Time:** 15 minutes

---

### TASK 3: Wire Notification Trigger in CancellationPolicyModal.js
**File:** `src/CancellationPolicyModal.js`  
**Action:** After booking cancellation is confirmed

Find where booking status is set to 'cancelled' and add:

```javascript
// After cancellation confirmed:
try {
  const { notifyBookingCancelled } = await import('./notificationService');
  const refundPercent = calculateRefundPercentage(booking.scheduled_date);
  const refundAmount = (booking.gross_amount_paise / 100) * refundPercent;
  
  // Notify pet parent
  await notifyBookingCancelled({
    userId: booking.pet_parent_id,
    userEmail: petParentEmail,
    userPhone: petParentPhone,
    otherUserName: sitterName,
    reason: cancellationReason,
    refundAmount: refundAmount.toFixed(2),
    refundStatus: 'Processing',
    bookingRef: booking.booking_ref,
  });
  
  // Also notify sitter
  await notifyBookingCancelled({
    userId: booking.sitter_id,
    userEmail: sitterEmail,
    userPhone: sitterPhone,
    otherUserName: petParentName,
    reason: cancellationReason,
    refundAmount: 0,
    refundStatus: 'Cancelled',
    bookingRef: booking.booking_ref,
  });
} catch (err) {
  console.error('Cancellation notification failed:', err);
}
```

**Est. Time:** 20 minutes

---

### TASK 4: Wire Notification Trigger in PhotoUploadModal.js
**File:** `src/PhotoUploadModal.js`  
**Action:** After photos are successfully uploaded

Find where photos are saved and add:

```javascript
// After photos uploaded successfully:
try {
  const { notifyWalkProofReceived } = await import('./notificationService');
  const { data: petParent } = await supabase
    .from('users')
    .select('email, phone')
    .eq('id', booking.pet_parent_id)
    .single();
  
  await notifyWalkProofReceived(
    booking.pet_parent_id,      // pet parent id
    petParent?.email,           // pet parent email
    petParent?.phone,           // pet parent phone
    sitterName                  // sitter name
  );
} catch (err) {
  console.error('Photo notification failed:', err);
}
```

**Est. Time:** 15 minutes

---

### TASK 5: Wire Notification Trigger in AdminPanel.js (Payout Marking)
**File:** `src/AdminPanel.js` or wherever payout is marked as paid

Find the code that marks payout as paid and add:

```javascript
// After marking payout paid:
try {
  const { notifyPayoutMarked } = await import('./notificationService');
  const { data: sitterUser } = await supabase
    .from('users')
    .select('email, phone')
    .eq('id', sitter.user_id)
    .single();
  
  await notifyPayoutMarked(
    sitter.id,                  // sitter id
    sitterUser?.email,          // sitter email
    sitterUser?.phone,          // sitter phone
    payoutAmount,               // amount in paise
    bookingCount,               // number of bookings in payout
    new Date().toLocaleDateString('en-IN')  // payout date
  );
} catch (err) {
  console.error('Payout notification failed:', err);
}
```

**Est. Time:** 15 minutes

---

### TASK 6: Environment Variables Setup
**File:** Create/Update `.env.local` in fursday root

Required environment variables to add:

```
REACT_APP_SENDGRID_KEY=SG.xxxxx  # Get from SendGrid dashboard
REACT_APP_MSG91_AUTH_KEY=xxxxx   # Get from MSG91 dashboard
REACT_APP_ADMIN_PASSWORD=your-password  # Already set?
```

**Note:** These will be automatically available in Vercel via project settings.

**Est. Time:** 10 minutes

---

## 🔴 CRITICAL MISSING: Auto-Refund Logic

**File:** `src/CancellationPolicyModal.js` or new `refundService.js`

**What needs to happen:**

```javascript
// Calculate refund based on timing
function calculateRefundPercentage(scheduledDate) {
  const now = new Date();
  const booking = new Date(scheduledDate);
  const hoursUntil = (booking - now) / (1000 * 60 * 60);
  
  if (hoursUntil < 24) return 0;      // < 24h: 0% refund
  if (hoursUntil < 72) return 75;     // 24-72h: 75% refund
  return 100;                         // 72h+: 100% refund
}

// Process refund
async function processRefund(booking, refundPercentage) {
  const refundAmountPaise = Math.floor(booking.gross_amount_paise * (refundPercentage / 100));
  
  // Update booking with refund info
  await supabase.from('bookings').update({
    refund_amount_paise: refundAmountPaise,
    refund_status: 'pending',  // pending → processing → completed
  }).eq('id', booking.id);
  
  // Reduce sitter payout by refund amount (they get back the 85%)
  const sitterRefund = Math.floor(refundAmountPaise * 0.85);
  // UPDATE payout_owed for this sitter
  
  // Create audit log
  // TODO: Log refund in audit logs with reason, amount, status
}
```

**Est. Time:** 1-2 hours

---

## 📊 DEPLOYMENT CHECKLIST

Before deploying to production:

- [ ] All 5 notification wire-ups completed
- [ ] .env.local configured with SendGrid & MSG91 keys
- [ ] Auto-refund logic implemented and tested
- [ ] Database migrations applied to Supabase
- [ ] Test flow: Book → Pay → Receive notifications
- [ ] Test sitter: View earnings → See monthly breakdown
- [ ] Test admin: Mark payout paid → Sitter gets notification
- [ ] No console errors in browser dev tools
- [ ] Email templates rendering correctly
- [ ] SMS messages sending successfully

---

## 📱 NEXT FEATURES (After this)

1. **Advanced Sitter Filters** (1 day)
   - Filter by rating, experience level, response time
   - Update ExploreScreen.js with filter UI

2. **Referral Program UI** (2 days)
   - Generate unique code for each user
   - Share button (copy to clipboard, WhatsApp, etc.)
   - Sitter earnings dashboard shows referral bonuses

3. **Sitter Availability Calendar** (2 days)
   - SitterEditProfile.js - Calendar UI to set available dates
   - ExploreScreen.js - Show availability badges

4. **Admin Analytics Dashboard** (2 days)
   - New tab in AdminPanel
   - Charts: daily bookings, monthly revenue, user growth

5. **Promo Code Management** (1 day)
   - PaymentScreen.js - Add promo code input
   - Admin UI - Create/edit promo codes

---

## 📞 QUICK REFERENCE

**Email Service Setup:**
- SendGrid: https://sendgrid.com (free tier: 100 emails/day)
- Create API key, add to .env as REACT_APP_SENDGRID_KEY

**SMS Service Setup:**
- MSG91: https://www.msg91.com (paid service)
- Create API key, add to .env as REACT_APP_MSG91_AUTH_KEY

**Testing Without Services:**
- Both emailService.js and smsService.js log to console in dev mode
- Check browser console to verify notifications would send
- No errors if keys are missing (graceful degradation)

---

**Total Est. Time Remaining:** 3-4 hours (wire-ups + auto-refund)  
**Difficulty:** Medium (mostly copy-paste integration)  
**Risk:** Low (each change is isolated, notifications don't break core flow)

Ready to wire these up? I can do them in sequence or all at once. 🚀
