-- Home-screen promo banner: flat Rs.100 credit, one redemption per user.
-- Enforcement of "one use per user" happens in the app (checks promo_usage
-- before allowing re-application), not via a DB constraint — consistent
-- with how the rest of booking pricing is already client-computed and
-- trusted at insert time (see BookingFlow.js).
insert into promo_codes (
  code, discount_percent, discount_amount, max_uses, min_booking_amount,
  max_discount_amount, valid_from, valid_until, status, description
) values (
  'WELCOME100', 0, 100, null, 0,
  100, now(), now() + interval '10 years', 'active',
  'Home screen banner promo: flat Rs.100 credit off any booking, one redemption per user'
)
on conflict (code) do nothing;
