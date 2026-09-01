# 📋 REMAINING TASKS TO BUILD - PRIORITY ORDER

**Current Status:** 7 notifications wired, Tier 1 + partial Tier 2 complete  
**Goal:** 100% notification coverage (30/30) + remaining features  
**Total Estimated Effort:** 2-3 weeks

---

## 🔴 TIER 2 - HIGH PRIORITY (This Week)

These directly impact user engagement and retention.

### TASK 1: Walk Starts Notification ⏱️ 1-2 hours
**File:** `src/SitterDashboard.js` - In verifyStartOtp() function (around line 266)  
**What:** When sitter enters start OTP, notify both parties

**Send to:**
- Pet Parent: "[SitterName] started the walk with [PetName] 🚶"
- Sitter: "Walk started! Enjoy the time with [PetName]"

**Channels:** In-app + SMS

**Code Pattern:**
```javascript
// After OTP verified, add:
const { notifyWalkProofReceived } = await import('./notificationService');
// Create custom function: notifyWalkStarted(sitterId, petParentId, petName, sitterName)
```

**Dependencies:** None - uses existing notificationService

**Test:** Book walk → Sitter enters OTP → Check both get notifications

---

### TASK 2: Walk Completes Notification ⏱️ 1-2 hours
**File:** `src/BookingsDashboard.js` or `src/SitterDashboard.js` - In completeWithOtp() function

**What:** When walk completes (sitter OTP + parent verification)

**Send to:**
- Pet Parent: "Walk complete! [SitterName] finished with [PetName] ✓"
- Sitter: "Walk completed! Please upload photos ⏰"

**Channels:** In-app + SMS + Email

**Code Pattern:** Similar to Walk Starts

**Test:** Complete a walk → Check both notified → Sitter reminded to upload photos

---

### TASK 3: Sitter Rejected Notification ⏱️ 30 minutes
**File:** `src/AdminPanel.js` - In rejectSitter() function (around line 69)

**What:** When admin rejects pending sitter application

**Send to:**
- Sitter: "Application not approved. Reason: [auto-reason or admin note]"

**Channels:** In-app + Email

**Code Pattern:**
```javascript
// After rejection, add notification
const { data: sitterData } = await supabase...
await notifyBookingCancelled({ // or create notifySitterRejected()
  userId: sitterData.users.id,
  userEmail: sitterData.users.email,
  reason: 'Application did not meet our standards. Please reapply with improvements.'
});
```

**Test:** Reject pending sitter → Check email received

---

### TASK 4: Sitter Suspended Notification ⏱️ 30 minutes
**File:** `src/AdminPanel.js` - In suspendSitter() function (around line 77)

**What:** When admin suspends active sitter

**Send to:**
- Sitter: "⚠️ Your account suspended. Reason: [reason]. Contact support."

**Channels:** In-app + Email + SMS

**Test:** Suspend sitter → Check they get warning → Can't accept new bookings

---

### TASK 5: Top Sitter Badge Awarded ⏱️ 30 minutes
**File:** `src/AdminPanel.js` - In toggleTopSitter() function (around line 86)

**What:** When admin awards ⭐ badge to high-performing sitter

**Send to:**
- Sitter: "🌟 You're a TOP SITTER! Badge awarded on your profile!"

**Channels:** In-app + SMS + Email

**Test:** Award badge → Check sitter notification → Verify badge shows on profile

---

### TASK 6: Dispute Filed Notification ⏱️ 1 hour
**File:** New `src/DisputeForm.js` OR update AdminDisputes.js

**What:** When user files dispute/complaint about booking

**Send to:**
- Other Party: "Dispute filed against you: [Type] - [Title]"
- Admin: "NEW DISPUTE: [Type] - Booking [Ref] - Open"

**Channels:** In-app + Email + SMS

**Code Pattern:**
```javascript
// After dispute created, call:
const { notifyBookingCancelled } = await import('./notificationService'); // reuse
// Create: notifyDisputeFiled(disputeId, reporterId, otherPartyId, type, title)
```

**Dependencies:** Disputes table already exists in DB

**Test:** File dispute → Check both parties + admin notified

---

### TASK 7: Dispute Resolved Notification ⏱️ 30 minutes
**File:** `src/AdminPanel.js` or `src/AdminDisputes.js` - After dispute resolution

**What:** When admin resolves dispute with decision

