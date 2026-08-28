const fs = require('fs');
const code = `import React from 'react';
import { CheckCircle, Phone, MessageCircle, Calendar, Clock, MapPin } from 'lucide-react';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

export default function BookingReceipt({ onBack, onViewBookings, city, booking }) {
  const t = THEMES[city] || THEMES.Gurgaon;
  const b = booking || {};

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      <div style={{ padding:'60px 24px 32px', textAlign:'center' }}>
        <div style={{ width:80, height:80, borderRadius:24, background:'rgba(76,175,80,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', border:'2px solid #4CAF50' }}>
          <CheckCircle size={40} color="#4CAF50" />
        </div>
        <div style={{ fontSize:26, fontWeight:700, color:'white', marginBottom:8 }}>Booking Confirmed!</div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', lineHeight:1.6 }}>
          Payment received. Your sitter has been notified.
        </div>
      </div>

      <div style={{ padding:'0 20px' }}>
        <div style={{ background:'#1a1a2e', borderRadius:20, padding:20, marginBottom:14, border:'1px solid rgba(255,107,53,0.2)' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Booking details</div>
          {[
            { label:'Booking ref', val:b.ref || b.booking_ref },
            { label:'Service', val:b.service || b.service_type },
            { label:'Amount paid', val:'Rs.' + Math.round((b.amount || b.gross_amount_paise || 0) / 100) },
            { label:'Date', val:b.scheduled_date || 'Confirmed' },
            { label:'Time', val:b.scheduled_time || 'As booked' },
            { label:'Status', val:'✓ Paid & Confirmed' },
          ].filter(x => x.val).map((x,i,arr) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.06)':'none' }}>
              <span style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>{x.label}</span>
              <span style={{ fontSize:13, color:x.label==='Status'?'#4CAF50':'white', fontWeight:x.label==='Status'?700:500 }}>{x.val}</span>
            </div>
          ))}
        </div>

        {(b.sitterName || b.sitterPhone) && (
          <div style={{ background:'#1a1a2e', borderRadius:20, padding:20, marginBottom:14, border:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>Your sitter</div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:t.primary, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'white', flexShrink:0 }}>
                {(b.sitterName||'S')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ color:'white', fontSize:16, fontWeight:700 }}>{b.sitterName || 'Your sitter'}</div>
                <div style={{ color:'rgba(255,255,255,0.5)', fontSize:12 }}>Will be there on time 🐾</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {b.sitterPhone && (
                <a href={'tel:'+b.sitterPhone}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'12px 0', borderRadius:12, border:'1.5px solid rgba(255,255,255,0.15)', background:'transparent', color:'white', fontSize:13, fontWeight:600, textDecoration:'none' }}>
                  <Phone size={15} /> Call sitter
                </a>
              )}
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'12px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}
                onClick={onViewBookings}>
                <MessageCircle size={15} /> Message
              </div>
            </div>
          </div>
        )}

        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:16, padding:'14px 16px', marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'white', marginBottom:10 }}>What happens next?</div>
          {[
            { emoji:'📱', text:'Your sitter will confirm the booking within 1 hour' },
            { emoji:'📍', text:'Share your flat/tower details if not already done' },
            { emoji:'🐾', text:'Relax — your dog is in safe hands' },
          ].map((s,i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'6px 0', alignItems:'flex-start' }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{s.emoji}</span>
              <span style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.5 }}>{s.text}</span>
            </div>
          ))}
        </div>

        <button onClick={onViewBookings}
          style={{ width:'100%', padding:'16px 0', borderRadius:16, border:'none', background:t.primary, color:'white', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:10 }}>
          View my bookings
        </button>
        <button onClick={onBack}
          style={{ width:'100%', padding:'14px 0', borderRadius:16, border:'1.5px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:14, cursor:'pointer' }}>
          Back to home
        </button>
      </div>
    </div>
  );
}`;
fs.writeFileSync('C:\\Users\\nikhil.a.mathur\\SynologyDrive\\Home Project\\fursday\\src\\BookingReceipt.js', code, 'utf8');
console.log('Done BookingReceipt, bytes:', code.length);
