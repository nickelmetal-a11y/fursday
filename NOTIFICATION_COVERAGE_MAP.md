# 100% Notification Coverage Map - All User Actions

**Goal:** Every action → Notification to relevant party (In-app + Email + SMS)  
**Status:** Planning phase - Implementation follows

---

## 🎯 NOTIFICATION TYPES BY ACTION

### BOOKING LIFECYCLE (Pet Parent Initiates)

#### 1. Booking Created (Pet Parent)
**Action:** Pet parent completes booking form
**Triggers:**
- ✅ To Sitter: "New booking from [PetParent] - [PetName] on [Date]" (IN-APP + SMS)
- ✅ To Pet Parent: "Booking request sent to [SitterName]" (IN-APP)

**Files to update:**
- BookingFlow.js (after booking created, before payment screen)

---

#### 2. Payment Successful
**Action:** Razorpay payment completes
**Triggers:**
- ✅ To Pet Parent: "Booking confirmed with [SitterName]! [Date] [Time]" (IN-APP + EMAIL + SMS)
- ✅ To Sitter: "ACCEPTED: New booking - [PetName], [Date] [Time]" (IN-APP + SMS + EMAIL)

**Files to update:**
- PaymentScreen.js (line 54, after onSuccess callback)

---

#### 3. Sitter Accepts Booking
**Action:** Sitter clicks "Accept" button
**Triggers:**
- ✅ To Pet Parent: "[SitterName] accepted your booking! ✓" (IN-APP + SMS)
- ✅ To Sitter: "Booking confirmed!" (IN-APP)

**Files to update:**
- SitterDashboard.js (acceptBooking function)

---

#### 4. Sitter Declines Booking
**Action:** Sitter clicks "Decline" button
**Triggers:**
- ✅ To Pet Parent: "[SitterName] couldn't accept. Finding alternatives..." (IN-APP + SMS)
- ✅ To Sitter: "Booking declined (you can re-offer if available)" (IN-APP)

**Files to update:**
- SitterDashboard.js (declineBooking function)

---

#### 5. Walk Starts (OTP Entry)
**Action:** Sitter enters start OTP
**Triggers:**
- ✅ To Pet Parent: "[SitterName] started the walk with [PetName] 🚶" (IN-APP + SMS)
- ✅ To Sitter: "Walk started! Enjoy the time with [PetName]" (IN-APP)

**Files to update:**
- SitterDashboard.js (verifyStartOtp function)

---

#### 6. Walk Completed (OTP Verification)
**Action:** Sitter completes walk, parent verifies end OTP
**Triggers:**
- ✅ To Pet Parent: "Walk complete! [SitterName] finished with [PetName]" (IN-APP + SMS)
- ✅ To Sitter: "Walk completed! Please upload photos ⏰" (IN-APP + SMS)

**Files to update:**
- SitterDashboard.js (completeWithOtp function)
- BookingsDashboard.js (parent side verification)

---

#### 7. Photos Uploaded by Sitter
**Action:** Sitter uploads 1-3 walk proof photos
**Triggers:**
- ✅ To Pet Parent: "[SitterName] uploaded walk photos 📸" (IN-APP + EMAIL + SMS)
- ✅ To Sitter: "Photos uploaded! Parent will confirm soon" (IN-APP)

**Files to update:**
- PhotoUploadModal.js (after photos saved to database)

---

#### 8. Photos Confirmed by Pet Parent
**Action:** Pet parent confirms walk photos
**Triggers:**
- ✅ To Sitter: "[PetName]'s parent confirmed the photos ✓ Payout ready!" (IN-APP + SMS)
- ✅ To Pet Parent: "Photos confirmed. Thank you for booking!" (IN-APP)

**Files to update:**
- BookingsDashboard.js (confirmPhotos function)

---

### REVIEW & RATING LIFECYCLE

#### 9. Review Submitted
**Action:** Pet parent leaves 5-star review + text
**Triggers:**
- ✅ To Sitter: "[PetParent] left a ⭐⭐⭐⭐⭐ review: '[review text]'" (IN-APP + EMAIL)
- ✅ To Pet Parent: "Review posted! Thank you for the feedback" (IN-APP)

**Files to update:**
- ReviewModal.js (after review saved to database)

---

