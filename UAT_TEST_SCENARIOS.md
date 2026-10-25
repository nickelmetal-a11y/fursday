# 🧪 UAT TEST SCENARIOS - USER ACCEPTANCE TESTING

**Date:** 2026-10-25  
**Status:** Ready to Execute  
**Total Scenarios:** 15 Critical User Workflows  
**Focus:** Real user journeys, not technical details

---

## 📋 UAT SCENARIO INDEX

| # | Scenario | User | Duration | Priority |
|---|----------|------|----------|----------|
| 1 | Complete Booking → Payment → Confirmation | Pet Parent | 10 min | 🔴 CRITICAL |
| 2 | Sitter Accepts Job & Completes Walk | Sitter | 15 min | 🔴 CRITICAL |
| 3 | Pet Parent Leaves Review | Pet Parent | 5 min | 🔴 CRITICAL |
| 4 | Sitter Uploads Walk Photos | Sitter | 5 min | 🔴 CRITICAL |
| 5 | Pet Parent Views Walk Proof | Pet Parent | 5 min | 🟠 HIGH |
| 6 | Pet Parent Cancels Booking (72h+) | Pet Parent | 5 min | 🟠 HIGH |
| 7 | Pet Parent Cancels Booking (24-72h) | Pet Parent | 5 min | 🟠 HIGH |
| 8 | Pet Parent Cancels Booking (<24h) | Pet Parent | 5 min | 🟠 HIGH |
| 9 | Admin Approves New Sitter | Admin | 3 min | 🟠 HIGH |
| 10 | Admin Awards Top Sitter Badge | Admin | 3 min | 🟠 HIGH |
| 11 | Admin Marks Payout as Paid | Admin | 3 min | 🟠 HIGH |
| 12 | Sitter Views Earnings Dashboard | Sitter | 5 min | 🟡 MEDIUM |
| 13 | Repeat Booking Flow | Pet Parent | 8 min | 🟡 MEDIUM |
| 14 | Notification Delivery - All Channels | System | 5 min | 🔴 CRITICAL |
| 15 | Error Handling - API Failure | System | 5 min | 🟠 HIGH |

**Total Duration:** ~90 minutes (1.5 hours)

---

## 🔴 SCENARIO 1: COMPLETE BOOKING → PAYMENT → CONFIRMATION

**User:** Pet Parent  
**Duration:** 10 minutes  
**Priority:** CRITICAL  
**Expected Notifications:** 2 (in-app + email for both parties)

### Setup
```
Prerequisite: Pet parent logged in, pet profile created
Starting State: Home screen
```

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Click "Book Now" button | BookingFlow screen opens | ⏳ PENDING |
| 2 | Select service "Walk 30 min" | Service selected, price shown (₹349) | ⏳ PENDING |
| 3 | Select date "7 days from now" | Calendar opens, date selectable | ⏳ PENDING |
| 4 | Select time "10:00 AM" | Time picker shows, selection saved | ⏳ PENDING |
| 5 | Select pet "Buddy" | Pet dropdown shows saved pets | ⏳ PENDING |
| 6 | Check "Dog not aggressive" checkbox | Checkbox required to proceed | ⏳ PENDING |
| 7 | Click "Confirm Booking" | Review screen shows all details | ⏳ PENDING |
| 8 | Click "Proceed to Payment" | Razorpay payment modal opens | ⏳ PENDING |
| 9 | Complete payment simulation | Payment success confirmed | ⏳ PENDING |
| 10 | Verify booking confirmation | Screen shows "Booking Confirmed" + receipt | ⏳ PENDING |

### Verification Checklist

**Database:**
- [ ] Booking created in `bookings` table
- [ ] `payment_status` = "paid"
- [ ] `status` = "confirmed"
- [ ] `booking_ref` generated

**Notifications (In-App):**
- [ ] Sitter receives notification
- [ ] Pet parent receives notification
- [ ] Notification visible in NotificationCenter

**Email:**
- [ ] Sitter email received (from SendGrid)
- [ ] Pet parent email received (from SendGrid)
- [ ] Email contains booking details

**SMS (if phone available):**
- [ ] Sitter SMS received (from MSG91)
- [ ] Pet parent SMS received (from MSG91)

