import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { color } from './theme';
import Icon from './ui/Icon';
import {
  A, Badge, ChipGroup, ConfirmDialog, DataTable, EmptyState, KpiTile, LoadMore, Notice, SearchBox, SectionHeader, Skeleton,
  StatusBadge, Toast, Toolbar, fmtDate, rs, usePaged,
} from './AdminUI';

const TYPE_LABEL = { referral_reward: 'Referrer reward', signup_bonus: 'Signup credit' };

// Referrals that someone actually used, and the credits they created
// (apply_referral_code, migration 035). Credits stay pending until an admin
// applies them after the new person's first completed booking.
export default function AdminReferrals({ onGoTab }) {
  const [referrals, setReferrals] = useState([]);
  const [bonuses, setBonuses] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState('pending');
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const flash = (text, tone = 'success') => { setToast({ text, tone }); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(async () => {
    const [{ data: r, error: rErr }, { data: b, error: bErr }, { data: u }] = await Promise.all([
      supabase.from('referrals').select('*').not('referred_user_id', 'is', null).order('created_at', { ascending: false }),
      supabase.from('referral_bonuses').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('id, name'),
    ]);
    setReferrals((r || []).filter(x => x.referred_user_id));
    setBonuses(b || []);
    setNames(Object.fromEntries((u || []).map(x => [x.id, x.name])));
    setLoadError(rErr || bErr ? (rErr || bErr).message : '');
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const nameOf = (id) => names[id] || (id ? String(id).slice(0, 8) + '…' : '—');
  const completedFor = useCompletedBookings(bonuses.map(b => b.user_id));

  const markApplied = async (bonus) => {
    setBusy(true);
    const { data, error } = await supabase.from('referral_bonuses').update({ status: 'applied', applied_at: new Date().toISOString() }).eq('id', bonus.id).select('id');
    setBusy(false);
    setConfirm(null);
    if (error) { flash('Could not update: ' + error.message, 'error'); return; }
    // An update that RLS silently blocks returns no rows and no error.
    if (!data || data.length === 0) { flash('The database did not save this. Admins need update access to referral_bonuses.', 'error'); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('admin_audit_logs').insert({ admin_id: user.id, action: 'referral_bonus_applied', resource_type: 'referral_bonuses', resource_id: bonus.id, reason: rs(bonus.amount) + ' ' + (TYPE_LABEL[bonus.type] || bonus.type) + ' for ' + nameOf(bonus.user_id), status: 'success' });
    try {
      const { createNotification } = await import('./notificationService');
      await createNotification(bonus.user_id, 'referral_bonus_applied', 'Referral credit added', 'Your ' + rs(bonus.amount) + ' Fursday referral credit has been applied.');
    } catch (e) { console.error('Referral notification failed:', e); }
    setBonuses(list => list.map(x => (x.id === bonus.id ? { ...x, status: 'applied', applied_at: new Date().toISOString() } : x)));
    flash(rs(bonus.amount) + ' credit applied for ' + nameOf(bonus.user_id));
  };

  const pending = bonuses.filter(b => b.status === 'pending');
  const q = query.trim().toLowerCase();
  const shownBonuses = bonuses.filter(b => (status === 'all' || b.status === status) && (!q || nameOf(b.user_id).toLowerCase().includes(q)));
  const shownReferrals = referrals.filter(r => !q || [nameOf(r.referrer_id), nameOf(r.referred_user_id), r.referral_code].some(v => String(v).toLowerCase().includes(q)));
  const pagedBonuses = usePaged(shownBonuses, 25, status + '|' + q);
  const pagedReferrals = usePaged(shownReferrals, 25, q);

  if (loading) return <Skeleton rows={5} label="Loading referrals..." />;

  return (
    <div style={A.stack(20)}>
      {toast && <Toast message={toast.text} tone={toast.tone} />}
      {loadError && <Notice tone="danger" icon="alert">Could not load everything: {loadError}</Notice>}
      <div style={A.grid(170)}>
        <KpiTile label="People referred" value={referrals.length} />
        <KpiTile label="Credits pending" value={pending.length} tone={pending.length ? 'warning' : undefined} />
        <KpiTile label="Pending value" value={rs(pending.reduce((a, b) => a + Number(b.amount || 0), 0))} />
        <KpiTile label="Applied so far" value={rs(bonuses.filter(b => b.status === 'applied').reduce((a, b) => a + Number(b.amount || 0), 0))} />
      </div>

      <Toolbar>
        <SearchBox label="Search referrals" value={query} onChange={setQuery} placeholder="Search a name or code" />
        {onGoTab && <button onClick={() => onGoTab('settings')} style={A.small}><Icon name="settings" size={14} />Change amounts</button>}
      </Toolbar>

      <section>
        <SectionHeader title="Credits" subtitle="Apply a credit after the new person's first completed booking, once you have given it to them." />
        <div style={{ marginBottom: 12 }}>
          <ChipGroup label="Filter credits by status" value={status} onChange={setStatus}
            options={[{ id: 'pending', label: 'Pending (' + pending.length + ')' }, { id: 'applied', label: 'Applied' }, { id: 'all', label: 'All' }]} />
        </div>
        {shownBonuses.length === 0 ? <EmptyState icon="gift" title={status === 'pending' ? 'No credits waiting' : 'No credits'} text="Credits appear when someone signs up with a referral code." /> : <>
          <DataTable label="Referral credits" rows={pagedBonuses.visible} columns={[
            { key: 'who', label: 'Person', render: b => <span style={{ fontWeight: 600 }}>{nameOf(b.user_id)}</span> },
            { key: 'type', label: 'Type', nowrap: true, render: b => TYPE_LABEL[b.type] || b.type },
            { key: 'amount', label: 'Amount', align: 'right', render: b => rs(b.amount) },
            { key: 'ready', label: 'Completed bookings', align: 'right', render: b => completedFor[b.user_id] ?? '—' },
            { key: 'created', label: 'Created', nowrap: true, render: b => fmtDate(b.created_at) },
            { key: 'status', label: 'Status', render: b => <StatusBadge status={b.status || 'pending'} /> },
            { key: 'action', label: '', render: b => (b.status === 'pending'
              ? <button onClick={() => setConfirm(b)} style={A.smallPrimary}><Icon name="check" size={14} />Mark applied</button>
              : <span style={{ fontSize: 12, color: color.muted }}>{b.applied_at ? fmtDate(b.applied_at) : ''}</span>) },
          ]} />
          <LoadMore paged={pagedBonuses} total={shownBonuses.length} />
        </>}
      </section>

      <section>
        <SectionHeader title="Referrals used" subtitle="Each row is one person who joined with someone's code." />
        {shownReferrals.length === 0 ? <EmptyState icon="users" title="No referrals yet" /> : <>
          <DataTable label="Referrals used" rows={pagedReferrals.visible} columns={[
            { key: 'referrer', label: 'Referred by', render: r => <span style={{ fontWeight: 600 }}>{nameOf(r.referrer_id)}</span> },
            { key: 'referred', label: 'New person', render: r => nameOf(r.referred_user_id) },
            { key: 'code', label: 'Code', nowrap: true, render: r => <Badge tone="neutral">{r.referral_code}</Badge> },
            { key: 'when', label: 'Joined', nowrap: true, render: r => fmtDate(r.used_at || r.created_at) },
          ]} />
          <LoadMore paged={pagedReferrals} total={shownReferrals.length} />
        </>}
      </section>

      {confirm && (
        <ConfirmDialog title={'Apply ' + rs(confirm.amount) + ' credit?'} confirmLabel="Yes, mark applied" busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => markApplied(confirm)}>
          {nameOf(confirm.user_id)} gets a notification that their {(TYPE_LABEL[confirm.type] || 'credit').toLowerCase()} has been applied. Do this once you have actually given it.
        </ConfirmDialog>
      )}
    </div>
  );
}

// Completed bookings per user, so the admin can see who has earned their credit.
function useCompletedBookings(userIds) {
  const [counts, setCounts] = useState({});
  const key = [...new Set(userIds)].sort().join(',');
  useEffect(() => {
    if (!key) return;
    let live = true;
    (async () => {
      const ids = key.split(',');
      const { data } = await supabase.from('bookings').select('pet_parent_id, status').in('pet_parent_id', ids);
      const c = Object.fromEntries(ids.map(id => [id, 0]));
      (data || []).forEach(b => { if (b.status === 'completed') c[b.pet_parent_id] = (c[b.pet_parent_id] || 0) + 1; });
      if (live) setCounts(c);
    })();
    return () => { live = false; };
  }, [key]);
  return counts;
}
