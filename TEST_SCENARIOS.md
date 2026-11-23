# 🧪 Fursday Test Scenarios (Unit • Integration • UAT)

**Created:** 2026-10-29
**Purpose:** One consolidated list. Detailed step-by-step UAT lives in `UAT_TEST_SCENARIOS.md`; the 86-case manual plan is in `E2E_TEST_PLAN.md`.

**Legend:** ✅ already covered by an existing test file | 🆕 gap, not tested yet

---

## 1. UNIT TESTS (Jest, one function/component, everything external mocked)

### 1.1 Region restriction — `geolocationService.js` 🆕
| ID | Scenario | Expected |
|----|----------|----------|
| UT-GEO-01 | IP lat/lng inside Delhi/NCR (28.6, 77.2) | `allowed: true` |
| UT-GEO-02 | IP in Gurgaon (28.46, 77.03), Noida (28.57, 77.32) | `allowed: true` |
| UT-GEO-03 | IP in Mumbai / Bangalore | `allowed: false` |
| UT-GEO-04 | Boundary values exactly 28.4 / 28.9 / 76.8 / 77.5 | `allowed: true` (inclusive) |
| UT-GEO-05 | Just outside boundary (28.39, 77.51) | `allowed: false` |
| UT-GEO-06 | ipapi.co returns non-200 | Falls back to GPS |
| UT-GEO-07 | ipapi.co throws / network down | Falls back to GPS |
| UT-GEO-08 | API returns missing/NaN lat/lng | Blocked, no crash |
| UT-GEO-09 | GPS fallback inside region | `allowed: true` |
| UT-GEO-10 | GPS permission denied | `allowed: false` + error |
| UT-GEO-11 | `navigator.geolocation` undefined | `allowed: false`, "not available" |
| UT-GEO-12 | IP lookup hangs (>5s) | Must time out. NOTE: `fetch({timeout})` is ignored by browsers, needs `AbortController` |
| UT-GEO-13 | Result returns the IP for the blocked screen | `ip` field present |

### 1.2 Cancellation & refund — `CancellationPolicyModal.js` 🆕
| ID | Scenario | Expected |
|----|----------|----------|
| UT-CAN-01 | 100 hours before booking | 100% refund |
| UT-CAN-02 | Exactly 72h | 100% (boundary) |
| UT-CAN-03 | 71h 59m | 75% |
| UT-CAN-04 | Exactly 24h | 75% (boundary) |
| UT-CAN-05 | 23h 59m | 0% |
| UT-CAN-06 | Booking already in the past | 0%, no crash |
| UT-CAN-07 | Refund amount = price × % (₹349 at 75% = ₹261.75) | Correct rounding |
| UT-CAN-08 | `price` null/undefined | Refund ₹0, no NaN |
| UT-CAN-09 | Cancel writes `refunds` row with % and amount | Insert called once |

### 1.3 Booking flow — `BookingFlow.js` 🆕
| ID | Scenario | Expected |
|----|----------|----------|
| UT-BKG-01 | Cannot proceed without service / date / time / pet | Next disabled |
| UT-BKG-02 | Aggression checkbox unchecked | Cannot confirm |
| UT-BKG-03 | Past date selected | Rejected |
| UT-BKG-04 | Price per service (Walk 30 = ₹349, etc.) | Matches price table |
| UT-BKG-05 | Hot-month date | Heat advisory shown |
| UT-BKG-06 | Cool-month date | No advisory |
| UT-BKG-07 | Dismiss heat advisory | Hidden, stays hidden |
| UT-BKG-08 | Repeat booking prefill | Sitter, service, pet pre-set; skips service step |
| UT-BKG-09 | Heat notification failure | Booking still succeeds (error swallowed) |

### 1.4 Reviews — `ReviewModal.js` 🆕
| ID | Scenario | Expected |
|----|----------|----------|
| UT-REV-01 | Submit with no star rating | Blocked |
| UT-REV-02 | Review text 9 chars | Blocked (min 10) |
| UT-REV-03 | Review text exactly 10 chars | Accepted |
| UT-REV-04 | 1–5 star values | Saved correctly |
| UT-REV-05 | Duplicate review for same booking | Blocked |

### 1.5 Notifications — `notificationService.js` ✅ (25+ tests)
| ID | Scenario | Status |
|----|----------|--------|
| UT-NOT-01 | All 25+ notify* functions exported and callable | ✅ |
| UT-NOT-02 | Missing email → skips email, still creates in-app | ✅ |
| UT-NOT-03 | Missing phone → skips SMS | ✅ |
| UT-NOT-04 | `getUserUnreadNotificationCount` returns 0 on error | 🆕 verify |
| UT-NOT-05 | Notification text contains pet/sitter names, no "undefined" | 🆕 |

