-- Promo redemption becomes server-authoritative. Before this, BookingFlow.js
-- computed the discount in the browser, wrote the discounted price itself,
-- and inserted its own promo_usage row (policy: with check (true)) — so a
-- client could skip the usage row and reuse a code forever, max_uses was
-- never enforced, and times_used never moved. Now:
--   preview_promo()          read-only check used by the checkout UI
--   apply_promo_to_booking() validates again, discounts the booking, records
--                            usage and bumps times_used in one transaction
-- The client always inserts bookings at full price; only this function can
-- lower gross_amount_paise. sitter_payout_paise is never touched — the
-- discount comes out of the platform's margin, not the sitter's earnings.

create or replace function public.preview_promo(p_code text, p_amount_rupees numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  p promo_codes%rowtype;
  d numeric;
begin
  select * into p from promo_codes where code = upper(trim(p_code));
  if not found or p.status <> 'active' or now() < p.valid_from or now() > p.valid_until then
    return jsonb_build_object('error', 'invalid');
  end if;
  if p.max_uses is not null and coalesce(p.times_used, 0) >= p.max_uses then
    return jsonb_build_object('error', 'exhausted');
  end if;
  if auth.uid() is not null and exists (
    select 1 from promo_usage where promo_code_id = p.id and user_id = auth.uid()
  ) then
    return jsonb_build_object('error', 'already_used');
  end if;
  if coalesce(p.min_booking_amount, 0) > p_amount_rupees then
    return jsonb_build_object('error', 'min_amount', 'min_amount', p.min_booking_amount);
  end if;

  d := greatest(coalesce(p.discount_amount, 0), p_amount_rupees * coalesce(p.discount_percent, 0) / 100.0);
  if p.max_discount_amount is not null then
    d := least(d, p.max_discount_amount);
  end if;
  d := round(least(d, p_amount_rupees));

  return jsonb_build_object('promo_id', p.id, 'code', p.code, 'discount', d);
end;
$$;

create or replace function public.apply_promo_to_booking(p_booking_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b bookings%rowtype;
  p promo_codes%rowtype;
  result jsonb;
  d numeric;
begin
  select * into b from bookings
    where id = p_booking_id and pet_parent_id = auth.uid()
    for update;
  if not found then
    return jsonb_build_object('error', 'not_your_booking');
  end if;
  if b.payment_status = 'paid' then
    return jsonb_build_object('error', 'already_paid');
  end if;
  if exists (select 1 from promo_usage where booking_id = b.id) then
    return jsonb_build_object('error', 'already_applied');
  end if;

  -- Row lock so two simultaneous redemptions can't both slip under max_uses.
  select * into p from promo_codes where code = upper(trim(p_code)) for update;

  result := preview_promo(p_code, b.sitter_payout_paise / 100.0);
  if result ? 'error' then
    return result;
  end if;
  d := (result->>'discount')::numeric;

  update bookings
    set gross_amount_paise = greatest(0, b.sitter_payout_paise - (d * 100)::integer)
    where id = b.id;
  insert into promo_usage (promo_code_id, booking_id, user_id, discount_amount)
    values (p.id, b.id, auth.uid(), d);
  update promo_codes
    set times_used = coalesce(times_used, 0) + 1, updated_at = now()
    where id = p.id;

  return result;
end;
$$;

revoke all on function public.preview_promo(text, numeric) from public;
revoke all on function public.apply_promo_to_booking(uuid, text) from public;
grant execute on function public.preview_promo(text, numeric) to authenticated;
grant execute on function public.apply_promo_to_booking(uuid, text) to authenticated;

-- Only apply_promo_to_booking() (security definer) may write usage rows now.
drop policy if exists "System can create promo usage" on promo_usage;