#### 10. Review Appears on Profile
**Action:** Review is visible on sitter's public profile
**Triggers:**
- ✅ To Sitter: "Your rating updated! [Old: 4.2⭐ → New: 4.5⭐]" (IN-APP + SMS)

**Files to update:**
- reviewService.js (after review published)

---

### CANCELLATION LIFECYCLE

#### 11. Cancellation Initiated
**Action:** Pet parent clicks "Cancel booking"
**Triggers:**
- ✅ To Pet Parent: "Confirm cancellation? You'll get [Refund%] refund" (IN-APP modal)
- ✅ To Sitter: "ALERT: Booking might be cancelled - [PetName]" (IN-APP + SMS)

**Files to update:**
- CancellationPolicyModal.js (before confirmation)

---

#### 12. Cancellation Confirmed
**Action:** Pet parent confirms cancellation
**Triggers:**
- ✅ To Pet Parent: "Booking cancelled. Refund: Rs.[Amount] processing 💳" (IN-APP + EMAIL + SMS)
- ✅ To Sitter: "Booking cancelled by [PetParent]. (Loss for this time slot)" (IN-APP + SMS)
- ✅ To Admin: "AUDIT: Cancellation - [Booking] by [PetParent] - Refund Rs.[Amount]" (IN-APP audit log)

**Files to update:**
- CancellationPolicyModal.js (after cancellation confirmed)
- AdminPanel.js (auto-log to audit logs)

---

### MESSAGING & COMMUNICATION

#### 13. Message Sent (Pet Parent → Sitter)
**Action:** Pet parent sends message in chat
**Triggers:**
- ✅ To Sitter: "New message from [PetParent]: '[preview of message]'" (IN-APP + SMS notification badge)
- ✅ To Pet Parent: "Message sent ✓" (IN-APP confirmation)

**Files to update:**
- ChatScreen.js (after message posted)

---

#### 14. Message Sent (Sitter → Pet Parent)
**Action:** Sitter sends message in chat
**Triggers:**
- ✅ To Pet Parent: "New message from [SitterName]: '[preview]'" (IN-APP + SMS notification badge)
- ✅ To Sitter: "Message sent ✓" (IN-APP confirmation)

**Files to update:**
- ChatScreen.js (after message posted)

---

### PAYOUT & EARNINGS

#### 15. Walk Eligible for Payout
**Action:** Walk completed + photos confirmed
**Triggers:**
- ✅ To Sitter: "[PetName] walk ready for payout! Earning: Rs.[Amount]" (IN-APP)

**Files to update:**
- BookingsDashboard.js (after photos confirmed)

---

#### 16. Admin Marks Payout as Paid
**Action:** Admin clicks "Mark as Paid" for sitter
**Triggers:**
- ✅ To Sitter: "Payout received! Rs.[Amount] → Your bank account 💰" (IN-APP + EMAIL + SMS)
- ✅ To Admin: "AUDIT: Payout marked paid - [Sitter] - Rs.[Amount]" (IN-APP audit)

**Files to update:**
- AdminPanel.js (after payout marked)

---

### ADMIN ACTIONS

#### 17. Sitter Application Received
**Action:** New sitter completes onboarding form
**Triggers:**
- ✅ To Sitter: "Application received! Admin reviews in 24 hours ⏱️" (IN-APP + EMAIL + SMS)
- ✅ To Admin: "NEW SITTER: [Name] applied with [Services]" (IN-APP + dashboard notification)

**Files to update:**
- SitterOnboarding.js (after form submitted)

---

#### 18. Sitter Approved
**Action:** Admin clicks "Approve" on pending sitter
**Triggers:**
- ✅ To Sitter: "🎉 You're approved! Start accepting bookings now!" (IN-APP + EMAIL + SMS)
- ✅ To Admin: "AUDIT: Sitter approved - [Name]" (IN-APP audit log)

**Files to update:**
- AdminPanel.js (after approval)

---

#### 19. Sitter Rejected
**Action:** Admin clicks "Reject" on pending sitter
**Triggers:**
- ✅ To Sitter: "Application not approved this time. Reason: [reason]" (IN-APP + EMAIL)
- ✅ To Admin: "AUDIT: Sitter rejected - [Name] - [reason]" (IN-APP audit log)

**Files to update:**
- AdminPanel.js (after rejection)

---

