import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const ORANGE = '#FF6B35';
const LINKS_API = 'https://fursday.vercel.app/api/test-login-links';

export const whatsappMessage = (a) => [
  '🐾 Fursday test login',
  a.name + ' (' + (a.role === 'sitter' ? 'sitter' + (a.sitterStatus && a.sitterStatus !== 'active' ? ', ' + a.sitterStatus : '') : 'pet parent') + ')',
  '',
  'Tap this link on your phone to sign in. It works once and expires in about 1 hour:',
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
    <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Test logins</div>
          <div style={{ fontSize: 12, color: '#888' }}>One-time links for the TEST accounts only. Each works once and expires in about an hour.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {accounts && accounts.length > 0 && <button onClick={() => copy(all, 'all')} style={{ minHeight: 38, padding: '0 14px', borderRadius: 8, border: '1px solid #DDD', background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{copied === 'all' ? 'Copied ✓' : 'Copy all messages'}</button>}
          <button onClick={generate} disabled={busy} style={{ minHeight: 38, padding: '0 14px', borderRadius: 8, border: 'none', background: ORANGE, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? 'Creating links…' : accounts ? 'Make fresh links' : 'Make login links'}</button>
        </div>
      </div>
      {error && <div role="alert" style={{ marginTop: 10, fontSize: 13, color: '#A32D2D', background: '#FCEBEB', borderRadius: 8, padding: '8px 12px' }}>{error}</div>}
      {accounts && accounts.length === 0 && <div style={{ marginTop: 10, fontSize: 13, color: '#888' }}>No test accounts found.</div>}
      {accounts && accounts.map(a => (
        <div key={a.email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #F2F2F2', marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{a.name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{a.role === 'sitter' ? 'Sitter' + (a.sitterStatus ? ' · ' + a.sitterStatus : '') : 'Pet parent'} · {a.email}</div>
            {a.error && <div style={{ fontSize: 12, color: '#A32D2D' }}>{a.error}</div>}
          </div>
          {a.link && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => copy(whatsappMessage(a), a.email)} style={{ minHeight: 34, padding: '0 10px', borderRadius: 8, border: '1px solid #DDD', background: 'white', fontSize: 12, cursor: 'pointer' }}>{copied === a.email ? 'Copied ✓' : 'Copy message'}</button>
              <a href={'https://wa.me/?text=' + encodeURIComponent(whatsappMessage(a))} target="_blank" rel="noreferrer"
                style={{ minHeight: 34, padding: '0 10px', borderRadius: 8, background: '#25D366', color: 'white', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>WhatsApp</a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

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
    if (!window.confirm('Mark this deletion as done? Do this only after the personal data has been removed.')) return;
    const { error } = await supabase.from('account_deletion_requests').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', req.id);
    if (error) { setMsg('Could not update: ' + error.message); return; }
    setMsg('Deletion marked as completed');
    load();
  };

  const nameById = useMemo(() => Object.fromEntries(users.map(u => [u.id, u.name])), [users]);
  const filtered = users.filter(u => {
    const isSitter = !!sitterByUser[u.id];
    if (role === 'sitter' && !isSitter) return false;
    if (role === 'parent' && isSitter) return false;
    const q = query.trim().toLowerCase();
    return !q || (u.name || '').toLowerCase().includes(q) || (contacts[u.id]?.email || '').toLowerCase().includes(q);
  });

  if (loading) return <div style={{ color: '#888', fontSize: 14 }}>Loading people...</div>;

  const daysOpen = (iso) => Math.floor((Date.now() - new Date(iso)) / 86400000);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {msg && <div role="status" style={{ background: '#E8F5E9', color: '#2E7D32', borderRadius: 10, padding: '8px 12px', fontSize: 13 }}>{msg}</div>}

      <TestLogins />

      <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>Account deletion requests ({deletions.length})</div>
        {deletions.length === 0 && <div style={{ fontSize: 13, color: '#888' }}>No open requests.</div>}
        {deletions.map(d => {
          const age = daysOpen(d.requested_at);
          return (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid #F2F2F2', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{nameById[d.user_id] || d.user_id}</div>
                <div style={{ fontSize: 12, color: age >= 25 ? '#C62828' : '#888' }}>Requested {fmt(d.requested_at)} · {age} days ago{age >= 25 ? ' · due within 30 days' : ''}</div>
                {d.reason && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>“{d.reason}”</div>}
              </div>
              <button onClick={() => completeDeletion(d)} style={{ minHeight: 36, padding: '0 14px', borderRadius: 8, border: 'none', background: '#FCEBEB', color: '#A32D2D', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark deleted</button>
            </div>
          );
        })}
      </div>

      <div style={{ background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <input aria-label="Search people" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name"
            style={{ flex: 1, minWidth: 180, padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E0E0', fontSize: 14 }} />
          {['all', 'parent', 'sitter'].map(r => (
            <button key={r} onClick={() => setRole(r)} aria-pressed={role === r}
              style={{ minHeight: 40, padding: '0 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: role === r ? ORANGE : '#F0F0F0', color: role === r ? 'white' : '#555' }}>
              {r === 'all' ? 'Everyone' : r === 'parent' ? 'Pet parents' : 'Sitters'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{filtered.length} of {users.length} people</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#888', fontSize: 11, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 8px' }}>Name</th><th style={{ padding: '6px 8px' }}>Role</th><th style={{ padding: '6px 8px' }}>Joined</th><th style={{ padding: '6px 8px' }}>Bookings</th><th style={{ padding: '6px 8px' }}>Contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => {
                const sp = sitterByUser[u.id];
                const c = contacts[u.id];
                return (
                  <tr key={u.id} style={{ borderTop: '1px solid #F2F2F2' }}>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{u.name || '—'}</td>
                    <td style={{ padding: '8px' }}>{sp ? 'Sitter · ' + sp.status : 'Pet parent'}</td>
                    <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{fmt(u.created_at)}</td>
                    <td style={{ padding: '8px', fontVariantNumeric: 'tabular-nums' }}>{bookingCounts[u.id] || 0}</td>
                    <td style={{ padding: '8px' }}>
                      {c ? <span style={{ fontSize: 12 }}>{c.phone || 'no phone'} · {c.email || 'no email'}</span>
                        : <button onClick={() => showContact(u.id)} style={{ minHeight: 30, padding: '0 10px', borderRadius: 6, border: '1px solid #DDD', background: 'white', fontSize: 12, cursor: 'pointer' }}>Show</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
