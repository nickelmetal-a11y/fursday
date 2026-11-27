import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { sitterScorecard } from './adminInsights';
import { logSitterApproved, logSitterRejected, logSitterSuspended, logSitterNeedsChanges, logTopSitterToggled } from './auditService';
import {
  A, Badge, StatusBadge, EmptyState, DataTable, SearchBox, Toolbar, usePaged, LoadMore, Drawer, Facts, Notice,
  SectionHeader, KpiTile, rsPaise, fmtDate, fmtDateTime, serviceLabel, humanize,
} from './AdminUI';

export const FOUNDING_LIMIT = 20;
export const formatAadhaar = (n) => String(n || '').replace(/(\d{4})(?=\d)/g, '$1 ');
// Outside the review queue, only the last 4 digits are shown.
export const maskAadhaar = (n) => {
  const d = String(n || '').replace(/\D/g, '');
  return d ? 'XXXX XXXX ' + d.slice(-4) : null;
};
// users.phone_verified_at for each sitter's account (migration 038). Before
// 038 the column is missing, so every phone reads as not verified, which is true.
export function usePhoneVerified(sitters) {
  const [map, setMap] = useState({});
  const ids = sitters.map(s => s.user_id).filter(Boolean).sort().join(',');
  useEffect(() => {
    if (!ids) return undefined;
    let live = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('users').select('id, phone_verified_at').in('id', ids.split(','));
        if (live && !error) setMap(Object.fromEntries((data || []).map(u => [u.id, u.phone_verified_at || null])));
      } catch { /* keep "not verified" */ }
    })();
    return () => { live = false; };
  }, [ids]);
  return (s) => s.users?.phone_verified_at || map[s.user_id] || null;
}

const PhoneBadge = ({ verifiedAt }) => (verifiedAt
  ? <Badge tone="success" icon="check">Phone verified</Badge>
  : <Badge tone="warning" icon="alert">Phone not verified</Badge>);

const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));

const notifyUser = async (fn) => {
  try { await fn(await import('./notificationService')); } catch (e) { console.error('Notification failed:', e); }
};

