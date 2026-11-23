import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Phone } from 'lucide-react';
import { supabase } from './supabase';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

export default function ChatScreen({ onBack, city, booking, userType }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const bottomRef = useRef(null);

  const otherPartyName = userType === 'sitter'
    ? (booking?.parentName || 'Pet parent')
    : (booking?.sitterName || 'Sitter');

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
        alert('Message failed to send. Please try again.');
        return;
      }

      // TIER 1: Send message notification to other party
      try {
        const otherUserId = userType === 'sitter' ? booking.pet_parent_id : booking.sitter_id;
        const senderName = userType === 'sitter' ? (booking?.sitterName || 'Sitter') : (booking?.parentName || 'Pet parent');

        const { notifyMessageReceived } = await import('./notificationService');
        await notifyMessageReceived(otherUserId, null, senderName);
      } catch(notifErr) { console.error('Message notification failed:', notifErr); }
    } catch(e) { console.log('Send error:', e); }
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
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:11 }}>{booking?.service || 'Booking chat'}</div>
        </div>
        {otherPartyPhone && (
          <a href={'tel:'+otherPartyPhone} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <Phone size={16} color="white" />
          </a>
        )}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 8px' }}>
        {loading && (
          <div style={{ textAlign:'center', padding:40, color:'#888', fontSize:13 }}>Loading messages...</div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 20px' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>💬</div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>No messages yet</div>
            <div style={{ fontSize:12, color:'#888' }}>Say hello to {otherPartyName}!</div>
          </div>
        )}
        {!loading && messages.map((m, i) => {
          const isMine = m.sender_id === currentUserId;
          return (
            <div key={m.id || i} style={{ display:'flex', justifyContent:isMine?'flex-end':'flex-start', marginBottom:10 }}>
              <div style={{ maxWidth:'75%', background:isMine?t.primary:'white', borderRadius:isMine?'18px 18px 4px 18px':'18px 18px 18px 4px', padding:'10px 14px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize:14, color:isMine?'white':'#1a1a1a', lineHeight:1.4 }}>{m.message}</div>
                <div style={{ fontSize:10, color:isMine?'rgba(255,255,255,0.7)':'#AAA', marginTop:4, textAlign:'right' }}>
                  {new Date(m.created_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

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
          placeholder="Type a message..."
          style={{ flex:1, padding:'12px 16px', borderRadius:24, border:'1.5px solid #E0E0E0', fontSize:14, outline:'none', fontFamily:'inherit' }} />
        <button onClick={sendMessage}
          style={{ width:44, height:44, borderRadius:22, border:'none', background:t.primary, color:'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}