### 1.6 Email — `emailService.js` ✅ (30+ tests)
| ID | Scenario | Status |
|----|----------|--------|
| UT-EML-01 | Missing `REACT_APP_SENDGRID_KEY` → graceful no-op | ✅ |
| UT-EML-02 | Null / invalid email address | ✅ |
| UT-EML-03 | SendGrid 4xx/5xx → no unhandled exception | ✅ |

### 1.7 SMS — `smsService.js` ✅ (28 tests)
| ID | Scenario | Status |
|----|----------|--------|
| UT-SMS-01 | Missing `MSG91` key → graceful no-op | ✅ |
| UT-SMS-02 | Invalid phone format (no +91, too short) | ✅ |
| UT-SMS-03 | Message length / special characters | 🆕 verify |

### 1.8 Settings — `SettingsScreen.js` ✅ (40+ tests)
| ID | Scenario | Status |
|----|----------|--------|
| UT-SET-01 | Name/phone validation | ✅ |
| UT-SET-02 | Notification toggles (push/email/SMS) | ✅ |
| UT-SET-03 | Language EN / HI / MR switch | ✅ |
| UT-SET-04 | Sign out clears session | ✅ |

### 1.9 Other components 🆕
| ID | Component | Scenario |
|----|-----------|----------|
| UT-PET-01 | `PetProfile` | Name and breed required; photo size limit |
| UT-PHO-01 | `PhotoUploadModal` | Accepts 1–3 photos, rejects 0 and 4+ |
| UT-PHO-02 | `PhotoUploadModal` | Rejects non-image file / oversized file |
| UT-FAV-01 | `ExploreScreen` | Heart toggles favorite on/off |
| UT-EXP-01 | `ExploreScreen` | Sitters sorted by GPS distance |
| UT-EXP-02 | `ExploreScreen` | Favorites tab shows only favorites |
| UT-EAR-01 | `SitterEarningsDashboard` | Lifetime = sum of bookings; monthly grouping correct |
| UT-EAR-02 | `SitterEarningsDashboard` | No bookings → ₹0, empty state |
| UT-RCP-01 | `ReceiptModal` | Shows service, date, sitter, pet, price |
| UT-RCP-02 | `ReceiptModal` | HTML download generates valid file |
| UT-AUD-01 | `auditService` | Every admin action writes a log row |
| UT-APP-01 | `App.js` | `regionRestricted` renders "Coming Soon" + IP + Check Again |
| UT-APP-02 | `App.js` | Map retry shown on GPS error |
| UT-APP-03 | `App.js` | No hardcoded city text (uses `CITY_CONFIG`) |

---

## 2. INTEGRATION TESTS (components + real/mocked Supabase, 2+ modules together)

### 2.1 Booking → Payment → Notification
| ID | Scenario | Expected |
|----|----------|----------|
| IT-01 | BookingFlow → PaymentScreen → Razorpay test mode success | `bookings` row created, status confirmed |
| IT-02 | Payment success → `notifyBookingConfirmed` | In-app + email to both parent and sitter |
| IT-03 | Payment fails / user closes Razorpay | No confirmed booking, `notifyPaymentFailed` sent |
| IT-04 | Double-click on Pay | Only one booking created |
| IT-05 | Booking for a sitter who became unavailable | `notifySitterUnavailable`, no charge |

### 2.2 Cancellation → Refund → Audit
| ID | Scenario | Expected |
|----|----------|----------|
| IT-06 | Cancel at 72h+ | `bookings` cancelled, `refunds` row 100%, notification sent |
| IT-07 | Cancel at 24–72h | Refund 75% recorded and shown in UI |
| IT-08 | Cancel at <24h | Refund 0%, sitter payout retained |
| IT-09 | Cancel an already-cancelled booking | Rejected |

### 2.3 Walk lifecycle
| ID | Scenario | Expected |
|----|----------|----------|
| IT-10 | Sitter accepts → starts → completes walk | Status transitions in order; `notifyWalkStarted` / `notifyWalkCompleted` |
| IT-11 | Photo upload → `walk_photo_reports` + storage | Parent gets `notifyWalkProofReceived` |
| IT-12 | Parent confirms photos | `parent_confirmed_photos = true` |
| IT-13 | Completed walk → Review → sitter `avg_rating` / `review_count` update | Values recalculated correctly |
| IT-14 | Completed walk → Receipt generation | Matches booking price/date |

