# 🔌 NOTIFICATION INTEGRATION IMPLEMENTATION PLAN

**Date:** 2026-10-25  
**Status:** Starting integration work  
**Priority:** Complete wire-ups before E2E testing

---

## 📋 INTEGRATION CHECKLIST

### Phase 1: Critical Path (Tier 1 Notifications)

#### 1. PaymentScreen.js - Booking Confirmation
**File:** `src/PaymentScreen.js`  
**Trigger:** When booking payment succeeds  
**Action:** Call `notifyBookingConfirmed(data)`

```javascript
// After successful payment
import { notifyBookingConfirmed } from './notificationService';

// In payment success handler:
await notifyBookingConfirmed({
  sitterId: booking.sitter_id,
  sitterEmail: sitter.email,
  sitterPhone: sitter.phone,
  petParentId: booking.pet_parent_id,
  petParentEmail: user.email,
  petParentPhone: user.phone,
  petName: pet.name,
  sitterName: sitter.name,
  serviceType: booking.service_type,
  dateTime: booking.booking_date_time,
  amount: booking.amount,
  bookingRef: booking.booking_ref,
});
```

**Tests to run after:**
- NOTIF-001: Booking Confirmation
- BOOK-011: Confirmation Email

---

#### 2. ReviewModal.js - Review Received Notification
**File:** `src/ReviewModal.js`  
**Trigger:** When pet parent submits review  
**Action:** Call `notifyReviewReceived(data)`

```javascript
// After review submission
import { notifyReviewReceived } from './notificationService';

await notifyReviewReceived(
  sitter.id,
  sitter.email,
  sitter.phone,
  rating,
  petParentName,
  petName,
  reviewText
);
```

**Tests to run after:**
- NOTIF-002: Review Received
- DASH-003: Leave Review

---

#### 3. CancellationPolicyModal.js - Cancellation Notice
**File:** `src/CancellationPolicyModal.js`  
**Trigger:** When booking is cancelled  
**Action:** Call `notifyBookingCancelled(data)`

```javascript
// After cancellation confirmed
import { notifyBookingCancelled } from './notificationService';

await notifyBookingCancelled({
  userId: userId,
  userEmail: user.email,
  userPhone: user.phone,
  otherUserName: otherUserName,
  reason: cancellationReason,
  refundAmount: calculateRefund(hoursUntilBooking),
  refundStatus: 'Processing',
  bookingRef: booking.booking_ref,
});
```

**Tests to run after:**
- BOOK-006: Cancel Booking <24hrs
- BOOK-007: Cancel Booking 24-72hrs
- BOOK-008: Cancel Booking 72hrs+

---

#### 4. PhotoUploadModal.js - Walk Proof Notification
**File:** `src/PhotoUploadModal.js`  
**Trigger:** When sitter uploads walk photos  
**Action:** Call `notifyWalkProofReceived(data)`

```javascript
// After photo upload success
import { notifyWalkProofReceived } from './notificationService';

await notifyWalkProofReceived(
  petParentId,
  petParentEmail,
  petParentPhone,
  sitterName
);
```

**Tests to run after:**
- NOTIF-004: Walk Proof Received
- DASH-005: View Walk Photos
- SITTER-007: Upload Walk Photos

---

#### 5. AdminPanel.js - Payout Notification
**File:** `src/AdminPanel.js`  
**Trigger:** When admin marks payout as paid  
**Action:** Call `notifyPayoutMarked(data)`

```javascript
// After payout marked paid
import { notifyPayoutMarked } from './notificationService';

await notifyPayoutMarked(
  sitterId,
  sitterEmail,
  sitterPhone,
  payoutAmount,
  bookingCount,
  payoutDate
);
```

**Tests to run after:**
- ADMIN-010: Mark Payout Paid
- SITTER-009: View Earnings

---

### Phase 2: Additional Tier 2 Notifications

#### 6. SitterDashboard.js - Walk Started/Completed
**File:** `src/SitterDashboard.js`  
**Trigger 1:** Walk starts → `notifyWalkStarted()`  
**Trigger 2:** Walk completes → `notifyWalkCompleted()`

#### 7. AdminPanel.js - Sitter Approval/Rejection
**File:** `src/AdminPanel.js`  
**Trigger 1:** Approve → `notifySitterApproved()`  
**Trigger 2:** Reject → `notifySitterRejected()`  
**Trigger 3:** Suspend → `notifySitterSuspended()`  
**Trigger 4:** Award Top Badge → `notifyTopSitterAwarded()`

#### 8. AdminPanel.js - Dispute Resolution
**File:** `src/AdminPanel.js`  
**Trigger 1:** Dispute filed → `notifyDisputeFiled()`  
**Trigger 2:** Dispute resolved → `notifyDisputeResolved()`

---

## 🎯 IMPLEMENTATION STRATEGY

### Step 1: Environment Setup
```bash
# Verify .env.local has these (for local testing):
REACT_APP_SENDGRID_KEY=SG.xxxxx
REACT_APP_MSG91_AUTH_KEY=xxxxx
```

### Step 2: Wire Each Component
For each file in the checklist:
1. Import notification service
2. Add function call at trigger point
3. Test with local dev server
4. Commit individually

### Step 3: Local Testing
```bash
npm start
# Open DevTools console to see notifications being triggered
# Check local database to verify notifications saved
```

### Step 4: Staging Deployment
```bash
vercel --prod
# Set env vars in Vercel dashboard
# Test end-to-end in staging
```

---

## 📊 INTEGRATION TIMELINE

| Phase | Tasks | Estimated Time | Status |
|-------|-------|-----------------|--------|
| Phase 1 | Wire 5 critical paths | 2-3 hours | 🟡 TODO |
| Phase 2 | Wire 8 additional triggers | 2-3 hours | 🟡 TODO |
| Testing | Run E2E test suite | 2-3 hours | 🟡 TODO |
| Staging | Deploy & verify | 1 hour | 🟡 TODO |
| Production | Final deployment | 30 min | 🟡 TODO |

**Total:** 8-11 hours (can run in parallel test sections)

---

## ✅ VERIFICATION CHECKLIST

After each wire-up, verify:
- [ ] Notification function called
- [ ] Data passed correctly to function
- [ ] No console errors
- [ ] Notification appears in database
- [ ] Related tests pass

---

## 🚀 READY FOR IMPLEMENTATION

All notification functions are ready in `notificationService.js`.  
All email/SMS functions are ready in `emailService.js` and `smsService.js`.  
Tests are passing.

**Next Action:** Start with Phase 1, wire each component one by one.

