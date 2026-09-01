-- Dispute & complaint management system
create table if not exists disputes (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null unique references bookings(id) on delete cascade,
  reported_by uuid not null references users(id) on delete set null, -- sitter or pet parent
  dispute_type text not null, -- refund_request, quality_complaint, payment_issue, no_show, safety_concern, etc.
  title text not null,
  description text,
  evidence_urls text[], -- photo/video proof
  status text default 'open', -- open, in_review, resolved, closed
  resolution text, -- refund_full, refund_partial, no_refund, other
  refund_amount numeric(10,2),
  admin_notes text,
  assigned_to uuid references users(id) on delete set null, -- admin assigned to handle
  resolved_at timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Create index for efficient querying
create index if not exists idx_disputes_booking_id on disputes(booking_id);
create index if not exists idx_disputes_status on disputes(status);
create index if not exists idx_disputes_created_at on disputes(created_at desc);

-- Enable RLS
alter table disputes enable row level security;

-- RLS Policies
drop policy if exists "Users can view their disputes" on disputes;
drop policy if exists "Anyone can create disputes" on disputes;
drop policy if exists "Admins can manage all disputes" on disputes;

create policy "Users can view their disputes" on disputes for select using (
  reported_by = auth.uid() OR
  booking_id IN (select id from bookings where sitter_id = auth.uid() or pet_parent_id = auth.uid())
);
create policy "Anyone can create disputes" on disputes for insert with check (reported_by = auth.uid());
create policy "Admins can view all disputes" on disputes for select using (true); -- TODO: Add admin role check