### 2.4 Auth, region, security (RLS)
| ID | Scenario | Expected |
|----|----------|----------|
| IT-15 | Outside-region IP → login screen never shown | "Coming Soon" |
| IT-16 | Inside region, logged out → LoginScreen; after OTP → Home | Session persists on refresh |
| IT-17 | Parent A reads Parent B's bookings | Denied by RLS |
| IT-18 | Non-admin queries `admin_audit_logs` / `disputes` | Denied by RLS |
| IT-19 | Sitter reads another sitter's `sitter_pii` (Aadhaar/UPI) | Denied by RLS |
| IT-20 | Sitter reads own earnings only | Own rows only |
| IT-21 | All new tables in migrations 001–013 have RLS enabled | Verified via SQL |

### 2.5 Admin
| ID | Scenario | Expected |
|----|----------|----------|
| IT-22 | Approve sitter → profile live + `notifyTopSitterAwarded` / approval notice | Visible in Explore |
| IT-23 | Reject / suspend sitter | Hidden from Explore, `notifySitterRejected` / `Suspended` |
| IT-24 | Mark payout paid | `notifyPayoutMarked`; earnings dashboard updates |
| IT-25 | Resolve dispute with refund | `notifyDisputeResolved`; refund row written |
| IT-26 | Every admin action | Row in `admin_audit_logs` |

### 2.6 Messaging, favorites, notifications UI
| ID | Scenario | Expected |
|----|----------|----------|
| IT-27 | Send chat message → recipient sees it in real time | Realtime subscription works |
| IT-28 | New message → `notifyMessageReceived` | Bell count increments |
| IT-29 | Open NotificationCenter → mark read | Unread count decrements |
| IT-30 | Favorite sitter, reload app | Favorite persists (`favorites` table) |
| IT-31 | Broadcast request → multiple sitters respond | `broadcast_responses` rows, parent sees list |
| IT-32 | Report sitter / file dispute | `sitter_reports` / `disputes` row + admin visibility |

### 2.7 External services & scheduled jobs
| ID | Scenario | Expected |
|----|----------|----------|
| IT-33 | SendGrid key invalid | In-app still created; no crash |
| IT-34 | MSG91 key invalid | Same fallback |
| IT-35 | Supabase down / 500 | Friendly error, no white screen |
| IT-36 | 12h and 1h booking reminders (migration 013) fire | `notification_jobs` processed once, no duplicates |
| IT-37 | Referral code applied → bonus on first completed booking | `referral_bonuses` row + `notifyReferralBonusPaid` |
| IT-38 | Promo code applied at checkout (migration 012) | Discounted price charged |

---

## 3. UAT (real user journeys, pass/fail by a human)

### 3.1 Pet parent
| ID | Journey | Pass criteria |
|----|---------|---------------|
| UAT-P-01 | First visit in Delhi/NCR → sign up (OTP) → onboarding | Lands on Map First home |
| UAT-P-02 | Create pet profile with photo | Pet appears in booking dropdown |
| UAT-P-03 | Find sitter on map/list, view profile and reviews | Distance, rating, photos shown |
| UAT-P-04 | Book 30-min walk, pay with Razorpay test card | Confirmation + receipt, email arrives |
| UAT-P-05 | Book on a hot day | Heat advisory visible and understandable |
| UAT-P-06 | Chat with sitter before the walk | Messages delivered both ways |
| UAT-P-07 | View walk photos, confirm | Photos load, confirm works |
| UAT-P-08 | Leave 5-star review | Shows on sitter profile |
| UAT-P-09 | Cancel at each of 3 refund tiers | Correct % shown BEFORE confirming |
| UAT-P-10 | Re-book same sitter in 2 taps | Prefilled, quick |
| UAT-P-11 | Favorite a sitter, find in Favorites tab | Persisted |
| UAT-P-12 | Download and print receipt | Readable, correct |
| UAT-P-13 | Change settings (language, notifications), sign out and in | Preferences saved |
| UAT-P-14 | Report a sitter / file a dispute | Confirmation shown, admin sees it |
| UAT-P-15 | Open app from Mumbai (VPN) | "Coming Soon" with clear message |

### 3.2 Sitter
| ID | Journey | Pass criteria |
|----|---------|---------------|
| UAT-S-01 | Sign up as sitter, upload KYC, submit | "Pending approval" status |
| UAT-S-02 | Edit profile, add up to 3 portfolio photos | 4th photo refused |
| UAT-S-03 | Receive and accept a job | Parent notified |
| UAT-S-04 | Start walk → complete walk | Statuses update on both sides |
| UAT-S-05 | Upload 1–3 walk photos | Parent notified |
| UAT-S-06 | View earnings (lifetime, monthly, per booking) | Totals match bookings |
| UAT-S-07 | Receive payout notice | Email + SMS content correct |
| UAT-S-08 | Receive heat advisory / 12h and 1h reminders | Arrive at right times |