**Console Logs:**
- [ ] `notifyBookingConfirmed()` called
- [ ] No errors in DevTools console
- [ ] All data logged correctly

### Pass/Fail Criteria
✅ **PASS IF:**
- Booking created successfully
- Payment confirmed
- Both parties receive notification
- No errors in console

❌ **FAIL IF:**
- Booking not created
- Payment failed
- Notification not sent
- Errors in console

---

## 🔴 SCENARIO 2: SITTER ACCEPTS JOB & COMPLETES WALK

**User:** Sitter  
**Duration:** 15 minutes  
**Priority:** CRITICAL  
**Expected Notifications:** 3 (walk started, walk completed, booking confirmed)

### Setup
```
Prerequisite: Sitter logged in, booking from Scenario 1 available
Starting State: Sitter Dashboard
```

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Open SitterDashboard | Active jobs listed | ⏳ PENDING |
| 2 | See booking notification | "New booking!" visible | ⏳ PENDING |
| 3 | Click "Accept Booking" | Modal shows confirmation | ⏳ PENDING |
| 4 | Confirm acceptance | Status changes to "accepted" | ⏳ PENDING |
| 5 | Click "Start Walk" button | Walk starts, timer begins | ⏳ PENDING |
| 6 | Simulate walk activity | Time passes (or skip to end) | ⏳ PENDING |
| 7 | Click "Complete Walk" | End screen shows with OTP field | ⏳ PENDING |
| 8 | Confirm completion | Status changes to "completed" | ⏳ PENDING |
| 9 | Verify earnings update | Earnings show pending payout | ⏳ PENDING |
| 10 | Check for notifications | Walk completion notification sent | ⏳ PENDING |

### Verification Checklist

**Database:**
- [ ] Booking `status` = "completed"
- [ ] `sitter_earnings` record created
- [ ] Amount = 85% of booking price
- [ ] `payout_status` = "pending"

**Notifications:**
- [ ] Sitter gets "Walk Completed" notification
- [ ] Pet Parent gets "Walk Completed" notification
- [ ] Notifications appear in-app
- [ ] Email notifications sent

**Console Logs:**
- [ ] No errors
- [ ] Walk lifecycle logged
- [ ] Earnings calculated correctly

### Pass/Fail Criteria
✅ **PASS IF:**
- Walk completed successfully
- Earnings recorded (85% of price)
- Notifications sent to both parties
- No errors

❌ **FAIL IF:**
- Walk status not updated
- Earnings not calculated
- Notifications not sent
- Errors in console

---

## 🔴 SCENARIO 3: PET PARENT LEAVES REVIEW

**User:** Pet Parent  
**Duration:** 5 minutes  
**Priority:** CRITICAL  
**Expected Notifications:** 1 (sitter receives review notification)

### Setup
```
Prerequisite: Booking completed (from Scenario 2)
Starting State: BookingsDashboard, viewing completed booking
```

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | View completed booking | Options visible including "Leave Review" | ⏳ PENDING |
| 2 | Click "Leave Review" | ReviewModal opens with 5-star rating | ⏳ PENDING |
| 3 | Select 5-star rating | Stars highlight in gold | ⏳ PENDING |
| 4 | Type review text | "Great experience!" entered (>10 chars) | ⏳ PENDING |
| 5 | Click "Submit Review" | Modal closes, review saved | ⏳ PENDING |
| 6 | Verify review visible | Sitter's profile shows new review | ⏳ PENDING |
| 7 | Check rating updated | Sitter's avg rating updated | ⏳ PENDING |
| 8 | Verify notification | Sitter receives "New Review" notification | ⏳ PENDING |

### Verification Checklist

**Database:**
- [ ] Review created in `reviews` table
- [ ] Rating = 5 stars
- [ ] Review text saved
- [ ] Sitter's `avg_rating` updated
- [ ] Sitter's `review_count` incremented

**Notifications:**
- [ ] Sitter receives in-app notification
- [ ] Email sent to sitter (from SendGrid)
- [ ] SMS sent to sitter (from MSG91)

