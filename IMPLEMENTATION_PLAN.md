# Fursday Development Plan - Critical & High Priority Features

**Session Start:** 2026-09-01
**Status:** In Progress
**Total EST:** 3-4 weeks

---

## CRITICAL BLOCKERS (Week 1)

### 1. ✅ Razorpay Payment Integration (DONE)
- Status: Payment screen built, integration complete
- Verify: End-to-end payment flow works
- TODO: Webhook handling for payment reconciliation
- Est: 2-3 hours

### 2. 🟡 Notification Trigger Integration (IN PROGRESS)
- Status: **DONE (Infrastructure)** - notificationService.js rewritten with email & SMS
- Email service created: emailService.js (SendGrid integration)
- SMS service created: smsService.js (MSG91 integration)
- ✅ Updated notificationService.js with:
  - [ ] notifyBookingConfirmed() - sends in-app, email, SMS
  - [ ] notifyReviewReceived() - sends in-app + email
  - [ ] notifyMessageReceived() - sends in-app
  - [ ] notifyWalkProofReceived() - sends in-app + email + SMS
  - [ ] notifyBookingCancelled() - sends in-app + email
  - [ ] notifyPayoutMarked() - sends in-app + email + SMS
- **STILL TODO - Wire-up:**
  - [ ] PaymentScreen.js → Call notifyBookingConfirmed() after payment success
  - [ ] ReviewModal.js → Call notifyReviewReceived() after review submit
  - [ ] ChatScreen.js → Call notifyMessageReceived() on new message
  - [ ] PhotoUploadModal.js → Call notifyWalkProofReceived() on photo upload
  - [ ] BookingFlow.js/CancellationPolicyModal.js → Call notifyBookingCancelled() on cancellation
  - [ ] AdminPanel.js → Call notifyPayoutMarked() when payout marked paid
  - [ ] Set env vars: REACT_APP_SENDGRID_KEY, REACT_APP_MSG91_AUTH_KEY
- Est: 2-3 hours (wire-up remaining)

### 3. ✅ Sitter Earnings Dashboard (DONE)
- Status: **COMPLETE**
- ✅ Created SitterEarningsDashboard.js component with:
  - Total lifetime earnings calculation (85% of completed bookings)
  - Monthly breakdown of earnings
  - Individual booking breakdown with dates & amounts
  - Payout status tracking
  - Time filters: All Time, This Month, This Week
  - Tips section for earning more
- ✅ Integrated into SitterDashboard.js:
  - Added 💰 Earnings tab in navigation
  - Shows when activeNav === 'earnings'
  - Navigates back to jobs tab
- Database queries: Fetches completed bookings and calculates 85% sitter share
- Est: DONE (1 day)

