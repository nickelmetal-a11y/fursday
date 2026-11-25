import React, { useEffect, useState } from 'react';
import { Phone, MessageCircle, Siren, Stethoscope, X } from 'lucide-react';
import { useLanguage } from './i18n';
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

  const row = (bg, fg) => ({ width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 14, border: 'none', background: bg, color: fg, fontSize: 15, fontWeight: 700, cursor: 'pointer', textAlign: 'left', textDecoration: 'none', boxSizing: 'border-box' });
  const sub = { display: 'block', fontSize: 12, fontWeight: 400, opacity: 0.8, marginTop: 2 };

  return (
    <div role="dialog" aria-modal="true" aria-label="SOS" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 390, background: 'white', borderRadius: '24px 24px 0 0', padding: '20px 16px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#C62828' }}>🆘 {hi ? 'आपातकालीन मदद' : 'Emergency help'}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{location ? (hi ? 'आपकी लोकेशन संदेश में जोड़ दी गई है' : 'Your location will be included') : (hi ? 'लोकेशन ढूँढ रहे हैं…' : 'Finding your location…')}</div>
          </div>
          <button onClick={onClose} aria-label={hi ? 'बंद करें' : 'Close'} style={{ width: 44, height: 44, border: 'none', background: '#F5F5F5', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        {phoneOk && (
          <button style={row('#C62828', 'white')} onClick={() => callSupport(phone)}>
            <Phone size={22} /><span>{hi ? 'Fursday सपोर्ट को कॉल करें' : 'Call Fursday support'}<span style={sub}>+{phone}</span></span>
          </button>
        )}
        {waOk && (
          <button style={row('#E8F5E9', '#1B5E20')} onClick={() => openWhatsAppSupport(whatsapp, message)}>
            <MessageCircle size={22} /><span>{hi ? 'WhatsApp पर लोकेशन भेजें' : 'WhatsApp support with my location'}<span style={sub}>{bookingRef ? (hi ? 'बुकिंग ' : 'Booking ') + bookingRef : (hi ? 'सपोर्ट टीम तुरंत देखती है' : 'The team sees it right away')}</span></span>
          </button>
        )}
        <a href="tel:112" style={row('#FFF3E0', '#BF360C')}>
          <Siren size={22} /><span>{hi ? '112 पर कॉल करें' : 'Call 112'}<span style={sub}>{hi ? 'पुलिस, एम्बुलेंस, आग — राष्ट्रीय आपातकालीन नंबर' : 'Police, ambulance, fire: national emergency number'}</span></span>
        </a>
        <a href={'https://www.google.com/maps/search/veterinary+hospital' + (location ? '/@' + location + ',14z' : '+near+me')} target="_blank" rel="noreferrer" style={row('#E3F2FD', '#0D47A1')}>
          <Stethoscope size={22} /><span>{hi ? 'नज़दीकी पशु अस्पताल' : 'Nearest vet hospital'}<span style={sub}>{hi ? 'Google Maps में खोलें' : 'Opens Google Maps'}</span></span>
        </a>
        {!phoneOk && !waOk && (
          <div style={{ fontSize: 12, color: '#A32D2D', background: '#FCEBEB', borderRadius: 10, padding: '8px 12px' }}>
            {hi ? 'Fursday सपोर्ट नंबर अभी उपलब्ध नहीं है। आपात स्थिति में 112 पर कॉल करें।' : 'Fursday support number is not available right now. In an emergency, call 112.'}
          </div>
        )}
      </div>
    </div>
  );
}