### 3.3 Admin
| ID | Journey | Pass criteria |
|----|---------|---------------|
| UAT-A-01 | Log in to admin panel (password gate) | Wrong password rejected |
| UAT-A-02 | Approve / reject / suspend sitter | Sitter notified |
| UAT-A-03 | Award Top Sitter badge | Badge visible in Explore |
| UAT-A-04 | Mark payout as paid | Sitter sees it |
| UAT-A-05 | Resolve a dispute with refund | Both parties notified |
| UAT-A-06 | Filter audit logs by action | Correct entries listed |

### 3.4 Non-functional (acceptance)
| ID | Scenario | Pass criteria |
|----|----------|---------------|
| UAT-N-01 | Page load on 4G phone | < 3s |
| UAT-N-02 | Map renders | < 2s |
| UAT-N-03 | Works on iPhone Safari and Android Chrome | No layout breaks |
| UAT-N-04 | Screen reader / keyboard navigation (WCAG AA) | Core flows usable |
| UAT-N-05 | Slow network / offline mid-booking | Clear error, no duplicate charge |
| UAT-N-06 | Browser console on every screen | No red errors |
| UAT-N-07 | Production build: view bundle source | No SendGrid/MSG91 keys visible (see risk below) |

---

## ✅ CancellationPolicyModal.js and BookingFlow.js now have real tests (2026-10-29)

- `src/CancellationPolicyModal.test.js` — new, 11 tests, all 9 `UT-CAN-*` scenarios pass, including the exact 72h/24h boundaries and the ₹349×75%=₹261.75 rounding check. Found a test-authoring trap worth remembering: "75% refund" and "No refund" render **twice** on screen (once in the static rules table, once in the live summary), so a plain `getByText` is ambiguous — scoped the query to the summary box instead.
- `src/BookingFlow.test.js` — new, 9 tests, all 9 `UT-BKG-*` scenarios pass.
- **Found and fixed a real, safety-relevant bug:** the Dog Aggression Disclosure checkbox could be bypassed entirely. `canContinue()` for the pet-selection step only checked `selectedPet`, never `aggressionConfirmed` — so clicking Continue with a pet selected (box unchecked) silently advanced to Review anyway. `getValidationError()` had the right message defined, it just never ran because `canContinue()` returned `true` first. Fixed: `canContinue()` now requires both.
- Full suite is now **9 suites, 173 tests, all passing.**

Still not covered: `ReviewModal.js` (unit), and all Integration/UAT scenarios (need a test Supabase project or a human).

## ✅ geolocationService.js and ChatScreen.js now have real tests (2026-10-29)

- `src/geolocationService.test.js` — new, 14 tests, all 13 `UT-GEO-*` scenarios pass. Found and fixed a real bug in the process: `fetch(url, {timeout: 5000})` does nothing in browsers (silently ignored option); `geolocationService.js` now uses a real `AbortController` timeout.
- `src/ChatScreen.test.js` — new, 13 tests (`UT-CHAT-01..09`) covering the sitter↔parent messaging screen from **both sides**: correct header name, quick-reply chips, sending as parent vs. as sitter (right `sender_type`, right insert, right `notifyMessageReceived(otherPartyId, ...)`), a live realtime message arriving via the `postgres_changes` subscription, and graceful handling of no booking / no phone number.
- Found and fixed a real jsdom gap while writing those: `Element.prototype.scrollIntoView` isn't implemented in jsdom, so **any** component that calls it (not just `ChatScreen.js`) crashes on mount under test. Polyfilled once in `src/setupTests.js` rather than per-test.
- Full suite is now **7 suites, 151 tests, all passing.**

Still not covered: `CancellationPolicyModal.js`, `BookingFlow.js`, `ReviewModal.js` (unit), and all Integration/UAT scenarios (need a test Supabase project or a human).

## ✅ Live tracker

All 139 scenarios + 5 bugs found while running the existing suite are tracked at:
**https://claude.ai/artifact/WvTWxx5EuLDxTZYzcXvZE4** (tap a status pill to update it)

## ✅ Bugs fixed (2026-10-29)

All 5 below are fixed. Full suite is now **124/124 passing, 5/5 suites green** (verified from a local, non-cloud-synced copy — see note below).

