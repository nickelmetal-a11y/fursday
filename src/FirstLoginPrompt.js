import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

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

  const ready = name.trim().length >= 2;

  return (
    <div style={{ ...ui.page, background:color.surface, display:'flex', flexDirection:'column' }}>
      <div style={{ background:color.navy, padding:'calc(48px + env(safe-area-inset-top)) 24px 52px', display:'flex', justifyContent:'center' }}>
        <div style={{ width:64, height:64, borderRadius:18, background:'linear-gradient(135deg,#F4A25B 0%,#FFFFFF 52%,#5FB088 100%)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 10px 30px rgba(0,0,0,0.25)' }}>
          <Icon name="paw" size={36} color={color.navy} strokeWidth={2} />
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', background:color.surface, borderRadius:`${radius.xl}px ${radius.xl}px 0 0`, marginTop:-24, padding:'28px 20px calc(28px + env(safe-area-inset-bottom))' }}>
        <h1 style={{ fontSize:font.xl, fontWeight:700, color:color.ink, margin:'0 0 6px', letterSpacing:-0.2 }}>
          {tr('firstLogin_title')}
        </h1>
        <div style={{ fontSize:font.md, color:color.muted, marginBottom:24, lineHeight:1.5 }}>
          {tr('firstLogin_subtitle')}
        </div>

        {error && (
          <div role="alert" style={{ display:'flex', gap:8, alignItems:'flex-start', background:color.dangerSoft, borderRadius:radius.md, padding:'10px 12px', marginBottom:16, fontSize:13, color:color.danger }}>
            <Icon name="alert" size={16} style={{ marginTop:1 }} />{error}
          </div>
        )}

        <input
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder={tr('firstLogin_namePlaceholder')}
          aria-label={tr('firstLogin_namePlaceholder')}
          autoFocus
          autoComplete="name"
          style={{ ...ui.input, minHeight:50, fontSize:16, marginBottom:12 }}
        />

        <button onClick={handleSave} disabled={saving || !ready}
          style={{ ...ui.primaryButton, width:'100%', minHeight:50, opacity:ready ? 1 : 0.55, cursor:ready ? 'pointer' : 'not-allowed' }}>
          {saving ? tr('common_saving') : tr('firstLogin_getStarted')}
        </button>

        <div style={{ marginTop:20, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:font.sm, color:color.muted, overflowWrap:'anywhere' }}>
          <Icon name="mail" size={14} color={color.faint} />{user.email}
        </div>
      </div>
    </div>
  );
}