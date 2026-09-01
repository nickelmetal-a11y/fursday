-- Cancellation policy tracking
alter table bookings add column if not exists cancellation_reason text;
alter table bookings add column if not exists cancelled_by text;
alter table bookings add column if not exists refund_percentage int default 100;
alter table bookings add column if not exists refund_amount numeric(10,2) default 0;
alter table bookings add column if not exists refund_processed boolean default false;
alter table bookings add column if not exists cancelled_at timestamp;

-- Refund tracking table
create table if not exists refunds (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null unique references bookings(id) on delete cascade,
  pet_parent_id uuid not null references users(id) on delete cascade,
  original_amount numeric(10,2) not null,
  refund_amount numeric(10,2) not null,
  refund_percentage int not null,
  reason text,
  status text default 'pending', -- pending, processed, failed, disputed
  processed_at timestamp,
  created_at timestamp default now()
);

-- Enable RLS
alter table refunds enable row level security;

-- RLS Policies
drop policy if exists "Anyone can view refunds" on refunds;
drop policy if exists "Pet parents can view their refunds" on refunds;

create policy "Anyone can view refunds" on refunds for select using (true);
create policy "Pet parents can view their refunds" on refunds for select using (pet_parent_id = auth.uid());