### 4. ❌ Auto-Refund Logic (PAYMENT CRITICAL)
- Status: Cancellation policy exists but refunds may not auto-execute
- Need:
  - [ ] When booking cancelled → Auto-calculate refund %
  - [ ] Auto-issue refund to: wallet first, then original payment method
  - [ ] Refund should subtract from payout owed to sitter (admin doesn't pay)
  - [ ] Audit trail of refund in audit logs
- Est: 1-2 days

---

## HIGH PRIORITY (Week 2)

### 5. ❌ Email Notifications
- Status: MISSING
- Setup:
  - [ ] Use SendGrid or AWS SES (SendGrid free tier: 100 emails/day)
  - [ ] Email templates: Booking confirmation, cancellation, review, payout, etc.
  - [ ] Hook into notification triggers above
  - [ ] Env variables: SENDGRID_API_KEY or SES credentials
- Est: 2 days

### 6. ❌ Referral Program
- Status: MISSING
- What it needs:
  - [ ] New table: `referrals` with columns: (referrer_id, referred_user_id, referral_code, bonus_amount, status, created_at)
  - [ ] New table: `referral_bonuses` with (user_id, amount, type: [signup_bonus|referral_reward], status: [pending|applied], created_at)
  - [ ] Generate unique code for each user (e.g., "REFER_ABC123")
  - [ ] Share UI button (generate link: `fursday.vercel.app?ref=ABC123`)
  - [ ] On signup with ref code → Link referrer
  - [ ] After first booking → Issue bonus to both users
  - [ ] Sitter can redeem bonus as cash (adds to next payout)
  - [ ] UI: Show referral code + earnings from referrals
- Est: 2-3 days

### 7. ❌ Advanced Search & Filters
- Status: PARTIAL (only service type + GPS)
- Add filters:
  - [ ] Rating (3+ stars, 4+ stars, 4.5+ stars)
  - [ ] Experience level (New, Regular, Top Rated)
  - [ ] Languages spoken (if tracked)
  - [ ] Pet types they handle (large dogs, puppies, seniors, etc.)
  - [ ] Response time (<1 hour, <4 hours, etc.)
  - [ ] Price range
- Est: 1-2 days

### 8. ❌ SMS Notifications via MSG91
- Status: MISSING (user asked to skip earlier)
- What it needs:
  - [ ] Integration with MSG91 API (already mentioned as "except MSG91")
  - [ ] Send: Booking reminders, walk in 30 mins alert, payout notification
  - [ ] Env var: MSG91_AUTH_KEY
  - [ ] Hook into same notification triggers
- Est: 1 day (can skip if user wants)

### 9. ❌ Sitter Availability Calendar
- Status: MISSING
- What it needs:
  - [ ] New table: `sitter_availability` with (sitter_id, date, time_slots, is_available, created_at)
  - [ ] In SitterEditProfile.js → Add calendar UI to set available dates/times
  - [ ] In ExploreScreen.js → Show availability badge or filter unavailable sitters
  - [ ] Pet parents see "Available on: Sep 5, Sep 7, Sep 10" before booking
- Est: 2 days

---

## MEDIUM PRIORITY (Week 3)

### 10. ❌ Analytics Dashboard (for admin)
- Status: MISSING
- Admin can see:
  - [ ] Daily bookings, weekly revenue, monthly trends
  - [ ] Active users (pet parents + sitters)
  - [ ] Completion rate % (completed vs cancelled)
  - [ ] Cancellation rate by reason
  - [ ] Dispute rate (disputes / total bookings)
  - [ ] Top sitters by earnings
  - [ ] Top cities by bookings
  - [ ] Charts: Booking volume over time, revenue trend, user growth
- Est: 2-3 days

### 11. ❌ Promotional Codes
- Status: MISSING
- What it needs:
  - [ ] Table: `promo_codes` with (code, discount_%, max_uses, expiry_date, status)
  - [ ] In PaymentScreen.js → Add promo code input field
  - [ ] Validate code, apply discount before payment
  - [ ] Admin panel → Create/edit/deactivate codes
  - [ ] Tracking: Which codes used by whom
- Est: 1-2 days

### 12. ❌ Sitter Performance Badges
- Status: MISSING
- Badges to earn:
  - [ ] ⚡ Lightning Response (accepts <2 mins, show at top)
  - [ ] ✅ Completion Star (100% completion rate)
  - [ ] 💖 Customer Love (4.8+ avg rating)
  - [ ] 🏆 Weekly Hero (most bookings this week)
  - [ ] Display on: profile, card, explore
- Est: 1-2 days

---

## BUILD ORDER (Start Here)

1. **Today (Day 1-2):** Notification triggers + Sitter Earnings Dashboard
2. **Day 3:** Auto-refund logic + Payment webhook
3. **Day 4-5:** Email notifications + Referral Program (part 1)
4. **Day 6-7:** Referral UI + Advanced Filters
5. **Day 8-9:** Sitter Availability Calendar
6. **Day 10-11:** Analytics Dashboard
7. **Day 12+:** Promotional Codes + Performance Badges

---

## KEY DECISIONS

**Email Service:** SendGrid (free 100/day, or AWS SES)
**SMS Service:** MSG91 (skip if user wants)
**Referral Bonus:** Rs. 100-250 per signup
**Refund Logic:** Auto-issue to wallet first, then bank transfer
**Analytics:** Google Charts or Chart.js for visualizations
**Performance Badges:** Calculated nightly via cron job

---

## Critical Files to Touch

- notificationService.js (integrate triggers)
- PaymentScreen.js (notification on success)
- ReviewModal.js (notify on review)
- BookingFlow.js (notify on booking)
- SitterDashboard.js (add earnings tab)
- ExploreScreen.js (add filters, availability)
- AdminPanel.js (add analytics tab)
- NEW: EarningsDashboard.js
- NEW: ReferralProgram.js
- NEW: emailService.js
- NEW: smsService.js (MSG91)
- NEW: Database migrations for referrals, availability, etc.

---

Ready to start? Let's build! 🚀
