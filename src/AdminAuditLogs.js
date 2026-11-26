import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { color, font } from './theme';
import Icon from './ui/Icon';
import { A, Badge, ChipGroup, DataTable, EmptyState, LoadMore, SearchBox, Skeleton, Toolbar, TONE, fmtDateTime, humanize, usePaged } from './AdminUI';

const ACTIONS = {
  approve_sitter: { label: 'Sitter Approved', icon: 'check' },
  reject_sitter: { label: 'Sitter Rejected', icon: 'close' },
  suspend_sitter: { label: 'Sitter Suspended', icon: 'pause' },
  reinstate_sitter: { label: 'Sitter Reinstated', icon: 'play' },
  request_sitter_changes: { label: 'Changes Requested', icon: 'edit' },
  toggle_top_sitter: { label: 'Top Sitter Badge', icon: 'star' },
  mark_payout_paid: { label: 'Payout Marked', icon: 'wallet' },
  admin_cancel_booking: { label: 'Booking Cancelled', icon: 'close' },
  admin_reassign_booking: { label: 'Booking Reassigned', icon: 'repeat' },
  booking_note: { label: 'Booking Note', icon: 'edit' },
  send_announcement: { label: 'Announcement Sent', icon: 'megaphone' },
  admin_sign_in: { label: 'Admin Sign-in', icon: 'key' },
  zone_created: { label: 'Zone Created', icon: 'map' },
  zone_updated: { label: 'Zone Updated', icon: 'map' },
  zone_opened: { label: 'Zone Opened', icon: 'map' },
  zone_closed: { label: 'Zone Closed', icon: 'map' },
  zone_deleted: { label: 'Zone Deleted', icon: 'trash' },
  referral_bonus_applied: { label: 'Referral Credit Applied', icon: 'gift' },
};
const actionOf = (a) => ACTIONS[a] || { label: humanize(a), icon: 'history' };

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [admins, setAdmins] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
      const rows = data || [];
      setLogs(rows);
      const ids = [...new Set(rows.map(r => r.admin_id).filter(Boolean))];
      if (ids.length) {
        const { data: u } = await supabase.from('users').select('id, name').in('id', ids);
        setAdmins(Object.fromEntries((u || []).map(x => [x.id, x.name])));
      }
      setLoading(false);
    })();
  }, []);

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort((a, b) => actionOf(a).label.localeCompare(actionOf(b).label));
  const q = query.trim().toLowerCase();
  const shown = logs.filter(l => (filterAction === 'all' || l.action === filterAction)
    && (status === 'all' || (status === 'success' ? l.status === 'success' : l.status !== 'success'))
    && (!q || [l.reason, l.error_message, l.resource_id, admins[l.admin_id]].filter(Boolean).some(v => String(v).toLowerCase().includes(q))));
  const paged = usePaged(shown, 50, [filterAction, status, q].join('|'));

  const columns = [
    { key: 'when', label: 'When', nowrap: true, render: l => <span style={A.num}>{fmtDateTime(l.created_at)}</span> },
    { key: 'action', label: 'Action', nowrap: true, render: l => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name={actionOf(l.action).icon} size={16} color={color.navy} /><span style={{ fontWeight: 600 }}>{actionOf(l.action).label}</span>
      </span>
    ) },
    { key: 'resource', label: 'Resource', nowrap: true, render: l => <span style={A.muted}>{humanize(l.resource_type)} {l.resource_id ? String(l.resource_id).substring(0, 8) + '…' : ''}</span> },
    { key: 'admin', label: 'Admin', render: l => admins[l.admin_id] || <span style={A.muted}>{l.admin_id ? String(l.admin_id).substring(0, 8) + '…' : '—'}</span> },
    { key: 'status', label: 'Status', render: l => <Badge tone={TONE[l.status] || 'warning'}>{humanize(l.status)}</Badge> },
    { key: 'details', label: 'Details', render: l => (
      <div style={{ minWidth: 200, fontSize: font.sm, lineHeight: 1.5 }}>
        {l.reason && <div style={{ color: color.text }}>{l.reason}</div>}
        {l.error_message && <div style={{ color: color.danger }}>{l.error_message}</div>}
        {!l.reason && !l.error_message && <span style={A.muted}>—</span>}
      </div>
    ) },
  ];

  return (
    <div>
      <Toolbar>
        <SearchBox label="Search audit log" value={query} onChange={setQuery} placeholder="Search details, admin or resource id" />
        <select aria-label="Filter by action" value={filterAction} onChange={e => setFilterAction(e.target.value)} style={A.select}>
          <option value="all">All Actions</option>
          {uniqueActions.map(a => <option key={a} value={a}>{actionOf(a).label}</option>)}
        </select>
        <ChipGroup label="Filter by result" value={status} onChange={setStatus} options={[{ id: 'all', label: 'All results' }, { id: 'success', label: 'Succeeded' }, { id: 'error', label: 'Failed' }]} />
      </Toolbar>

      {loading && <Skeleton rows={6} label="Loading audit logs..." />}
      {!loading && shown.length === 0 && <EmptyState icon="history" title="No audit logs found" text={logs.length ? 'Nothing matches these filters.' : 'Admin actions will be recorded here.'} />}
      {!loading && shown.length > 0 && (
        <>
          <DataTable label="Audit log" columns={columns} rows={paged.visible} />
          <LoadMore paged={paged} total={shown.length} />
        </>
      )}
    </div>
  );
}
