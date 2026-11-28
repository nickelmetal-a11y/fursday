# Fursday end-to-end scenarios

These scenarios follow a real user through the whole app, not one screen at a time. Each one mounts `<App/>` (or `AdminApp`) on the in-memory database (`src/testing/fakeSupabase.js`). Money runs through the real `api/payments/[action].js` handler with a fake Razorpay behind it (`src/testing/fakePayments.js`). Each scenario signs in as the parent, then the sitter, then the admin, in turn.

Test files: `src/scenarios/e2e-*.scenario.test.js`. Each scenario asserts the correct behaviour, so a failing scenario is a bug.

## A. Parent booking journeys

| ID | Scenario | Expected |
|----|----------|----------|
| A1 | Home "Walk" tile → Explore → sitter → Book → service, day, time, pet → Request booking | Explore opens filtered to walks. The booking has `sitter_id` set, status `pending` and the full price. (Regression: on 2026-11-27 the tile opened checkout with no sitter and failed with "null sitter_id".) |
| A2 | Home "Boarding" tile → boarding host → 2 nights | The price equals `priceFor` (weekend surcharge, extra dog). The booking has `end_date`. |
| A3 | Promo banner "Book now" → choose a sitter → checkout | The code is already applied. The parent pays the discounted price. `sitter_payout_paise` stays at full price. |
| A4 | A visitor (signed out) taps Book on a profile, then signs in | Checkout resumes for the same sitter. |
| A5 | Bookings → "Book again" | Same sitter, service and pet, prefilled. |
| A6 | Weekly walk plan (Mon/Wed/Fri) | One series and N bookings, paid in one checkout. |
| A7 | Meet & greet | Free, with no payment step. |
| A8 | Sitter's day off; boarding host full | That day can't be picked. A full night is blocked. |
| A9 | Address in a closed zone | Booking is blocked and the waitlist is offered. |

## B. Nearby requests ("Anyone nearby")

| ID | Scenario | Expected |
|----|----------|----------|
| B1 | Parent sends a walk request | Wave 1 invites matching sitters within 5 km only. Paused, pending, wrong-service, wrong-city and day-off sitters are not invited. |
| B2 | Invited vs not-invited sitter opens Jobs | Only the invited sitter sees the request. |
| B3 | Paused sitter opens Jobs | Sees the "You're paused" notice and gets no invites. |
| B4 | Sitter offers a price → parent chooses it | Checkout is prefilled with the date, time and agreed price. The booking starts `confirmed` and is linked to the request. Other sitters see "Someone else got it". |
| B5 | No offers after 15 minutes | Wave 2 widens to 8 km, then wave 3 to 12 km. |
| B6 | Urgent mode, first sitter accepts | Booked straight away. |
| B7 | Request expires | Sitters see "Closed" and can't reply. |
| B8 | Parent cancels the request | Sitters see "Cancelled". |

## C. Payment confirmation

| ID | Scenario | Expected |
|----|----------|----------|
| C1 | Test account pays at booking (simulated) | `payment_status` is `authorized` and nothing is captured. The parent sees the money is held. |
| C2 | Real gateway (keys set) | The order amount equals the gross. A valid signature gives `authorized`. A bad signature is refused and the booking is unchanged. |
| C3 | Sitter accepts | Payment is captured. The payout is `on_hold` with `payout_release_at` = service end + 24h. The parent is notified. |
| C4 | Weekly plan, sitter accepts one visit | The whole paid group is captured. |
| C5 | Real user before Razorpay keys exist | "Pay after the sitter accepts" path. |
| C6 | Payment fails twice | First "Payment unsuccessful", then "Payment failed again". The booking is still payable. |

## D. Payment reversal (void / refund)

| ID | Scenario | Expected |
|----|----------|----------|
| D1 | Sitter declines | The authorization is voided and the parent gets everything back. |
| D2 | Sitter doesn't reply within 24h | The daily sweep voids it. |
| D3 | Parent cancels more than 72h ahead (flexible / moderate / strict) | The server works out the refund by policy tier. `refunded_amount_paise` is recorded and the sitter payout is reduced. |
| D4 | Parent cancels less than 24h ahead (moderate) | No refund. The sitter keeps the payout. |
| D5 | Sitter cancels after accepting | Full refund to the parent. |
| D6 | Admin cancels from the Bookings tab | Full refund. |
| D7 | Dispute open during the hold | The sweep does not release the payout. |
| D8 | Promo booking cancelled | The refund is based on what was actually paid. |

## E. Disbursement (payout)

| ID | Scenario | Expected |
|----|----------|----------|
| E1 | Service done; sweep runs before and after end + 24h | The payout stays `on_hold` before, then becomes `ready`. |
| E2 | Admin Payouts → Mark paid | Grouped by sitter, net of 15% (0% for Founding sitters). Status becomes `paid` and the sitter is notified with the net amount. |
| E3 | Sitter Earnings | On-hold, ready and paid totals are correct. The yearly statement matches. |
| E4 | Parent tips after the service | 100% goes to the sitter and is added to the payout. |
| E5 | Promo booking payout | Uses `sitter_payout_paise` (before the promo), never the gross. |
| E6 | Admin releases a hold early | Works for an admin. A non-admin is refused. |

## F. Sitter journey

| ID | Scenario | Expected |
|----|----------|----------|
| F1 | Sitter accepts from Jobs | The parent sees Confirmed. Chat works both ways. |
| F2 | Start with OTP → complete → photo report → reviews | The parent confirms the photos. Both sides can review. |
| F3 | Boarding check-in, daily update, check-out | The parent's stay timeline shows each step. |

## Not covered by these tests (needs real devices or keys)

- The database guard trigger refusing browser writes to money fields (SQL; checked on prod by REST).
- Real Razorpay checkout UI, SMS codes (Twilio), push (Firebase), and real email delivery.
