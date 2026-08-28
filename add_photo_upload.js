const fs = require('fs');
let sd = fs.readFileSync('src/WalkReportCard.js', 'utf8');
let log = [];
const L = s => { log.push(s); console.log(s); };

// 1. Add supabase import + useRef
sd = sd.replace(
  `import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Camera, Heart, Share2 } from 'lucide-react';`,
  `import React, { useState, useRef } from 'react';
import { ArrowLeft, CheckCircle, Camera, Heart, Share2, X } from 'lucide-react';
import { supabase } from './supabase';

// Compress an image file to ~1200px max, 80% quality JPEG (keeps 10MB iPhone photos small for 4G)
const compressImage = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1200;
      let { width, height } = img;
      if (width > height && width > maxDim) { height = height * maxDim / width; width = maxDim; }
      else if (height > maxDim) { width = width * maxDim / height; height = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});`
);
L('1. imports + compressImage helper added');

// 2. Add photo state + upload handler after the r state declaration
sd = sd.replace(
  `  const upd = (f,v) => setR(p => ({...p,[f]:v}));`,
  `  const upd = (f,v) => setR(p => ({...p,[f]:v}));
  const [photos, setPhotos] = useState([]);        // {url, uploading}
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 3) { alert('Maximum 3 photos'); return; }
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const fileName = 'walk-' + (b.id || 'test') + '-' + Date.now() + '.jpg';
      const { data, error } = await supabase.storage.from('walk-photos').upload(fileName, compressed, { contentType:'image/jpeg', upsert:true });
      if (error) { alert('Upload failed: ' + error.message); setUploadingPhoto(false); return; }
      const { data: urlData } = supabase.storage.from('walk-photos').getPublicUrl(fileName);
      setPhotos(prev => [...prev, { url: urlData.publicUrl }]);
    } catch(err) { alert('Photo error: ' + err.message); }
    setUploadingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx));`
);
L('2. photo state + upload/remove handlers added');

// 3. Replace the dummy camera boxes with real upload UI
sd = sd.replace(
  `              <div style={{ display:'flex', gap:10, marginBottom:8 }}>
                {[1,2,3].map(i=>(
                  <div key={i} style={{ flex:1, aspectRatio:'1', borderRadius:14, background:t.light, border:'2px dashed '+t.primary, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:4 }}>
                    <Camera size={20} color={t.primary} />
                    <span style={{ fontSize:10, color:t.primary }}>Add</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:'#AAA' }}>Photos sent to parent via WhatsApp</div>`,
  `              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display:'none' }} />
              <div style={{ display:'flex', gap:10, marginBottom:8 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ flex:1, position:'relative', aspectRatio:'1', borderRadius:14, overflow:'hidden' }}>
                    <img src={p.url} alt="walk" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    <div onClick={() => removePhoto(i)} style={{ position:'absolute', top:4, right:4, width:22, height:22, borderRadius:11, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                      <X size={13} color="white" />
                    </div>
                  </div>
                ))}
                {photos.length < 3 && (
                  <div onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                    style={{ flex:1, aspectRatio:'1', borderRadius:14, background:t.light, border:'2px dashed '+t.primary, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:4 }}>
                    {uploadingPhoto ? <span style={{ fontSize:11, color:t.primary }}>Uploading...</span> : <><Camera size={20} color={t.primary} /><span style={{ fontSize:10, color:t.primary }}>Add</span></>}
                  </div>
                )}
                {/* fill empty slots visually */}
                {photos.length < 2 && Array.from({length: 2 - photos.length}).map((_, i) => (
                  <div key={'e'+i} style={{ flex:1, aspectRatio:'1' }} />
                ))}
              </div>
              <div style={{ fontSize:11, color:'#AAA' }}>{photos.length}/3 photos · compressed for fast sending</div>`
);
L('3. dummy camera boxes replaced with real upload UI');

// 4. Make send() actually save the report + photos to Supabase
sd = sd.replace(
  `  const send = () => { setSending(true); setTimeout(()=>{ setSending(false); setSent(true); },2000); };`,
  `  const send = async () => {
    setSending(true);
    try {
      await supabase.from('walk_reports').insert({
        booking_id: b.id || null,
        pee: r.pee, poo: r.poo, water: r.water, food: r.food,
        mood: r.mood, duration_mins: parseInt(r.mins) || null, distance_km: parseFloat(r.km) || null,
        zone: r.zone || null, heat_safe: r.heat, stray: r.stray,
        highlight: r.highlight || null, notes: r.notes || null, next_rec: r.nextrec || null,
        gate_in: r.gatein || null, gate_out: r.gateout || null,
        photo_urls: photos.map(p => p.url),
      });
    } catch(err) { console.log('Report save error:', err); }
    setSending(false);
    setSent(true);
  };`
);
L('4. send() now saves report + photo URLs to walk_reports table');

// 5. Show photos in the preview (step 3) — add after the notes block in preview
sd = sd.replace(
  `              {r.notes ? (
                <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'10px 14px' }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>From {sitter}</div>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.6 }}>{r.notes}</div>
                </div>
              ) : null}`,
  `              {r.notes ? (
                <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'10px 14px', marginBottom:8 }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>From {sitter}</div>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,0.8)', lineHeight:1.6 }}>{r.notes}</div>
                </div>
              ) : null}
              {photos.length > 0 && (
                <div style={{ display:'flex', gap:6, marginTop:4 }}>
                  {photos.map((p, i) => (
                    <div key={i} style={{ flex:1, aspectRatio:'1', borderRadius:10, overflow:'hidden' }}>
                      <img src={p.url} alt="walk" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                  ))}
                </div>
              )}`
);
L('5. photos shown in preview');

fs.writeFileSync('src/WalkReportCard.js', sd, 'utf8');
L('\\nDONE');
