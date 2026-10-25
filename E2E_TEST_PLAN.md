# 🧪 END-TO-END TEST PLAN

**Date:** 2026-10-25  
**Status:** Ready to execute  
**Total Tests:** 86 from Fursday_Test_Cases.csv  
**Framework:** Manual testing + Jest unit tests

---

## 📊 TEST EXECUTION ROADMAP

### Phase 0: Setup (30 minutes)
- [ ] Start dev server: `npm start`
- [ ] Create test user account (pet parent)
- [ ] Create test sitter account
- [ ] Get admin credentials
- [ ] Open DevTools console for debugging

### Phase 1: Core Authentication (15 minutes)
**Tests:** AUTH-001 to AUTH-005

```
AUTH-001: Valid Email Login ✅
- Navigate to fursday.vercel.app
- Enter test email
- Check email for OTP
- Expected: Login successful

AUTH-002: Invalid Email Format ✅
- Enter "test@"
- Expected: Error message

AUTH-003: Wrong OTP Entry ✅
- Enter valid email, receive OTP
- Enter wrong OTP 3 times
- Expected: Error after attempts

AUTH-004: OTP Expiry ✅
- Request OTP
- Wait 10+ minutes
- Try expired OTP
- Expected: Error "OTP expired"

AUTH-005: Multiple Concurrent Logins ✅
- Login from Device A
- Login from Device B
- Expected: Both sessions active
```

### Phase 2: Booking Flow (45 minutes)
**Tests:** BOOK-001 to BOOK-012

**Critical Path - Complete Booking:**
```
BOOK-001: Complete 4-Step Booking
1. Click "Book Now"
2. Select "Walk 30 min"
3. Select date (7 days from now)
4. Select time (10:00 AM)
5. Select pet "Buddy"
6. Confirm & proceed to payment
7. Complete Razorpay payment
Expected: 
  ✅ Booking created
  ✅ Receipt generated
  ✅ Notification sent to sitter + parent
  ✅ Status: "confirmed"

✅ CRITICAL: Check browser console for notification service logs
```

**Heat Advisory:**
```
BOOK-002: Heat Advisory (April-Sept)
- Book walk in May 1-30
- Expected: Orange banner warning
- Only shows April-September
```

**Aggression Disclosure:**
```
BOOK-003: Aggression Disclosure
- Start booking
- Skip aggression checkbox
- Try to confirm
- Expected: Error "Must confirm"
```

**Cancellation Tests:**
```
BOOK-006: Cancel <24hrs → Refund 0%
BOOK-007: Cancel 24-72hrs → Refund 75%
BOOK-008: Cancel 72hrs+ → Refund 100%

After each cancellation:
✅ Check notification sent
✅ Verify refund amount correct
✅ Check status updated to "cancelled"
```

**Repeat Booking:**
```
BOOK-010: Repeat Booking
1. View completed booking
2. Click "Repeat" button
3. Confirm with new date
Expected: Same sitter + pet pre-filled
```

### Phase 3: Sitter Experience (60 minutes)
**Tests:** SITTER-001 to SITTER-010

**Onboarding:**
```
SITTER-001: Complete Signup
1. Email login
2. Fill profile form
3. Upload Aadhaar
4. Set UPI
5. Select services & pricing
Expected: Status = "pending_approval"
```

**Portfolio Photos:**
```
SITTER-002: Portfolio Photos
1. Click photo upload
2. Select 3 photos
3. Save profile
Expected: 
  ✅ Photos compressed
  ✅ Max 3 images
  ✅ Max 2MB each
  ✅ Visible on sitter profile
```

**Dashboard:**
```
SITTER-003: View Active Jobs
- Login as sitter
- Check dashboard
- Expected: Active bookings listed

SITTER-006: Complete Walk
1. Accept booking
2. Click "Start Walk"
3. Do walk activity (simulated)
4. Click "Complete Walk"
5. Enter end OTP
Expected:
  ✅ Status: "completed"
  ✅ Parent gets notification
  ✅ Eligible for payout
```

**Walk Photos:**
```
SITTER-007: Upload Walk Photos
1. Go to completed booking
2. Click "Upload Photos"
3. Select 1-3 photos
Expected:
  ✅ Photos stored
  ✅ Parent notification sent
  ✅ Max 3 images
```

