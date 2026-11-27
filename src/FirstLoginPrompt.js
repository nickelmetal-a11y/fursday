import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

export default function FirstLoginPrompt({ user, onDone }) {
  const [name, setName] = useState('');
  const [petName, setPetName] = useState('');
  const [intent, setIntent] = useState('find');
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
    if (petName.trim()) {
      const { error: petError } = await supabase.from('pet_profiles').insert({ user_id: user.id, name: petName.trim() });
      if (petError) console.error('Could not save pet:', petError.message);
    }
    onDone(name.trim(), intent);
  };

  const ready = name.trim().length >= 2;
  const options = [
    { id: 'find', icon: 'paw', title: tr('firstLogin_findTitle'), sub: tr('firstLogin_findSub') },
    { id: 'offer', icon: 'heart', title: tr('firstLogin_offerTitle'), sub: tr('firstLogin_offerSub') },
  ];

  return (
    <div style={{ ...ui.page, background:color.surface, display:'flex', flexDirection:'column' }}>
      <div style={{ background:color.navy, padding:'calc(40px + env(safe-area-inset-top)) 24px 48px', display:'flex', justifyContent:'center' }}>
        <div style={{ width:64, height:64, borderRadius:18, background:'linear-gradient(135deg,#F4A25B 0%,#FFFFFF 52%,#5FB088 100%)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 10px 30px rgba(0,0,0,0.25)' }}>
          <Icon name="paw" size={36} color={color.navy} strokeWidth={2} />
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', background:color.surface, borderRadius:`${radius.xl}px ${radius.xl}px 0 0`, marginTop:-24, padding:'28px 20px calc(28px + env(safe-area-inset-bottom))' }}>
        <h1 style={{ fontSize:font.xl, fontWeight:700, color:color.ink, margin:'0 0 6px', letterSpacing:-0.2 }}>
          {tr('firstLogin_title')}
        </h1>
        <div style={{ fontSize:font.md, color:color.muted, marginBottom:22, lineHeight:1.5 }}>
          {tr('firstLogin_quickSub')}
        </div>

        {error && (
          <div role="alert" style={{ display:'flex', gap:8, alignItems:'flex-start', background:color.dangerSoft, borderRadius:radius.md, padding:'10px 12px', marginBottom:16, fontSize:13, color:color.danger }}>
            <Icon name="alert" size={16} style={{ marginTop:1 }} />{error}
          </div>
        )}

        <label htmlFor="fl-name" style={ui.label}>{tr('firstLogin_subtitle')}</label>
        <input
          id="fl-name"
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          placeholder={tr('firstLogin_namePlaceholder')}
          autoFocus
          autoComplete="name"
          style={{ ...ui.input, minHeight:50, fontSize:16, marginBottom:16 }}
        />

        <div role="radiogroup" aria-label={tr('firstLogin_intentLabel')} style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
          <div style={ui.label}>{tr('firstLogin_intentLabel')}</div>
          {options.map(o => {
            const on = intent === o.id;
            return (
              <button type="button" key={o.id} role="radio" aria-checked={on} onClick={() => setIntent(o.id)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', minHeight:60, textAlign:'left', font:'inherit', color:'inherit', cursor:'pointer', background:on ? color.navySoft : color.surface, border:`1px solid ${on ? color.navy : color.line}`, borderRadius:radius.lg }}>
                <span style={{ ...ui.iconTile, width:40, height:40, background:on ? color.surface : color.tile }}><Icon name={o.icon} size={20} /></span>
                <span style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:'block', fontSize:15, fontWeight:600, color:color.ink }}>{o.title}</span>
                  <span style={{ display:'block', fontSize:font.sm, color:color.muted, lineHeight:1.45 }}>{o.sub}</span>
                </span>
                <span aria-hidden="true" style={{ width:20, height:20, borderRadius:radius.pill, border:`1.5px solid ${on ? color.navy : color.line}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxSizing:'border-box' }}>
                  {on && <span style={{ width:10, height:10, borderRadius:radius.pill, background:color.navy }} />}
                </span>
              </button>
            );
          })}
        </div>

        {intent === 'find' && (
          <>
            <label htmlFor="fl-pet" style={ui.label}>{tr('firstLogin_petLabel')}</label>
            <input
              id="fl-pet"
              value={petName}
              onChange={e => setPetName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder={tr('firstLogin_petPlaceholder')}
              style={{ ...ui.input, minHeight:50, fontSize:16, marginBottom:16 }}
            />
          </>
        )}

        <button onClick={handleSave} disabled={saving || !ready}
          style={{ ...ui.primaryButton, width:'100%', minHeight:50, opacity:ready ? 1 : 0.55, cursor:ready ? 'pointer' : 'not-allowed' }}>
          {saving ? tr('common_saving') : intent === 'offer' ? tr('firstLogin_offerButton') : tr('firstLogin_getStarted')}
        </button>

        <div style={{ marginTop:14, display:'flex', gap:8, alignItems:'flex-start', fontSize:font.sm, color:color.muted, lineHeight:1.5 }}>
          <Icon name="shield" size={15} color={color.faint} style={{ marginTop:2, flexShrink:0 }} />
          <span>{intent === 'offer' ? tr('firstLogin_offerNote') : tr('firstLogin_findNote')}</span>
        </div>

        <div style={{ marginTop:'auto', paddingTop:20, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:font.sm, color:color.muted, overflowWrap:'anywhere' }}>
          <Icon name="mail" size={14} color={color.faint} />{user.email}
        </div>
      </div>
    </div>
  );
}