**Send to:**
- Pet Parent: "Dispute resolved! Decision: [Resolution]. Refund: Rs.[Amount]"
- Sitter: "Dispute resolved. Decision: [Resolution]"
- Admin Log: Audit trail of decision

**Channels:** In-app + Email + SMS

**Test:** Resolve dispute → Check notification with decision + refund amount

---

## 🟡 TIER 3 - MEDIUM PRIORITY (Next Week)

These enhance experience but aren't blocking.

### TASK 8: Heat Advisory Alert ⏱️ 1 hour
**File:** `src/BookingFlow.js` - At step 3 when date selected

**What:** Show warning if booking is in hot months (Apr-Sept) + send notifications

**Send to:**
- Sitter: "🔥 Hot day warning! Stay hydrated during [PetName]'s walk"
- Pet Parent: "Heat advisory for [Date]. Consider shorter walk or reschedule"

**Channels:** In-app banner + SMS + Email

**Test:** Book in May → See heat warning → Both get notifications

---

### TASK 9: Booking Reminder (12 hours before) ⏱️ 2-3 hours
**File:** New `src/scheduledNotifications.js` OR Supabase edge function

**What:** Scheduled job that runs 12 hours before scheduled walk

**Send to:**
- Sitter: "⏰ Reminder: Walk with [PetName] tomorrow at [Time]"
- Pet Parent: "Reminder: [SitterName] coming tomorrow at [Time] for [PetName]"

**Channels:** In-app + SMS

**How to Implement:**
- Option A: Supabase pg_cron job (runs SQL every night)
- Option B: Third-party job scheduler (Firebase, AWS Lambda)
- Option C: Vercel serverless function + cron trigger

**Recommended:** Use Supabase pg_cron (built-in, no external dependency)

---

### TASK 10: Booking Reminder (1 hour before) ⏱️ 2 hours
**File:** scheduledNotifications.js

**What:** Final reminder 1 hour before walk

**Send to:**
- Sitter: "🚶 Walk starting soon! [PetName] at [Time]"
- Pet Parent: "Sitter [Name] arriving soon for [PetName]'s walk 🐾"

**Channels:** In-app + SMS (high priority)

---

### TASK 11: Weekly Earnings Summary ⏱️ 2 hours
**File:** New `src/weeklyReports.js` + Supabase scheduled function

**What:** Every Sunday 6 PM, send sitter summary of week's earnings

**Send to:**
- Sitter: "📊 Weekly Summary: [N] walks, Rs.[Total] earned, Rating: [⭐]"

**Channels:** Email + SMS

**Includes:**
- Number of walks completed
- Total earnings (85% commission)
- Average rating
- Comparison to previous week

---

### TASK 12: Rating Update Notification ⏱️ 30 minutes
**File:** `src/ReviewModal.js` - After review saved

**What:** When rating is posted, notify sitter of rating change

**Send to:**
- Sitter: "Your rating updated! [Old: 4.2⭐ → New: 4.5⭐]"

**Channels:** In-app + SMS

**Test:** Post review → Check sitter gets rating update notification

---

## 🟢 ADDITIONAL FEATURES (Optional)

### TASK 13: Referral Program UI ⏱️ 2-3 days
**Files:** New `src/ReferralProgram.js`, update `src/SitterEarningsDashboard.js`

**What:** Sitters generate codes, share, track bonuses

**Features:**
- Display unique referral code
- Share button (Copy/WhatsApp/SMS)
- Referral history (who signed up, status, bonus)
- Bonus redemption UI

**Database:** referrals table already migrated

---

### TASK 14: Sitter Availability Calendar ⏱️ 2 days
**Files:** New `src/SitterAvailabilityCalendar.js`, update `src/SitterEditProfile.js`

**What:** Sitters set available dates/times, parents see availability

**Features:**
- Calendar UI (date picker)
- Time slot selection
- Bulk availability (e.g., "Every Monday 9-12")
- Pet parents see "Available on: Sep 5, 7, 10"

**Database:** sitter_availability table already migrated

---

### TASK 15: Advanced Sitter Filters ⏱️ 1-2 days
**File:** `src/ExploreScreen.js` - Add filter UI

**What:** Filter sitters beyond GPS + service type

**Filters:**
- Rating (3+, 4+, 4.5+)
- Experience level (new, regular, top rated)
- Response time (<1hr, <4hrs)
- Languages
- Pet types handled

