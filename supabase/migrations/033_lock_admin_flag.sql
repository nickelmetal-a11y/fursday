-- CRITICAL: users could promote themselves to admin. The users table lets a
-- person update their own row (name/phone), and nothing stopped that update
-- from also setting is_admin = true. Verified 2026-11-26: a normal test
-- account's PATCH on its own is_admin was accepted (HTTP 200).
--
-- Fix: a trigger rejects any change to is_admin unless the caller is already
-- an admin. The SQL Editor and the service role run without auth.uid(), so
-- the owner can still grant admin with:
--   update public.users set is_admin = true where email = 'person@example.com';

create or replace function public.guard_is_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin is distinct from old.is_admin
     and auth.uid() is not null
     and not public.is_admin_user() then
    raise exception 'Only an admin can change admin access' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists users_guard_is_admin on public.users;
create trigger users_guard_is_admin before update of is_admin on public.users
  for each row execute function public.guard_is_admin();

-- New rows can't arrive pre-promoted either.
create or replace function public.guard_is_admin_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_admin and auth.uid() is not null and not public.is_admin_user() then
    new.is_admin := false;
  end if;
  return new;
end $$;

drop trigger if exists users_guard_is_admin_insert on public.users;
create trigger users_guard_is_admin_insert before insert on public.users
  for each row execute function public.guard_is_admin_insert();

-- Audit: list everyone who is an admin right now. Anyone unexpected here
-- should be reviewed before running anything else.
select id, name, email, is_admin from public.users where is_admin order by name;
