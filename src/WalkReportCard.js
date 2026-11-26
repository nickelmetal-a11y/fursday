import React, { useState, useRef } from 'react';
import { supabase } from './supabase';
import { choosePhoto } from './photoPicker';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';



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

const getMoods = (tr) => [
  { val:1, label:tr('walkReport_moodAnxious') },
  { val:2, label:tr('walkReport_moodUnsettled') },
  { val:3, label:tr('walkReport_moodGood') },
  { val:4, label:tr('walkReport_moodHappy') },
  { val:5, label:tr('walkReport_moodAmazing') },
];

const getStrays = (tr) => [
  { val:'none', label:tr('walkReport_strayNone'), tone:'success' },
  { val:'saw', label:tr('walkReport_straySaw'), tone:'info' },
  { val:'chased', label:tr('walkReport_strayChased'), tone:'warning' },
  { val:'scuffle', label:tr('walkReport_strayScuffle'), tone:'danger' },
];

const ZONES = {
  Gurgaon: ['DLF Phase 1','DLF Phase 2','DLF Phase 3','DLF Phase 4','DLF Phase 5','Nirvana Country','Sushant Lok','Golf Course Road','Sector 56','Other'],
  Pune: ['Koregaon Park','Baner','Viman Nagar','Kharadi','Aundh','Wakad','Kalyani Nagar','Other'],
};

