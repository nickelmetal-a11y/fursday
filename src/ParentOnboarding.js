import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

export default function ParentOnboarding({ onDone, city, userName }) {
  const { t: tr } = useLanguage();
  const [step, setStep] = useState(0);
  const [petName, setPetName] = useState('');
  const [petBreed, setPetBreed] = useState('');
  const [petAge, setPetAge] = useState('');
  const [saving, setSaving] = useState(false);

  const BREEDS = ['Labrador','Golden Retriever','German Shepherd','Beagle','Pug','Shih Tzu','Pomeranian','Indie/Mixed','Husky','Other'];

  const savePet = async () => {
    if (!petName.trim()) { onDone(); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('pet_profiles').insert({
          user_id: user.id,
          name: petName.trim(),
          breed: petBreed || null,
          age_years: parseInt(petAge) || null,
        });
        if (error) { alert(tr('parentOnboarding_petSaveError') + error.message); setSaving(false); return; }
      }
    } catch(e) { console.log('Pet save error:', e); }
    setSaving(false);
    onDone();
  };

  const rowTitle = { fontSize:font.md, fontWeight:600, color:color.ink, marginBottom:2 };
  const rowSub = { fontSize:13, color:color.muted, lineHeight:1.5 };
  const note = (tone, icon, text) => (
    <div style={{ background:color[tone + 'Soft'], color:color[tone], borderRadius:radius.md, padding:'10px 12px', display:'flex', gap:8, alignItems:'flex-start', fontSize:font.sm, lineHeight:1.55 }}>
      <Icon name={icon} size={16} style={{ marginTop:1 }} /><div>{text}</div>
    </div>
  );

  const steps = [
    {
      icon: 'paw',
      title: tr('parentOnboarding_welcomeTitle', { name: userName || tr('parentOnboarding_defaultName') }),
      sub: tr('parentOnboarding_welcomeSub', { city }),
      content: (
        <div>
          {[
            { icon:'shield', title:tr('parentOnboarding_featureAadhaarTitle'), sub:tr('parentOnboarding_featureAadhaarSub') },
            { icon:'pin', title:tr('parentOnboarding_featureGpsTitle'), sub:tr('parentOnboarding_featureGpsSub') },
            { icon:'message', title:tr('parentOnboarding_featureReportsTitle'), sub:tr('parentOnboarding_featureReportsSub') },
            { icon:'star', title:tr('parentOnboarding_featureRatedTitle'), sub:tr('parentOnboarding_featureRatedSub') },
          ].map((item,i) => (
            <div key={i} style={{ display:'flex', gap:14, padding:'14px 0', borderTop:i?`1px solid ${color.line}`:'none', alignItems:'flex-start' }}>
              <div style={{ ...ui.iconTile, width:44, height:44 }}><Icon name={item.icon} size={21} /></div>
              <div>
                <div style={rowTitle}>{item.title}</div>
                <div style={rowSub}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      ),
      btnLabel: tr('parentOnboarding_letsGoButton'),
      canNext: true,
    },
    {
      icon: 'fileText',
      title: tr('parentOnboarding_responsibilitiesTitle'),
      sub: tr('parentOnboarding_responsibilitiesSub'),
      content: (
        <div>
          <div style={{ marginBottom:6 }}>{note('info', 'info', tr('parentOnboarding_responsibilitiesInfo'))}</div>
          {[
            { icon:'tag', title:tr('parentOnboarding_reqCollarTitle'), detail:tr('parentOnboarding_reqCollarDetail'), must:true },
            { icon:'droplet', title:tr('parentOnboarding_reqWaterTitle'), detail:tr('parentOnboarding_reqWaterDetail'), must:true },
            { icon:'alert', title:tr('parentOnboarding_reqAggressionTitle'), detail:tr('parentOnboarding_reqAggressionDetail'), must:true },
            { icon:'pill', title:tr('parentOnboarding_reqMedicationTitle'), detail:tr('parentOnboarding_reqMedicationDetail'), must:false },
            { icon:'heart', title:tr('parentOnboarding_reqRespectTitle'), detail:tr('parentOnboarding_reqRespectDetail'), must:false },
            { icon:'smartphone', title:tr('parentOnboarding_reqOtpTitle'), detail:tr('parentOnboarding_reqOtpDetail'), must:true },
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'12px 0', borderTop:i?`1px solid ${color.line}`:'none', alignItems:'flex-start' }}>
              <div style={{ ...ui.iconTile, width:40, height:40 }}><Icon name={item.icon} size={19} /></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:6, marginBottom:2 }}>
                  <div style={{ ...rowTitle, marginBottom:0, fontSize:13 }}>{item.title}</div>
                  {item.must && <span style={ui.badge('danger')}>{tr('parentOnboarding_requiredBadge')}</span>}
                </div>
                <div style={{ ...rowSub, fontSize:font.sm }}>{item.detail}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:8 }}>{note('success', 'check', tr('parentOnboarding_agreeNote'))}</div>
        </div>
      ),
      btnLabel: tr('parentOnboarding_agreeButton'),
      canNext: true,
    },
    {
      icon: 'edit',
      title: tr('parentOnboarding_dogInfoTitle'),
      sub: tr('parentOnboarding_dogInfoSub'),
      content: (
        <div>
          <label htmlFor="po-name" style={ui.label}>{tr('parentOnboarding_dogNameLabel')}</label>
          <input id="po-name" value={petName} onChange={e => setPetName(e.target.value)} placeholder={tr('parentOnboarding_dogNamePlaceholder')} aria-label={tr('parentOnboarding_dogNameLabel')}
            style={{ ...ui.input, marginBottom:14 }} />
          <label htmlFor="po-breed" style={ui.label}>{tr('parentOnboarding_breedLabel')}</label>
          <select id="po-breed" value={petBreed} onChange={e => setPetBreed(e.target.value)} aria-label={tr('parentOnboarding_breedLabel')}
            style={{ ...ui.input, marginBottom:14 }}>
            <option value="">{tr('parentOnboarding_selectBreedPlaceholder')}</option>
            {BREEDS.map(b => <option key={b} value={b}>{b === 'Indie/Mixed' ? tr('pet_breedIndie') : b === 'Other' ? tr('pet_breedOther') : b}</option>)}
          </select>
          <label htmlFor="po-age" style={ui.label}>{tr('parentOnboarding_ageLabel')}</label>
          <input id="po-age" value={petAge} onChange={e => setPetAge(e.target.value.replace(/\D/g,''))} placeholder={tr('parentOnboarding_agePlaceholder')} aria-label={tr('parentOnboarding_ageLabel')} type="tel" inputMode="numeric"
            style={ui.input} />
          <div style={{ marginTop:16 }}>{note('info', 'info', tr('parentOnboarding_moreDetailsHint'))}</div>
        </div>
      ),
      btnLabel: saving ? tr('common_saving') : tr('parentOnboarding_findSittersButton'),
      canNext: true,
    },
  ];

  const current = steps[step];

  return (
    <div style={{ ...ui.page, paddingBottom:'calc(140px + env(safe-area-inset-bottom))' }}>
      <div style={{ ...ui.header, minHeight:65, boxSizing:'border-box' }}>
        {step > 0 && (
          <button type="button" onClick={() => setStep(s => s-1)} style={ui.backButton} aria-label={tr('common_back')}>
            <Icon name="arrowLeft" size={20} />
          </button>
        )}
        <div aria-hidden="true" style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          {steps.map((_,i) => (
            <div key={i} style={{ width:i===step?24:8, height:6, borderRadius:3, background:i<=step?color.navy:color.line, transition:'width 0.2s' }} />
          ))}
        </div>
      </div>

      <div style={{ padding:'24px 16px 0' }}>
        <div style={{ ...ui.iconTile, background:color.navySoft, marginBottom:14 }}><Icon name={current.icon} size={24} /></div>
        <h1 style={{ fontSize:font.xxl, fontWeight:700, color:color.ink, margin:'0 0 6px', letterSpacing:-0.3 }}>{current.title}</h1>
        <div style={{ fontSize:font.md, color:color.muted, lineHeight:1.5 }}>{current.sub}</div>
      </div>

      <div style={{ padding:'18px 16px 0' }}>
        <div style={{ ...ui.card, padding:'6px 16px 16px' }}>
          <div style={{ paddingTop:10 }}>{current.content}</div>
        </div>
      </div>

      <div style={{ position:'fixed', bottom:0, left:0, right:0, maxWidth:480, margin:'0 auto', boxSizing:'border-box', background:color.surface, borderTop:`1px solid ${color.line}`, padding:'12px 16px calc(12px + env(safe-area-inset-bottom))', zIndex:100 }}>
        <button
          onClick={() => { if(step < steps.length-1) setStep(s=>s+1); else savePet(); }}
          disabled={saving}
          style={{ ...ui.primaryButton, width:'100%' }}>
          {current.btnLabel}
        </button>
        <button onClick={onDone}
          style={{ width:'100%', marginTop:4, minHeight:44, background:'none', border:'none', color:color.muted, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          {tr('parentOnboarding_skipForNow')}
        </button>
      </div>
    </div>
  );
}