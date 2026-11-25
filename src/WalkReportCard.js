import React, { useState, useRef } from 'react';
import { ArrowLeft, CheckCircle, Camera, Heart, Share2, X } from 'lucide-react';
import { supabase } from './supabase';
import { choosePhoto } from './photoPicker';
import { useLanguage } from './i18n';



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
});

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

const getMoods = (tr) => [
  { val:1, emoji:'😰', label:tr('walkReport_moodAnxious') },
  { val:2, emoji:'😕', label:tr('walkReport_moodUnsettled') },
  { val:3, emoji:'😊', label:tr('walkReport_moodGood') },
  { val:4, emoji:'😄', label:tr('walkReport_moodHappy') },
  { val:5, emoji:'🤩', label:tr('walkReport_moodAmazing') },
];

const getStrays = (tr) => [
  { val:'none', label:tr('walkReport_strayNone'), emoji:'✅' },
  { val:'saw', label:tr('walkReport_straySaw'), emoji:'👀' },
  { val:'chased', label:tr('walkReport_strayChased'), emoji:'⚠️' },
  { val:'scuffle', label:tr('walkReport_strayScuffle'), emoji:'🚨' },
];

const ZONES = {
  Gurgaon: ['DLF Phase 1','DLF Phase 2','DLF Phase 3','DLF Phase 4','DLF Phase 5','Nirvana Country','Sushant Lok','Golf Course Road','Sector 56','Other'],
  Pune: ['Koregaon Park','Baner','Viman Nagar','Kharadi','Aundh','Wakad','Kalyani Nagar','Other'],
};