#### 20. Sitter Suspended
**Action:** Admin clicks "Suspend" on active sitter
**Triggers:**
- ✅ To Sitter: "⚠️ Your account suspended. Reason: [reason]. Contact support." (IN-APP + EMAIL + SMS)
- ✅ To Admin: "AUDIT: Sitter suspended - [Name] - [reason]" (IN-APP audit log)

**Files to update:**
- AdminPanel.js (after suspension)

---

#### 21. Top Sitter Badge Awarded
**Action:** Admin awards ⭐ Top Sitter badge
**Triggers:**
- ✅ To Sitter: "🌟 You're a TOP SITTER! Badge awarded!" (IN-APP + SMS + EMAIL)
- ✅ To Admin: "AUDIT: Top badge awarded - [Sitter]" (IN-APP audit log)

**Files to update:**
- AdminPanel.js (after badge awarded)

---

### DISPUTES & COMPLAINTS

#### 22. Dispute Filed
**Action:** User files dispute/complaint
**Triggers:**
- ✅ To Other Party: "Dispute filed against you. Details: [Type]" (IN-APP + EMAIL + SMS)
- ✅ To Admin: "NEW DISPUTE: [Type] - [Booking] - Status: open" (IN-APP + email)

**Files to update:**
- New DisputeForm.js component or UpdateAdminDisputes.js

---

#### 23. Dispute Resolved
**Action:** Admin resolves dispute
**Triggers:**
- ✅ To Pet Parent: "Dispute resolved! Decision: [Resolution]. Refund: Rs.[Amount]" (IN-APP + EMAIL + SMS)
- ✅ To Sitter: "Dispute resolved. Decision: [Resolution]" (IN-APP + EMAIL)
- ✅ To Admin: "AUDIT: Dispute resolved - [ID] - [Resolution]" (IN-APP audit log)

**Files to update:**
- AdminPanel.js (after resolution saved)

---

### REFERRAL PROGRAM

#### 24. Referral Code Generated
**Action:** User generates referral code
**Triggers:**
- ✅ To User: "Your referral code: [CODE]. Share to earn Rs.100 per signup!" (IN-APP)

**Files to update:**
- New ReferralProgram.js component

---

#### 25. Referred User Signs Up
**Action:** New user signs up with referral code
**Triggers:**
- ✅ To Referrer: "[Name] joined with your code! Bonus pending after 1st booking" (IN-APP + SMS)
- ✅ To New User: "Welcome! You get Rs.50 bonus on first booking (code: [CODE])" (IN-APP + EMAIL)

**Files to update:**
- LoginScreen.js or ParentOnboarding.js

---

#### 26. Referral Bonus Paid
**Action:** Referred user completes first booking
**Triggers:**
- ✅ To Referrer: "Referral bonus earned! Rs.100 added to your wallet 💰" (IN-APP + SMS)
- ✅ To New User: "First booking bonus! Rs.50 credited" (IN-APP + SMS)

**Files to update:**
- BookingsDashboard.js (after booking completed)

---

### SYSTEM & SPECIAL EVENTS

#### 27. Heat Advisory Alert
**Action:** Booking scheduled during hot months (Apr-Sep)
**Triggers:**
- ✅ To Sitter: "🔥 Hot day warning! Stay hydrated during [PetName]'s walk" (IN-APP + SMS)
- ✅ To Pet Parent: "Heat advisory for [Date]. Consider rescheduling or shorter walk" (IN-APP + EMAIL)

**Files to update:**
- BookingFlow.js (heat advisory shown) + send notification

---

#### 28. Booking Reminder (12 hours before)
**Action:** Cron job runs 12 hours before scheduled walk
**Triggers:**
- ✅ To Sitter: "⏰ Reminder: Walk with [PetName] tomorrow at [Time]" (IN-APP + SMS)
- ✅ To Pet Parent: "Reminder: [SitterName] coming tomorrow at [Time] for [PetName]" (IN-APP + SMS)

**Files to update:**
- New scheduledNotifications.js or use Supabase functions

---

#### 29. Booking Reminder (1 hour before)
**Action:** Cron job runs 1 hour before scheduled walk
**Triggers:**
- ✅ To Sitter: "🚶 Walk starting soon! [PetName] at [Time]" (IN-APP + SMS)
- ✅ To Pet Parent: "Sitter [Name] arriving soon for [PetName]'s walk 🐾" (IN-APP + SMS)