**Sitter Profile:**
- [ ] Rating displays as 5.0 stars (or updated avg)
- [ ] Review text visible on profile
- [ ] Review count increased

### Pass/Fail Criteria
✅ **PASS IF:**
- Review submitted successfully
- Rating updated on sitter profile
- Sitter receives notification
- No errors

❌ **FAIL IF:**
- Review not saved
- Rating not updated
- Notification not sent
- Errors in console

---

## 🔴 SCENARIO 4: SITTER UPLOADS WALK PHOTOS

**User:** Sitter  
**Duration:** 5 minutes  
**Priority:** CRITICAL  
**Expected Notifications:** 1 (pet parent receives photo notification)

### Setup
```
Prerequisite: Walk completed (from Scenario 2)
Starting State: SitterDashboard, viewing completed walk
```

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | View completed booking | Upload photos option visible | ⏳ PENDING |
| 2 | Click "Upload Photos" | PhotoUploadModal opens | ⏳ PENDING |
| 3 | Select 3 photos from device | File picker opens | ⏳ PENDING |
| 4 | Confirm photo selection | Preview shows 3 images | ⏳ PENDING |
| 5 | Click "Upload" | Photos uploading... | ⏳ PENDING |
| 6 | Wait for completion | "Upload Successful" message | ⏳ PENDING |
| 7 | Verify modal closes | Returns to walk details | ⏳ PENDING |
| 8 | Check pet parent notification | "Walk photos uploaded" notification sent | ⏳ PENDING |

### Verification Checklist

**Database:**
- [ ] Photos stored in `sitter_profile_photos` table
- [ ] `booking_id` linked to photos
- [ ] 3 photos saved (max limit)
- [ ] Photos compressed & optimized

**Parent Notification:**
- [ ] In-app notification sent
- [ ] Email sent (optional enhancement)
- [ ] SMS sent (optional enhancement)

**File Storage:**
- [ ] Photos uploaded to Supabase Storage
- [ ] File names unique
- [ ] Compression applied
- [ ] Size < 2MB each

### Pass/Fail Criteria
✅ **PASS IF:**
- Photos uploaded successfully
- Pet parent receives notification
- Photos visible in carousel
- No errors

❌ **FAIL IF:**
- Upload failed
- Notification not sent
- Photos not visible
- File size violations
- Errors in console

---

## 🟠 SCENARIO 5-8: CANCELLATION FLOWS (4 Scenarios)

**User:** Pet Parent  
**Duration:** 5 min each  
**Priority:** HIGH  
**Focus:** Refund calculation accuracy

### SCENARIO 5A: Cancel 72+ Hours Before
**Expected:** 100% refund

```
Steps:
1. Create booking for 7 days from now (₹349)
2. Wait 24 hours (or simulate)
3. Click "Cancel Booking"
4. Verify refund = ₹349 (100%)
5. Verify notification sent to sitter
6. Verify in wallet/payment system
```

### SCENARIO 5B: Cancel 24-72 Hours Before
**Expected:** 75% refund (₹262)

```
Steps:
1. Create booking for 3 days from now (₹349)
2. Wait to 48-hour mark
3. Click "Cancel Booking"
4. Verify refund = ₹262 (75%)
5. Verify notification sent to sitter
6. Verify in wallet/payment system
```

### SCENARIO 5C: Cancel <24 Hours Before
**Expected:** 0% refund (non-refundable)

```
Steps:
1. Create booking for tomorrow (₹349)
2. Wait until <24 hours remain
3. Click "Cancel Booking"
4. Verify refund = ₹0 (0%)
5. Verify notification sent to sitter
6. Verify non-refundable status shown
```

### Verification for All Cancellations

**Database:**
- [ ] Booking `status` = "cancelled"
- [ ] Cancellation reason stored
- [ ] Refund amount calculated correctly
- [ ] `payment_refund_status` updated

**Notifications:**
- [ ] Pet parent receives cancellation notice
- [ ] Sitter receives cancellation notice
- [ ] Refund amount shown in notification

**Payment System:**
- [ ] Refund processed to payment method
- [ ] Amount matches calculation

---

## 🟠 SCENARIO 9: ADMIN APPROVES NEW SITTER

