import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';

const isImage = (m) => typeof m === 'string' && /\/storage\/v1\/object\/public\/chat-photos\//.test(m);
// Readable one-line preview of a chat message (photos and schedule cards are
// stored as special strings). Shared with the sitter dashboard.
export const messagePreview = (m, tr) => {
  if (!m) return tr('inbox_noMessages');
  if (isImage(m)) return tr('inbox_photo');
  if (m.startsWith('FURSDAY_SCHEDULE::') || m.startsWith('FURSDAY_SCHEDULE_OK::')) return tr('inbox_schedule');
  return m.length > 70 ? m.slice(0, 70) + '…' : m;
};

// Questions asked before any booking (migration 038). Returns [] until it runs.
async function loadConversations(role, user, sitterId) {
  try {
    const q = role === 'sitter'
      ? supabase.from('conversations').select('*, users(name)').eq('sitter_id', sitterId)
      : supabase.from('conversations').select('*, sitter_profiles(id, user_id, users(name))').eq('pet_parent_id', user.id);
    const { data: convs, error } = await q;
    if (error || !Array.isArray(convs) || !convs.length) return [];
    const { data: msgs } = await supabase.from('conversation_messages').select('conversation_id, body, created_at, sender_id, read_at').in('conversation_id', convs.map(c => c.id)).order('created_at', { ascending: false });
    const latest = {}, unread = {};
    (msgs || []).forEach(m => {
      if (!latest[m.conversation_id]) latest[m.conversation_id] = m;
      if (m.sender_id !== user.id && !m.read_at) unread[m.conversation_id] = (unread[m.conversation_id] || 0) + 1;
    });
    return convs.filter(c => latest[c.id]).map(c => ({
      kind: 'conversation', key: 'c-' + c.id, conversation: c, unread: unread[c.id] || 0,
      at: latest[c.id]?.created_at || c.last_message_at || c.created_at,
      preview: latest[c.id]?.body,
      name: role === 'sitter' ? c.users?.name : c.sitter_profiles?.users?.name,
    }));
  } catch (e) {
    return [];
  }
}

// One list of every conversation, newest first. Used by both roles: a parent
// sees their sitters, a sitter sees their pet parents. Booking chats open with
// onOpenChat(booking); questions before booking with onOpenConversation(conversation, name).
export default function InboxScreen({ role, onOpenChat, onOpenConversation }) {
  const { t: tr, lang } = useLanguage();
  const [threads, setThreads] = useState(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setThreads([]); return; }
      let bookings = [], sitterId = null;
      if (role === 'sitter') {
        const { data: sp } = await supabase.from('sitter_profiles').select('id').eq('user_id', user.id).maybeSingle();
        sitterId = sp?.id || null;
        if (sp) ({ data: bookings } = await supabase.from('bookings').select('*, users(name)').eq('sitter_id', sp.id));
      } else {
        ({ data: bookings } = await supabase.from('bookings').select('*, sitter_profiles(id, user_id, users(name))').eq('pet_parent_id', user.id));
      }
      bookings = bookings || [];
      let rows = [];
      if (bookings.length) {
        const { data: msgs } = await supabase.from('messages').select('booking_id, message, created_at, sender_id').in('booking_id', bookings.map(b => b.id)).order('created_at', { ascending: false });
        const latest = {};
        (msgs || []).forEach(m => { if (!latest[m.booking_id]) latest[m.booking_id] = m; });
        rows = bookings
          .filter(b => latest[b.id] || ['pending', 'confirmed', 'active'].includes(b.status))
          .map(b => ({
            kind: 'booking', key: 'b-' + b.id, booking: b, at: latest[b.id]?.created_at || b.created_at, preview: latest[b.id]?.message,
            name: role === 'sitter' ? b.users?.name : b.sitter_profiles?.users?.name,
          }));
      }
      const convs = role === 'sitter' && !sitterId ? [] : await loadConversations(role, user, sitterId);
      setThreads([...rows, ...convs].sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0)));
    })();
  }, [role]);

  const when = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? d.toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });
  };
  const open = (t) => {
    if (t.kind === 'booking') onOpenChat && onOpenChat(t.booking);
    else onOpenConversation && onOpenConversation(t.conversation, t.name);
  };

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      <div style={ui.header}><h1 style={ui.headerTitle}>{tr('inbox_title')}</h1></div>
      <div style={{ padding: 16 }}>
        {threads === null && [0, 1, 2].map(i => <div key={i} style={{ height: 68, borderRadius: radius.lg, background: color.surface, border: `1px solid ${color.line}`, marginBottom: 10, opacity: 0.6 }} />)}
        {threads && threads.length === 0 && (
          <div style={{ ...ui.card, textAlign: 'center', color: color.muted, fontSize: font.md, padding: 28 }}>
            <div style={{ ...ui.iconTile, margin: '0 auto 12px' }}><Icon name="message" /></div>
            {tr('inbox_empty')}
          </div>
        )}
        {threads && threads.length > 0 && (
          <div style={{ background: color.surface, borderRadius: radius.lg, border: `1px solid ${color.line}`, overflow: 'hidden' }}>
            {threads.map((t, i) => (
              <button key={t.key} type="button" onClick={() => open(t)}
                style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', borderTop: i ? `1px solid ${color.line}` : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: font.family }}>
                <div style={{ width: 44, height: 44, borderRadius: radius.pill, background: color.navySoft, color: color.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: font.lg, flexShrink: 0 }}>
                  {(t.name || '?')[0]}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: font.md, fontWeight: 600, color: color.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name || '—'}</span>
                    <span style={{ fontSize: font.xs, color: color.faint, flexShrink: 0 }}>{when(t.at)}</span>
                  </div>
                  <div style={{ fontSize: font.sm, color: t.unread ? color.ink : color.muted, fontWeight: t.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{messagePreview(t.preview, tr)}</div>
                  <div style={{ fontSize: font.xs, color: color.faint, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {t.kind === 'booking' ? <>{t.booking.booking_ref} · {t.booking.booking_date || ''}</> : <span style={ui.badge('info')}>{tr('inbox_beforeBooking')}</span>}
                    {t.unread > 0 && <span style={ui.badge('warning')}>{tr('inbox_unread', { n: t.unread })}</span>}
                  </div>
                </div>
                <Icon name="chevronRight" size={18} color={color.faint} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