**Files to update:**
- scheduledNotifications.js

---

#### 30. Weekly Earnings Summary (Pet Parent)
**Action:** Every Sunday 6 PM
**Triggers:**
- ✅ To Sitter: "📊 Weekly Summary: [N] walks, Rs.[Total] earned, Rating: [⭐]" (IN-APP + EMAIL)

**Files to update:**
- New weeklyReports.js or Supabase scheduled functions

---

---

## 📊 NOTIFICATION MATRIX

| Action | Pet Parent | Sitter | Admin | In-App | Email | SMS |
|--------|-----------|--------|-------|--------|-------|-----|
| Booking Created | ✅ | ✅ | - | ✅ | - | ✅ |
| Payment Success | ✅ | ✅ | - | ✅ | ✅ | ✅ |
| Sitter Accepts | ✅ | ✅ | - | ✅ | - | ✅ |
| Walk Starts | ✅ | ✅ | - | ✅ | - | ✅ |
| Walk Complete | ✅ | ✅ | - | ✅ | - | ✅ |
| Photos Uploaded | ✅ | ✅ | - | ✅ | ✅ | ✅ |
| Photos Confirmed | ✅ | ✅ | - | ✅ | - | ✅ |
| Review Posted | - | ✅ | - | ✅ | ✅ | - |
| Cancellation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Message Sent | ✅ | ✅ | - | ✅ | - | ✅ (badge) |
| Payout Paid | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sitter Approved | - | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dispute Filed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dispute Resolved | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Referral Bonus | ✅ | - | - | ✅ | - | ✅ |
| Heat Advisory | ✅ | ✅ | - | ✅ | ✅ | ✅ |
| Booking Reminder (12h) | ✅ | ✅ | - | ✅ | - | ✅ |
| Booking Reminder (1h) | ✅ | ✅ | - | ✅ | - | ✅ |

---

## 🚀 IMPLEMENTATION PRIORITY

### TIER 1 - CRITICAL (Do Now)
These block user experience completely:
1. Payment Success (both parties)
2. Booking Confirmed (both parties)
3. Walk Starts/Completes (both parties)
4. Photos Uploaded/Confirmed (both parties)
5. Messages (both parties)

### TIER 2 - HIGH (This Week)
These drive engagement:
6. Review Posted (sitter retention)
7. Payout Paid (sitter retention)
8. Sitter Approved/Rejected (onboarding)
9. Cancellations (both retention + revenue)
10. Disputes (customer service)

### TIER 3 - MEDIUM (Next Week)
These enhance experience:
11. Booking Reminders (12h + 1h)
12. Heat Advisories (safety)
13. Weekly Summaries (engagement)
14. Referral Bonuses (growth)
15. Admin Audit Logging (compliance)

---

## 📋 FILES TO UPDATE (Summary)

**TIER 1 (Critical - Start Here):**
- ✅ PaymentScreen.js
- ✅ ReviewModal.js
- ✅ CancellationPolicyModal.js
- ✅ PhotoUploadModal.js
- ✅ ChatScreen.js
- ⏳ SitterDashboard.js (acceptBooking, completeWithOtp)
- ⏳ BookingsDashboard.js (confirmPhotos, start/end OTP verification)

**TIER 2 (High):**
- AdminPanel.js (approve, reject, suspend, award badge)
- AdminDisputes.js (resolve dispute)
- SitterOnboarding.js (application submission)
- New DisputeForm.js (file dispute)

**TIER 3 (Medium):**
- New scheduledNotifications.js (reminders, summaries)
- New ReferralProgram.js (referral codes)
- BookingFlow.js (heat advisory)

---

## ✅ COMPLETION CHECKLIST

- [ ] All 30 notification types defined
- [ ] All recipient combinations clear (both parties, admin)
- [ ] All files identified
- [ ] Test cases created for each
- [ ] Email templates styled
- [ ] SMS messages concise & clear
- [ ] No notification duplication
- [ ] Frequency limits set (no spam)
- [ ] Unsubscribe options available
- [ ] Audit trail complete

---

**Goal:** 100% notification coverage = Every action → Both parties informed  
**Timeline:** Tier 1 (3-4 hours) → Tier 2 (2-3 days) → Tier 3 (2-3 days)  
**Outcome:** Highly engaged platform with transparent communication
