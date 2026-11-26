import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { A, Field, Notice, SectionHeader } from './AdminUI';

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
    // resource_id is a uuid column, so the audience goes in new_value.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('admin_audit_logs').insert({ admin_id: user.id, action: 'send_announcement', resource_type: 'notifications', resource_id: null, new_value: { audience, city_id: cityId || null }, reason: title.trim() + ' — ' + rows.length + ' people', status: 'success' });
    setSending(false);
    setMsg({ error: false, text: 'Sent to ' + rows.length + ' people.' });
    setTitle(''); setBody('');
  };

  const ready = title.trim().length >= 3 && body.trim().length >= 5 && recipients.length > 0;

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <section style={{ ...ui.card, flex: '1 1 360px', maxWidth: 620, ...A.stack(14) }}>
        <SectionHeader title="Send an announcement" subtitle="Appears in the app's notification bell. Use it for new features, holiday hours, weather warnings, or policy changes." />
        <div>
          <span style={ui.label}>Audience</span>
          <div role="radiogroup" aria-label="Audience" style={A.row(6)}>
            {AUDIENCES.map(a => (
              <button key={a.id} role="radio" aria-checked={audience === a.id} onClick={() => setAudience(a.id)} style={ui.chip(audience === a.id)}>{a.label}</button>
            ))}
          </div>
        </div>
        <Field label="City" htmlFor="broadcast-city">
          <select id="broadcast-city" aria-label="City" value={cityId} onChange={e => setCityId(e.target.value)} style={{ ...A.select, width: '100%' }}>
            <option value="">All cities</option>
            {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Title" htmlFor="broadcast-title" help={title.length + '/80'}>
          <input id="broadcast-title" aria-label="Title" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder="Title, e.g. Diwali week: extra sitters available" style={A.input} />
        </Field>
        <Field label="Message" htmlFor="broadcast-body" help={body.length + '/300'}>
          <textarea id="broadcast-body" aria-label="Message" value={body} onChange={e => setBody(e.target.value)} maxLength={300} rows={3} placeholder="Message (300 characters max)" style={A.textarea} />
        </Field>
        <div style={{ fontSize: font.md, color: color.text }}>Will reach <b>{recipients.length}</b> {recipients.length === 1 ? 'person' : 'people'}.</div>
        {msg && <Notice tone={msg.error ? 'danger' : 'success'} icon={msg.error ? 'alert' : 'check'}>{msg.text}</Notice>}
        {confirming ? (
          <div style={{ ...A.row(8), background: color.warningSoft, borderRadius: radius.md, padding: 12 }}>
            <span style={{ fontSize: font.md, fontWeight: 600, flex: '1 1 200px' }}>Send to {recipients.length} people? This can't be undone.</span>
            <button onClick={send} style={A.primary}>Yes, send</button>
            <button onClick={() => setConfirming(false)} style={A.secondary}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirming(true)} disabled={!ready || sending}
            style={{ ...A.primary, alignSelf: 'flex-start', ...(ready && !sending ? null : A.disabled) }}>
            <Icon name="send" size={18} />{sending ? 'Sending…' : 'Review and send'}
          </button>
        )}
      </section>

      <aside style={{ flex: '1 1 260px', maxWidth: 360, ...A.stack(8) }}>
        <div style={{ fontSize: font.xs, fontWeight: 600, color: color.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Preview</div>
        <div style={{ ...ui.card, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ ...ui.iconTile, width: 40, height: 40 }}><Icon name="megaphone" size={20} /></div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: font.md, fontWeight: 600, overflowWrap: 'anywhere' }}>{title.trim() || 'Your title'}</div>
            <div style={{ fontSize: font.sm, color: color.muted, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{body.trim() || 'Your message appears here.'}</div>
          </div>
        </div>
      </aside>
    </div>
  );
}
