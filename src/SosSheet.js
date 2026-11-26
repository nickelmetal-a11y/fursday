import React, { useEffect, useState } from 'react';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { useSupportContact, openWhatsAppSupport, callSupport, isValidSupportNumber } from './supportContact';

// One place for every SOS entry point (Settings, sitter's active job). It tries
// to attach the caller's location so support can act without asking.
export default function SosSheet({ onClose, bookingRef, userName }) {
  const { lang } = useLanguage();
  const hi = lang === 'hi';
  const { whatsapp, phone } = useSupportContact();
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => setLocation(p.coords.latitude.toFixed(5) + ',' + p.coords.longitude.toFixed(5)),
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  const waOk = isValidSupportNumber(whatsapp);
  const phoneOk = isValidSupportNumber(phone);
  const message = [
    'SOS from the Fursday app',
    userName ? 'Name: ' + userName : null,
    bookingRef ? 'Booking: ' + bookingRef : null,
    location ? 'Location: https://maps.google.com/?q=' + location : 'Location: not shared',
  ].filter(Boolean).join('\n');

  const row = { width: '100%', minHeight: 64, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: radius.lg, border: `1px solid ${color.line}`, background: color.surface, color: color.ink, fontSize: 15, fontWeight: 600, fontFamily: font.family, cursor: 'pointer', textAlign: 'left', textDecoration: 'none', boxSizing: 'border-box' };
  const sub = { display: 'block', fontSize: font.sm, fontWeight: 400, color: color.muted, marginTop: 2 };
  const tile = (tone) => ({ ...ui.iconTile, width: 40, height: 40, background: color[tone + 'Soft'], color: color[tone] });
  const chevron = <Icon name="chevronRight" size={18} color={color.faint} style={{ marginLeft: 'auto' }} />;

  return (
    <div role="dialog" aria-modal="true" aria-label="SOS" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(16,24,40,0.55)', zIndex: 3000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: color.surface, borderRadius: `${radius.xl}px ${radius.xl}px 0 0`, padding: '20px 16px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10, fontFamily: font.family, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ ...tile('danger'), width: 44, height: 44 }}><Icon name="sos" size={22} strokeWidth={2} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: font.lg, fontWeight: 700, color: color.danger }}>{hi ? 'आपातकालीन मदद' : 'Emergency help'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: font.sm, color: color.muted }}>
                <Icon name="pin" size={13} />{location ? (hi ? 'आपकी लोकेशन संदेश में जोड़ दी गई है' : 'Your location will be included') : (hi ? 'लोकेशन ढूँढ रहे हैं…' : 'Finding your location…')}
              </div>
            </div>
          </div>
          <button onClick={onClose} aria-label={hi ? 'बंद करें' : 'Close'} style={{ ...ui.backButton, borderRadius: radius.pill }}><Icon name="plus" size={20} style={{ transform: 'rotate(45deg)' }} /></button>
        </div>

        {phoneOk && (
          <button style={{ ...row, background: color.danger, border: 'none', color: color.surface, fontWeight: 700 }} onClick={() => callSupport(phone)}>
            <span style={{ ...ui.iconTile, width: 40, height: 40, background: 'rgba(255,255,255,0.16)', color: color.surface }}><Icon name="phone" size={20} /></span>
            <span>{hi ? 'Fursday सपोर्ट को कॉल करें' : 'Call Fursday support'}<span style={{ ...sub, color: color.surface, opacity: 0.85 }}>+{phone}</span></span>
          </button>
        )}
        {waOk && (
          <button style={row} onClick={() => openWhatsAppSupport(whatsapp, message)}>
            <span style={tile('success')}><Icon name="message" size={20} /></span>
            <span>{hi ? 'WhatsApp पर लोकेशन भेजें' : 'WhatsApp support with my location'}<span style={sub}>{bookingRef ? (hi ? 'बुकिंग ' : 'Booking ') + bookingRef : (hi ? 'सपोर्ट टीम तुरंत देखती है' : 'The team sees it right away')}</span></span>
            {chevron}
          </button>
        )}
        <a href="tel:112" style={row}>
          <span style={tile('danger')}><Icon name="alert" size={20} /></span>
          <span>{hi ? '112 पर कॉल करें' : 'Call 112'}<span style={sub}>{hi ? 'पुलिस, एम्बुलेंस, आग — राष्ट्रीय आपातकालीन नंबर' : 'Police, ambulance, fire: national emergency number'}</span></span>
          {chevron}
        </a>
        <a href={'https://www.google.com/maps/search/veterinary+hospital' + (location ? '/@' + location + ',14z' : '+near+me')} target="_blank" rel="noreferrer" style={row}>
          <span style={tile('info')}><Icon name="stethoscope" size={20} /></span>
          <span>{hi ? 'नज़दीकी पशु अस्पताल' : 'Nearest vet hospital'}<span style={sub}>{hi ? 'Google Maps में खोलें' : 'Opens Google Maps'}</span></span>
          {chevron}
        </a>
        {!phoneOk && !waOk && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: font.sm, color: color.danger, background: color.dangerSoft, borderRadius: radius.md, padding: '10px 12px', lineHeight: 1.5 }}>
            <Icon name="info" size={16} style={{ marginTop: 1 }} />
            <span>{hi ? 'Fursday सपोर्ट नंबर अभी उपलब्ध नहीं है। आपात स्थिति में 112 पर कॉल करें।' : 'Fursday support number is not available right now. In an emergency, call 112.'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
