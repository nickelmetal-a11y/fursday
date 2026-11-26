import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { color, font, ui } from './theme';
import Icon from './ui/Icon';
import { A, Badge, ChipGroup, ConfirmDialog, DataTable, EmptyState, LoadMore, Notice, SearchBox, SectionHeader, Skeleton, Toolbar, fmtDate, usePaged } from './AdminUI';

const LINKS_API = 'https://fursday.vercel.app/api/test-login-links';

export const whatsappMessage = (a) => [
  '🐾 Fursday test login',
  a.name + ' (' + (a.role === 'sitter' ? 'sitter' + (a.sitterStatus && a.sitterStatus !== 'active' ? ', ' + a.sitterStatus : '') : 'pet parent') + ')',
  '',
  'Tap this link on your phone to sign in. It works once and expires in 24 hours:',
  a.link,
].join('\n');

// Fresh one-time links for the fake @example.com test accounts only (see api/test-login-links.js).
function TestLogins() {
  const [accounts, setAccounts] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);

  const generate = async () => {
    setBusy(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(LINKS_API, { method: 'POST', headers: { Authorization: 'Bearer ' + (session?.access_token || '') } });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Request failed');
      setAccounts(body.accounts);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { setError('Copy failed; select the text instead.'); }
  };

  const all = (accounts || []).filter(a => a.link).map(whatsappMessage).join('\n\n────────\n\n');

  return (
    <section style={ui.card}>
      <SectionHeader title="Test logins"
        subtitle="One-time links for the TEST accounts only. Each works once and expires in 24 hours (Supabase Email OTP Expiration = 86400)."
        action={<>
          {accounts && accounts.length > 0 && <button onClick={() => copy(all, 'all')} style={A.small}>{copied === 'all' ? 'Copied ✓' : 'Copy all messages'}</button>}
          <button onClick={generate} disabled={busy} style={{ ...A.smallPrimary, ...(busy ? { opacity: 0.6 } : null) }}>{busy ? 'Creating links…' : accounts ? 'Make fresh links' : 'Make login links'}</button>
        </>} />
      {error && <Notice tone="danger" icon="alert">{error}</Notice>}
      {accounts && accounts.length === 0 && <div style={A.muted}>No test accounts found.</div>}
      {accounts && accounts.map((a, i) => (
        <div key={a.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: font.md, fontWeight: 600 }}>{a.name}</div>
            <div style={A.muted}>{a.role === 'sitter' ? 'Sitter' + (a.sitterStatus ? ' · ' + a.sitterStatus : '') : 'Pet parent'} · {a.email}</div>
            {a.error && <div style={{ fontSize: font.sm, color: color.danger }}>{a.error}</div>}
          </div>
          {a.link && (
            <div style={A.row(6)}>
              <button onClick={() => copy(whatsappMessage(a), a.email)} style={A.small}>{copied === a.email ? 'Copied ✓' : 'Copy message'}</button>
              <a href={'https://wa.me/?text=' + encodeURIComponent(whatsappMessage(a))} target="_blank" rel="noreferrer"
                style={{ ...A.smallPrimary, background: color.success, textDecoration: 'none' }}><Icon name="send" size={14} />WhatsApp</a>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

const SEED_API = 'https://fursday.vercel.app/api/seed-test-data';

// Fills the live database with TEST data (see api/seed-test-data.js): only
// @example.com accounts are ever created or changed. Safe to run again.
export function TestData() {
  const [busy, setBusy] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async (step) => {
    setBusy(step); setError(''); setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const r = await fetch(SEED_API, { method: 'POST', headers: { Authorization: 'Bearer ' + (session?.access_token || ''), 'Content-Type': 'application/json' }, body: JSON.stringify({ step }) });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Request failed');
      setResult(body);
    } catch (e) { setError(e.message); }
    setBusy(null);
  };

  return (
    <section style={ui.card}>
      <SectionHeader title="Test data"
        subtitle="Creates or completes TEST accounts only (@example.com). Running it again reuses what exists."
        action={<>
          <button onClick={() => run('pune')} disabled={!!busy} style={{ ...A.small, ...(busy ? { opacity: 0.6 } : null) }}>{busy === 'pune' ? 'Creating…' : 'Create Pune test accounts'}</button>
          <button onClick={() => run('profiles')} disabled={!!busy} style={{ ...A.smallPrimary, ...(busy ? { opacity: 0.6 } : null) }}>{busy === 'profiles' ? 'Filling profiles…' : 'Complete test sitter profiles'}</button>
        </>} />
      {error && <Notice tone="danger" icon="alert">{error}</Notice>}
      {result && (
        <div>
          {result.notes?.map(n => <Notice key={n} tone="warning" icon="info">{n}</Notice>)}
          {result.report.length === 0 && <div style={A.muted}>Nothing to do.</div>}
          {result.report.map((line, i) => (
            <div key={i} style={{ fontSize: font.sm, padding: '6px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>{line}</div>
          ))}
        </div>
      )}
    </section>
  );
}

const daysOpen = (iso) => Math.floor((Date.now() - new Date(iso)) / 86400000);

// People on the platform, plus the account deletion queue (Apple 5.1.1 / DPDP:
// a request must be acted on within 30 days, so the oldest is shown first).
export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [sitterByUser, setSitterByUser] = useState({});
  const [bookingCounts, setBookingCounts] = useState({});
  const [deletions, setDeletions] = useState([]);
  const [contacts, setContacts] = useState({});
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = async () => {
    setLoading(true);
    const [{ data: u }, { data: sp }, { data: bk }, { data: del }] = await Promise.all([
      supabase.from('users').select('id, name, created_at, city_id').order('created_at', { ascending: false }),
      supabase.from('sitter_profiles').select('id, user_id, status'),
      supabase.from('bookings').select('pet_parent_id, status'),
      supabase.from('account_deletion_requests').select('*').eq('status', 'requested').order('requested_at', { ascending: true }),
    ]);
    setUsers(u || []);
    setSitterByUser(Object.fromEntries((sp || []).map(s => [s.user_id, s])));
    const counts = {};
    (bk || []).forEach(b => { counts[b.pet_parent_id] = (counts[b.pet_parent_id] || 0) + 1; });
    setBookingCounts(counts);
    setDeletions(del || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const showContact = async (id) => {
    const { data } = await supabase.rpc('get_user_contact', { target_id: id });
    setContacts(c => ({ ...c, [id]: data?.[0] || { phone: null, email: null } }));
  };

  const completeDeletion = async (req) => {
    setConfirm(null);
    const { error } = await supabase.from('account_deletion_requests').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', req.id);
    if (error) { setMsg('Could not update: ' + error.message); return; }
    setMsg('Deletion marked as completed');
    load();
  };

  const nameById = useMemo(() => Object.fromEntries(users.map(u => [u.id, u.name])), [users]);
  const q = query.trim().toLowerCase();
  const filtered = users.filter(u => {
    const isSitter = !!sitterByUser[u.id];
    if (role === 'sitter' && !isSitter) return false;
    if (role === 'parent' && isSitter) return false;
    return !q || (u.name || '').toLowerCase().includes(q) || (contacts[u.id]?.email || '').toLowerCase().includes(q);
  });
  const paged = usePaged(filtered, 50, role + '|' + q);

  if (loading) return <Skeleton rows={6} label="Loading people..." />;

  const columns = [
    { key: 'name', label: 'Name', render: u => <span style={{ fontWeight: 600 }}>{u.name || '—'}</span> },
    { key: 'role', label: 'Role', nowrap: true, render: u => (sitterByUser[u.id] ? <span>{'Sitter · ' + sitterByUser[u.id].status}</span> : <span>Pet parent</span>) },
    { key: 'joined', label: 'Joined', nowrap: true, render: u => fmtDate(u.created_at) },
    { key: 'bookings', label: 'Bookings', align: 'right', render: u => bookingCounts[u.id] || 0 },
    { key: 'contact', label: 'Contact', render: u => {
      const c = contacts[u.id];
      return c ? <span style={{ fontSize: font.sm }}>{c.phone || 'no phone'} · {c.email || 'no email'}</span>
        : <button onClick={() => showContact(u.id)} style={A.small}><Icon name="eye" size={14} />Show</button>;
    } },
  ];

  return (
    <div style={A.stack(16)}>
      {msg && <Notice tone={msg.startsWith('Could not') ? 'danger' : 'success'} icon="check">{msg}</Notice>}

      <section style={ui.card}>
        <SectionHeader title={'Account deletion requests (' + deletions.length + ')'} subtitle="Must be completed within 30 days of the request. Oldest first." />
        {deletions.length === 0 && <div style={A.muted}>No open requests.</div>}
        {deletions.map((d, i) => {
          const age = daysOpen(d.requested_at);
          return (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...A.row(6), fontSize: font.md, fontWeight: 600 }}>{nameById[d.user_id] || d.user_id}{age >= 25 && <Badge tone="danger" icon="clock">Due soon</Badge>}</div>
                <div style={{ fontSize: font.sm, color: age >= 25 ? color.danger : color.muted }}>Requested {fmtDate(d.requested_at)} · {age} days ago{age >= 25 ? ' · due within 30 days' : ''}</div>
                {d.reason && <div style={{ fontSize: font.sm, color: color.text, marginTop: 2 }}>“{d.reason}”</div>}
              </div>
              <button onClick={() => setConfirm(d)} style={A.smallDanger}>Mark deleted</button>
            </div>
          );
        })}
      </section>

      <section>
        <SectionHeader title="People" />
        <Toolbar>
          <SearchBox label="Search people" value={query} onChange={setQuery} placeholder="Search by name" />
          <ChipGroup label="Filter by role" value={role} onChange={setRole}
            options={[{ id: 'all', label: 'Everyone' }, { id: 'parent', label: 'Pet parents' }, { id: 'sitter', label: 'Sitters' }]} />
        </Toolbar>
        {filtered.length === 0 ? <EmptyState icon="users" title="Nobody matches" /> : <>
          <DataTable label="People" columns={columns} rows={paged.visible} />
          <LoadMore paged={paged} total={filtered.length} />
        </>}
      </section>

      <TestLogins />
      <TestData />

      {confirm && (
        <ConfirmDialog title="Mark this deletion as done?" tone="danger" confirmLabel="Yes, mark deleted" onCancel={() => setConfirm(null)} onConfirm={() => completeDeletion(confirm)}>
          Do this only after {nameById[confirm.user_id] || 'this person'}'s personal data has been removed.
        </ConfirmDialog>
      )}
    </div>
  );
}