**Earnings:**
```
SITTER-009: View Earnings
1. Go to Earnings tab
2. View monthly breakdown
3. Check individual bookings
Expected:
  ✅ Shows 85% of booking price
  ✅ Pending until admin marks paid
```

### Phase 4: Pet Parent Experience (45 minutes)
**Tests:** DASH-001 to DASH-010

**Dashboard:**
```
DASH-001: View Active Bookings
- Login as pet parent
- Go to Bookings
- Expected: Active bookings listed

DASH-002: View Past Bookings
- Scroll to past bookings
- Expected: Completed walks shown

DASH-003: Leave Review
1. Click completed booking
2. Click "Leave Review"
3. Rate 5 stars
4. Add review text
Expected:
  ✅ Review saved
  ✅ Sitter notification sent
  ✅ Rating visible on sitter profile
```

**Walk Receipts:**
```
DASH-004: Download Receipt
1. Click completed booking
2. Click "Receipt" button
3. Download file
Expected:
  ✅ Professional receipt
  ✅ All booking details
  ✅ Service type, date, sitter, pet, price
  ✅ Walk photos included
```

**Walk Proof:**
```
DASH-005: View Walk Photos
1. Go to completed booking
2. Click "View Walk Proof"
3. View carousel
Expected:
  ✅ Photo carousel
  ✅ All images visible
  ✅ Sitter name shown
```

**Pet Profile:**
```
DASH-009: Edit Pet Profile
1. Go to "My Pets"
2. Click pet
3. Edit details
4. Save
Expected:
  ✅ Pre-filled form
  ✅ Changes saved
  ✅ Appears in booking dropdown

DASH-010: Add New Pet
1. Click "Add Pet"
2. Fill form
3. Upload photo
4. Save
Expected: New pet appears in dropdown
```

### Phase 5: Admin Panel (60 minutes)
**Tests:** ADMIN-001 to ADMIN-015

**Dashboard:**
```
ADMIN-001: Admin Login
1. Navigate to https://fursday.vercel.app#admin
2. Enter admin password
3. Expected: Dashboard with KPIs

ADMIN-015: View KPI Dashboard
- Check top stats: Pending sitters, Active sitters, Bookings, GMV, Payouts
- Expected: Auto-updates
```

**Sitter Management:**
```
ADMIN-002: View Pending Sitters
1. Click "Pending" tab
2. Expected: All pending applications

ADMIN-003: Approve Sitter
1. Go to Pending
2. Click Approve
3. Expected:
   ✅ Status: "active"
   ✅ Sitter notified
   ✅ Audit logged

ADMIN-004: Reject Sitter
1. Go to Pending
2. Click Reject
3. Expected:
   ✅ Status: "rejected"
   ✅ Audit logged

ADMIN-005: Suspend Sitter
1. Go to All Sitters
2. Click Suspend
3. Expected: Can't accept bookings

ADMIN-006: Reinstate Sitter
1. Click Reinstate
2. Expected: Status: "active"

ADMIN-007: Award Top Sitter
1. Go to sitter
2. Click "Give Top Badge"
3. Expected:
   ✅ ⭐ badge visible
   ✅ Audit logged
```

**Booking Management:**
```
ADMIN-008: View All Bookings
1. Click "Bookings" tab
2. Expected: All bookings with ref, service, status, price
```

**Payout Management:**
```
ADMIN-009: View Unpaid Payouts
1. Click "Payouts" tab
2. Expected: Unpaid payouts listed (85% of booking price)

ADMIN-010: Mark Payout Paid
1. Go to Payouts
2. Click "Mark Paid"
3. Expected:
   ✅ Status: "paid"
   ✅ Sitter notification sent
   ✅ Audit logged
```

**Dispute Resolution:**
```
ADMIN-013: View Disputes
1. Click "Disputes" tab
2. Expected: All disputes listed with status, type, reporter

ADMIN-014: Resolve Dispute
1. Click dispute
2. Select resolution
3. Add refund & notes
4. Click Resolve
5. Expected:
   ✅ Status: "resolved"
   ✅ Refund processed if needed
   ✅ Audit logged
```

**Audit Logs:**
```
ADMIN-011: View Audit Logs
1. Click "Audit" tab
2. Expected: All admin actions logged

ADMIN-012: Filter Audit Logs
1. Select action type
2. Expected: Only selected actions shown
```

### Phase 6: Notifications (30 minutes)
**Tests:** NOTIF-001 to NOTIF-006

