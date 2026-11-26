import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const ORANGE = '#FF6B35';
const AUDIENCES = [
  { id: 'sitters', label: 'All active sitters' },
  { id: 'parents', label: 'All pet parents' },
  { id: 'everyone', label: 'Everyone' },
];

// In-app announcements (they appear in each person's notification bell).
export default function AdminBroadcast() {
  const [users, setUsers] = useState([]);
  const [sitters, setSitters] = useState([]);
  const [cities, setCities] = useState([]);
  const [audience, setAudience] = useState('sitters');
  const [cityId, setCityId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: u }, { data: sp }, { data: c }] = await Promise.all([
        supabase.from('users').select('id, name, city_id'),
        supabase.from('sitter_profiles').select('user_id, status, city_id'),
        supabase.from('cities').select('id, name'),
      ]);
      setUsers(u || []); setSitters(sp || []); setCities(c || []);
    })();
  }, []);

  const sitterUserIds = new Set(sitters.map(s => s.user_id));
  const recipients = (() => {
    if (audience === 'sitters') return sitters.filter(s => s.status === 'active' && (!cityId || s.city_id === cityId)).map(s => s.user_id);
    const pool = users.filter(u => !cityId || u.city_id === cityId || sitters.find(s => s.user_id === u.id)?.city_id === cityId);
    return (audience === 'parents' ? pool.filter(u => !sitterUserIds.has(u.id)) : pool).map(u => u.id);
  })();

  const send = async () => {
    setConfirming(false);
    setSending(true); setMsg(null);
    const rows = recipients.map(id => ({ user_id: id, type: 'announcement', title: title.trim(), body: body.trim(), read: false }));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from('notifications').insert(rows.slice(i, i + 200));
      if (error) { setSending(false); setMsg({ error: true, text: 'Stopped after ' + i + ' of ' + rows.length + ': ' + error.message }); return; }
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('admin_audit_logs').insert({ admin_id: user.id, action: 'send_announcement', resource_type: 'notifications', resource_id: audience, reason: title.trim() + ' — ' + rows.length + ' people', status: 'success' });
    setSending(false);
    setMsg({ error: false, text: 'Sent to ' + rows.length + ' people.' });
    setTitle(''); setBody('');
  };

  const ready = title.trim().length >= 3 && body.trim().length >= 5 && recipients.length > 0;

  return (
    <div style={{ maxWidth: 560, background: 'white', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Send an announcement</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: -6 }}>Appears in the app's notification bell. Use it for new features, holiday hours, weather warnings, or policy changes.</div>
      <div role="radiogroup" aria-label="Audience" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {AUDIENCES.map(a => (
          <button key={a.id} role="radio" aria-checked={audience === a.id} onClick={() => setAudience(a.id)}
            style={{ minHeight: 38, padding: '0 14px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: audience === a.id ? ORANGE : '#F0F0F0', color: audience === a.id ? 'white' : '#555' }}>{a.label}</button>
        ))}
      </div>
      <select aria-label="City" value={cityId} onChange={e => setCityId(e.target.value)} style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E0E0', fontSize: 14 }}>
        <option value="">All cities</option>
        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input aria-label="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder="Title, e.g. Diwali week: extra sitters available"
        style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E0E0', fontSize: 14 }} />
      <textarea aria-label="Message" value={body} onChange={e => setBody(e.target.value)} maxLength={300} rows={3} placeholder="Message (300 characters max)"
        style={{ padding: '10px 12px', borderRadius: 8, border: '1.5px solid #E0E0E0', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
      <div style={{ fontSize: 12, color: '#555' }}>Will reach <b>{recipients.length}</b> {recipients.length === 1 ? 'person' : 'people'}.</div>
      {msg && <div role="status" style={{ fontSize: 13, borderRadius: 8, padding: '8px 12px', background: msg.error ? '#FCEBEB' : '#E8F5E9', color: msg.error ? '#A32D2D' : '#2E7D32' }}>{msg.text}</div>}
      {confirming ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Send to {recipients.length} people? This can't be undone.</span>
          <button onClick={send} style={{ minHeight: 38, padding: '0 14px', borderRadius: 8, border: 'none', background: ORANGE, color: 'white', fontWeight: 700, cursor: 'pointer' }}>Yes, send</button>
          <button onClick={() => setConfirming(false)} style={{ minHeight: 38, padding: '0 14px', borderRadius: 8, border: '1px solid #DDD', background: 'white', cursor: 'pointer' }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} disabled={!ready || sending}
          style={{ alignSelf: 'flex-start', minHeight: 40, padding: '0 18px', borderRadius: 8, border: 'none', background: ORANGE, color: 'white', fontSize: 14, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed', opacity: ready && !sending ? 1 : 0.5 }}>
          {sending ? 'Sending…' : 'Review and send'}
        </button>
      )}
    </div>
  );
}