// Everything an admin can do to a sitter. Each action writes the change,
// logs it to admin_audit_logs, tells the sitter, then refreshes the panel.
export function makeSitterActions({ sitters, showMsg, reload }) {
  const currentAdmin = async () => (await supabase.auth.getUser()).data.user;
  const sitterUser = async (id, cols = 'users(id)') => (await supabase.from('sitter_profiles').select(cols).eq('id', id).single()).data;

  const approve = async (id) => {
    const user = await currentAdmin();
    if (!sitters.find(s => s.id === id)?.aadhaar_number) { showMsg('Aadhaar is required before approval. Use "Needs changes" to ask for it.', 'error'); return; }
    const now = new Date().toISOString();
    let { error } = await supabase.from('sitter_profiles').update({ status: 'active', aadhaar_verified: true, approved_at: now, aadhaar_verified_at: now }).eq('id', id);
    // Before migration 032 the two date columns don't exist yet; approve without them.
    if (error && /approved_at|aadhaar_verified_at|column/i.test(error.message || '')) {
      ({ error } = await supabase.from('sitter_profiles').update({ status: 'active', aadhaar_verified: true }).eq('id', id));
    }
    if (error) { showMsg('Could not approve: ' + error.message, 'error'); return; }
    if (user) await logSitterApproved(user.id, id);
    const data = await sitterUser(id, 'users(id, name)');
    if (data?.users) await notifyUser(n => n.createNotification(data.users.id, 'sitter_approved', '🎉 Account Approved!', 'You are now live and can start accepting bookings'));
    showMsg('Sitter approved ✓');
    reload();
  };

  const requestChanges = async (id) => {
    const notes = window.prompt('What does this sitter need to fix before re-review?');
    if (!notes) return;
    const user = await currentAdmin();
    const { error } = await supabase.from('sitter_profiles').update({ status: 'needs_changes', review_notes: notes }).eq('id', id);
    if (error) { showMsg('Could not update: ' + error.message, 'error'); return; }
    if (user) await logSitterNeedsChanges(user.id, id, notes);
    const data = await sitterUser(id);
    if (data?.users) await notifyUser(n => n.createNotification(data.users.id, 'sitter_needs_changes', '⚠️ Changes needed on your profile', notes));
    showMsg('Sent back for changes');
    reload();
  };

  const reject = async (id) => {
    const user = await currentAdmin();
    const { error } = await supabase.from('sitter_profiles').update({ status: 'rejected' }).eq('id', id);
    if (error) { showMsg('Could not reject: ' + error.message, 'error'); return; }
    if (user) await logSitterRejected(user.id, id);
    const data = await sitterUser(id);
    if (data?.users) {
      const { data: contact } = await supabase.rpc('get_user_contact', { target_id: data.users.id });
      await notifyUser(n => n.notifySitterRejected(data.users.id, contact?.[0]?.email, 'Application did not meet our standards. Please reapply with improvements.'));
    }
    showMsg('Sitter rejected');
    reload();
  };

  const toggleSuspend = async (id, currentStatus) => {
    const user = await currentAdmin();
    const next = currentStatus === 'suspended' ? 'active' : 'suspended';
    const { error } = await supabase.from('sitter_profiles').update({ status: next }).eq('id', id);
    if (error) { showMsg('Could not update: ' + error.message, 'error'); return; }
    if (user) await logSitterSuspended(user.id, id, next === 'suspended');
    if (next === 'suspended') {
      const data = await sitterUser(id);
      if (data?.users) {
        const { data: contact } = await supabase.rpc('get_user_contact', { target_id: data.users.id });
        await notifyUser(n => n.notifySitterSuspended(data.users.id, contact?.[0]?.email, contact?.[0]?.phone, 'Your account has been suspended. Please contact support for details.'));
      }
    }
    showMsg(next === 'suspended' ? 'Sitter suspended' : 'Sitter reinstated ✓');
    reload();
  };

  const toggleTop = async (id, current) => {
    const user = await currentAdmin();
    const { error } = await supabase.from('sitter_profiles').update({ is_top_sitter: !current }).eq('id', id);
    if (error) { showMsg('Could not update: ' + error.message, 'error'); return; }
    if (user) await logTopSitterToggled(user.id, id, !current);
    if (!current) {
      const data = await sitterUser(id);
      if (data?.users) {
        const { data: contact } = await supabase.rpc('get_user_contact', { target_id: data.users.id });
        await notifyUser(n => n.notifyTopSitterAwarded(data.users.id, contact?.[0]?.email, contact?.[0]?.phone));
      }
    }
    showMsg(current ? 'Top Sitter badge removed' : 'Top Sitter badge awarded');
    reload();
  };

  const toggleFounding = async (id, current) => {
    const { error } = await supabase.from('sitter_profiles').update({ is_founding_sitter: !current }).eq('id', id);
    if (error) { showMsg('Could not update: ' + error.message, 'error'); return; }
    showMsg(current ? 'Founding Sitter perk removed' : 'Founding Sitter perk granted — 0% commission');
    reload();
  };

  return { approve, requestChanges, reject, toggleSuspend, toggleTop, toggleFounding };
}

const Avatar = ({ sitter, size = 48 }) => (sitter.profile_photo_url
  ? <img src={sitter.profile_photo_url} alt={'Photo of ' + (sitter.users?.name || 'sitter')} style={{ width: size, height: size, borderRadius: radius.md, objectFit: 'cover', flexShrink: 0 }} />
  : <div style={{ ...ui.iconTile, width: size, height: size }}><Icon name="user" /></div>);

const chipStyle = (tone) => ({ ...ui.badge(tone), fontSize: font.sm, padding: '5px 10px', borderRadius: radius.sm });