1. **`emailService.sendPhotosUploadedEmail`** — added as a real exported function (was a dead `console.log` stub living inside `notificationService.js`); `notificationService.js` now imports and calls the real one.
2. **`createNotification()` returned nothing** — now does `.insert(...).select().single()` and returns the row (or `null` on error).
3. **GPS timeout inconsistency in `App.js`** — the main-mount call now uses `10000`ms, matching the other two call sites (was `8000`).
4. **Settings icon (⚙️) "not found" in `App.test.js`** — this was a test gap, not an app bug: the test never mocked Supabase auth, so `App.js` stayed on `<LoginScreen/>` forever (`if (!user) return <LoginScreen/>`). Added a Supabase + `geolocationService` mock to `App.test.js`.
5. **`SettingsScreen.test.js` (4 failures)** — all test bugs, not app bugs: a loose `/Profile/i` and `/Notifications/i` regex also matched "Edit profile" and the notification toggle labels (fixed with exact-string matches); the language test checked `combobox[0]` (Notification Frequency) instead of `combobox[1]` (Language) and expected `"Hindi"` instead of the real uncontrolled-option value `"हिन्दी (Hindi)"`; the responsive/scroll tests used the wrong DOM depth and camelCase `minHeight` instead of the serialized `min-height`.

**A trap that cost real time while fixing #4:** `jest.mock(..., () => ({ fn: jest.fn().mockResolvedValue(...) }))` looked right but silently broke after the *first* test in the file — CRA's bundled Jest config sets `resetMocks: true`, which wipes a `jest.fn()`'s queued implementation before every test. Fix: use a plain function in the mock factory, not `jest.fn()`, when you need the same canned response for every test in the file.

Dashboard and `TEST_SCENARIOS.md` are both updated; see git-free changes in `src/emailService.js`, `src/notificationService.js`, `src/App.js`, `src/setupTests.js`, `src/App.test.js`, `src/SettingsScreen.test.js`.

## 🐛 Original findings, for reference (now fixed above)

Running the existing Jest suite (`notificationService.test.js`, `emailService.test.js`, `smsService.test.js`, `SettingsScreen.test.js`, `App.test.js`) gave **124 tests, 115 passed, 9 failed**:

1. **`emailService.sendPhotosUploadedEmail` does not exist.** `notificationService.js` expects it; `emailService.js` only defines `sendBookingConfirmationEmail`, `sendReviewReceivedEmail`, `sendPayoutNotificationEmail`, `sendCancellationEmail`.
2. **`createNotification()` never returns anything.** Every caller awaiting it gets `undefined`, even on success — no return statement in `notificationService.js`.
3. **GPS timeout is inconsistent in `App.js`**: 10000ms (line 156), 8000ms (line 228, the main mount call), 10000ms (line 453, "Try again" button).
4. **Settings icon (⚙️) isn't found in the bottom nav** in the test's render path (icon is defined at `App.js:570`, but not reached/rendered under test setup).
5. **`SettingsScreen.js`**: duplicate "Profile" and "Notifications" text (ambiguous selectors), a language select showing "immediate" instead of "Hindi", and a responsive/scroll container that reports no width and isn't found.

**Also found while fixing the test run itself:** `react-scripts test` run from this SynologyDrive-mounted folder hung for 15+ minutes doing nothing (0% CPU) — the folder is cloud-sync-virtualized (files report 0 on-disk blocks until fetched). Installing `node_modules` and running tests from a local, non-cloud folder took 6s install + 7.9s test run. Added a `beforeEach`/`afterEach` fetch mock to `src/setupTests.js` so no test hits the real network either way.

## ⚠️ Risks these tests should catch

1. **API keys in the browser bundle.** `REACT_APP_SENDGRID_KEY` / `REACT_APP_MSG91_AUTH_KEY` are shipped to every visitor. Covered by UAT-N-07. Fix: move email/SMS to a Supabase Edge Function or Vercel serverless function.
2. **Geolocation timeout is not real.** `fetch(url, { timeout: 5000 })` is ignored by browsers, so a hanging IP lookup could freeze the app on load. Covered by UT-GEO-12.
3. **Region check is client-side only.** Trivially bypassed with dev tools; fine for MVP but should not be treated as a security control.

## Suggested order
1. Write the 🆕 unit tests for `geolocationService`, `CancellationPolicyModal`, `BookingFlow` (highest risk: money and access).
2. Run integration tests IT-01 to IT-09 and IT-17 to IT-21 (payments, refunds, RLS).
3. Run UAT-P-04, P-09, S-03 to S-05 and A-04 on staging with test keys.
