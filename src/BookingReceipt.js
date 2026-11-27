import React from 'react';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

const eyebrow = { fontSize: font.xs, color: color.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 };

export default function BookingReceipt({ onBack, onViewBookings, city, booking }) {
  const { t: tr } = useLanguage();
  const b = booking || {};
  const sitterName = b.sitterName || tr('receipt_sitterFallbackName');
  const onHold = b.payment_status === 'authorized';

  return (
    <div style={{ ...ui.page, paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
      <div style={{ background: color.surface, borderBottom: `1px solid ${color.line}`, padding: 'calc(40px + env(safe-area-inset-top)) 16px 24px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: radius.pill, background: color.successSoft, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Icon name="check" size={32} strokeWidth={2.4} />
        </div>
        <div style={{ fontSize: font.xxl, fontWeight: 700, color: color.ink, marginBottom: 6, letterSpacing: -0.3 }}>{tr(onHold ? 'receipt_heldHeading' : 'receipt_confirmedHeading')}</div>
        <div style={{ fontSize: font.md, color: color.muted, lineHeight: 1.6 }}>
          {tr(onHold ? 'receipt_heldBody' : b.payment_status === 'held' ? 'receipt_capturedBody' : 'receipt_confirmedBody')}
        </div>
      </div>

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={ui.card}>
          <div style={eyebrow}>{tr('receipt_bookingDetails')}</div>
          {[
            { key:'ref', label:tr('receipt_labelBookingRef'), val:b.ref || b.booking_ref },
            { key:'service', label:tr('receipt_labelService'), val:b.service || b.service_type },
            { key:'amount', label:tr('receipt_labelAmountPaid'), val:'Rs.' + Math.round((b.amount || b.gross_amount_paise || 0) / 100) },
            { key:'date', label:tr('receipt_labelDate'), val:b.booking_date || tr('receipt_dateFallbackConfirmed') },
            { key:'time', label:tr('receipt_labelTime'), val:b.time_slot || tr('receipt_timeFallbackAsBooked') },
            { key:'status', label:tr('receipt_labelStatus'), val:tr(onHold ? 'receipt_statusHeldAwaiting' : 'receipt_statusPaidConfirmed') },
          ].filter(x => x.val).map((x,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:'9px 0', borderTop:i ? `1px solid ${color.line}` : 'none' }}>
              <span style={{ fontSize:13, color:color.muted }}>{x.label}</span>
              {x.key === 'status'
                ? <span style={ui.badge(onHold ? 'info' : 'success')}>{x.val}</span>
                : <span style={{ fontSize:13, color:color.ink, fontWeight:600, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{x.val}</span>}
            </div>
          ))}
        </div>

        {(b.sitterName || b.sitterPhone) && (
          <div style={ui.card}>
            <div style={eyebrow}>{tr('receipt_yourSitter')}</div>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <div style={{ width:48, height:48, borderRadius:radius.md, background:color.navySoft, color:color.navy, display:'flex', alignItems:'center', justifyContent:'center', fontSize:font.xl, fontWeight:700, flexShrink:0 }}>
                {(b.sitterName||'S')[0].toUpperCase()}
              </div>
              <div style={{ minWidth:0 }}>
                <div style={{ color:color.ink, fontSize:font.lg, fontWeight:700 }}>{sitterName}</div>
                <div style={{ color:color.muted, fontSize:font.sm }}>{tr('receipt_sitterOnTime')}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              {b.sitterPhone && (
                <a href={'tel:'+b.sitterPhone} style={{ ...ui.secondaryButton, flex:1, minHeight:44, fontSize:14, textDecoration:'none' }}>
                  <Icon name="phone" size={16} /> {tr('receipt_callSitter')}
                </a>
              )}
              <button type="button" style={{ ...ui.primaryButton, flex:1, minHeight:44, fontSize:14 }} onClick={onViewBookings}>
                <Icon name="message" size={16} /> {tr('receipt_message')}
              </button>
            </div>
          </div>
        )}

        <div style={ui.card}>
          <div style={ui.sectionTitle}>{tr('receipt_whatsNextHeading')}</div>
          {[
            { icon:'bell', text:tr('receipt_bullet1') },
            { icon:'pin', text:tr('receipt_bullet2') },
            { icon:'shield', text:tr('receipt_bullet3') },
          ].map((s,i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'8px 0', alignItems:'center' }}>
              <span style={{ ...ui.iconTile, width:36, height:36, borderRadius:radius.sm }}><Icon name={s.icon} size={18} /></span>
              <span style={{ fontSize:13, color:color.text, lineHeight:1.5 }}>{s.text}</span>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }}>
          <button type="button" onClick={onViewBookings} style={{ ...ui.primaryButton, width:'100%' }}>
            {tr('receipt_viewBookings')}
          </button>
          <button type="button" onClick={onBack} style={{ ...ui.secondaryButton, width:'100%' }}>
            {tr('receipt_backToHome')}
          </button>
        </div>
      </div>
    </div>
  );
}
