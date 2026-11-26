import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';

const ORANGE = '#FF6B35';
const DARK = '#0f0f1a';

export default function FirstLoginPrompt({ user, onDone }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { t: tr } = useLanguage();

  const handleSave = async () => {
    if (name.trim().length < 2) { setError(tr('firstLogin_errName')); return; }
    setSaving(true);
    const { error } = await supabase.from('users').upsert({
      id: user.id,
      name: name.trim(),
      email: user.email,
    }, { onConflict: 'id' });
    if (error) { setError(tr('firstLogin_errSave')); setSaving(false); return; }
    onDone(name.trim());
  };

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:DARK, fontFamily:'-apple-system,sans-serif', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
      <div style={{ width:72, height:72, borderRadius:22, background:ORANGE, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, marginBottom:24 }}>
        🐾
      </div>
      <div style={{ fontSize:26, fontWeight:700, color:'white', marginBottom:8, textAlign:'center' }}>
        {tr('firstLogin_title')}
      </div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:40, textAlign:'center', lineHeight:1.6 }}>
        {tr('firstLogin_subtitle')}
      </div>

      {error && (
        <div style={{ background:'#FCEBEB', borderRadius:12, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#A32D2D', width:'100%', boxSizing:'border-box' }}>
          {error}
        </div>
      )}

      <input
        value={name}
        onChange={e => { setName(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        placeholder={tr('firstLogin_namePlaceholder')}
        aria-label={tr('firstLogin_namePlaceholder')}
        autoFocus
        style={{ width:'100%', padding:'16px', borderRadius:14, border:'1.5px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', fontSize:16, color:'white', outline:'none', fontFamily:'inherit', boxSizing:'border-box', marginBottom:12 }}
      />

      <button onClick={handleSave} disabled={saving || name.trim().length < 2}
        style={{ width:'100%', padding:'16px 0', borderRadius:14, border:'none', background:name.trim().length >= 2 ? ORANGE : 'rgba(255,255,255,0.1)', color:'white', fontSize:15, fontWeight:700, cursor:name.trim().length >= 2 ? 'pointer' : 'not-allowed' }}>
        {saving ? tr('common_saving') : tr('firstLogin_getStarted')}
      </button>

      <div style={{ marginTop:24, fontSize:12, color:'rgba(255,255,255,0.2)', textAlign:'center' }}>
        {user.email}
      </div>
    </div>
  );
}