**User:** Admin  
**Duration:** 3 minutes  
**Priority:** HIGH

### Setup
```
Prerequisite: New sitter application pending approval
Starting State: AdminPanel > Pending Sitters tab
```

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to Admin Panel | Pending sitters listed | ⏳ PENDING |
| 2 | Click pending sitter | Details shown (name, phone, email, Aadhaar, UPI) | ⏳ PENDING |
| 3 | Click "Approve" button | Confirmation modal appears | ⏳ PENDING |
| 4 | Confirm approval | Status changes to "active" | ⏳ PENDING |
| 5 | Check sitter notification | Sitter receives "Approved" notification | ⏳ PENDING |
| 6 | Verify audit log | Action logged with timestamp & admin name | ⏳ PENDING |

### Verification Checklist

**Database:**
- [ ] Sitter `status` = "active"
- [ ] `approval_date` set to current timestamp
- [ ] Audit log entry created

**Notifications:**
- [ ] Sitter receives in-app notification
- [ ] Email sent (from SendGrid)
- [ ] SMS sent (from MSG91)

**Audit Trail:**
- [ ] Admin Audit Logs show approval action
- [ ] Timestamp correct
- [ ] Admin user identified

---

## 🟠 SCENARIO 10: ADMIN AWARDS TOP SITTER BADGE

**User:** Admin  
**Duration:** 3 minutes  
**Priority:** HIGH

### Setup
```
Prerequisite: Sitter with good rating exists
Starting State: AdminPanel > All Sitters
```

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Find sitter with 4.5+ rating | Click on sitter | ⏳ PENDING |
| 2 | Click "Award Top Sitter" button | Confirmation appears | ⏳ PENDING |
| 3 | Confirm action | Badge awarded, ⭐ appears | ⏳ PENDING |
| 4 | View sitter profile | ⭐ badge visible on profile | ⏳ PENDING |
| 5 | Check sitter card | Badge visible in Explore sitters list | ⏳ PENDING |
| 6 | Verify notifications | Sitter receives congratulations notification | ⏳ PENDING |

### Verification Checklist

**Database:**
- [ ] Sitter `is_top_sitter` = true
- [ ] Badge awarded timestamp recorded
- [ ] Audit log created

**UI:**
- [ ] ⭐ badge visible on sitter profile
- [ ] Badge visible in sitter cards (Explore)
- [ ] Badge removes when unawarded

**Notifications:**
- [ ] Sitter receives "Top Sitter" notification
- [ ] Email sent
- [ ] SMS sent (if phone available)

---

## 🟠 SCENARIO 11: ADMIN MARKS PAYOUT AS PAID

**User:** Admin  
**Duration:** 3 minutes  
**Priority:** HIGH  
**Expected Notifications:** 1 (sitter receives payout confirmation)

### Setup
```
Prerequisite: Sitter has completed walk & earnings pending
Starting State: AdminPanel > Payouts tab
```

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to Payouts tab | Unpaid payouts listed | ⏳ PENDING |
| 2 | See sitter payout (85% of booking) | Amount shown correctly | ⏳ PENDING |
| 3 | Click "Mark Paid" button | Confirmation modal appears | ⏳ PENDING |
| 4 | Confirm payment | Status changes to "paid" | ⏳ PENDING |
| 5 | Check sitter notification | Sitter receives "Payout Marked Paid" | ⏳ PENDING |
| 6 | Verify amount in notification | Shows correct amount (85% of booking) | ⏳ PENDING |
| 7 | Check audit log | Payment action logged | ⏳ PENDING |

### Verification Checklist

**Database:**
- [ ] Payout `status` = "paid"
- [ ] `payment_date` = current date
- [ ] Amount correct (85% of booking price)

**Notifications - Sitter Receives:**
- [ ] In-app notification: "Payout of ₹XXX marked paid"
- [ ] Email with payout confirmation
- [ ] SMS with amount and date

**Sitter Dashboard:**
- [ ] Earnings tab shows payout in "Paid" section
- [ ] Amount matches exactly

**Audit Trail:**
- [ ] Admin actions logged
- [ ] Timestamp & payout ID recorded

---

