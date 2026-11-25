import React from 'react';
import { CheckCircle, Phone, MessageCircle, Calendar, Clock, MapPin } from 'lucide-react';
import { useLanguage, registerTranslations } from './i18n';

registerTranslations({
  en: {
    receipt_confirmedHeading: 'Booking Confirmed!',
    receipt_confirmedBody: 'Payment received. Your sitter has been notified.',
    receipt_bookingDetails: 'Booking details',
    receipt_labelBookingRef: 'Booking ref',
    receipt_labelService: 'Service',
    receipt_labelAmountPaid: 'Amount paid',
    receipt_labelDate: 'Date',
    receipt_labelTime: 'Time',
    receipt_labelStatus: 'Status',
    receipt_dateFallbackConfirmed: 'Confirmed',
    receipt_timeFallbackAsBooked: 'As booked',
    receipt_statusPaidConfirmed: '✓ Paid & Confirmed',
    receipt_yourSitter: 'Your sitter',
    receipt_sitterFallbackName: 'Your sitter',
    receipt_sitterOnTime: 'Will be there on time 🐾',
    receipt_callSitter: 'Call sitter',
    receipt_message: 'Message',
    receipt_whatsNextHeading: 'What happens next?',
    receipt_bullet1: 'Your sitter will confirm the booking within 1 hour',
    receipt_bullet2: 'Share your flat/tower details if not already done',
    receipt_bullet3: 'Relax — your dog is in safe hands',
    receipt_viewBookings: 'View my bookings',
    receipt_backToHome: 'Back to home',
  },
  hi: {
    receipt_confirmedHeading: 'बुकिंग पक्की हो गई!',
    receipt_confirmedBody: 'भुगतान प्राप्त हो गया है। आपके सिटर को सूचित कर दिया गया है।',
    receipt_bookingDetails: 'बुकिंग विवरण',
    receipt_labelBookingRef: 'बुकिंग रेफ',
    receipt_labelService: 'सेवा',
    receipt_labelAmountPaid: 'भुगतान राशि',
    receipt_labelDate: 'तारीख',
    receipt_labelTime: 'समय',
    receipt_labelStatus: 'स्थिति',
    receipt_dateFallbackConfirmed: 'पुष्ट',
    receipt_timeFallbackAsBooked: 'बुक किए अनुसार',
    receipt_statusPaidConfirmed: '✓ भुगतान हुआ और पक्का',
    receipt_yourSitter: 'आपका सिटर',
    receipt_sitterFallbackName: 'आपका सिटर',
    receipt_sitterOnTime: 'समय पर पहुंचेंगे 🐾',
    receipt_callSitter: 'सिटर को कॉल करें',
    receipt_message: 'संदेश',
    receipt_whatsNextHeading: 'आगे क्या होगा?',
    receipt_bullet1: 'आपका सिटर 1 घंटे के भीतर बुकिंग की पुष्टि करेगा',
    receipt_bullet2: 'यदि अभी तक नहीं किया है तो अपने फ्लैट/टावर की जानकारी साझा करें',
    receipt_bullet3: 'निश्चिंत रहें — आपका कुत्ता सुरक्षित हाथों में है',
    receipt_viewBookings: 'मेरी बुकिंग देखें',
    receipt_backToHome: 'होम पर वापस जाएं',
  },
});

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

