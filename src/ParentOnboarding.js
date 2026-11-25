import React, { useState } from 'react';
import { supabase } from './supabase';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useLanguage } from './i18n';


const ORANGE = '#FF6B35';

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

  const steps = [
    {
      emoji: '🐾',
      title: tr('parentOnboarding_welcomeTitle', { name: userName || tr('parentOnboarding_defaultName') }),
      sub: tr('parentOnboarding_welcomeSub', { city }),
      content: (
        <div>
          {[
            { emoji:'🛡️', title:tr('parentOnboarding_featureAadhaarTitle'), sub:tr('parentOnboarding_featureAadhaarSub') },
            { emoji:'📍', title:tr('parentOnboarding_featureGpsTitle'), sub:tr('parentOnboarding_featureGpsSub') },
            { emoji:'💬', title:tr('parentOnboarding_featureReportsTitle'), sub:tr('parentOnboarding_featureReportsSub') },
            { emoji:'⭐', title:tr('parentOnboarding_featureRatedTitle'), sub:tr('parentOnboarding_featureRatedSub') },
          ].map((item,i) => (
            <div key={i} style={{ display:'flex', gap:14, padding:'14px 0', borderBottom:i<3?'1px solid #F5F5F5':'none', alignItems:'flex-start' }}>
              <div style={{ width:44, height:44, borderRadius:14, background:'#FFF0EB', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{item.emoji}</div>
              <div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>{item.title}</div>
                <div style={{ fontSize:13, color:'#888', lineHeight:1.5 }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      ),
      btnLabel: tr('parentOnboarding_letsGoButton'),
      canNext: true,
    },
    {
      emoji: '📋',
      title: tr('parentOnboarding_responsibilitiesTitle'),
      sub: tr('parentOnboarding_responsibilitiesSub'),
      content: (
        <div>
          <div style={{ background:'#FFF0EB', borderRadius:14, padding:'12px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:18, flexShrink:0 }}>ℹ️</span>
            <div style={{ fontSize:12, color:'#FF6B35', lineHeight:1.6 }}>{tr('parentOnboarding_responsibilitiesInfo')}</div>
          </div>
          {[
            { emoji:'🦺', title:tr('parentOnboarding_reqCollarTitle'), detail:tr('parentOnboarding_reqCollarDetail'), must:true },
            { emoji:'💧', title:tr('parentOnboarding_reqWaterTitle'), detail:tr('parentOnboarding_reqWaterDetail'), must:true },
            { emoji:'⚠️', title:tr('parentOnboarding_reqAggressionTitle'), detail:tr('parentOnboarding_reqAggressionDetail'), must:true },
            { emoji:'💊', title:tr('parentOnboarding_reqMedicationTitle'), detail:tr('parentOnboarding_reqMedicationDetail'), must:false },
            { emoji:'🤝', title:tr('parentOnboarding_reqRespectTitle'), detail:tr('parentOnboarding_reqRespectDetail'), must:false },
            { emoji:'📱', title:tr('parentOnboarding_reqOtpTitle'), detail:tr('parentOnboarding_reqOtpDetail'), must:true },
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'12px 0', borderBottom:i<5?'1px solid #F5F5F5':'none', alignItems:'flex-start' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:item.must?'#FFF0EB':'#F8F8F8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{item.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{item.title}</div>
                  {item.must && <span style={{ fontSize:10, background:'#FCEBEB', color:'#A32D2D', borderRadius:6, padding:'1px 6px', fontWeight:600 }}>{tr('parentOnboarding_requiredBadge')}</span>}
                </div>
                <div style={{ fontSize:12, color:'#888', lineHeight:1.5 }}>{item.detail}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:14, background:'#E8F5E9', borderRadius:12, padding:'10px 14px', display:'flex', gap:8 }}>
            <span style={{ fontSize:16 }}>✓</span>
            <div style={{ fontSize:12, color:'#2E7D32', lineHeight:1.5 }}>{tr('parentOnboarding_agreeNote')}</div>
          </div>
        </div>
      ),
      btnLabel: tr('parentOnboarding_agreeButton'),
      canNext: true,
    },
    {
      emoji: '🐕',
      title: tr('parentOnboarding_dogInfoTitle'),
      sub: tr('parentOnboarding_dogInfoSub'),
      content: (
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>{tr('parentOnboarding_dogNameLabel')}</div>
          <input value={petName} onChange={e => setPetName(e.target.value)} placeholder={tr('parentOnboarding_dogNamePlaceholder')}
            style={{ width:'100%', padding:'14px 16px', borderRadius:14, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', marginBottom:14, boxSizing:'border-box' }} />
          <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>{tr('parentOnboarding_breedLabel')}</div>
          <select value={petBreed} onChange={e => setPetBreed(e.target.value)}
            style={{ width:'100%', padding:'14px 16px', borderRadius:14, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', marginBottom:14, background:'white', boxSizing:'border-box' }}>
            <option value="">{tr('parentOnboarding_selectBreedPlaceholder')}</option>
            {['Labrador','Golden Retriever','German Shepherd','Beagle','Pug','Shih Tzu','Pomeranian','Indie/Mixed','Husky','Other'].map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>{tr('parentOnboarding_ageLabel')}</div>
          <input value={petAge} onChange={e => setPetAge(e.target.value.replace(/\D/g,''))} placeholder={tr('parentOnboarding_agePlaceholder')} type="tel"
            style={{ width:'100%', padding:'14px 16px', borderRadius:14, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', marginBottom:0, boxSizing:'border-box' }} />
          <div style={{ marginTop:16, background:'#FFF0EB', borderRadius:12, padding:'10px 14px', fontSize:12, color:'#FF6B35' }}>
            {tr('parentOnboarding_moreDetailsHint')}
          </div>
        </div>
      ),
      btnLabel: saving ? tr('common_saving') : tr('parentOnboarding_findSittersButton'),
      canNext: true,
    },
  ];

  const current = steps[step];

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      <div style={{ background:'linear-gradient(135deg,#FF6B35,#FF8C5A)', padding:'48px 20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s-1)}
              style={{ background:'rgba(255,255,255,0.2)', border:'none', borderRadius:12, padding:'8px 12px', color:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
              <ArrowLeft size={16} /> {tr('common_back')}
            </button>
          )}
          <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
            {steps.map((_,i) => (
              <div key={i} style={{ width:i===step?24:8, height:8, borderRadius:4, background:i<=step?'white':'rgba(255,255,255,0.3)', transition:'width 0.2s' }} />
            ))}
          </div>
        </div>
        <div style={{ fontSize:36, marginBottom:12 }}>{current.emoji}</div>
        <div style={{ color:'white', fontSize:22, fontWeight:700, marginBottom:6 }}>{current.title}</div>
        <div style={{ color:'rgba(255,255,255,0.75)', fontSize:14, lineHeight:1.5 }}>{current.sub}</div>
      </div>

      <div style={{ padding:'20px 20px 0' }}>
        <div style={{ background:'white', borderRadius:20, padding:20, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          {current.content}
        </div>
      </div>

      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', padding:'12px 20px calc(28px + env(safe-area-inset-bottom))' }}>
        <button
          onClick={() => { if(step < steps.length-1) setStep(s=>s+1); else savePet(); }}
          disabled={saving}
          style={{ width:'100%', padding:'16px 0', borderRadius:16, border:'none', background:ORANGE, color:'white', fontSize:15, fontWeight:700, cursor:'pointer' }}>
          {current.btnLabel}
        </button>
        <button onClick={onDone}
          style={{ width:'100%', marginTop:8, padding:'10px 0', background:'none', border:'none', color:'#AAA', fontSize:13, cursor:'pointer' }}>
          {tr('parentOnboarding_skipForNow')}
        </button>
      </div>
    </div>
  );
}