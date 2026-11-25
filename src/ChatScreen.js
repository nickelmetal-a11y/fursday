import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Phone, Image as ImageIcon, Calendar } from 'lucide-react';
import { supabase } from './supabase';
import { choosePhoto } from './photoPicker';
import { useLanguage } from './i18n';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

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
  const t = THEMES[city] || THEMES.Gurgaon;
  const { t: tr } = useLanguage();
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
  }, [booking?.id]);

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
          await notifyMessageReceived(booking.recipientUserId, null, senderName);
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
          await notifyMessageReceived(booking.recipientUserId, null, senderProfile?.name || 'The other party');
        } catch (notifErr) { console.error('Photo notification failed:', notifErr); }
      }
    } catch (err) {
      alert(tr('chat_photoFailedAlert') + (err.message || err));
    }
    setUploadingPhoto(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const quickReplies = userType === 'sitter'
    ? ['On my way!', 'Running 5 min late', 'Walk completed ✓', 'Is the gate open?']
    : ['Thank you!', 'What time will you arrive?', 'Gate code is...', 'See you soon'];

  return (
    <div style={{ maxWidth:390, margin:'0 auto', height:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', display:'flex', flexDirection:'column' }}>
      <div style={{ background:t.grad, padding:'48px 20px 16px', display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
        <div onClick={onBack} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <ArrowLeft size={18} color="white" />
        </div>
        <div style={{ width:38, height:38, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'white' }}>
          {otherPartyName[0]}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ color:'white', fontSize:15, fontWeight:700 }}>{otherPartyName}</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:11 }}>{booking?.service || tr('chat_defaultServiceLabel')}</div>
        </div>
        {otherPartyPhone && (
          <a href={'tel:'+otherPartyPhone} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <Phone size={16} color="white" />
          </a>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 8px' }}>
        {loading && (
          <div style={{ textAlign:'center', padding:40, color:'#888', fontSize:13 }}>{tr('chat_loadingMessages')}</div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>💬</div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>{tr('chat_noMessages')}</div>
            <div style={{ fontSize:12, color:'#888' }}>{tr('chat_sayHello', { name: otherPartyName })}</div>
          </div>
        )}
        {!loading && messages.map((m, i) => {
          const isMine = m.sender_id === currentUserId;
          const schedule = parseScheduleMessage(m.message);
          return (
            <div key={m.id || i} style={{ display:'flex', justifyContent:isMine?'flex-end':'flex-start', marginBottom:10 }}>
              <div style={{ maxWidth:'75%', background:isMine?t.primary:'white', borderRadius:isMine?'18px 18px 4px 18px':'18px 18px 18px 4px', padding:isImageMessage(m.message)?6:schedule?0:'10px 14px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', overflow:'hidden' }}>
                {schedule ? (
                  <div style={{ minWidth:200 }}>
                    <div style={{ background:isMine?'rgba(255,255,255,0.15)':t.light, padding:'10px 14px', display:'flex', alignItems:'center', gap:6 }}>
                      <Calendar size={14} color={isMine?'white':t.primary} />
                      <span style={{ fontSize:12, fontWeight:700, color:isMine?'white':t.primary }}>{tr('chat_proposedSchedule')}</span>
                    </div>
                    <div style={{ padding:'10px 14px' }}>
                      {schedule.service && <div style={{ fontSize:13, color:isMine?'white':'#1a1a1a', marginBottom:4 }}>{SERVICE_NAME_KEYS[schedule.service] ? tr(SERVICE_NAME_KEYS[schedule.service]) : schedule.service}</div>}
                      {schedule.date && <div style={{ fontSize:13, color:isMine?'white':'#1a1a1a', marginBottom:4 }}>📅 {schedule.date}</div>}
                      {schedule.time && <div style={{ fontSize:13, color:isMine?'white':'#1a1a1a', marginBottom:4 }}>🕐 {schedule.time}</div>}
                      {schedule.price != null && <div style={{ fontSize:13, fontWeight:700, color:isMine?'white':t.primary }}>{tr('chat_priceLabel', { amount: Math.round(schedule.price/100) })}</div>}
                    </div>
                  </div>
                ) : isImageMessage(m.message)
                  ? <img src={m.message} alt="Shared" style={{ width:180, height:180, objectFit:'cover', borderRadius:14, display:'block' }} />
                  : <div style={{ fontSize:14, color:isMine?'white':'#1a1a1a', lineHeight:1.4 }}>{m.message}</div>}
                <div style={{ fontSize:10, color:isMine?'rgba(255,255,255,0.7)':'#AAA', marginTop:schedule?0:4, padding:schedule?'0 14px 8px':0, textAlign:'right' }}>
                  {new Date(m.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {showScheduleForm && (
        <div style={{ padding:'12px 16px', background:t.light, borderTop:'1px solid #F0F0F0', flexShrink:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:t.primary, marginBottom:8 }}>{tr('chat_proposeSchedule')}</div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <input type="date" value={proposedDate} onChange={e => setProposedDate(e.target.value)}
              style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', fontFamily:'inherit' }} />
            <input type="time" value={proposedTime} onChange={e => setProposedTime(e.target.value)}
              style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', fontFamily:'inherit' }} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowScheduleForm(false)}
              style={{ flex:1, padding:'10px 0', borderRadius:10, border:'1.5px solid #E0E0E0', background:'white', color:'#555', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              {tr('common_cancel')}
            </button>
            <button onClick={sendSchedule} disabled={!proposedDate || !proposedTime}
              style={{ flex:1, padding:'10px 0', borderRadius:10, border:'none', background:t.primary, color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {tr('chat_sendProposal')}
            </button>
          </div>
        </div>
      )}

      <div style={{ padding:'8px 16px', display:'flex', gap:6, overflowX:'auto', flexShrink:0 }}>
        {quickReplies.map((q, i) => (
          <button key={i} onClick={() => setText(q)}
            style={{ flexShrink:0, padding:'6px 12px', borderRadius:20, border:'1.5px solid '+t.light, background:t.light, color:t.primary, fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>
            {q}
          </button>
        ))}
      </div>

      <div style={{ padding:'10px 16px 20px', display:'flex', gap:8, background:'white', borderTop:'1px solid #F0F0F0', flexShrink:0 }}>
        <input value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder={tr('chat_typePlaceholder')}
          style={{ flex:1, padding:'12px 16px', borderRadius:24, border:'1.5px solid #E0E0E0', fontSize:14, outline:'none', fontFamily:'inherit' }} />
        {(booking?.date || booking?.time || booking?.price != null) && (
          <button onClick={openScheduleForm} title={tr('chat_proposeSchedule')}
            style={{ width:44, height:44, borderRadius:22, border:'1.5px solid #E0E0E0', background:'white', color:t.primary, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
            <Calendar size={18} />
          </button>
        )}
        <input ref={photoInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={sendPhoto} />
        <button onClick={() => choosePhoto(photoInputRef, sendPhoto)} disabled={uploadingPhoto} aria-label={tr('chat_attachPhoto')}
          style={{ width:44, height:44, borderRadius:22, border:'1.5px solid #E0E0E0', background:'white', color:t.primary, display:'flex', alignItems:'center', justifyContent:'center', cursor:uploadingPhoto?'not-allowed':'pointer', flexShrink:0, opacity:uploadingPhoto?0.6:1 }}>
          <ImageIcon size={18} />
        </button>
        <button onClick={sendMessage} aria-label={tr('chat_send')}
          style={{ width:44, height:44, borderRadius:22, border:'none', background:t.primary, color:'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}