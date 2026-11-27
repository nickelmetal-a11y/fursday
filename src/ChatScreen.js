import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { choosePhoto } from './photoPicker';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

// Maps a schedule-card service code to its i18n key (the map itself can't
// call the translation hook — it's module scope, not component scope).
const SERVICE_NAME_KEYS = { walk30: 'chat_service_walk30', walk60: 'chat_service_walk60', boarding: 'chat_service_boarding', daycare: 'chat_service_daycare', dropin: 'chat_service_dropin', housesit: 'chat_service_housesit' };

// A chat "message" is an image if it's a URL we uploaded to storage, rather
// than freeform text — there's no separate photo_url column on messages.
const isImageMessage = (msg) => typeof msg === 'string' && /\/storage\/v1\/object\/public\/chat-photos\//.test(msg);

// Schedule-detail cards are also carried as plain text (no schema column for
// them either) — a JSON payload behind a sentinel prefix, same trick as images.
const SCHEDULE_PREFIX = 'FURSDAY_SCHEDULE::';
const parseScheduleMessage = (msg) => {
  if (typeof msg !== 'string' || !msg.startsWith(SCHEDULE_PREFIX)) return null;
  try { return JSON.parse(msg.slice(SCHEDULE_PREFIX.length)); } catch { return null; }
};
// Written when the other side accepts a proposal; carries the proposal's message id.
const ACCEPT_PREFIX = 'FURSDAY_SCHEDULE_OK::';
const parseAcceptMessage = (msg) => {
  if (typeof msg !== 'string' || !msg.startsWith(ACCEPT_PREFIX)) return null;
  try { return JSON.parse(msg.slice(ACCEPT_PREFIX.length)); } catch { return null; }
};
// '18:30' -> '6:30 PM', matching the booking time slots.
const toSlotLabel = (hhmm) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmm;
  const h = parseInt(m[1], 10);
  return ((h % 12) || 12) + ':' + m[2] + ' ' + (h >= 12 ? 'PM' : 'AM');
};

const compressImage = (file, maxPx = 1200) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxPx) { h = h * maxPx / w; w = maxPx; }
      if (h > maxPx) { w = w * maxPx / h; h = maxPx; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.8);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

