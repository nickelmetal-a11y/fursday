-- Referral system for user acquisition
create table if not exists referrals (
  id uuid default gen_random_uuid() primary key,
  referrer_id uuid not null references users(id) on delete cascade,
  referred_user_id uuid references users(id) on delete set null,
  referral_code text unique not null,
  status text default 'active', -- active, used, expired
  created_at timestamp default now(),
  used_at timestamp
);

create table if not exists referral_bonuses (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references users(id) on delete cascade,
  amount numeric(10,2) not null, -- Rs. amount
  type text not null, -- signup_bonus, referral_reward
  source_booking_id uuid references bookings(id) on delete set null, -- booking that triggered bonus
  status text default 'pending', -- pending, applied, withdrawn
  created_at timestamp default now(),
  applied_at timestamp
);

-- Create indexes
create index if not exists idx_referrals_referrer_id on referrals(referrer_id);
create index if not exists idx_referrals_referred_user_id on referrals(referred_user_id);
create index if not exists idx_referrals_code on referrals(referral_code);
create index if not exists idx_referral_bonuses_user_id on referral_bonuses(user_id);
create index if not exists idx_referral_bonuses_status on referral_bonuses(status);

-- Enable RLS
alter table referrals enable row level security;
alter table referral_bonuses enable row level security;

-- RLS Policies
drop policy if exists "Users can view their referrals" on referrals;
drop policy if exists "Users can create referrals" on referrals;
drop policy if exists "Admins can view all referrals" on referrals;

create policy "Users can view their referrals" on referrals for select using (
  referrer_id = auth.uid() OR referred_user_id = auth.uid()
);

create policy "Users can create referrals" on referrals for insert with check (
  referrer_id = auth.uid()
);

create policy "Admins can view all referrals" on referrals for select using (true);

-- Referral bonuses
drop policy if exists "Users can view their bonuses" on referral_bonuses;
create policy "Users can view their bonuses" on referral_bonuses for select using (
  user_id = auth.uid()
);

create policy "System can create bonuses" on referral_bonuses for insert with check (true);
