const fs = require('fs');
let log = [];
const L = s => { log.push(s); console.log(s); };

// ═══ 1. Create a small support helper module ═══
const helper = `import { useState, useEffect } from 'react';
import { supabase } from './supabase';

// Loads support contact numbers from app_settings (never hardcoded in the UI).
export function useSupportContact() {
  const [whatsapp, setWhatsapp] = useState(null);
  const [phone, setPhone] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('app_settings').select('key,value').in('key', ['support_whatsapp','support_phone']);
        if (data) {
          const w = data.find(r => r.key === 'support_whatsapp');
          const p = data.find(r => r.key === 'support_phone');
          if (w) setWhatsapp(w.value);
          if (p) setPhone(p.value);
        }
      } catch(e) { /* silent */ }
    })();
  }, []);
  return { whatsapp, phone };
}

export function openWhatsAppSupport(number, prefill) {
  if (!number) return;
  const text = prefill ? '?text=' + encodeURIComponent(prefill) : '';
  window.open('https://wa.me/' + number + text, '_blank');
}

export function callSupport(number) {
  if (!number) return;
  window.location.href = 'tel:+' + number;
}
`;
fs.writeFileSync('src/supportContact.js', helper, 'utf8');
L('CREATED: src/supportContact.js');

// ═══ 2. UserProfile — add WhatsApp support button in Account section ═══
let up = fs.readFileSync('src/UserProfile.js', 'utf8');
if (!up.includes('useSupportContact')) {
  up = up.replace(
    `import { supabase } from './supabase';`,
    `import { supabase } from './supabase';
import { useSupportContact, openWhatsAppSupport } from './supportContact';`
  );
  // add hook call after component opens
  up = up.replace(
    `  const t = THEMES[city] || THEMES.Gurgaon;`,
    `  const t = THEMES[city] || THEMES.Gurgaon;
  const { whatsapp } = useSupportContact();`
  );
  // Insert a support button before the sign out block
  up = up.replace(
    `        <div onClick={handleSignOut}`,
    `        {whatsapp && (
          <div onClick={() => openWhatsAppSupport(whatsapp, 'Hi Fursday, I need help with')}
            style={{ background:'#25D366', borderRadius:16, padding:'14px 16px', marginBottom:8, display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
            <div style={{ width:40, height:40, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>\uD83D\uDCAC</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'white' }}>Chat with Fursday on WhatsApp</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.85)', marginTop:1 }}>We usually reply within minutes</div>
            </div>
          </div>
        )}
        <div onClick={handleSignOut}`
  );
  fs.writeFileSync('src/UserProfile.js', up, 'utf8');
  L('FIXED: UserProfile support button added');
} else L('OK: UserProfile already has support');

// ═══ 3. SitterDashboard — add WhatsApp support button ═══
let sd = fs.readFileSync('src/SitterDashboard.js', 'utf8');
if (!sd.includes('useSupportContact')) {
  sd = sd.replace(
    `import { supabase } from './supabase';`,
    `import { supabase } from './supabase';
import { useSupportContact, openWhatsAppSupport } from './supportContact';`
  );
  sd = sd.replace(
    `  const t = THEMES[city] || THEMES.Gurgaon;`,
    `  const t = THEMES[city] || THEMES.Gurgaon;
  const { whatsapp: supportWa } = useSupportContact();`
  );
  // Add a support button just above the bottom nav (before the fixed nav div)
  sd = sd.replace(
    `      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, background: 'white', borderTop: '1px solid #E0E0E0'`,
    `      {supportWa && (
        <div style={{ padding:'0 16px 16px' }}>
          <div onClick={() => openWhatsAppSupport(supportWa, 'Hi Fursday, I am a sitter and need help with')}
            style={{ background:'#25D366', borderRadius:14, padding:'12px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <span style={{ fontSize:18 }}>\uD83D\uDCAC</span>
            <div style={{ fontSize:13, fontWeight:600, color:'white' }}>Need help? Chat with Fursday support</div>
          </div>
        </div>
      )}
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, background: 'white', borderTop: '1px solid #E0E0E0'`
  );
  fs.writeFileSync('src/SitterDashboard.js', sd, 'utf8');
  L('FIXED: SitterDashboard support button added');
} else L('OK: SitterDashboard already has support');

// ═══ 4. BookingsDashboard — fix emergency line to use settings number ═══
let bd = fs.readFileSync('src/BookingsDashboard.js', 'utf8');
if (!bd.includes('useSupportContact')) {
  bd = bd.replace(
    `import { supabase } from './supabase';`,
    `import { supabase } from './supabase';
import { useSupportContact, callSupport } from './supportContact';`
  );
  bd = bd.replace(
    `  const t = THEMES[c] || THEMES.Gurgaon;`,
    `  const t = THEMES[c] || THEMES.Gurgaon;
  const { phone: supportPhone } = useSupportContact();`
  );
  // Replace the hardcoded emergency tel link
  bd = bd.replace(
    `<a href="tel:+911800000000"`,
    `<a onClick={(e) => { e.preventDefault(); callSupport(supportPhone); }} href="#"`
  );
  fs.writeFileSync('src/BookingsDashboard.js', bd, 'utf8');
  L('FIXED: BookingsDashboard emergency line uses settings number');
} else L('OK: BookingsDashboard already wired');

L('\\nDONE');