```
NOTIF-001: Booking Confirmation
1. Create booking via BOOK-001
2. Check notification bell
3. Expected: "Booking confirmed" notification

NOTIF-002: Review Received
1. Pet parent leaves review via DASH-003
2. Sitter checks notifications
3. Expected: "⭐ Review from [name]"

NOTIF-003: Message Notification
1. Send message to sitter
2. Sitter checks notifications
3. Expected: Bell shows unread count

NOTIF-004: Walk Proof Received
1. Sitter uploads photos via SITTER-007
2. Parent checks notifications
3. Expected: "Walk photos uploaded by [sitter]"

NOTIF-005: Notification Persistence
1. Create notification
2. Close/reopen app
3. Expected: Notification still visible

NOTIF-006: Mark as Read
1. Click notification
2. Expected: Marked read, removed from badge
```

### Phase 7: Security (30 minutes)
**Tests:** SEC-001 to SEC-006

```
SEC-001: User Data Isolation
1. Login as User A
2. Try to access User B's booking URL
3. Expected: Error 403 or RLS blocks

SEC-002: Role-Based Access
1. Login as pet parent
2. Try to access /sitter-dashboard
3. Expected: Redirected to pet parent dashboard

SEC-003: Admin-Only Features
1. Login as sitter
2. Try to access admin functions
3. Expected: Access denied

SEC-004: Booking Isolation
1. Sitter A books pet parent B
2. Login as Sitter C
3. Try to view booking
4. Expected: Can't see booking

SEC-005: Payment Security
1. Try to mark own payout as paid
2. Modify via network tab
3. Expected: Change blocked

SEC-006: OTP Brute Force
1. Try 5+ wrong OTPs
2. Expected: Temporarily blocked
```

### Phase 8: Edge Cases (30 minutes)
**Tests:** EDGE-001 to EDGE-006

```
EDGE-001: Concurrent Booking
1. Two pet parents book same sitter
2. Expected: One succeeds, one queued/error

EDGE-002: Network Timeout
1. Start booking
2. Disconnect internet
3. Reconnect
4. Expected: Graceful error, no duplication

EDGE-003: Image Upload Timeout
1. Try walk photo upload
2. Simulate slow network
3. Expected: Timeout error with retry

EDGE-004: Invalid GPS
1. Try booking with invalid location
2. Expected: Error or auto-correct

EDGE-005: Zero Price Booking
1. Admin sets service to $0
2. Pet parent books
3. Expected: Booking created, no charge

EDGE-006: Timezone Edge Case
1. Book walk across timezone
2. Expected: Correct time in both zones
```

---

## ⏱️ TEST EXECUTION TIMELINE

| Phase | Tests | Time | Status |
|-------|-------|------|--------|
| 0 Setup | - | 30 min | 🟡 TODO |
| 1 Auth | 5 | 15 min | 🟡 TODO |
| 2 Booking | 12 | 45 min | 🟡 TODO |
| 3 Sitter | 10 | 60 min | 🟡 TODO |
| 4 Parent | 10 | 45 min | 🟡 TODO |
| 5 Admin | 15 | 60 min | 🟡 TODO |
| 6 Notif | 6 | 30 min | 🟡 TODO |
| 7 Security | 6 | 30 min | 🟡 TODO |
| 8 Edge Cases | 6 | 30 min | 🟡 TODO |
| **Total** | **86** | **~6.5 hours** | 🟡 TODO |

---

## 🎯 TESTING CHECKLIST

### Before Starting
- [ ] Dev server running (`npm start`)
- [ ] DevTools console open
- [ ] Test accounts created
- [ ] INTEGRATION_STATUS.md read
- [ ] TEST_RESULTS.md reviewed

### After Each Test
- [ ] Console errors checked
- [ ] Database verified
- [ ] Notification logged
- [ ] Status code 200/201

### After Each Phase
- [ ] All tests in phase passed
- [ ] No regressions
- [ ] Performance acceptable
- [ ] Commit progress

### Final Sign-off
- [ ] All 86 tests passed
- [ ] Zero critical bugs
- [ ] All notifications working
- [ ] Security verified
- [ ] Ready for staging deployment

---

## 🚀 NEXT STEPS

1. Execute tests in phases (1 phase per session)
2. Document failures in FAILURES.md
3. Commit test results
4. Fix issues found
5. Re-test failed cases
6. Deploy to staging
7. Final production deployment

---

**Ready to execute! Starting with Phase 0 setup...**

