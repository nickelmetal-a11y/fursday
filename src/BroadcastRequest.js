import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

const SERVICES = [
  { id:'walk30', nameKey:'broadcast_svcWalkName', icon:'walk', subKey:'broadcast_svcWalkSub' },
  { id:'boarding', nameKey:'broadcast_svcBoardingName', icon:'boarding', subKey:'broadcast_svcBoardingSub' },
  { id:'daycare', nameKey:'broadcast_svcDaycareName', icon:'sun', subKey:'broadcast_svcDaycareSub' },
  { id:'dropin', nameKey:'broadcast_svcDropinName', icon:'bell', subKey:'broadcast_svcDropinSub' },
  { id:'housesit', nameKey:'broadcast_svcHousesitName', icon:'home', subKey:'broadcast_svcHousesitSub' },
];

const TIME_SLOTS = ['6:00 AM','7:00 AM','8:00 AM','10:00 AM','11:00 AM','4:00 PM','5:00 PM','6:00 PM','7:00 PM'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const getDays = () => {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  return days;
};

export default function BroadcastRequest({ onBack, city, onSitterAccepted }) {
  const [step, setStep] = useState(0);
  const [service, setService] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedTime, setSelectedTime] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [responses, setResponses] = useState([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const { t: tr, lang } = useLanguage();

  const days = getDays();
  const dayName = (d) => lang === 'hi' ? d.toLocaleDateString('hi-IN', { weekday: 'short' }) : DAY_NAMES[d.getDay()];
  const monthName = (d) => lang === 'hi' ? d.toLocaleDateString('hi-IN', { month: 'short' }) : MONTH_NAMES[d.getMonth()];

  const AREAS = city === 'Pune'
    ? ['Koregaon Park','Baner','Viman Nagar','Kharadi','Aundh','Wakad','Kalyani Nagar', 'Other']
    : ['DLF Phase 1','DLF Phase 2','DLF Phase 3','DLF Phase 4','DLF Phase 5','Nirvana Country','Sushant Lok','Sector 56', 'Other'];
  // 'Other' is the value stored in broadcast_requests.area; only its label is translated.
  const areaLabel = (a) => a === 'Other' ? tr('broadcast_areaOther') : a;

  const serviceLabel = (id) => { const s = SERVICES.find(x => x.id === id); return s ? tr(s.nameKey) : ''; };

  const submitRequest = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + selectedDay);

      const { data } = await supabase.from('broadcast_requests').insert({
        pet_parent_id: user?.id,
        city_id: cityRow?.id,
        service_type: service,
        scheduled_date: bookingDate.toISOString().split('T')[0],
        scheduled_time: selectedTime,
        area: area,
        notes: notes,
        status: 'open',
      }).select().single();

      if (data) setRequestId(data.id);
      setSubmitted(true);
    } catch(e) { console.log('Broadcast error:', e); }
    setSaving(false);
  };

  useEffect(() => {
    if (!requestId) return;
    const loadResponses = async () => {
      setLoadingResponses(true);
      const { data } = await supabase
        .from('broadcast_responses')
        .select('*, sitter_profiles(*, users(name))')
        .eq('request_id', requestId)
        .eq('status', 'accepted');
      const dataWithContact = await Promise.all((data || []).map(async (r) => {
        const sitterUserId = r.sitter_profiles?.user_id;
        if (!sitterUserId) return r;
        const { data: contact } = await supabase.rpc('get_user_contact', { target_id: sitterUserId });
        return { ...r, sitter_profiles: { ...r.sitter_profiles, users: { ...r.sitter_profiles.users, phone: contact?.[0]?.phone } } };
      }));
      setResponses(dataWithContact);
      setLoadingResponses(false);
    };
    loadResponses();
    const interval = setInterval(loadResponses, 10000);
    return () => clearInterval(interval);
  }, [requestId]);

  const acceptSitter = async (response) => {
    const { error: reqError } = await supabase.from('broadcast_requests').update({ status: 'filled', chosen_sitter_id: response.sitter_id }).eq('id', requestId);
    if (reqError) { alert(reqError.message); return; }
    const { error: respError } = await supabase.from('broadcast_responses').update({ status: 'chosen' }).eq('id', response.id);
    if (respError) { alert(respError.message); return; }
    // BookingFlow expects the same sitter shape the Explore screen builds.
    const sp = response.sitter_profiles || {};
    if (onSitterAccepted) onSitterAccepted({ ...sp, id: sp.id || response.sitter_id, name: sp.users?.name || tr('broadcast_sitterFallback'), services: sp.sitter_services || [] });
    onBack();
  };

  const stepTitle = { fontSize:font.xl, fontWeight:700, color:color.ink, margin:'0 0 4px', letterSpacing:-0.2 };
  const stepHint = { fontSize:font.md, color:color.muted, marginBottom:16 };
  const header = (title, sub) => (
    <div style={ui.header}>
      <button type="button" onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}>
        <Icon name="arrowLeft" size={20} />
      </button>
      <div style={{ minWidth:0 }}>
        <h1 style={ui.headerTitle}>{title}</h1>
        {sub && <div style={{ color:color.muted, fontSize:font.sm }}>{sub}</div>}
      </div>
    </div>
  );

  if (submitted) return (
    <div style={{ ...ui.page, paddingBottom:'calc(32px + env(safe-area-inset-bottom))' }}>
      {header(tr('broadcast_headerTitle'))}

      <div style={{ padding:16 }}>
        <div style={{ ...ui.card, display:'flex', gap:14, alignItems:'center', marginBottom:12 }}>
          <span style={{ ...ui.iconTile, background:color.saffronSoft, color:color.saffron }}><Icon name="megaphone" /></span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:font.lg, fontWeight:700, color:color.ink, marginBottom:2 }}>{tr('broadcast_requestSentTitle')}</div>
            <div style={{ fontSize:13, color:color.muted, lineHeight:1.5 }}>{tr('broadcast_requestSentSub')}</div>
          </div>
        </div>

        <div style={{ ...ui.card, marginBottom:20 }}>
          <div style={{ ...ui.sectionTitle, marginBottom:4 }}>{tr('broadcast_yourRequestLabel')}</div>
          {[
            { label:tr('broadcast_labelService'), val: serviceLabel(service) },
            { label:tr('broadcast_labelDate'), val: days[selectedDay] ? dayName(days[selectedDay])+', '+days[selectedDay].getDate()+' '+monthName(days[selectedDay]) : '' },
            { label:tr('broadcast_labelTime'), val: selectedTime },
            { label:tr('broadcast_labelArea'), val: area ? areaLabel(area) : '' },
          ].filter(x=>x.val).map((x,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'8px 0', borderTop:i ? `1px solid ${color.line}` : 'none' }}>
              <span style={{ fontSize:13, color:color.muted }}>{x.label}</span>
              <span style={{ fontSize:13, color:color.ink, fontWeight:500, textAlign:'right' }}>{x.val}</span>
            </div>
          ))}
        </div>

        <h2 style={ui.sectionTitle}>
          {tr('broadcast_sittersWhoCanHelp')} {loadingResponses ? '...' : '(' + responses.length + ')'}
        </h2>

        {responses.length === 0 && (
          <div style={{ ...ui.card, textAlign:'center', padding:28 }}>
            <div style={{ ...ui.iconTile, margin:'0 auto 12px' }}><Icon name="clock" /></div>
            <div style={{ fontSize:font.md, fontWeight:600, color:color.ink, marginBottom:4 }}>{tr('broadcast_waitingTitle')}</div>
            <div style={{ fontSize:13, color:color.muted }}>{tr('broadcast_waitingHint')}</div>
          </div>
        )}

        {responses.map(r => (
          <div key={r.id} style={{ ...ui.card, marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:48, height:48, borderRadius:radius.md, background:color.navySoft, display:'flex', alignItems:'center', justifyContent:'center', fontSize:font.xl, fontWeight:700, color:color.navy, flexShrink:0 }}>
                {(r.sitter_profiles?.users?.name||'S')[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:15, fontWeight:700, color:color.ink }}>{r.sitter_profiles?.users?.name || tr('broadcast_sitterFallback')}</div>
                <div style={{ fontSize:font.sm, color:color.success, fontWeight:500 }}>{tr('broadcast_availableCheck')}</div>
              </div>
              <div style={{ fontSize:15, fontWeight:700, color:color.ink, fontVariantNumeric:'tabular-nums' }}>Rs.{r.offered_price ? Math.round(r.offered_price / 100) : '—'}</div>
            </div>
            <button type="button" onClick={() => acceptSitter(r)} style={{ ...ui.primaryButton, width:'100%' }}>
              {tr('broadcast_bookThisSitter')}
            </button>
          </div>
        ))}

        <div style={{ background:color.successSoft, borderRadius:radius.md, padding:'12px 14px', marginTop:8, fontSize:13, color:color.success, lineHeight:1.5, display:'flex', gap:10 }}>
          <Icon name="shield" size={18} style={{ marginTop:1 }} />
          <span>{tr('broadcast_chargeNotice')}</span>
        </div>
      </div>
    </div>
  );

  const ready = (step===0&&service)||(step===1&&selectedTime)||(step===2&&area);

  return (
    <div style={{ ...ui.page, paddingBottom:'calc(96px + env(safe-area-inset-bottom))' }}>
      {header(tr('broadcast_headerTitle'), tr('broadcast_headerSub', { city }))}
      <div style={{ display:'flex', gap:6, padding:'12px 16px 14px', background:color.surface, borderBottom:`1px solid ${color.line}` }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ flex:1, height:4, borderRadius:radius.pill, background:i<=step ? color.navy : color.line }} />
        ))}
      </div>

      <div style={{ padding:'20px 16px 0' }}>
        {step === 0 && (
          <>
            <h2 style={stepTitle}>{tr('broadcast_step0Title')}</h2>
            <div style={stepHint}>{tr('broadcast_step0Sub')}</div>
            {SERVICES.map(s => {
              const on = service === s.id;
              return (
                <button type="button" key={s.id} onClick={() => setService(s.id)} aria-pressed={on}
                  style={{ width:'100%', textAlign:'left', font:'inherit', color:'inherit', background:color.surface, borderRadius:radius.lg, padding:'14px 16px', marginBottom:10, display:'flex', gap:14, alignItems:'center', cursor:'pointer', border:`1px solid ${on ? color.navy : color.line}`, boxShadow:on ? `inset 0 0 0 1px ${color.navy}` : 'none' }}>
                  <span style={{ ...ui.iconTile, background:on ? color.navySoft : color.tile }}><Icon name={s.icon} size={24} /></span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:600, color:color.ink }}>{tr(s.nameKey)}</div>
                    <div style={{ fontSize:font.sm, color:color.muted }}>{tr(s.subKey)}</div>
                  </div>
                  <span style={{ width:20, height:20, borderRadius:radius.pill, border:`1.5px solid ${on ? color.navy : color.line}`, background:on ? color.navy : 'transparent', color:'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {on && <Icon name="check" size={13} strokeWidth={2.6} />}
                  </span>
                </button>
              );
            })}
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={stepTitle}>{tr('broadcast_step1Title')}</h2>
            <div style={stepHint}>{tr('broadcast_step1Sub')}</div>
            <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:8, marginBottom:20, scrollbarWidth:'none' }}>
              {days.map((d,i) => {
                const on = selectedDay === i;
                return (
                  <button type="button" key={i} onClick={() => setSelectedDay(i)} aria-pressed={on}
                    style={{ flexShrink:0, width:54, borderRadius:radius.md, padding:'10px 6px', textAlign:'center', cursor:'pointer', font:'inherit', color:'inherit', background:on ? color.navy : color.surface, border:`1px solid ${on ? color.navy : color.line}` }}>
                    <div style={{ fontSize:font.xs, color:on ? 'rgba(255,255,255,0.75)' : color.muted, marginBottom:4 }}>{dayName(d)}</div>
                    <div style={{ fontSize:17, fontWeight:700, color:on ? 'white' : color.ink, fontVariantNumeric:'tabular-nums' }}>{d.getDate()}</div>
                    <div style={{ fontSize:font.xs, color:on ? 'rgba(255,255,255,0.7)' : color.faint, marginTop:2 }}>{monthName(d)}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
              {TIME_SLOTS.map(ts => {
                const on = selectedTime === ts;
                return (
                  <button type="button" key={ts} onClick={() => setSelectedTime(ts)} aria-pressed={on}
                    style={{ minHeight:44, padding:'0 8px', borderRadius:radius.md, textAlign:'center', cursor:'pointer', fontFamily:'inherit', background:on ? color.navy : color.surface, border:`1px solid ${on ? color.navy : color.line}`, fontSize:13, fontWeight:600, color:on ? 'white' : color.text, fontVariantNumeric:'tabular-nums' }}>
                    {ts}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={stepTitle}>{tr('broadcast_step2Title')}</h2>
            <div style={stepHint}>{tr('broadcast_step2Sub')}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {AREAS.map(a => (
                <button type="button" key={a} onClick={() => setArea(a)} aria-pressed={area===a} style={{ ...ui.chip(area===a), minHeight:40 }}>
                  {areaLabel(a)}
                </button>
              ))}
            </div>
            <div style={{ ...ui.card, marginBottom:14 }}>
              <div style={ui.label}>{tr('broadcast_notesLabel')}</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={tr('broadcast_notesPlaceholder')} aria-label={tr('broadcast_notesLabel')}
                style={{ ...ui.input, fontSize:14, resize:'none', minHeight:88, lineHeight:1.6 }} />
            </div>
            <div style={{ background:color.tile, borderRadius:radius.md, padding:'12px 14px', fontSize:13, color:color.text, lineHeight:1.6, display:'flex', gap:10 }}>
              <Icon name="lock" size={18} color={color.navy} style={{ marginTop:1 }} />
              <span>{tr('broadcast_privacyNotice')}</span>
            </div>
          </>
        )}
      </div>

      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:color.surface, borderTop:`1px solid ${color.line}`, zIndex:100 }}>
        <div style={{ maxWidth:480, margin:'0 auto', padding:'12px 16px calc(12px + env(safe-area-inset-bottom))', display:'flex', gap:10, boxSizing:'border-box' }}>
          {step > 0 && (
            <button type="button" onClick={() => setStep(s=>s-1)} style={{ ...ui.secondaryButton, flex:1 }}>
              {tr('broadcast_backButton')}
            </button>
          )}
          <button type="button"
            onClick={() => { if(step<2) setStep(s=>s+1); else submitRequest(); }}
            disabled={saving || (step===0&&!service) || (step===1&&!selectedTime) || (step===2&&!area)}
            style={{ ...ui.primaryButton, flex:2, background:ready ? color.navy : color.line, color:ready ? 'white' : color.faint, cursor:ready ? 'pointer' : 'not-allowed' }}>
            {saving ? tr('common_sending') : step===2 ? tr('broadcast_sendToAllButton') : tr('broadcast_continueButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