export default function WalkReportCard({ onBack, city, booking, mode }) {
  const { t: tr, lang } = useLanguage();
  const isParent = mode === 'parent';
  const c = city || 'Gurgaon';
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
    time: new Date().toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN',{hour:'2-digit',minute:'2-digit'}),
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

  const S = {
    inp: { ...ui.input, fontSize: font.md, background: color.surface, marginBottom: 12 },
    card: { ...ui.card, marginBottom: 12 },
    sec: { fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 10 },
    lbl: ui.label,
  };
  const heading = { fontSize: font.xl, fontWeight: 700, color: color.ink, margin: '0 0 4px', lineHeight: 1.3 };
  const sub = { fontSize: font.md, color: color.muted, margin: '0 0 16px', lineHeight: 1.5 };
  const checkBox = (on) => (
    <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: 6, border: on ? 'none' : `1.5px solid ${color.faint}`, background: on ? color.navy : color.surface, color: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {on && <Icon name="check" size={15} strokeWidth={2.4} />}
    </span>
  );
  const selectedMood = MOODS.find(m => m.val === r.mood);

  const stepBar = (
    <div style={{ display: 'flex', alignItems: 'flex-start', padding: '12px 16px', background: color.surface, borderBottom: `1px solid ${color.line}` }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 60, flexShrink: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: radius.pill, background: i < step ? color.success : i === step ? color.navy : color.tile, color: i <= step ? color.surface : color.faint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: font.xs, fontWeight: 700 }}>
              {i < step ? <Icon name="check" size={14} strokeWidth={2.4} /> : i + 1}
            </div>
            <span style={{ fontSize: font.xs, lineHeight: 1.2, textAlign: 'center', color: i === step ? color.navy : i < step ? color.success : color.faint, fontWeight: i === step ? 600 : 400 }}>{s}</span>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < step ? color.success : color.line, marginTop: 12 }} />}
        </React.Fragment>
      ))}
    </div>
  );

  if (sent) {
    return (
      <div style={{ ...ui.page, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', textAlign: 'center', boxSizing: 'border-box' }}>
        <div style={{ width: 72, height: 72, borderRadius: radius.pill, background: color.successSoft, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
          <Icon name="check" size={36} strokeWidth={2.2} />
        </div>
        <div style={{ fontSize: font.xxl, fontWeight: 700, color: color.ink, marginBottom: 8 }}>{tr('walkReport_sentHeading')}</div>
        <div style={{ fontSize: font.md, color: color.muted, marginBottom: 24, lineHeight: 1.6 }}>{tr('walkReport_sentBody', { parent, pet })}</div>
        <div style={{ ...S.card, width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', marginBottom: 20 }}>
          <span style={{ ...ui.iconTile, width: 40, height: 40, background: color.successSoft, color: color.success }}><Icon name="message" size={20} /></span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: color.ink, fontSize: font.md, fontWeight: 600 }}>{tr('walkReport_whatsappConfirmed')}</div>
            <div style={{ color: color.muted, fontSize: font.sm }}>{tr('walkReport_sentToNumber', { parent })}</div>
          </div>
          <Icon name="check" size={20} color={color.success} style={{ marginLeft: 'auto' }} />
        </div>
        <button onClick={onBack} style={{ ...ui.primaryButton, width: '100%' }}>
          {tr('walkReport_backToHome')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ ...ui.page, paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
      <div style={ui.header}>
        <button type="button" aria-label={tr('common_back')} onClick={onBack} style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 style={ui.headerTitle}>{tr('walkReport_headerTitle', { pet })}</h1>
          <div style={{ color: color.muted, fontSize: font.sm }}>{tr('walkReport_headerSubtitle', { sitter, time:r.time })}</div>
        </div>
      </div>

      {stepBar}

      <div style={{ padding: '20px 16px 0' }}>

        {step===0 && (
          <div>
            <h2 style={heading}>{tr('walkReport_activityHeading')}</h2>
            <p style={sub}>{tr('walkReport_activityHint')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[{f:'pee',l:tr('walkReport_activityPee')},{f:'poo',l:tr('walkReport_activityPoo')},{f:'water',l:tr('walkReport_activityWater')},{f:'food',l:tr('walkReport_activityFood')}].map(x => (
                <button type="button" key={x.f} aria-pressed={r[x.f]} onClick={()=>upd(x.f,!r[x.f])}
                  style={{ fontFamily: 'inherit', background: r[x.f] ? color.navySoft : color.surface, border: `1.5px solid ${r[x.f] ? color.navy : color.line}`, borderRadius: radius.lg, padding: '14px 12px', minHeight: 64, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {checkBox(r[x.f])}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: font.md, fontWeight: 600, color: color.ink, lineHeight: 1.3 }}>{x.l}</span>
                    {r[x.f] && <span style={{ display: 'block', fontSize: font.xs, color: color.navy, marginTop: 2 }}>{tr('walkReport_done')}</span>}
                  </span>
                </button>
              ))}
            </div>
            <div style={S.card}>
              <div style={S.sec}>{tr('walkReport_walkDetails')}</div>
              <div style={{ display:'flex', gap:10, marginBottom:12 }}>
                <div style={{ flex:1, minWidth: 0 }}>
                  <div style={S.lbl}>{tr('walkReport_durationLabel')}</div>
                  <input value={r.mins} onChange={e=>upd('mins',e.target.value)} placeholder={tr('walkReport_durationPlaceholder')} type="number" aria-label={tr('walkReport_durationLabel')} style={{...S.inp,marginBottom:0}} />
                </div>
                <div style={{ flex:1, minWidth: 0 }}>
                  <div style={S.lbl}>{tr('walkReport_distanceLabel')}</div>
                  <input value={r.km} onChange={e=>upd('km',e.target.value)} placeholder={tr('walkReport_distancePlaceholder')} type="number" aria-label={tr('walkReport_distanceLabel')} style={{...S.inp,marginBottom:0}} />
                </div>
              </div>
              <div style={S.lbl}>{tr('walkReport_walkAreaLabel')}</div>
              <select value={r.zone} onChange={e=>upd('zone',e.target.value)} aria-label={tr('walkReport_walkAreaLabel')} style={{...S.inp,cursor:'pointer'}}>
                <option value="">{tr('walkReport_selectArea')}</option>
                {zones.map(z=><option key={z} value={z}>{z==='Other' ? tr('walkReport_zoneOther') : z}</option>)}
              </select>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1, minWidth: 0 }}>
                  <div style={S.lbl}>{tr('walkReport_gateInLabel')}</div>
                  <input value={r.gatein} onChange={e=>upd('gatein',e.target.value)} placeholder="7:05 AM" aria-label={tr('walkReport_gateInLabel')} style={{...S.inp,marginBottom:0}} />
                </div>
                <div style={{ flex:1, minWidth: 0 }}>
                  <div style={S.lbl}>{tr('walkReport_gateOutLabel')}</div>
                  <input value={r.gateout} onChange={e=>upd('gateout',e.target.value)} placeholder="7:38 AM" aria-label={tr('walkReport_gateOutLabel')} style={{...S.inp,marginBottom:0}} />
                </div>
              </div>
            </div>
          </div>
        )}

        {step===1 && (
          <div>
            <h2 style={heading}>{tr('walkReport_moodHeading', { pet })}</h2>
            <p style={sub}>{tr('walkReport_moodHint')}</p>
            <div style={S.card}>
              <div style={S.sec}>{tr('walkReport_overallMood')}</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {MOODS.map(m=>(
                  <button type="button" key={m.val} aria-pressed={r.mood===m.val} onClick={()=>upd('mood',m.val)} style={ui.chip(r.mood===m.val)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={S.card}>
              <div style={S.sec}>{tr('walkReport_indiaSafetyChecks')}</div>
              <button type="button" aria-pressed={r.heat} onClick={()=>upd('heat',!r.heat)}
                style={{ width:'100%', boxSizing:'border-box', fontFamily:'inherit', textAlign:'left', background: r.heat ? color.successSoft : color.bg, border: `1.5px solid ${r.heat ? color.success : color.line}`, borderRadius: radius.md, padding:'12px 14px', marginBottom:16, cursor:'pointer', display:'flex', gap:12, alignItems:'center' }}>
                <span style={{ ...ui.iconTile, width: 40, height: 40, background: color.surface, color: r.heat ? color.success : color.warning }}><Icon name="thermometer" size={20} /></span>
                <div style={{ flex:1, minWidth: 0 }}>
                  <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr('walkReport_heatSafetyObserved')}</div>
                  <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2, lineHeight: 1.4 }}>{tr('walkReport_heatSafetyHint')}</div>
                </div>
                {checkBox(r.heat)}
              </button>
              <div style={S.sec}>{tr('walkReport_strayEncounters')}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {STRAYS.map(o=>(
                  <button type="button" key={o.val} aria-pressed={r.stray===o.val} onClick={()=>upd('stray',o.val)}
                    style={{ fontFamily:'inherit', textAlign:'left', minHeight: 44, padding:'10px 12px', borderRadius: radius.md, border: `1.5px solid ${r.stray===o.val ? color.navy : color.line}`, background: r.stray===o.val ? color.navySoft : color.surface, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: radius.pill, background: color[o.tone], flexShrink: 0 }} />
                    <span style={{ fontSize: font.sm, fontWeight: 600, color: r.stray===o.val ? color.navy : color.text }}>{o.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step===2 && (
          <div>
            <h2 style={heading}>{tr('walkReport_photosNotesHeading')}</h2>
            <p style={sub}>{tr('walkReport_photosNotesHint', { parent })}</p>
            <div style={S.card}>
              <div style={S.sec}>{tr('walkReport_walkPhotos')}</div>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display:'none' }} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:8 }}>
                {photos.map((p, i) => (
                  <div key={i} style={{ position:'relative', aspectRatio:'1', borderRadius: radius.md, overflow:'hidden' }}>
                    <img src={p.url} alt={tr('walkReport_photoAlt')} style={{ width:'100%', height:'100%', objectFit:'cover', display: 'block' }} />
                    <button type="button" aria-label={tr('walkReport_removePhotoAria')} onClick={() => removePhoto(i)} style={{ position:'absolute', top:6, right:6, width:28, height:28, borderRadius: radius.pill, border:'none', padding:0, background: color.surface, color: color.danger, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow: '0 1px 4px rgba(16,24,40,0.2)' }}>
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
                {photos.length < 3 && (
                  <button type="button" onClick={() => !uploadingPhoto && choosePhoto(fileInputRef, handlePhotoSelect, { cameraOnly: true })}
                    style={{ aspectRatio:'1', borderRadius: radius.md, padding:0, fontFamily:'inherit', background: color.tile, border: `1.5px dashed ${color.faint}`, color: color.navy, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', gap:4 }}>
                    {uploadingPhoto ? <span style={{ fontSize: font.xs }}>{tr('walkReport_uploading')}</span> : <><Icon name="camera" size={22} /><span style={{ fontSize: font.xs, fontWeight: 600 }}>{tr('walkReport_add')}</span></>}
                  </button>
                )}
              </div>
              <div style={{ fontSize: font.xs, color: color.muted }}>{tr('walkReport_photoCountHint', { n: photos.length })}</div>
            </div>
            <div style={S.card}>
              <div style={S.lbl}>{tr('walkReport_highlightLabel')}</div>
              <input value={r.highlight} onChange={e=>upd('highlight',e.target.value)} aria-label={tr('walkReport_highlightLabel')}
                placeholder={tr('walkReport_highlightPlaceholder', { pet })} style={S.inp} />
              <div style={S.lbl}>{tr('walkReport_messageToLabel', { parent })}</div>
              <textarea value={r.notes} onChange={e=>upd('notes',e.target.value)} aria-label={tr('walkReport_messageToLabel', { parent })}
                placeholder={tr('walkReport_messageToPlaceholder', { pet })}
                style={{...S.inp,minHeight:80,resize:'none',lineHeight:1.5}} />
              <div style={S.lbl}>{tr('walkReport_nextRecLabel')}</div>
              <input value={r.nextrec} onChange={e=>upd('nextrec',e.target.value)} aria-label={tr('walkReport_nextRecLabel')}
                placeholder={tr('walkReport_nextRecPlaceholder')} style={{...S.inp,marginBottom:0}} />
            </div>
          </div>
        )}

        {step===3 && (
          <div>
            <h2 style={heading}>{tr('walkReport_previewHeading')}</h2>
            <p style={sub}>{tr('walkReport_previewHint', { parent })}</p>
            <div style={S.card}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14, paddingBottom:12, borderBottom: `1px solid ${color.line}` }}>
                <span style={{ ...ui.iconTile, width: 40, height: 40 }}><Icon name="paw" size={20} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: color.ink, fontSize: font.md, fontWeight: 700 }}>{tr('walkReport_headerTitle', { pet })}</div>
                  <div style={{ color: color.muted, fontSize: font.xs }}>{tr('walkReport_headerSubtitle', { sitter, time:r.time })}</div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8, marginBottom:14 }}>
                {[
                  { icon:'clock', val:r.mins?r.mins+' '+tr('walkReport_minUnit'):'--', label:tr('walkReport_statDuration') },
                  { icon:'pin', val:r.km?r.km+' km':'--', label:tr('walkReport_statDistance') },
                  { icon:'star', val:selectedMood ? selectedMood.label : tr('walkReport_moodNotSet'), label:tr('walkReport_statMood') },
                ].map((x,i)=>(
                  <div key={i} style={{ background: color.bg, borderRadius: radius.md, padding:'10px 6px', textAlign:'center', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', color: color.navy, marginBottom: 4 }}><Icon name={x.icon} size={17} /></div>
                    <div style={{ fontSize: font.sm, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.val}</div>
                    <div style={{ fontSize: font.xs, color: color.muted }}>{x.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
                {[{done:r.pee,l:tr('walkReport_chipPee')},{done:r.poo,l:tr('walkReport_chipPoo')},{done:r.water,l:tr('walkReport_chipWater')},{done:r.food,l:tr('walkReport_chipTreat')}].map((x,i)=>(
                  <span key={i} style={x.done ? ui.badge('success') : { ...ui.badge('info'), background: color.tile, color: color.muted }}><Icon name={x.done ? 'check' : 'close'} size={12} /> {x.l}</span>
                ))}
              </div>
              {r.heat && (
                <div style={{ background: color.successSoft, color: color.success, borderRadius: radius.md, padding:'8px 12px', marginBottom:8, display:'flex', gap:8, alignItems:'center', fontSize: font.sm, fontWeight: 600 }}>
                  <Icon name="thermometer" size={16} />
                  <span>{tr('walkReport_heatSafetyObserved')}</span>
                </div>
              )}
              {r.stray!=='none' && (
                <div style={{ background: color.warningSoft, color: color.warning, borderRadius: radius.md, padding:'8px 12px', marginBottom:8, display:'flex', gap:8, alignItems:'center', fontSize: font.sm, fontWeight: 600 }}>
                  <Icon name="alert" size={16} />
                  <span>{tr('walkReport_straysPrefix')}{(STRAYS.find(o=>o.val===r.stray)||{}).label}</span>
                </div>
              )}
              {r.highlight ? (
                <div style={{ background: color.bg, borderRadius: radius.md, padding:'10px 14px', marginBottom:8 }}>
                  <div style={{ fontSize: font.xs, color: color.muted, marginBottom:4 }}>{tr('walkReport_highlightCardLabel')}</div>
                  <div style={{ fontSize: font.md, color: color.ink, fontStyle:'italic' }}>"{r.highlight}"</div>
                </div>
              ) : null}
              {r.notes ? (
                <div style={{ background: color.bg, borderRadius: radius.md, padding:'10px 14px', marginBottom:8 }}>
                  <div style={{ fontSize: font.xs, color: color.muted, marginBottom:4 }}>{tr('walkReport_fromSitter', { sitter })}</div>
                  <div style={{ fontSize: font.md, color: color.text, lineHeight:1.6 }}>{r.notes}</div>
                </div>
              ) : null}
              {photos.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:6, marginTop:4 }}>
                  {photos.map((p, i) => (
                    <div key={i} style={{ aspectRatio:'1', borderRadius: radius.sm, overflow:'hidden' }}>
                      <img src={p.url} alt={tr('walkReport_photoAlt')} style={{ width:'100%', height:'100%', objectFit:'cover', display: 'block' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ ...S.card, display:'flex', gap:12, alignItems:'center' }}>
              <span style={{ ...ui.iconTile, width: 40, height: 40, background: color.successSoft, color: color.success }}><Icon name="message" size={20} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: color.ink, fontSize: font.md, fontWeight: 600 }}>{tr('walkReport_sendsViaWhatsapp')}</div>
                <div style={{ color: color.muted, fontSize: font.sm }}>{tr('walkReport_deliveredInstantly', { parent })}</div>
              </div>
              <Icon name="send" size={18} color={color.muted} style={{ marginLeft:'auto' }} />
            </div>
            <div style={{ background: color.navySoft, borderRadius: radius.md, padding:'10px 14px', display:'flex', gap:8 }}>
              <Icon name="heart" size={16} color={color.navy} style={{ marginTop:2 }} />
              <div style={{ fontSize: font.sm, color: color.text, lineHeight:1.6 }}>{tr('walkReport_rebookTipPrefix')}<strong>{tr('walkReport_rebookTipBold')}</strong>{tr('walkReport_rebookTipSuffix')}</div>
            </div>
          </div>
        )}

      </div>

      <div style={{ position:'fixed', left:0, right:0, bottom:0, zIndex: 60, background: color.surface, borderTop: `1px solid ${color.line}` }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding:'12px 16px calc(12px + env(safe-area-inset-bottom))', display:'flex', gap:10, boxSizing: 'border-box' }}>
          {step>0 && (
            <button onClick={()=>setStep(s=>s-1)} style={{ ...ui.secondaryButton, flex:1 }}>
              {tr('common_back')}
            </button>
          )}
          <button onClick={()=>{ if(step<steps.length-1) setStep(s=>s+1); else send(); }} disabled={sending}
            style={{ ...ui.primaryButton, flex:2, opacity: sending ? 0.7 : 1 }}>
            {sending?tr('common_sending'):step===steps.length-1?tr('walkReport_sendToWhatsapp'):tr('walkReport_continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