---

### TASK 16: Admin Analytics Dashboard ⏱️ 2-3 days
**File:** New `src/AdminAnalytics.js`, add tab to `src/AdminPanel.js`

**What:** KPIs and trends for admin visibility

**Charts:**
- Daily bookings (line chart)
- Monthly revenue (bar chart)
- User growth (chart)
- Completion rate %
- Cancellation rate by reason
- Top sitters by earnings

**Libraries:** Chart.js or Recharts

---

### TASK 17: Promo Code Management ⏱️ 1 day
**Files:** New `src/PromoCodeUI.js`, update `src/PaymentScreen.js`

**What:** Admin creates codes, customers apply discounts

**Features:**
- Admin: Create code, set discount %, expiry
- Customer: Apply code at checkout
- Auto-calculate discount
- Track usage statistics

**Database:** promo_codes table already migrated

---

## 📊 BUILD ROADMAP

### Phase 1: This Week (Tier 2 - 4-5 hours)
```
[ ] Task 1: Walk Starts Notification (1-2h)
[ ] Task 2: Walk Completes Notification (1-2h)
[ ] Task 3: Sitter Rejected Notification (0.5h)
[ ] Task 4: Sitter Suspended Notification (0.5h)
[ ] Task 5: Top Sitter Badge Notification (0.5h)
[ ] Task 6: Dispute Filed Notification (1h)
[ ] Task 7: Dispute Resolved Notification (0.5h)
TOTAL: ~6-7 hours → Deploy after this
```

### Phase 2: Next Week (Tier 3 + Enhancements - 10-12 hours)
```
[ ] Task 8: Heat Advisory Alert (1h)
[ ] Task 9: 12-hour Booking Reminder (2-3h)
[ ] Task 10: 1-hour Booking Reminder (2h)
[ ] Task 11: Weekly Earnings Summary (2h)
[ ] Task 12: Rating Update Notification (0.5h)
[ ] Task 13: Referral Program UI (2-3 days) - Optional
[ ] Task 14: Sitter Availability Calendar (2 days) - Optional
[ ] Task 15: Advanced Filters (1-2 days) - Optional
```

### Phase 3: Growth Features (2-3 weeks later)
```
[ ] Task 16: Admin Analytics Dashboard (2-3 days)
[ ] Task 17: Promo Code Management (1 day)
```

---

## ✅ BUILD SEQUENCE (Start Here)

**TODAY - Deploy Current Build (30 min):**
1. Fix any remaining compile errors
2. Deploy to production
3. Test 7 wired notifications work

**TOMORROW - Tier 2 Notifications (1 day):**
1. Start with Task 1 (Walk Starts) - simplest pattern
2. Then Task 2 (Walk Completes) - similar pattern
3. Then Tasks 3-7 (Admin notifications) - quick wins
4. Deploy mid-afternoon

**NEXT WEEK - Tier 3 + Enhancements (5-6 days):**
1. Scheduled jobs (reminders) - might need new infrastructure
2. Additional features based on priority
3. Deploy Friday

---

## 🎯 WHICH SHOULD I BUILD FIRST?

**If you want maximum impact:** Build Tier 2 (Tasks 1-7) this week
- These make the platform feel **alive** and **real-time**
- Directly impact engagement and retention
- All use existing infrastructure

**If you want quick wins:** Start with Tasks 3-5 (Admin notifications)
- Each ~30 minutes
- All in AdminPanel.js
- Can deploy as batch

**Recommended sequence:**
1. **TODAY:** Deploy current 7 notifications
2. **TOMORROW:** Wire Tasks 3, 4, 5 (admin notifications) - 1.5 hours
3. **THURSDAY:** Wire Tasks 1, 2, 6, 7 (walk + disputes) - 4-5 hours
4. **FRIDAY:** Deploy complete Tier 2 (all 7 tasks done)

**Result:** 30 notifications live, engagement 10x better, ready for launch 🚀

---

## 📝 NEXT INSTRUCTION

**Tell me which task you want to build, and I'll:**
1. Show you exactly where in the code to add it
2. Provide the complete notification code
3. Wire it up
4. Test it
5. Move to next task

**Pick one:** Task 1, 2, 3, 4, 5, 6, 7 OR all of Tier 2?

Or if you prefer, I can just start building them all systematically today!