// ── Pending review queue ─────────────────────────────────────────────────────
export function PendingQueue({ sitters, actions }) {
  const pending = sitters.filter(s => s.status === 'pending').sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  const phoneVerifiedAt = usePhoneVerified(pending);
  if (pending.length === 0) return <EmptyState icon="check" title="No pending applications" text="New sitter applications appear here for review." />;
  return (
    <div style={A.stack(12)}>
      {pending.map(s => {
        const waiting = s.created_at ? daysSince(s.created_at) : 0;
        return (
          <article key={s.id} style={{ ...ui.card, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <Avatar sitter={s} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: font.lg, fontWeight: 700 }}>{s.users?.name || 'Unknown'}</div>
                <div style={A.muted}>{[s.users?.phone, s.cities?.name].filter(Boolean).join(' · ')}</div>
                {s.users?.email && <div style={A.muted}>{s.users.email}</div>}
              </div>
              <div style={{ ...A.stack(4), alignItems: 'flex-end' }}>
                <StatusBadge status={s.status} />
                {phoneVerifiedAt(s) && <PhoneBadge verifiedAt={phoneVerifiedAt(s)} />}
                {waiting >= 2 && <Badge tone="danger" icon="clock">Waiting {waiting} days</Badge>}
              </div>
            </div>
            <div style={A.row(6)}>
              {s.aadhaar_number
                ? <span style={chipStyle('info')}><Icon name="shield" size={14} /> Aadhaar: {formatAadhaar(s.aadhaar_number)}</span>
                : <span style={chipStyle('danger')}><Icon name="alert" size={14} /> No Aadhaar submitted. Ask for changes before approving.</span>}
              {s.upi_id && <span style={chipStyle('success')}><Icon name="wallet" size={14} /> UPI: {s.upi_id}</span>}
              {!phoneVerifiedAt(s) && <span style={chipStyle('warning')}><Icon name="alert" size={14} /> Phone not verified yet. Approval still works; ask them to verify in Settings.</span>}
            </div>
            {s.bio && <div style={{ fontSize: font.md, color: color.text, lineHeight: 1.6, padding: '10px 12px', background: color.bg, borderRadius: radius.md }}>{s.bio}</div>}
            {s.sitter_services?.length > 0 && (
              <div style={A.row(6)}>
                {s.sitter_services.map((sv, i) => <Badge key={i} tone="navy">{serviceLabel(sv.service_type)} · {rsPaise(sv.price_paise)}</Badge>)}
              </div>
            )}
            {(s.base_area || s.base_pincode) && <div style={A.muted}>Works from {[s.base_area, s.base_pincode].filter(Boolean).join(' ')} · up to {s.service_radius_km || 5} km</div>}
            <div style={{ fontSize: font.sm, color: color.faint }}>Applied: {new Date(s.created_at).toLocaleDateString('en-IN')}</div>
            <div style={A.row(8)}>
              <button onClick={() => actions.approve(s.id)} disabled={!s.aadhaar_number} title={s.aadhaar_number ? '' : 'Aadhaar is required before approval'}
                style={{ ...A.primary, flex: 2, minWidth: 140, ...(s.aadhaar_number ? null : A.disabled) }}>
                <Icon name="check" size={18} />Approve
              </button>
              <button onClick={() => actions.requestChanges(s.id)} style={{ ...A.secondary, flex: 1, minWidth: 130 }}>Needs changes</button>
              <button onClick={() => actions.reject(s.id)} style={{ ...A.danger, flex: 1, minWidth: 100 }}>Reject</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

const STATUS_OPTIONS = ['all', 'active', 'pending', 'needs_changes', 'suspended', 'rejected', 'draft'];

// ── Sitter directory ─────────────────────────────────────────────────────────
export default function SitterDirectory({ sitters, bookings, actions }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [city, setCity] = useState('all');
  const [openId, setOpenId] = useState(null);

  const foundingCount = sitters.filter(s => s.is_founding_sitter).length;
  const cities = useMemo(() => [...new Set(sitters.map(s => s.cities?.name).filter(Boolean))].sort(), [sitters]);
  const cards = useMemo(() => Object.fromEntries(sitters.map(s => [s.id, sitterScorecard(s, bookings)])), [sitters, bookings]);

  const q = query.trim().toLowerCase();
  const filtered = sitters.filter(s => {
    if (status !== 'all' && s.status !== status) return false;
    if (city !== 'all' && s.cities?.name !== city) return false;
    return !q || [s.users?.name, s.users?.phone, s.users?.email, s.upi_id].filter(Boolean).some(v => v.toLowerCase().includes(q));
  });
  const paged = usePaged(filtered, 25, [q, status, city].join('|'));
  const open = sitters.find(s => s.id === openId) || null;
  const phoneVerifiedAt = usePhoneVerified(open ? [open] : []);
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  const columns = [
    { key: 'name', label: 'Sitter', render: s => (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 180 }}>
        <Avatar sitter={s} size={36} />
        <div style={{ minWidth: 0 }}>
          <div style={A.row(6)}>
            <button onClick={stop(() => setOpenId(s.id))} style={{ background: 'none', border: 'none', padding: 0, fontSize: font.md, fontWeight: 600, color: color.navy, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>{s.users?.name || 'Unknown'}</button>
            {s.is_top_sitter && <Badge tone="saffron" icon="star">Top</Badge>}
            {s.is_founding_sitter && <Badge tone="navy" icon="award">Founding</Badge>}
          </div>
          <div style={{ ...A.muted, fontSize: font.xs }}>{s.users?.phone || 'No phone'}</div>
        </div>
      </div>
    ) },
    { key: 'city', label: 'City', render: s => s.cities?.name || '—', nowrap: true },
    { key: 'status', label: 'Status', render: s => <StatusBadge status={s.status} /> },
    { key: 'done', label: 'Done', align: 'right', render: s => cards[s.id].completed },
    { key: 'rating', label: 'Rating', align: 'right', nowrap: true, render: s => (cards[s.id].rating ? cards[s.id].rating.toFixed(1) + ' (' + cards[s.id].reviews + ')' : '—') },
    { key: 'accepts', label: 'Accepts', align: 'right', render: s => (cards[s.id].acceptanceRate == null ? '—' : cards[s.id].acceptanceRate + '%') },
    { key: 'cancels', label: 'Cancels', align: 'right', render: s => cards[s.id].cancelRate + '%' },
    { key: 'flags', label: 'Flags', render: s => (cards[s.id].flags.length
      ? <div style={A.stack(4)}>{cards[s.id].flags.map(f => <Badge key={f} tone="danger" icon="alert">{f}</Badge>)}</div>
      : <span style={A.muted}>—</span>) },
    { key: 'actions', label: 'Actions', render: s => (
      <div style={{ ...A.row(6), flexWrap: 'nowrap' }}>
        {(s.status === 'pending' || s.status === 'needs_changes') && (
          <button onClick={stop(() => actions.approve(s.id))} disabled={!s.aadhaar_number} title={s.aadhaar_number ? '' : 'Aadhaar is required before approval'}
            style={{ ...A.smallPrimary, ...(s.aadhaar_number ? null : A.disabled) }}><Icon name="check" size={14} />Approve</button>
        )}
        {s.status === 'pending' && <button onClick={stop(() => actions.requestChanges(s.id))} style={A.small}>Needs changes</button>}
        {(s.status === 'active' || s.status === 'suspended') && (
          <button onClick={stop(() => actions.toggleSuspend(s.id, s.status))} style={s.status === 'suspended' ? A.small : A.smallDanger}>
            <Icon name={s.status === 'suspended' ? 'play' : 'pause'} size={14} />{s.status === 'suspended' ? 'Reinstate' : 'Suspend'}
          </button>
        )}
        <button onClick={stop(() => setOpenId(s.id))} style={A.small} aria-label={'Open ' + (s.users?.name || 'sitter')}>View</button>
      </div>
    ) },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Notice tone={foundingCount >= FOUNDING_LIMIT ? 'danger' : 'saffron'} icon="award">
          Founding Sitters (0% commission): {foundingCount}/{FOUNDING_LIMIT}{foundingCount >= FOUNDING_LIMIT ? ' — batch full' : ''}
        </Notice>
      </div>
      <Toolbar>
        <SearchBox label="Search sitters" value={query} onChange={setQuery} placeholder="Search name, phone, email or UPI" />
        <select aria-label="Filter sitters by status" value={status} onChange={e => setStatus(e.target.value)} style={A.select}>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s === 'all' ? 'All statuses' : humanize(s)}</option>)}
        </select>
        <select aria-label="Filter sitters by city" value={city} onChange={e => setCity(e.target.value)} style={A.select}>
          <option value="all">All cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Toolbar>
      {filtered.length === 0
        ? <EmptyState icon="users" title="No sitters match" text="Try a different search, status or city." />
        : <>
          <DataTable label="Sitters" columns={columns} rows={paged.visible} onRowClick={s => setOpenId(s.id)} />
          <LoadMore paged={paged} total={filtered.length} />
        </>}
      {open && <SitterDrawer sitter={open} phoneVerifiedAt={phoneVerifiedAt(open)} scorecard={cards[open.id]} bookings={bookings} actions={actions} foundingFull={foundingCount >= FOUNDING_LIMIT} onClose={() => setOpenId(null)} />}
    </div>
  );
}

const AUDIT_LABELS = { approve_sitter: 'Approved', reject_sitter: 'Rejected', suspend_sitter: 'Suspended', reinstate_sitter: 'Reinstated', toggle_top_sitter: 'Top Sitter badge changed', request_sitter_changes: 'Sent back for changes' };

function SitterDrawer({ sitter: s, phoneVerifiedAt, scorecard: sc, bookings, actions, foundingFull, onClose }) {
  const [history, setHistory] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const { data } = await supabase.from('admin_audit_logs').select('*').eq('resource_id', s.id).order('created_at', { ascending: false }).limit(20);
      if (live) setHistory(data || []);
    })();
    return () => { live = false; };
  }, [s.id, s.status, s.is_top_sitter, s.is_founding_sitter]);

  const recent = bookings.filter(b => b.sitter_id === s.id).slice(0, 5);
  const services = (s.sitter_services || []).filter(sv => sv.is_active !== false);

  return (
    <Drawer title={s.users?.name || 'Sitter'} subtitle={[s.cities?.name, 'Joined ' + fmtDate(s.created_at)].filter(Boolean).join(' · ')} onClose={onClose}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Avatar sitter={s} size={72} />
        <div style={A.stack(6)}>
          <div style={A.row(6)}>
            <StatusBadge status={s.status} />
            {s.is_top_sitter && <Badge tone="saffron" icon="star">Top Sitter</Badge>}
            {s.is_founding_sitter && <Badge tone="navy" icon="award">Founding (0% commission)</Badge>}
            {s.aadhaar_verified && <Badge tone="success" icon="shield">Aadhaar verified</Badge>}
            <PhoneBadge verifiedAt={phoneVerifiedAt} />
          </div>
          {s.headline && <div style={{ fontSize: font.md, color: color.text }}>{s.headline}</div>}
        </div>
      </div>

      <div style={A.row(8)}>
        {(s.status === 'pending' || s.status === 'needs_changes') && (
          <button onClick={() => actions.approve(s.id)} disabled={!s.aadhaar_number} style={{ ...A.smallPrimary, ...(s.aadhaar_number ? null : A.disabled) }}><Icon name="check" size={14} />Approve</button>
        )}
        {s.status === 'pending' && <button onClick={() => actions.requestChanges(s.id)} style={A.small}>Needs changes</button>}
        {(s.status === 'active' || s.status === 'suspended') && (
          <button onClick={() => actions.toggleSuspend(s.id, s.status)} style={s.status === 'suspended' ? A.small : A.smallDanger}>
            <Icon name={s.status === 'suspended' ? 'play' : 'pause'} size={14} />{s.status === 'suspended' ? 'Reinstate' : 'Suspend'}
          </button>
        )}
        <button onClick={() => actions.toggleFounding(s.id, s.is_founding_sitter)} disabled={!s.is_founding_sitter && foundingFull}
          style={{ ...A.small, ...(!s.is_founding_sitter && foundingFull ? A.disabled : null) }}>
          <Icon name="award" size={14} />{s.is_founding_sitter ? 'Remove Founding (0% comm.)' : 'Make Founding Sitter'}
        </button>
        <button onClick={() => actions.toggleTop(s.id, s.is_top_sitter)} style={A.small}>
          <Icon name="star" size={14} />{s.is_top_sitter ? 'Remove Top Badge' : 'Give Top Badge'}
        </button>
      </div>

      <section style={ui.card}>
        <SectionHeader title="Scorecard" />
        <div style={A.grid(110)}>
          <KpiTile label="Completed" value={sc.completed} />
          <KpiTile label="Rating" value={sc.rating ? sc.rating.toFixed(1) : '—'} sub={<span style={A.muted}>{sc.reviews} reviews</span>} />
          <KpiTile label="Accepts" value={sc.acceptanceRate == null ? '—' : sc.acceptanceRate + '%'} />
          <KpiTile label="Cancels" value={sc.cancelRate + '%'} tone={sc.cancelRate >= 20 ? 'danger' : undefined} />
        </div>
        {sc.flags.length > 0 && <div style={{ ...A.row(6), marginTop: 10 }}>{sc.flags.map(f => <Badge key={f} tone="danger" icon="alert">{f}</Badge>)}</div>}
      </section>

      <section style={ui.card}>
        <SectionHeader title="Profile" />
        <Facts items={[
          ['Phone', s.users?.phone || '—'], ['Phone verified', phoneVerifiedAt ? 'Yes, ' + fmtDate(phoneVerifiedAt) : 'No'],
          ['Email', s.users?.email || '—'], ['City', s.cities?.name || '—'],
          ['Approved', fmtDate(s.approved_at)], ['Languages', (s.languages || []).join(', ') || '—'], ['Max dogs', s.max_dogs || '—'],
        ]} />
        {s.bio && <p style={{ fontSize: font.md, color: color.text, lineHeight: 1.6, margin: '12px 0 0' }}>{s.bio}</p>}
        {!phoneVerifiedAt && <div style={{ marginTop: 12 }}><Notice tone="warning" icon="alert">This phone number has not been verified by SMS code. Ask the sitter to verify it in Settings.</Notice></div>}
        {s.review_notes && <div style={{ marginTop: 12 }}><Notice tone="warning" icon="alert">Last review note: {s.review_notes}</Notice></div>}
      </section>

      <section style={ui.card}>
        <SectionHeader title="Documents and payout" subtitle="Aadhaar is masked here; the full number shows only in the Pending review queue." />
        <Facts items={[
          ['Aadhaar', maskAadhaar(s.aadhaar_number) || 'Not submitted'],
          ['Aadhaar verified', s.aadhaar_verified ? 'Yes' + (s.aadhaar_verified_at ? ', ' + fmtDate(s.aadhaar_verified_at) : '') : 'No'],
          ['UPI', s.upi_id || 'Not set'],
        ]} />
      </section>

      <section style={ui.card}>
        <SectionHeader title="Services and coverage" />
        {services.length === 0 ? <div style={A.muted}>No services listed.</div> : (
          <div style={A.stack(0)}>
            {services.map((sv, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: i ? `1px solid ${color.line}` : 'none', fontSize: font.md }}>
                <span>{serviceLabel(sv.service_type)}</span><span style={{ fontWeight: 600, ...A.num }}>{rsPaise(sv.price_paise)}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ ...A.muted, marginTop: 10 }}>
          {s.base_area || s.base_pincode
            ? 'Base: ' + [s.base_area, s.base_pincode].filter(Boolean).join(' ') + ' · travels up to ' + (s.service_radius_km || 5) + ' km'
            : 'Base area not set yet' + (s.service_radius_km ? ' · radius ' + s.service_radius_km + ' km' : '')}
        </div>
      </section>

      <section style={ui.card}>
        <SectionHeader title="Recent bookings" />
        {recent.length === 0 ? <div style={A.muted}>No bookings yet.</div> : recent.map((b, i) => (
          <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '8px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: font.md, fontWeight: 600 }}>{b.booking_ref}</div>
              <div style={A.muted}>{serviceLabel(b.service_type)} · {b.booking_date || fmtDate(b.created_at)}</div>
            </div>
            <div style={{ ...A.row(8), flexWrap: 'nowrap' }}>
              <span style={{ ...A.num, fontWeight: 600 }}>{rsPaise(b.gross_amount_paise)}</span>
              <StatusBadge status={b.status} />
            </div>
          </div>
        ))}
      </section>

      <section style={ui.card}>
        <SectionHeader title="Admin history" />
        {history === null ? <div style={A.muted}>Loading history…</div> : history.length === 0 ? <div style={A.muted}>No admin actions yet.</div> : history.map((h, i) => (
          <div key={h.id} style={{ padding: '8px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
            <div style={{ fontSize: font.md, fontWeight: 600 }}>{AUDIT_LABELS[h.action] || humanize(h.action)}</div>
            <div style={A.muted}>{fmtDateTime(h.created_at)}{h.reason ? ' · ' + h.reason : ''}</div>
          </div>
        ))}
      </section>
    </Drawer>
  );
}
