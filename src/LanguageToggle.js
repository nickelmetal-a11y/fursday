import React from 'react';
import { useLanguage } from './i18n';

// Rendered once, outside every screen's own layout, so language switching
// works from any screen without each screen owning its own control.
export default function LanguageToggle() {
  const { lang, setLang } = useLanguage();
  return (
    <div style={{ position:'fixed', top:10, left:'50%', transform:'translateX(-50%)', width:390, maxWidth:'100%', zIndex:4000, pointerEvents:'none', display:'flex', justifyContent:'flex-end', padding:'0 12px', boxSizing:'border-box' }}>
      <div style={{ pointerEvents:'auto', display:'flex', background:'rgba(0,0,0,0.65)', borderRadius:20, padding:3, gap:2, boxShadow:'0 2px 8px rgba(0,0,0,0.3)', backdropFilter:'blur(4px)' }}>
        <button onClick={() => setLang('en')} style={{ border:'none', borderRadius:16, padding:'5px 11px', fontSize:11, fontWeight:700, cursor:'pointer', background: lang==='en' ? 'white' : 'transparent', color: lang==='en' ? '#1a1a1a' : 'white' }}>EN</button>
        <button onClick={() => setLang('hi')} style={{ border:'none', borderRadius:16, padding:'5px 11px', fontSize:11, fontWeight:700, cursor:'pointer', background: lang==='hi' ? 'white' : 'transparent', color: lang==='hi' ? '#1a1a1a' : 'white' }}>हिं</button>
      </div>
    </div>
  );
}