export default function ChatScreen({ onBack, city, booking, userType }) {
  const { t: tr, lang } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);
  const bottomRef = useRef(null);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');

  const otherPartyName = userType === 'sitter'
    ? (booking?.parentName || tr('chat_defaultParentName'))
    : (booking?.sitterName || tr('chat_defaultSitterName'));

  const otherPartyPhone = booking?.otherPhone || '';

  const loadMessages = async () => {
    if (!booking?.id) { setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user ? user.id : null);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('booking_id', booking.id)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadMessages();
    if (!booking?.id) return;
    const channel = supabase
      .channel('messages-' + booking.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'booking_id=eq.' + booking.id }, payload => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [booking?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !booking?.id) return;
    const messageText = text;
    setText('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: sendError } = await supabase.from('messages').insert({
        booking_id: booking.id,
        sender_id: user ? user.id : null,
        sender_type: userType,
        message: messageText,
      });
      if (sendError) {
        console.error('Send message failed:', sendError);
        setText(messageText);
        alert(tr('chat_sendFailedAlert'));
        return;
      }

      // TIER 1: Send message notification to other party
      try {
        if (booking?.recipientUserId) {
          const { data: senderProfile } = await supabase.from('users').select('name').eq('id', user?.id).single();
          const senderName = senderProfile?.name || (userType === 'sitter' ? 'Your sitter' : 'Pet parent');
          const { notifyMessageReceived } = await import('./notificationService');
          await notifyMessageReceived(booking.recipientUserId, null, senderName, booking.id);
        }
      } catch(notifErr) { console.error('Message notification failed:', notifErr); }
    } catch(e) { console.log('Send error:', e); }
  };

  const openScheduleForm = () => {
    setProposedDate(booking?.date || new Date().toISOString().split('T')[0]);
    setProposedTime(booking?.time || '09:00');
    setShowScheduleForm(true);
  };

  const sendSchedule = async () => {
    if (!booking?.id || !proposedDate || !proposedTime) return;
    const payload = SCHEDULE_PREFIX + JSON.stringify({
      service: booking.service || null,
      date: proposedDate,
      time: proposedTime,
      price: booking.price || null,
    });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: sendError } = await supabase.from('messages').insert({
        booking_id: booking.id,
        sender_id: user ? user.id : null,
        sender_type: userType,
        message: payload,
      });
      if (sendError) { alert(tr('chat_scheduleFailedAlert') + sendError.message); return; }
      setShowScheduleForm(false);

      if (booking?.recipientUserId) {
        try {
          const { data: senderProfile } = await supabase.from('users').select('name').eq('id', user?.id).single();
          const { notifyScheduleProposed } = await import('./notificationService');
          await notifyScheduleProposed(booking.recipientUserId, senderProfile?.name || 'The other party', proposedDate, proposedTime);
        } catch (notifErr) { console.error('Schedule notification failed:', notifErr); }
      }
    } catch (err) {
      alert(tr('chat_scheduleFailedAlert') + (err.message || err));
    }
  };

  const sendPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !booking?.id) return;
    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const compressed = await compressImage(file);
      const path = `${booking.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('chat-photos').upload(path, compressed);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat-photos').getPublicUrl(path);
      const { error: sendError } = await supabase.from('messages').insert({
        booking_id: booking.id,
        sender_id: user ? user.id : null,
        sender_type: userType,
        message: publicUrl,
      });
      if (sendError) throw sendError;

      if (booking?.recipientUserId) {
        try {
          const { data: senderProfile } = await supabase.from('users').select('name').eq('id', user?.id).single();
          const { notifyMessageReceived } = await import('./notificationService');
          await notifyMessageReceived(booking.recipientUserId, null, senderProfile?.name || 'The other party', booking.id);
        } catch (notifErr) { console.error('Photo notification failed:', notifErr); }
      }
    } catch (err) {
      alert(tr('chat_photoFailedAlert') + (err.message || err));
    }
    setUploadingPhoto(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const quickReplies = userType === 'sitter'
    ? [tr('chat_qrOnMyWay'), tr('chat_qrLate'), tr('chat_qrWalkDone'), tr('chat_qrGate')]
    : [tr('chat_qrThanks'), tr('chat_qrWhatTime'), tr('chat_qrGateCode'), tr('chat_qrSeeYou')];

  const acceptedProposalIds = new Set(messages.map(m => parseAcceptMessage(m.message)?.proposalId).filter(Boolean));

  const acceptSchedule = async (m, schedule) => {
    const slot = toSlotLabel(schedule.time);
    const { error: updError } = await supabase.from('bookings').update({ booking_date: schedule.date, time_slot: slot }).eq('id', booking.id);
    if (updError) { alert(tr('chat_scheduleAcceptFailed') + updError.message); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error: msgError } = await supabase.from('messages').insert({
      booking_id: booking.id, sender_id: user ? user.id : null, sender_type: userType,
      message: ACCEPT_PREFIX + JSON.stringify({ proposalId: m.id, date: schedule.date, time: slot }),
    });
    if (msgError) console.error('Accept message failed:', msgError);
    if (booking?.recipientUserId) {
      try {
        const { createNotification } = await import('./notificationService');
        await createNotification(booking.recipientUserId, 'schedule_accepted', '✅ New time confirmed', schedule.date + ' ' + slot);
      } catch (notifErr) { console.error('Schedule accepted notification failed:', notifErr); }
    }
  };

  const iconBtn = { width:44, height:44, borderRadius:radius.pill, border:`1px solid ${color.line}`, background:color.surface, color:color.navy, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, padding:0 };
  const timeLabel = (iso) => new Date(iso).toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour:'2-digit', minute:'2-digit' });

  return (
    <div style={{ ...ui.page, height:'100vh', minHeight:0, display:'flex', flexDirection:'column' }}>
      <div style={{ ...ui.header, flexShrink:0 }}>
        <div onClick={onBack} role="button" tabIndex={0} aria-label={tr('common_back')}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBack && onBack(); } }}
          style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </div>
        <div style={{ width:40, height:40, borderRadius:radius.pill, background:color.navySoft, color:color.navy, display:'flex', alignItems:'center', justifyContent:'center', fontSize:font.lg, fontWeight:700, flexShrink:0 }}>
          {otherPartyName[0]}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:700, color:color.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{otherPartyName}</div>
          <div style={{ fontSize:font.sm, color:color.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{booking?.service || tr('chat_defaultServiceLabel')}</div>
        </div>
        {otherPartyPhone && (
          <a href={'tel:'+otherPartyPhone} aria-label={tr('chat_callAria', { name: otherPartyName })} style={{ ...iconBtn, width:40, height:40, borderRadius:radius.md, border:'none', background:color.tile }}>
            <Icon name="phone" size={19} />
          </a>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 8px' }}>
        {loading && (
          <div style={{ padding:'8px 0' }}>
            {[['flex-start', 180], ['flex-end', 140], ['flex-start', 220]].map(([side, w], i) => (
              <div key={i} style={{ display:'flex', justifyContent:side, marginBottom:10 }}><div style={{ width:w, height:40, borderRadius:radius.lg, background:color.tile }} /></div>
            ))}
            <div style={{ textAlign:'center', color:color.muted, fontSize:13, marginTop:8 }}>{tr('chat_loadingMessages')}</div>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ ...ui.card, textAlign:'center', padding:'28px 20px', marginTop:24 }}>
            <div style={{ ...ui.iconTile, margin:'0 auto 12px' }}><Icon name="message" /></div>
            <div style={{ fontSize:font.md, fontWeight:600, color:color.ink, marginBottom:4 }}>{tr('chat_noMessages')}</div>
            <div style={{ fontSize:13, color:color.muted }}>{tr('chat_sayHello', { name: otherPartyName })}</div>
          </div>
        )}
        {!loading && messages.map((m, i) => {
          const isMine = m.sender_id === currentUserId;
          const schedule = parseScheduleMessage(m.message);
          const accepted = parseAcceptMessage(m.message);
          const isImage = isImageMessage(m.message);
          if (accepted) return (
            <div key={m.id || i} style={{ display:'flex', justifyContent:'center', margin:'4px 0 12px' }}>
              <div style={{ ...ui.badge('success'), fontSize:font.sm, padding:'6px 12px' }}>
                <Icon name="check" size={14} strokeWidth={2.25} />{tr('chat_scheduleAccepted', { date: accepted.date, time: accepted.time })}
              </div>
            </div>
          );
          const ink = isMine ? color.surface : color.ink;
          return (
            <div key={m.id || i} style={{ display:'flex', justifyContent:isMine?'flex-end':'flex-start', marginBottom:8 }}>
              <div style={{ maxWidth:'78%', background:isMine ? color.navy : color.surface, border:isMine ? 'none' : `1px solid ${color.line}`, borderRadius:isMine?'18px 18px 4px 18px':'18px 18px 18px 4px', padding:isImage ? 4 : schedule ? 0 : '9px 13px', overflow:'hidden' }}>
                {schedule ? (
                  <div style={{ minWidth:220 }}>
                    <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:6, borderBottom:`1px solid ${isMine ? 'rgba(255,255,255,0.14)' : color.line}`, background:isMine ? 'transparent' : color.navySoft, color:isMine ? color.surface : color.navy }}>
                      <Icon name="calendar" size={15} />
                      <span style={{ fontSize:font.sm, fontWeight:700 }}>{tr('chat_proposedSchedule')}</span>
                    </div>
                    <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:6, fontSize:13, color:ink }}>
                      {schedule.service && <div style={{ fontWeight:600 }}>{SERVICE_NAME_KEYS[schedule.service] ? tr(SERVICE_NAME_KEYS[schedule.service]) : schedule.service}</div>}
                      {schedule.date && <div style={{ display:'flex', alignItems:'center', gap:6 }}><Icon name="calendar" size={14} style={{ opacity:0.7 }} />{schedule.date}</div>}
                      {schedule.time && <div style={{ display:'flex', alignItems:'center', gap:6 }}><Icon name="clock" size={14} style={{ opacity:0.7 }} />{schedule.time}</div>}
                      {schedule.price != null && <div style={{ fontWeight:700, fontVariantNumeric:'tabular-nums', color:isMine ? color.surface : color.navy }}>{tr('chat_priceLabel', { amount: Math.round(schedule.price/100) })}</div>}
                      {!isMine && m.id && (acceptedProposalIds.has(m.id)
                        ? <div style={{ marginTop:4, display:'flex', alignItems:'center', gap:6, fontSize:font.sm, fontWeight:600, color:color.success }}><Icon name="check" size={14} strokeWidth={2.25} />{tr('chat_scheduleAcceptedShort')}</div>
                        : <button onClick={() => acceptSchedule(m, schedule)}
                            style={{ ...ui.primaryButton, marginTop:4, width:'100%', minHeight:44, fontSize:font.md }}>
                            {tr('chat_acceptNewTime')}
                          </button>)}
                    </div>
                  </div>
                ) : isImage
                  ? <img src={m.message} alt={tr('chat_sharedPhotoAlt')} style={{ width:200, height:200, maxWidth:'100%', objectFit:'cover', borderRadius:14, display:'block' }} />
                  : <div style={{ fontSize:font.md, color:ink, lineHeight:1.45, whiteSpace:'pre-wrap', overflowWrap:'anywhere' }}>{m.message}</div>}
                <div style={{ fontSize:10, color:isMine ? 'rgba(255,255,255,0.65)' : color.faint, marginTop:schedule ? 0 : 3, padding:schedule ? '0 14px 8px' : isImage ? '4px 6px 2px' : 0, textAlign:'right' }}>
                  {timeLabel(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {showScheduleForm && (
        <div style={{ padding:'14px 16px', background:color.surface, borderTop:`1px solid ${color.line}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:700, color:color.ink, marginBottom:10 }}>
            <Icon name="calendar" size={16} color={color.navy} />{tr('chat_proposeSchedule')}
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <input type="date" value={proposedDate} onChange={e => setProposedDate(e.target.value)}
              style={{ ...ui.input, flex:1, minWidth:0, fontSize:14, padding:'10px 12px' }} />
            <input type="time" value={proposedTime} onChange={e => setProposedTime(e.target.value)}
              style={{ ...ui.input, flex:1, minWidth:0, fontSize:14, padding:'10px 12px' }} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowScheduleForm(false)} style={{ ...ui.secondaryButton, flex:1, minHeight:44, fontSize:14 }}>
              {tr('common_cancel')}
            </button>
            <button onClick={sendSchedule} disabled={!proposedDate || !proposedTime} style={{ ...ui.primaryButton, flex:1, minHeight:44, fontSize:14 }}>
              {tr('chat_sendProposal')}
            </button>
          </div>
        </div>
      )}

      <div style={{ padding:'8px 16px', display:'flex', gap:8, overflowX:'auto', flexShrink:0, background:color.bg }}>
        {quickReplies.map((q, i) => (
          <button key={i} onClick={() => setText(q)} style={{ ...ui.chip(false), flexShrink:0, whiteSpace:'nowrap', fontWeight:500 }}>
            {q}
          </button>
        ))}
      </div>

      <div style={{ padding:'10px 12px calc(10px + env(safe-area-inset-bottom))', display:'flex', alignItems:'center', gap:8, background:color.surface, borderTop:`1px solid ${color.line}`, flexShrink:0 }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={tr('chat_typePlaceholder')}
          style={{ ...ui.input, flex:1, minWidth:0, minHeight:44, borderRadius:radius.pill, background:color.bg, padding:'10px 16px', fontSize:15 }} />
        {(booking?.date || booking?.time || booking?.price != null) && (
          <button onClick={openScheduleForm} title={tr('chat_proposeSchedule')} aria-label={tr('chat_proposeSchedule')} style={iconBtn}>
            <Icon name="calendar" size={19} />
          </button>
        )}
        <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={sendPhoto} />
        <button onClick={() => choosePhoto(photoInputRef, sendPhoto)} disabled={uploadingPhoto} aria-label={tr('chat_attachPhoto')}
          style={{ ...iconBtn, cursor:uploadingPhoto?'not-allowed':'pointer', opacity:uploadingPhoto?0.5:1 }}>
          <Icon name="image" size={19} />
        </button>
        <button onClick={sendMessage} aria-label={tr('chat_send')}
          style={{ ...iconBtn, border:'none', background:color.navy, color:color.surface }}>
          <Icon name="send" size={18} />
        </button>
      </div>
    </div>
  );
}