## 🟡 SCENARIO 12: SITTER VIEWS EARNINGS DASHBOARD

**User:** Sitter  
**Duration:** 5 minutes  
**Priority:** MEDIUM

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Click Earnings tab (💰) | Earnings dashboard loads | ⏳ PENDING |
| 2 | View total earnings (lifetime) | Shows total accumulated | ⏳ PENDING |
| 3 | View current month breakdown | Monthly summary shown | ⏳ PENDING |
| 4 | View individual bookings | All bookings listed with earnings | ⏳ PENDING |
| 5 | See pending vs paid payouts | Split clearly shown | ⏳ PENDING |
| 6 | Check for pending payouts | Shows "Pending Admin Review" | ⏳ PENDING |
| 7 | Check for paid payouts | Shows payment date | ⏳ PENDING |

### Verification Checklist

**Calculations:**
- [ ] Individual booking = 85% of service price
- [ ] Monthly total = sum of completed bookings
- [ ] Lifetime total = sum of all paid bookings

**Status Indicators:**
- [ ] Pending: Shows "Awaiting Admin Review"
- [ ] Paid: Shows payment date
- [ ] On-time payments shown

---

## 🟡 SCENARIO 13: REPEAT BOOKING FLOW

**User:** Pet Parent  
**Duration:** 8 minutes  
**Priority:** MEDIUM

### Setup
```
Prerequisite: Completed booking with same sitter & pet from earlier
Starting State: BookingsDashboard, viewing past booking
```

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | View completed booking | "Repeat" or "Book Again" button visible | ⏳ PENDING |
| 2 | Click "Repeat Booking" | Booking flow opens with pre-filled data | ⏳ PENDING |
| 3 | Verify sitter pre-filled | Same sitter selected | ⏳ PENDING |
| 4 | Verify pet pre-filled | Same pet selected | ⏳ PENDING |
| 5 | Verify service pre-filled | Same service type selected | ⏳ PENDING |
| 6 | Select new date | Can pick different date/time | ⏳ PENDING |
| 7 | Complete booking flow | Proceeds to payment | ⏳ PENDING |
| 8 | Verify notification sent | Booking confirmation sent to both | ⏳ PENDING |

### Verification Checklist

**Pre-filled Data:**
- [ ] Sitter ID matches previous booking
- [ ] Pet ID matches previous booking
- [ ] Service type matches previous booking
- [ ] Time slots available for new date

**Booking Creation:**
- [ ] New booking created (different ID)
- [ ] Same sitter assigned
- [ ] Same pet linked
- [ ] New date/time recorded

---

## 🔴 SCENARIO 14: NOTIFICATION DELIVERY - ALL CHANNELS

**User:** System (Testing All Notification Paths)  
**Duration:** 5 minutes  
**Priority:** CRITICAL

### Verification for Each Notification Type

**For Booking Confirmation (From Scenario 1):**

| Channel | Expected | Status | Notes |
|---------|----------|--------|-------|
| In-App | Notification in bell icon | ⏳ PENDING | Real-time sync |
| Email (SendGrid) | Booking details email | ⏳ PENDING | To both parties |
| SMS (MSG91) | Booking reminder SMS | ⏳ PENDING | To both parties |
| Browser Console | No errors logged | ⏳ PENDING | Verify logs |

**For Review Notification (From Scenario 3):**

| Channel | Expected | Status | Notes |
|---------|----------|--------|-------|
| In-App | "⭐ Review from [name]" | ⏳ PENDING | Sitter receives |
| Email (SendGrid) | Review details sent | ⏳ PENDING | Sitter gets email |
| SMS (MSG91) | Review notification | ⏳ PENDING | Sitter gets SMS |

**For Walk Proof Notification (From Scenario 4):**

| Channel | Expected | Status | Notes |
|---------|----------|--------|-------|
| In-App | "Walk photos uploaded" | ⏳ PENDING | Parent receives |
| Email (SendGrid) | Photos notification | ⏳ PENDING | Parent gets email |
| SMS (MSG91) | Photo uploaded alert | ⏳ PENDING | Parent gets SMS |

**For Payout Notification (From Scenario 11):**

