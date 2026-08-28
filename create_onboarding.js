const fs = require('fs');
const code = `import React, { useState } from 'react';
import { supabase } from './supabase';
import { ArrowLeft, CheckCircle } from 'lucide-react';

const ORANGE = '#FF6B35';

export default function ParentOnboarding({ onDone, city, userName }) {
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
        await supabase.from('pet_profiles').insert({
          user_id: user.id,
          name: petName.trim(),
          breed: petBreed || null,
          age_years: parseInt(petAge) || null,
        });
      }
    } catch(e) { console.log('Pet save error:', e); }
    setSaving(false);
    onDone();
  };

  const steps = [
    {
      emoji: '🐾',
      title: 'Welcome to Fursday, ' + (userName || 'there') + '!',
      sub: 'Trusted pet care in ' + city + '. Let us set you up in 2 quick steps.',
      content: (
        <div>
          {[
            { emoji:'🛡️', title:'Aadhaar-verified sitters', sub:'Every sitter is background checked and verified.' },
            { emoji:'📍', title:'GPS-tracked walks', sub:'Watch your dog\'s walk live on the map.' },
            { emoji:'💬', title:'Walk reports after every walk', sub:'Photos, notes, and mood updates sent to you.' },
            { emoji:'⭐', title:'Rated and reviewed', sub:'Only book sitters trusted by other pet parents.' },
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
      btnLabel: "Let's go →",
      canNext: true,
    },
    {
      emoji: '🐕',
      title: 'Tell us about your dog',
      sub: 'This helps sitters prepare for your pet.',
      content: (
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Dog\'s name *</div>
          <input value={petName} onChange={e => setPetName(e.target.value)} placeholder="e.g. Bruno"
            style={{ width:'100%', padding:'14px 16px', borderRadius:14, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', marginBottom:14, boxSizing:'border-box' }} />
          <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Breed</div>
          <select value={petBreed} onChange={e => setPetBreed(e.target.value)}
            style={{ width:'100%', padding:'14px 16px', borderRadius:14, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', marginBottom:14, background:'white', boxSizing:'border-box' }}>
            <option value="">Select breed (optional)</option>
            {['Labrador','Golden Retriever','German Shepherd','Beagle','Pug','Shih Tzu','Pomeranian','Indie/Mixed','Husky','Other'].map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>Age (years)</div>
          <input value={petAge} onChange={e => setPetAge(e.target.value.replace(/\\D/g,''))} placeholder="e.g. 2" type="tel"
            style={{ width:'100%', padding:'14px 16px', borderRadius:14, border:'1.5px solid #E0E0E0', fontSize:15, outline:'none', marginBottom:0, boxSizing:'border-box' }} />
          <div style={{ marginTop:16, background:'#FFF0EB', borderRadius:12, padding:'10px 14px', fontSize:12, color:'#FF6B35' }}>
            You can add more details and photos in your profile later.
          </div>
        </div>
      ),
      btnLabel: saving ? 'Saving...' : 'Find sitters near me 🐾',
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
              <ArrowLeft size={16} /> Back
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

      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', padding:'12px 20px 28px' }}>
        <button
          onClick={() => { if(step < steps.length-1) setStep(s=>s+1); else savePet(); }}
          disabled={saving}
          style={{ width:'100%', padding:'16px 0', borderRadius:16, border:'none', background:ORANGE, color:'white', fontSize:15, fontWeight:700, cursor:'pointer' }}>
          {current.btnLabel}
        </button>
        <button onClick={onDone}
          style={{ width:'100%', marginTop:8, padding:'10px 0', background:'none', border:'none', color:'#AAA', fontSize:13, cursor:'pointer' }}>
          Skip for now
        </button>
      </div>
    </div>
  );
}`;
fs.writeFileSync('C:\\Users\\nikhil.a.mathur\\SynologyDrive\\Home Project\\fursday\\src\\ParentOnboarding.js', code, 'utf8');
console.log('Done ParentOnboarding, bytes:', code.length);