export default function BookingReceipt({ onBack, onViewBookings, city, booking }) {
  const { t: tr } = useLanguage();
  const t = THEMES[city] || THEMES.Gurgaon;
  const b = booking || {};
  const sitterName = b.sitterName || tr('receipt_sitterFallbackName');

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      <div style={{ padding:'60px 24px 32px', textAlign:'center' }}>
        <div style={{ width:80, height:80, borderRadius:24, background:'rgba(76,175,80,0.2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', border:'2px solid #4CAF50' }}>
          <CheckCircle size={40} color="#4CAF50" />
        </div>
        <div style={{ fontSize:26, fontWeight:700, color:'white', marginBottom:8 }}>{tr('receipt_confirmedHeading')}</div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', lineHeight:1.6 }}>
          {tr('receipt_confirmedBody')}
        </div>
      </div>

      <div style={{ padding:'0 20px' }}>
        <div style={{ background:'#1a1a2e', borderRadius:20, padding:20, marginBottom:14, border:'1px solid rgba(255,107,53,0.2)' }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>{tr('receipt_bookingDetails')}</div>
          {[
            { key:'ref', label:tr('receipt_labelBookingRef'), val:b.ref || b.booking_ref },
            { key:'service', label:tr('receipt_labelService'), val:b.service || b.service_type },
            { key:'amount', label:tr('receipt_labelAmountPaid'), val:'Rs.' + Math.round((b.amount || b.gross_amount_paise || 0) / 100) },
            { key:'date', label:tr('receipt_labelDate'), val:b.booking_date || tr('receipt_dateFallbackConfirmed') },
            { key:'time', label:tr('receipt_labelTime'), val:b.time_slot || tr('receipt_timeFallbackAsBooked') },
            { key:'status', label:tr('receipt_labelStatus'), val:tr('receipt_statusPaidConfirmed') },
          ].filter(x => x.val).map((x,i,arr) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:i<arr.length-1?'1px solid rgba(255,255,255,0.06)':'none' }}>
              <span style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>{x.label}</span>
              <span style={{ fontSize:13, color:x.key==='status'?'#4CAF50':'white', fontWeight:x.key==='status'?700:500 }}>{x.val}</span>
            </div>
          ))}
        </div>

        {(b.sitterName || b.sitterPhone) && (
          <div style={{ background:'#1a1a2e', borderRadius:20, padding:20, marginBottom:14, border:'1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>{tr('receipt_yourSitter')}</div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:t.primary, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:'white', flexShrink:0 }}>
                {(b.sitterName||'S')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ color:'white', fontSize:16, fontWeight:700 }}>{sitterName}</div>
                <div style={{ color:'rgba(255,255,255,0.5)', fontSize:12 }}>{tr('receipt_sitterOnTime')}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {b.sitterPhone && (
                <a href={'tel:'+b.sitterPhone}
                  style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'12px 0', borderRadius:12, border:'1.5px solid rgba(255,255,255,0.15)', background:'transparent', color:'white', fontSize:13, fontWeight:600, textDecoration:'none' }}>
                  <Phone size={15} /> {tr('receipt_callSitter')}
                </a>
              )}
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'12px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}
                onClick={onViewBookings}>
                <MessageCircle size={15} /> {tr('receipt_message')}
              </div>
            </div>
          </div>
        )}

        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:16, padding:'14px 16px', marginBottom:14 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'white', marginBottom:10 }}>{tr('receipt_whatsNextHeading')}</div>
          {[
            { emoji:'📱', text:tr('receipt_bullet1') },
            { emoji:'📍', text:tr('receipt_bullet2') },
            { emoji:'🐾', text:tr('receipt_bullet3') },
          ].map((s,i) => (
            <div key={i} style={{ display:'flex', gap:10, padding:'6px 0', alignItems:'flex-start' }}>
              <span style={{ fontSize:16, flexShrink:0 }}>{s.emoji}</span>
              <span style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.5 }}>{s.text}</span>
            </div>
          ))}
        </div>

        <button onClick={onViewBookings}
          style={{ width:'100%', padding:'16px 0', borderRadius:16, border:'none', background:t.primary, color:'white', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:10 }}>
          {tr('receipt_viewBookings')}
        </button>
        <button onClick={onBack}
          style={{ width:'100%', padding:'14px 0', borderRadius:16, border:'1.5px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.5)', fontSize:14, cursor:'pointer' }}>
          {tr('receipt_backToHome')}
        </button>
      </div>
    </div>
  );
}