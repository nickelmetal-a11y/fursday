-- Sitter onboarding redesign: save-and-resume + a real "needs changes" status
-- distinct from the existing terminal "rejected", so an admin can send a
-- sitter back for fixes without the finality of a rejection.
alter table public.sitter_profiles
  add column if not exists onboarding_step integer not null default 0,
  add column if not exists review_notes text;

alter table public.sitter_profiles drop constraint if exists sitter_profiles_status_check;
alter table public.sitter_profiles add constraint sitter_profiles_status_check
  check (status = any (array['draft','pending','active','suspended','rejected','needs_changes']));
