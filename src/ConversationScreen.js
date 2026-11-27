import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { createNotification } from './notificationService';

// Missing table (migration 038 not run yet) rather than an ordinary error.
const tableMissing = (err) => !!err && (err.code === '42P01' || err.code === 'PGRST205' || /conversation|schema cache|does not exist/i.test(err.message || ''));

// A parent asks a sitter something before booking. The parent opens it with
// `sitter`; the sitter opens it from the inbox with `conversation` and role="sitter".
export default function ConversationScreen({ sitter, onBack, city, conversation: initialConversation, role = 'parent', onBookNow }) {
  const { t: tr, lang } = useLanguage();
  const isSitter = role === 'sitter';
  const [conversation, setConversation] = useState(initialConversation || null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [me, setMe] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const otherName = isSitter
    ? (initialConversation?.parentName || initialConversation?.users?.name || tr('convo_defaultParent'))
    : (sitter?.name || tr('convo_defaultSitter'));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setMe(user || null);
      let conv = initialConversation || null;
      try {
        if (!conv && user && sitter?.id) {
          const { data, error } = await supabase.from('conversations').select('*').eq('pet_parent_id', user.id).eq('sitter_id', sitter.id).maybeSingle();
          if (error) { if (tableMissing(error)) { if (!cancelled) { setUnavailable(true); setLoading(false); } return; } throw error; }
          conv = data || null;
        }
        if (cancelled) return;
        setConversation(conv);
        if (conv?.id) {
          const { data, error } = await supabase.from('conversation_messages').select('*').eq('conversation_id', conv.id).order('created_at', { ascending: true });
          if (error && tableMissing(error)) { if (!cancelled) setUnavailable(true); }
          else if (!cancelled) setMessages(data || []);
          if (user) await supabase.from('conversation_messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', conv.id).neq('sender_id', user.id).is('read_at', null);
        }
      } catch (e) {
        console.error('Conversation load failed:', e?.message || e);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sitter?.id, initialConversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!conversation?.id) return;
    const channel = supabase
      .channel('conversation-' + conversation.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_messages', filter: 'conversation_id=eq.' + conversation.id }, payload => {
        setMessages(prev => (prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversation?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const recipientId = async (conv) => {
    if (isSitter) return conv.pet_parent_id;
    if (sitter?.user_id) return sitter.user_id;
    const { data } = await supabase.from('sitter_profiles').select('user_id').eq('id', conv.sitter_id).maybeSingle();
    return data?.user_id || null;
  };

  const send = async () => {
    const body = text.trim().slice(0, 2000);
    if (!body || !me || sending) return;
    setSending(true);
    try {
      let conv = conversation;
      if (!conv) {
        const { data, error } = await supabase.from('conversations').insert({ pet_parent_id: me.id, sitter_id: sitter.id }).select('*').single();
        if (error) { if (tableMissing(error)) { setUnavailable(true); setSending(false); return; } throw error; }
        conv = data;
        setConversation(conv);
      }
      const { data: msg, error } = await supabase.from('conversation_messages').insert({ conversation_id: conv.id, sender_id: me.id, body }).select('*').single();
      if (error) throw error;
      setText('');
      if (msg) setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conv.id);
      try {
        const to = await recipientId(conv);
        if (to) {
          const { data: mine } = await supabase.from('users').select('name').eq('id', me.id).maybeSingle();
          const from = mine?.name || (isSitter ? 'Your sitter' : 'A pet parent');
          await createNotification(to, 'conversation_message', 'New message from ' + from, body.length > 120 ? body.slice(0, 120) + '…' : body, 'conversation:' + conv.id);
        }
      } catch (notifErr) { console.error('Conversation notification failed:', notifErr); }
    } catch (e) {
      alert(tr('convo_sendFailed'));
    }
    setSending(false);
  };

  const timeLabel = (iso) => new Date(iso).toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' });
  const iconBtn = { width: 44, height: 44, borderRadius: radius.pill, border: 'none', background: color.navy, color: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 };

  return (
    <div style={{ ...ui.page, height: '100vh', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...ui.header, flexShrink: 0 }}>
        <button type="button" onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </button>
        <div style={{ width: 40, height: 40, borderRadius: radius.pill, background: color.navySoft, color: color.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: font.lg, fontWeight: 700, flexShrink: 0 }}>
          {(otherName || '?')[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ ...ui.headerTitle, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherName}</h1>
          <div style={{ fontSize: font.sm, color: color.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr(isSitter ? 'convo_subtitleSitter' : 'convo_subtitle')}</div>
        </div>
        {!isSitter && onBookNow && (
          <button type="button" onClick={() => onBookNow(sitter)} style={{ ...ui.primaryButton, minHeight: 40, padding: '0 14px', fontSize: 14, flexShrink: 0 }}>
            {tr('convo_bookNow')}
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {loading && <div role="status" style={{ textAlign: 'center', color: color.muted, fontSize: 13, marginTop: 24 }}>{tr('convo_loading')}</div>}
        {!loading && unavailable && (
          <div style={{ ...ui.card, textAlign: 'center', padding: '28px 20px', marginTop: 24 }}>
            <div style={{ ...ui.iconTile, margin: '0 auto 12px' }}><Icon name="message" /></div>
            <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 4 }}>{tr('convo_comingSoonTitle')}</div>
            <div style={{ fontSize: 13, color: color.muted, lineHeight: 1.5 }}>{tr('convo_comingSoonBody', { name: otherName })}</div>
            {!isSitter && onBookNow && (
              <button type="button" onClick={() => onBookNow(sitter)} style={{ ...ui.primaryButton, marginTop: 14, width: '100%' }}>{tr('convo_bookNow')}</button>
            )}
          </div>
        )}
        {!loading && !unavailable && messages.length === 0 && (
          <div style={{ ...ui.card, textAlign: 'center', padding: '28px 20px', marginTop: 24 }}>
            <div style={{ ...ui.iconTile, margin: '0 auto 12px' }}><Icon name="message" /></div>
            <div style={{ fontSize: 13, color: color.muted, lineHeight: 1.5 }}>{tr('convo_empty', { name: otherName })}</div>
          </div>
        )}
        {!loading && !unavailable && messages.map(m => {
          const mine = m.sender_id === me?.id;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{ maxWidth: '78%', background: mine ? color.navy : color.surface, border: mine ? 'none' : `1px solid ${color.line}`, borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '9px 13px' }}>
                <div style={{ fontSize: font.md, color: mine ? color.surface : color.ink, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</div>
                <div style={{ fontSize: 10, color: mine ? 'rgba(255,255,255,0.65)' : color.faint, marginTop: 3, textAlign: 'right' }}>{m.created_at ? timeLabel(m.created_at) : ''}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {!unavailable && (
        <div style={{ padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', gap: 8, background: color.surface, borderTop: `1px solid ${color.line}`, flexShrink: 0 }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(); }}
            placeholder={tr('convo_placeholder')} aria-label={tr('convo_placeholder')} maxLength={2000} disabled={loading}
            style={{ ...ui.input, flex: 1, minWidth: 0, minHeight: 44, borderRadius: radius.pill, background: color.bg, padding: '10px 16px' }} />
          <button type="button" onClick={send} disabled={!text.trim() || sending || loading} aria-label={tr('convo_send')}
            style={{ ...iconBtn, opacity: !text.trim() || sending ? 0.5 : 1 }}>
            <Icon name="send" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
