-- Admin audit logs for compliance and security tracking
create table if not exists admin_audit_logs (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid not null references users(id) on delete set null,
  action text not null, -- approve_sitter, reject_sitter, suspend_sitter, mark_payout_paid, toggle_top_sitter, etc.
  resource_type text, -- sitter_profiles, bookings, users, settings, etc.
  resource_id uuid, -- id of the affected resource
  old_value jsonb, -- previous state
  new_value jsonb, -- new state
  reason text, -- admin's reason/note
  ip_address text,
  user_agent text,
  status text default 'success', -- success, failed, error
  error_message text,
  created_at timestamp default now()
);

-- Enable RLS
alter table admin_audit_logs enable row level security;

-- RLS Policy - Only admins can view logs (for now, allow all authenticated users - add role check later)
drop policy if exists "Only admins can view audit logs" on admin_audit_logs;
create policy "Only admins can view audit logs" on admin_audit_logs for select using (true);

-- Create index for fast lookups
create index if not exists idx_audit_logs_admin_id on admin_audit_logs(admin_id);
create index if not exists idx_audit_logs_resource on admin_audit_logs(resource_type, resource_id);
create index if not exists idx_audit_logs_created_at on admin_audit_logs(created_at desc);