| Channel | Expected | Status | Notes |
|---------|----------|--------|-------|
| In-App | "Payout marked paid ₹XXX" | ⏳ PENDING | Sitter receives |
| Email (SendGrid) | Payout confirmation | ⏳ PENDING | With amount |
| SMS (MSG91) | Payment confirmation | ⏳ PENDING | Quick notification |

### Graceful Fallback Testing

**Test Missing Email:**
```
Set email to null for a user
Trigger notification
Expected: SMS + In-App still work, no crash
```

**Test Missing Phone:**
```
Set phone to null for a user
Trigger notification
Expected: Email + In-App still work, no crash
```

**Test Missing Both:**
```
Set email & phone to null
Trigger notification
Expected: In-App notification only, no crash
```

---

## 🟠 SCENARIO 15: ERROR HANDLING - API FAILURE RECOVERY

**User:** System (Testing Error Scenarios)  
**Duration:** 5 minutes  
**Priority:** HIGH

### Test SendGrid Failure

```
Steps:
1. Simulate SendGrid API down
2. Create booking (triggers email notification)
3. Verify:
   - In-app notification still sent ✓
   - SMS still sent (if phone available) ✓
   - Booking still completes ✓
   - No user-facing errors ✓
   - Error logged in console ✓
```

### Test MSG91 Failure

```
Steps:
1. Simulate MSG91 API down
2. Create booking (triggers SMS notification)
3. Verify:
   - In-app notification still sent ✓
   - Email still sent ✓
   - Booking still completes ✓
   - No user-facing errors ✓
   - Warning logged (SMS key missing) ✓
```

### Test Database Failure

```
Steps:
1. Simulate database connection issue
2. Try to create booking
3. Verify:
   - User sees error message ✓
   - Payment not processed ✓
   - No duplicate booking ✓
   - Proper error handling ✓
```

---

## 📊 UAT SCORING

### Pass Criteria for Each Scenario
- ✅ **PASS:** All checkboxes verified, no errors
- ⚠️ **CONDITIONAL:** Minor issues that don't block functionality
- ❌ **FAIL:** Critical failures or data loss

### Overall UAT Pass/Fail
- **PASS:** 14/15 scenarios pass
- **CONDITIONAL:** Up to 1 scenario with minor issues
- **FAIL:** 2+ scenarios failing OR data integrity issues

---

## 📋 UAT EXECUTION LOG

**Date Started:** [To be filled]  
**Tester:** [To be filled]  
**Browser:** [To be filled]  
**Environment:** [local/staging/production]

### Results Summary

| Scenario # | Name | Status | Duration | Notes |
|------------|------|--------|----------|-------|
| 1 | Booking → Payment | ⏳ PENDING | -- | -- |
| 2 | Sitter Completes Walk | ⏳ PENDING | -- | -- |
| 3 | Leave Review | ⏳ PENDING | -- | -- |
| 4 | Upload Photos | ⏳ PENDING | -- | -- |
| 5 | Cancel 72h+ | ⏳ PENDING | -- | -- |
| 6 | Cancel 24-72h | ⏳ PENDING | -- | -- |
| 7 | Cancel <24h | ⏳ PENDING | -- | -- |
| 8 | Admin Approves Sitter | ⏳ PENDING | -- | -- |
| 9 | Admin Awards Badge | ⏳ PENDING | -- | -- |
| 10 | Admin Marks Payout | ⏳ PENDING | -- | -- |
| 11 | Sitter Views Earnings | ⏳ PENDING | -- | -- |
| 12 | Repeat Booking | ⏳ PENDING | -- | -- |
| 13 | All Notifications | ⏳ PENDING | -- | -- |
| 14 | Error Handling | ⏳ PENDING | -- | -- |
| **TOTAL** | **Pass/Fail** | **⏳ PENDING** | **~90 min** | -- |

---

## 🎯 UAT SIGN-OFF

**All Scenarios Passed:** [ ] Yes [ ] No  
**Critical Issues Found:** [ ] None [ ] [Count]  
**Ready for Production:** [ ] Yes [ ] No  
**Approved By:** ________________  
**Date:** ________________

---

**UAT Test Scenarios Ready to Execute!**