export default function WalkReportCard({ onBack, city, booking, mode }) {
  const { t: tr } = useLanguage();
  const isParent = mode === 'parent';
  const c = city || 'Gurgaon';
  const t = THEMES[c] || THEMES.Gurgaon;
  const zones = ZONES[c] || ZONES.Gurgaon;
  const MOODS = getMoods(tr);
  const STRAYS = getStrays(tr);
  const b = booking || {};
  const pet = b.petName || 'Bruno';
  const sitter = b.sitterName || 'Priya';
  const parent = b.parentName || 'Rahul';

  const [step, setStep] = useState(0);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [r, setR] = useState({
    pee:false, poo:false, water:false, food:false,
    mood:0, mins:'', km:'', zone:'',
    heat:false, stray:'none',
    highlight:'', notes:'', nextrec:'',
    gatein:'', gateout:'',
    time: new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}),
  });

  const upd = (f,v) => setR(p => ({...p,[f]:v}));
  const [photos, setPhotos] = useState([]);        // {url, uploading}
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photos.length >= 3) { alert(tr('walkReport_maxPhotos')); return; }
    setUploadingPhoto(true);
    try {
      const compressed = await compressImage(file);
      const fileName = 'walk-' + (b.id || 'test') + '-' + Date.now() + '.jpg';
      const { data, error } = await supabase.storage.from('walk-photos').upload(fileName, compressed, { contentType:'image/jpeg', upsert:true });
      if (error) { alert(tr('walkReport_uploadFailedPrefix') + error.message); setUploadingPhoto(false); return; }
      const { data: urlData } = supabase.storage.from('walk-photos').getPublicUrl(fileName);
      setPhotos(prev => [...prev, { url: urlData.publicUrl }]);
    } catch(err) { alert(tr('walkReport_photoErrorPrefix') + err.message); }
    setUploadingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx));
  const steps = [tr('walkReport_stepActivity'), tr('walkReport_stepMoodSafety'), tr('walkReport_stepNotes'), tr('walkReport_stepPreviewSend')];

  const S = {
    inp: { width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:14, color:'#1a1a1a', outline:'none', fontFamily:'inherit', background:'#FAFAFA', marginBottom:12, boxSizing:'border-box' },
    card: { background:'white', borderRadius:18, padding:16, marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' },
    sec: { fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:10 },
    lbl: { fontSize:12, color:'#666', marginBottom:6, fontWeight:500 },
  };

  const send = async () => {
    setSending(true);
    try {
      const { error } = await supabase.from('walk_reports').insert({
        booking_id: b.id || null,
        pee: r.pee, poo: r.poo, water: r.water, food: r.food,
        mood: r.mood, duration_mins: parseInt(r.mins) || null, distance_km: parseFloat(r.km) || null,
        zone: r.zone || null, heat_safe: r.heat, stray: r.stray,
        highlight: r.highlight || null, notes: r.notes || null, next_rec: r.nextrec || null,
        gate_in: r.gatein || null, gate_out: r.gateout || null,
        photo_urls: photos.map(p => p.url),
      });
      if (error) { alert(tr('walkReport_sendFailedPrefix') + error.message); setSending(false); return; }
    } catch(err) {
      alert(tr('walkReport_sendFailedPrefix') + err.message);
      setSending(false);
      return;
    }
    setSending(false);
    setSent(true);
  };

  const StepBar = () => (
    <div style={{ display:'flex', alignItems:'center', padding:'12px 20px', background:'white', borderBottom:'1px solid #F5F5F5' }}>
      {steps.map((s,i) => (
        <React.Fragment key={i}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <div style={{ width:26, height:26, borderRadius:8, background: i<step?'#2E7D32':i===step?t.primary:'#F0F0F0', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {i<step ? <CheckCircle size={14} color="white" /> : <span style={{ fontSize:11, fontWeight:600, color:i===step?'white':'#BBB' }}>{i+1}</span>}
            </div>
            <span style={{ fontSize:9, color:i===step?t.primary:i<step?'#2E7D32':'#CCC', fontWeight:i===step?600:400 }}>{s}</span>
          </div>
          {i<steps.length-1 && <div style={{ flex:1, height:2, background:i<step?'#2E7D32':'#F0F0F0', margin:'0 4px 12px' }} />}
        </React.Fragment>
      ))}
    </div>
  );

  if (sent) {
    return (
      <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px', fontFamily:'sans-serif', textAlign:'center' }}>
        <div style={{ fontSize:72, marginBottom:16 }}>🐾</div>
        <div style={{ fontSize:26, fontWeight:700, color:'white', marginBottom:8 }}>{tr('walkReport_sentHeading')}</div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:32, lineHeight:1.6 }}>{tr('walkReport_sentBody', { parent, pet })}</div>
        <div style={{ background:'#128C7E', borderRadius:18, padding:'16px 20px', width:'100%', marginBottom:24, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:24 }}>💬</span>
          <div style={{ textAlign:'left' }}>
            <div style={{ color:'white', fontSize:13, fontWeight:700 }}>{tr('walkReport_whatsappConfirmed')}</div>
            <div style={{ color:'rgba(255,255,255,0.7)', fontSize:12 }}>{tr('walkReport_sentToNumber', { parent })}</div>
          </div>
          <CheckCircle size={20} color="white" style={{ marginLeft:'auto' }} />
        </div>
        <button onClick={onBack} style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:t.primary, color:'white', fontSize:15, fontWeight:600, cursor:'pointer' }}>
          {tr('walkReport_backToHome')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      <div style={{ background:t.grad, padding:'48px 20px 20px', display:'flex', alignItems:'center', gap:12 }}>
        <div onClick={onBack} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
          <ArrowLeft size={18} color="white" />
        </div>
        <div>
          <div style={{ color:'white', fontSize:17, fontWeight:700 }}>{tr('walkReport_headerTitle', { pet })}</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>{tr('walkReport_headerSubtitle', { sitter, time:r.time })}</div>
        </div>
      </div>

      <StepBar />

      <div style={{ padding:'20px 20px 0' }}>

        {step===0 && (
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{tr('walkReport_activityHeading')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:20 }}>{tr('walkReport_activityHint')}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
              {[{f:'pee',e:'💧',l:tr('walkReport_activityPee')},{f:'poo',e:'💩',l:tr('walkReport_activityPoo')},{f:'water',e:'🥤',l:tr('walkReport_activityWater')},{f:'food',e:'🍖',l:tr('walkReport_activityFood')}].map(x => (
                <div key={x.f} onClick={()=>upd(x.f,!r[x.f])}
                  style={{ background:r[x.f]?t.light:'white', border:r[x.f]?'2px solid '+t.primary:'1.5px solid #E0E0E0', borderRadius:16, padding:'14px 8px', textAlign:'center', cursor:'pointer' }}>
                  <div style={{ fontSize:28, marginBottom:6 }}>{x.e}</div>
                  <div style={{ fontSize:12, fontWeight:r[x.f]?700:400, color:r[x.f]?t.primary:'#888' }}>{x.l}</div>
                  {r[x.f] && <div style={{ fontSize:10, color:t.primary, marginTop:3 }}>{tr('walkReport_done')}</div>}
                </div>
              ))}
            </div>
            <div style={S.card}>
              <div style={S.sec}>{tr('walkReport_walkDetails')}</div>
              <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                <div style={{ flex:1 }}>
                  <div style={S.lbl}>{tr('walkReport_durationLabel')}</div>
                  <input value={r.mins} onChange={e=>upd('mins',e.target.value)} placeholder={tr('walkReport_durationPlaceholder')} type="number" style={{...S.inp,marginBottom:0}} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={S.lbl}>{tr('walkReport_distanceLabel')}</div>
                  <input value={r.km} onChange={e=>upd('km',e.target.value)} placeholder={tr('walkReport_distancePlaceholder')} type="number" style={{...S.inp,marginBottom:0}} />
                </div>
              </div>
              <div style={S.lbl}>{tr('walkReport_walkAreaLabel')}</div>
              <select value={r.zone} onChange={e=>upd('zone',e.target.value)} style={{...S.inp,cursor:'pointer'}}>
                <option value="">{tr('walkReport_selectArea')}</option>
                {zones.map(z=><option key={z} value={z}>{z}</option>)}
              </select>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={S.lbl}>{tr('walkReport_gateInLabel')}</div>
                  <input value={r.gatein} onChange={e=>upd('gatein',e.target.value)} placeholder="7:05 AM" style={{...S.inp,marginBottom:0}} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={S.lbl}>{tr('walkReport_gateOutLabel')}</div>
                  <input value={r.gateout} onChange={e=>upd('gateout',e.target.value)} placeholder="7:38 AM" style={{...S.inp,marginBottom:0}} />
                </div>
              </div>
            </div>
          </div>
        )}

        {step===1 && (
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{tr('walkReport_moodHeading', { pet })}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:20 }}>{tr('walkReport_moodHint')}</div>
            <div style={S.card}>
              <div style={S.sec}>{tr('walkReport_overallMood')}</div>
              <div style={{ display:'flex', gap:8 }}>
                {MOODS.map(m=>(
                  <div key={m.val} onClick={()=>upd('mood',m.val)}
                    style={{ flex:1, textAlign:'center', padding:'10px 4px', borderRadius:14, border:r.mood===m.val?'2px solid '+t.primary:'1.5px solid #E0E0E0', background:r.mood===m.val?t.light:'white', cursor:'pointer' }}>
                    <div style={{ fontSize:22, marginBottom:4 }}>{m.emoji}</div>
                    <div style={{ fontSize:10, color:r.mood===m.val?t.primary:'#888', fontWeight:r.mood===m.val?600:400 }}>{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.sec}>{tr('walkReport_indiaSafetyChecks')}</div>
              <div onClick={()=>upd('heat',!r.heat)}
                style={{ background:r.heat?'#E8F5E9':'#FFF8E1', border:r.heat?'1.5px solid #A5D6A7':'1.5px solid #FFE082', borderRadius:14, padding:'12px 14px', marginBottom:12, cursor:'pointer', display:'flex', gap:10, alignItems:'center' }}>
                <span style={{ fontSize:22 }}>🌡️</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{tr('walkReport_heatSafetyObserved')}</div>
                  <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{tr('walkReport_heatSafetyHint')}</div>
                </div>
                <div style={{ width:22, height:22, borderRadius:7, background:r.heat?'#2E7D32':'#E0E0E0', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {r.heat && <CheckCircle size={14} color="white" />}
                </div>
              </div>
              <div style={S.sec}>{tr('walkReport_strayEncounters')}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {STRAYS.map(o=>(
                  <div key={o.val} onClick={()=>upd('stray',o.val)}
                    style={{ padding:'10px 12px', borderRadius:12, border:r.stray===o.val?'2px solid '+t.primary:'1.5px solid #E0E0E0', background:r.stray===o.val?t.light:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:16 }}>{o.emoji}</span>
                    <span style={{ fontSize:12, fontWeight:r.stray===o.val?600:400, color:r.stray===o.val?t.primary:'#555' }}>{o.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step===2 && (
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{tr('walkReport_photosNotesHeading')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:20 }}>{tr('walkReport_photosNotesHint', { parent })}</div>
            <div style={S.card}>
              <div style={S.sec}>{tr('walkReport_walkPhotos')}</div>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display:'none' }} />
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
                  <div onClick={() => !uploadingPhoto && choosePhoto(fileInputRef, handlePhotoSelect, { cameraOnly: true })}
                    style={{ flex:1, aspectRatio:'1', borderRadius:14, background:t.light, border:'2px dashed '+t.primary, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:4 }}>
                    {uploadingPhoto ? <span style={{ fontSize:11, color:t.primary }}>{tr('walkReport_uploading')}</span> : <><Camera size={20} color={t.primary} /><span style={{ fontSize:10, color:t.primary }}>{tr('walkReport_add')}</span></>}
                  </div>
                )}
                {/* fill empty slots visually */}
                {photos.length < 2 && Array.from({length: 2 - photos.length}).map((_, i) => (
                  <div key={'e'+i} style={{ flex:1, aspectRatio:'1' }} />
                ))}
              </div>
              <div style={{ fontSize:11, color:'#AAA' }}>{tr('walkReport_photoCountHint', { n: photos.length })}</div>
            </div>
            <div style={S.card}>
              <div style={S.lbl}>{tr('walkReport_highlightLabel')}</div>
              <input value={r.highlight} onChange={e=>upd('highlight',e.target.value)}
                placeholder={tr('walkReport_highlightPlaceholder', { pet })} style={S.inp} />
              <div style={S.lbl}>{tr('walkReport_messageToLabel', { parent })}</div>
              <textarea value={r.notes} onChange={e=>upd('notes',e.target.value)}
                placeholder={tr('walkReport_messageToPlaceholder', { pet })}
                style={{...S.inp,minHeight:80,resize:'none'}} />
              <div style={S.lbl}>{tr('walkReport_nextRecLabel')}</div>
              <input value={r.nextrec} onChange={e=>upd('nextrec',e.target.value)}
                placeholder={tr('walkReport_nextRecPlaceholder')} style={{...S.inp,marginBottom:0}} />
            </div>
          </div>
        )}

        {step===3 && (
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{tr('walkReport_previewHeading')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>{tr('walkReport_previewHint', { parent })}</div>
            <div style={{ background:'#0f0f1a', borderRadius:24, padding:20, marginBottom:14, border:'1px solid rgba(255,107,53,0.2)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, paddingBottom:12, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width:40, height:40, borderRadius:12, background:t.primary, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🐾</div>
                <div>
                  <div style={{ color:'white', fontSize:14, fontWeight:700 }}>{tr('walkReport_headerTitle', { pet })}</div>
                  <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>{tr('walkReport_headerSubtitle', { sitter, time:r.time })}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                {[
                  { emoji:'⏱️', val:r.mins?r.mins+' min':'--', label:tr('walkReport_statDuration') },
                  { emoji:'📍', val:r.km?r.km+' km':'--', label:tr('walkReport_statDistance') },
                  { emoji:MOODS.find(m=>m.val===r.mood)?MOODS.find(m=>m.val===r.mood).emoji:'😊', val:MOODS.find(m=>m.val===r.mood)?MOODS.find(m=>m.val===r.mood).label:tr('walkReport_moodNotSet'), label:tr('walkReport_statMood') },
                ].map((x,i)=>(
                  <div key={i} style={{ background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'10px 8px', textAlign:'center' }}>
                    <div style={{ fontSize:18, marginBottom:4 }}>{x.emoji}</div>
                    <div style={{ fontSize:12, fontWeight:700, color:'white' }}>{x.val}</div>
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>{x.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                {[{done:r.pee,e:'💧',l:tr('walkReport_chipPee')},{done:r.poo,e:'💩',l:tr('walkReport_chipPoo')},{done:r.water,e:'🥤',l:tr('walkReport_chipWater')},{done:r.food,e:'🍖',l:tr('walkReport_chipTreat')}].map((x,i)=>(
                  <div key={i} style={{ background:x.done?'rgba(46,125,50,0.2)':'rgba(255,255,255,0.04)', borderRadius:20, padding:'5px 10px', display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:13 }}>{x.e}</span>
                    <span style={{ fontSize:11, color:x.done?'#81C784':'rgba(255,255,255,0.3)', fontWeight:x.done?600:400 }}>{x.l} {x.done?'✓':'✗'}</span>
                  </div>
                ))}
              </div>
              {r.heat && (
                <div style={{ background:'rgba(46,125,50,0.15)', borderRadius:10, padding:'6px 12px', marginBottom:8, display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ fontSize:13 }}>🌡️</span>
                  <span style={{ fontSize:12, color:'#81C784', fontWeight:500 }}>{tr('walkReport_heatSafetyObserved')}</span>
                </div>
              )}
              {r.stray!=='none' && (
                <div style={{ background:'rgba(255,152,0,0.15)', borderRadius:10, padding:'6px 12px', marginBottom:8, display:'flex', gap:6, alignItems:'center' }}>
                  <span style={{ fontSize:13 }}>⚠️</span>
                  <span style={{ fontSize:12, color:'#FFB74D', fontWeight:500 }}>{tr('walkReport_straysPrefix')}{(STRAYS.find(o=>o.val===r.stray)||{}).label}</span>
                </div>
              )}
              {r.highlight ? (
                <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'10px 14px', marginBottom:8 }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>{tr('walkReport_highlightCardLabel')}</div>
                  <div style={{ fontSize:13, color:'white', fontStyle:'italic' }}>"{r.highlight}"</div>
                </div>
              ) : null}
              {r.notes ? (
                <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'10px 14px', marginBottom:8 }}>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:4 }}>{tr('walkReport_fromSitter', { sitter })}</div>
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
              )}
            </div>
            <div style={{ background:'#128C7E', borderRadius:16, padding:'12px 16px', marginBottom:14, display:'flex', gap:10, alignItems:'center' }}>
              <span style={{ fontSize:22 }}>💬</span>
              <div>
                <div style={{ color:'white', fontSize:13, fontWeight:600 }}>{tr('walkReport_sendsViaWhatsapp')}</div>
                <div style={{ color:'rgba(255,255,255,0.7)', fontSize:12 }}>{tr('walkReport_deliveredInstantly', { parent })}</div>
              </div>
              <Share2 size={18} color="white" style={{ marginLeft:'auto' }} />
            </div>
            <div style={{ background:'#E8F5E9', borderRadius:14, padding:'10px 14px', display:'flex', gap:8 }}>
              <Heart size={14} color="#2E7D32" style={{ flexShrink:0, marginTop:2 }} />
              <div style={{ fontSize:12, color:'#2E7D32', lineHeight:1.6 }}>{tr('walkReport_rebookTipPrefix')}<strong>{tr('walkReport_rebookTipBold')}</strong>{tr('walkReport_rebookTipSuffix')}</div>
            </div>
          </div>
        )}

      </div>

      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', padding:'12px 20px calc(28px + env(safe-area-inset-bottom))', display:'flex', gap:10 }}>
        {step>0 && (
          <button onClick={()=>setStep(s=>s-1)} style={{ flex:1, padding:'14px 0', borderRadius:14, border:'1.5px solid #E0E0E0', background:'white', color:'#555', fontSize:14, fontWeight:600, cursor:'pointer' }}>
            {tr('common_back')}
          </button>
        )}
        <button onClick={()=>{ if(step<steps.length-1) setStep(s=>s+1); else send(); }}
          style={{ flex:2, padding:'14px 0', borderRadius:14, border:'none', background:sending?'#CCC':t.primary, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          {sending?tr('common_sending'):step===steps.length-1?tr('walkReport_sendToWhatsapp'):tr('walkReport_continue')}
        </button>
      </div>
    </div>
  );
}