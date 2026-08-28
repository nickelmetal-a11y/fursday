const fs = require('fs');
const code = `import React, { useState } from 'react';
import { supabase } from './supabase';

const ORANGE = '#FF6B35';
const DARK = '#0f0f1a';

export default function FirstLoginPrompt({ user, onDone }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (name.trim().length < 2) { setError('Please enter your full name'); return; }
    setSaving(true);
    const { error } = await supabase.from('users').upsert({
      id: user.id,
      name: name.trim(),
      email: user.email,
    }, { onConflict: 'id' });
    if (error) { setError('Could not save. Please try again.'); setSaving(false); return; }
    onDone(name.trim());
  };

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:DARK, fontFamily:'-apple-system,sans-serif', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 24px' }}>
      <div style={{ width:72, height:72, borderRadius:22, background:ORANGE, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, marginBottom:24 }}>
        🐾
      </div>
      <div style={{ fontSize:26, fontWeight:700, color:'white', marginBottom:8, textAlign:'center' }}>
        Welcome to Fursday!
      </div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:40, textAlign:'center', lineHeight:1.6 }}>
        What should we call you?
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
        placeholder="Your full name"
        autoFocus
        style={{ width:'100%', padding:'16px', borderRadius:14, border:'1.5px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', fontSize:16, color:'white', outline:'none', fontFamily:'inherit', boxSizing:'border-box', marginBottom:12 }}
      />

      <button onClick={handleSave} disabled={saving || name.trim().length < 2}
        style={{ width:'100%', padding:'16px 0', borderRadius:14, border:'none', background:name.trim().length >= 2 ? ORANGE : 'rgba(255,255,255,0.1)', color:'white', fontSize:15, fontWeight:700, cursor:name.trim().length >= 2 ? 'pointer' : 'not-allowed' }}>
        {saving ? 'Saving...' : 'Get started →'}
      </button>

      <div style={{ marginTop:24, fontSize:12, color:'rgba(255,255,255,0.2)', textAlign:'center' }}>
        {user.email}
      </div>
    </div>
  );
}`;

fs.writeFileSync('C:\\Users\\nikhil.a.mathur\\SynologyDrive\\Home Project\\fursday\\src\\FirstLoginPrompt.js', code, 'utf8');
console.log('Done, bytes:', code.length);
