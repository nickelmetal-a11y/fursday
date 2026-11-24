-- Launch incentive: the first 20 sitters marked "Founding Sitter" by an admin
-- pay 0% commission (100% payout) instead of the standard flat 15%, until an
-- admin turns it back off. Manually managed on purpose, matching how
-- is_top_sitter already works — no auto-expiry logic, no counting/race
-- conditions to get right for a one-admin, twenty-sitter launch batch.
alter table public.sitter_profiles add column if not exists is_founding_sitter boolean not null default false;
