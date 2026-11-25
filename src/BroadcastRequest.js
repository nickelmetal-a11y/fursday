import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Clock, MapPin } from 'lucide-react';
import { supabase } from './supabase';
import { useLanguage, registerTranslations } from './i18n';

registerTranslations({
  en: {
    broadcast_headerTitle: 'Request a sitter',
    broadcast_headerSub: 'All available sitters in {city} will see this',
    broadcast_step0Title: 'What do you need?',
    broadcast_step0Sub: 'Select a service',
    broadcast_svcWalkName: 'Request a walker',
    broadcast_svcWalkSub: '30 min',
    broadcast_svcBoardingName: 'Home boarding',
    broadcast_svcBoardingSub: 'Per night',
    broadcast_svcDaycareName: 'Doggy daycare',
    broadcast_svcDaycareSub: 'Per day',
    broadcast_svcDropinName: 'Drop-in visit',
    broadcast_svcDropinSub: '30 min',
    broadcast_svcHousesitName: 'House sitting',
    broadcast_svcHousesitSub: 'Per night',
    broadcast_step1Title: 'When do you need it?',
    broadcast_step1Sub: 'Pick a date and time',
    broadcast_step2Title: 'Where are you?',
    broadcast_step2Sub: 'Sitters in your area will respond',
    broadcast_areaOther: 'Other',
    broadcast_notesLabel: 'Any notes for sitters?',
    broadcast_notesPlaceholder: 'e.g. Dog is friendly. Lives in Tower B, flat 401.',
    broadcast_privacyNotice: '🔒 Your contact details are hidden until you choose a sitter.',
    broadcast_backButton: '← Back',
    broadcast_continueButton: 'Continue →',
    broadcast_sendToAllButton: '📢 Send to all sitters',
    broadcast_requestSentTitle: 'Request sent to all sitters!',
    broadcast_requestSentSub: 'Sitters near you are being notified now.',
    broadcast_yourRequestLabel: 'Your request',
    broadcast_labelService: 'Service',
    broadcast_labelDate: 'Date',
    broadcast_labelTime: 'Time',
    broadcast_labelArea: 'Area',
    broadcast_sittersWhoCanHelp: 'Sitters who can help',
    broadcast_waitingTitle: 'Waiting for sitters to respond',
    broadcast_waitingHint: 'This usually takes 5–15 minutes. We will notify you.',
    broadcast_availableCheck: 'Available for your request ✓',
    broadcast_bookThisSitter: 'Book this sitter',
    broadcast_chargeNotice: '💡 You will only be charged once you accept a sitter and confirm payment.',
  },
  hi: {
    broadcast_headerTitle: 'सिटर के लिए रिक्वेस्ट भेजें',
    broadcast_headerSub: '{city} के सभी उपलब्ध सिटर इसे देखेंगे',
    broadcast_step0Title: 'आपको क्या चाहिए?',
    broadcast_step0Sub: 'एक सेवा चुनें',
    broadcast_svcWalkName: 'वॉकर बुलाएं',
    broadcast_svcWalkSub: '30 मिनट',
    broadcast_svcBoardingName: 'होम बोर्डिंग',
    broadcast_svcBoardingSub: 'प्रति रात',
    broadcast_svcDaycareName: 'डॉगी डेकेयर',
    broadcast_svcDaycareSub: 'प्रति दिन',
    broadcast_svcDropinName: 'ड्रॉप-इन विज़िट',
    broadcast_svcDropinSub: '30 मिनट',
    broadcast_svcHousesitName: 'हाउस सिटिंग',
    broadcast_svcHousesitSub: 'प्रति रात',
    broadcast_step1Title: 'आपको यह कब चाहिए?',
    broadcast_step1Sub: 'तारीख और समय चुनें',
    broadcast_step2Title: 'आप कहां हैं?',
    broadcast_step2Sub: 'आपके क्षेत्र के सिटर जवाब देंगे',
    broadcast_areaOther: 'अन्य',
    broadcast_notesLabel: 'सिटर के लिए कोई नोट?',
    broadcast_notesPlaceholder: 'जैसे: कुत्ता दोस्ताना है। टावर B, फ्लैट 401 में रहते हैं।',
    broadcast_privacyNotice: '🔒 जब तक आप कोई सिटर नहीं चुनते, आपकी संपर्क जानकारी छिपी रहेगी।',
    broadcast_backButton: '← वापस',
    broadcast_continueButton: 'आगे →',
    broadcast_sendToAllButton: '📢 सभी सिटर को भेजें',
    broadcast_requestSentTitle: 'सभी सिटर को रिक्वेस्ट भेज दी गई!',
    broadcast_requestSentSub: 'आपके पास के सिटर को अभी सूचित किया जा रहा है।',
    broadcast_yourRequestLabel: 'आपकी रिक्वेस्ट',
    broadcast_labelService: 'सेवा',
    broadcast_labelDate: 'तारीख',
    broadcast_labelTime: 'समय',
    broadcast_labelArea: 'क्षेत्र',
    broadcast_sittersWhoCanHelp: 'मदद कर सकने वाले सिटर',
    broadcast_waitingTitle: 'सिटर के जवाब का इंतज़ार',
    broadcast_waitingHint: 'इसमें आमतौर पर 5–15 मिनट लगते हैं। हम आपको सूचित करेंगे।',
    broadcast_availableCheck: 'आपकी रिक्वेस्ट के लिए उपलब्ध ✓',
    broadcast_bookThisSitter: 'इस सिटर को बुक करें',
    broadcast_chargeNotice: '💡 जब आप किसी सिटर को स्वीकार करके भुगतान की पुष्टि करेंगे, तभी आपसे शुल्क लिया जाएगा।',
  },
});

const ORANGE = '#FF6B35';
const ORANGE_LIGHT = '#FFF0EB';

const SERVICES = [
  { id:'walk30', nameKey:'broadcast_svcWalkName', icon:'🦮', subKey:'broadcast_svcWalkSub' },
  { id:'boarding', nameKey:'broadcast_svcBoardingName', icon:'🏠', subKey:'broadcast_svcBoardingSub' },
  { id:'daycare', nameKey:'broadcast_svcDaycareName', icon:'☀️', subKey:'broadcast_svcDaycareSub' },
  { id:'dropin', nameKey:'broadcast_svcDropinName', icon:'🔔', subKey:'broadcast_svcDropinSub' },
  { id:'housesit', nameKey:'broadcast_svcHousesitName', icon:'🏡', subKey:'broadcast_svcHousesitSub' },
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
  const { t: tr } = useLanguage();

  const days = getDays();
  const t = city === 'Pune'
    ? { primary:'#6C5CE7', light:'#F0EEFF', grad:'linear-gradient(135deg,#6C5CE7,#8E7CF3)' }
    : { primary:ORANGE, light:ORANGE_LIGHT, grad:'linear-gradient(135deg,#FF6B35,#FF8C5A)' };

  const AREAS = city === 'Pune'
    ? ['Koregaon Park','Baner','Viman Nagar','Kharadi','Aundh','Wakad','Kalyani Nagar', tr('broadcast_areaOther')]
    : ['DLF Phase 1','DLF Phase 2','DLF Phase 3','DLF Phase 4','DLF Phase 5','Nirvana Country','Sushant Lok','Sector 56', tr('broadcast_areaOther')];

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
    await supabase.from('broadcast_requests').update({ status: 'filled', chosen_sitter_id: response.sitter_id }).eq('id', requestId);
    await supabase.from('broadcast_responses').update({ status: 'chosen' }).eq('id', response.id);
    if (onSitterAccepted) onSitterAccepted(response.sitter_profiles);
    onBack();
  };

  if (submitted) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      <div style={{ background:t.grad, padding:'48px 20px 24px' }}>
        <div onClick={onBack} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginBottom:20 }}>
          <ArrowLeft size={18} color="white" />
        </div>
        <div style={{ fontSize:32, marginBottom:12 }}>📢</div>
        <div style={{ color:'white', fontSize:20, fontWeight:700, marginBottom:4 }}>{tr('broadcast_requestSentTitle')}</div>
        <div style={{ color:'rgba(255,255,255,0.75)', fontSize:13 }}>{tr('broadcast_requestSentSub')}</div>
      </div>

      <div style={{ padding:'20px 20px 0' }}>
        <div style={{ background:'white', borderRadius:16, padding:16, marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>{tr('broadcast_yourRequestLabel')}</div>
          {[
            { label:tr('broadcast_labelService'), val: serviceLabel(service) },
            { label:tr('broadcast_labelDate'), val: days[selectedDay] ? DAY_NAMES[days[selectedDay].getDay()]+', '+days[selectedDay].getDate()+' '+MONTH_NAMES[days[selectedDay].getMonth()] : '' },
            { label:tr('broadcast_labelTime'), val: selectedTime },
            { label:tr('broadcast_labelArea'), val: area },
          ].filter(x=>x.val).map((x,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #F8F8F8' }}>
              <span style={{ fontSize:12, color:'#888' }}>{x.label}</span>
              <span style={{ fontSize:12, color:'#1a1a1a', fontWeight:500 }}>{x.val}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:10 }}>
          {tr('broadcast_sittersWhoCanHelp')} {loadingResponses ? '...' : '(' + responses.length + ')'}
        </div>

        {responses.length === 0 && (
          <div style={{ textAlign:'center', padding:'30px 20px', background:'white', borderRadius:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>⏳</div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>{tr('broadcast_waitingTitle')}</div>
            <div style={{ fontSize:13, color:'#888' }}>{tr('broadcast_waitingHint')}</div>
          </div>
        )}

        {responses.map(r => (
          <div key={r.id} style={{ background:'white', borderRadius:16, padding:16, marginBottom:10, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:t.light, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, color:t.primary, flexShrink:0 }}>
                {(r.sitter_profiles?.users?.name||'S')[0].toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>{r.sitter_profiles?.users?.name || 'Sitter'}</div>
                <div style={{ fontSize:12, color:'#888' }}>{tr('broadcast_availableCheck')}</div>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:t.primary }}>Rs.{r.offered_price || '299'}</div>
            </div>
            <button onClick={() => acceptSitter(r)}
              style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              {tr('broadcast_bookThisSitter')}
            </button>
          </div>
        ))}

        <div style={{ background:'#E8F5E9', borderRadius:14, padding:'12px 16px', marginTop:8, fontSize:13, color:'#2E7D32' }}>
          {tr('broadcast_chargeNotice')}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      <div style={{ background:t.grad, padding:'48px 20px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <div onClick={onBack} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <ArrowLeft size={18} color="white" />
          </div>
          <div>
            <div style={{ color:'white', fontSize:17, fontWeight:700 }}>{tr('broadcast_headerTitle')}</div>
            <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>{tr('broadcast_headerSub', { city })}</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ flex:1, height:4, borderRadius:2, background:i<=step?'white':'rgba(255,255,255,0.3)' }} />
          ))}
        </div>
      </div>

      <div style={{ padding:'20px 20px 0' }}>
        {step === 0 && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{tr('broadcast_step0Title')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>{tr('broadcast_step0Sub')}</div>
            {SERVICES.map(s => (
              <div key={s.id} onClick={() => setService(s.id)}
                style={{ background:'white', borderRadius:16, padding:'14px 16px', marginBottom:10, display:'flex', gap:14, alignItems:'center', cursor:'pointer', border:service===s.id?'2px solid '+t.primary:'2px solid transparent', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize:24 }}>{s.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a' }}>{tr(s.nameKey)}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{tr(s.subKey)}</div>
                </div>
                {service===s.id && <CheckCircle size={18} color={t.primary} />}
              </div>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{tr('broadcast_step1Title')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:14 }}>{tr('broadcast_step1Sub')}</div>
            <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:8, marginBottom:16, scrollbarWidth:'none' }}>
              {days.map((d,i) => (
                <div key={i} onClick={() => setSelectedDay(i)}
                  style={{ flexShrink:0, width:54, borderRadius:14, padding:'10px 6px', textAlign:'center', cursor:'pointer', background:selectedDay===i?t.primary:'white', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize:10, color:selectedDay===i?'rgba(255,255,255,0.8)':'#AAA', marginBottom:4 }}>{DAY_NAMES[d.getDay()]}</div>
                  <div style={{ fontSize:17, fontWeight:700, color:selectedDay===i?'white':'#1a1a1a' }}>{d.getDate()}</div>
                  <div style={{ fontSize:10, color:selectedDay===i?'rgba(255,255,255,0.7)':'#CCC', marginTop:2 }}>{MONTH_NAMES[d.getMonth()]}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
              {TIME_SLOTS.map(ts => (
                <div key={ts} onClick={() => setSelectedTime(ts)}
                  style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:selectedTime===ts?t.primary:'white', fontSize:13, fontWeight:selectedTime===ts?600:400, color:selectedTime===ts?'white':'#555', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
                  {ts}
                </div>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{tr('broadcast_step2Title')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>{tr('broadcast_step2Sub')}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {AREAS.map(a => (
                <button key={a} onClick={() => setArea(a)}
                  style={{ padding:'8px 14px', borderRadius:20, border:area===a?'2px solid '+t.primary:'1.5px solid #E0E0E0', background:area===a?t.light:'white', color:area===a?t.primary:'#555', fontSize:13, fontWeight:area===a?600:400, cursor:'pointer' }}>
                  {a}
                </button>
              ))}
            </div>
            <div style={{ background:'white', borderRadius:16, padding:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>{tr('broadcast_notesLabel')}</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={tr('broadcast_notesPlaceholder')}
                style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:13, color:'#1a1a1a', outline:'none', resize:'none', minHeight:80, lineHeight:1.6, fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>
            <div style={{ background:'#E8F5E9', borderRadius:14, padding:'12px 16px', fontSize:13, color:'#2E7D32', lineHeight:1.6 }}>
              {tr('broadcast_privacyNotice')}
            </div>
          </>
        )}
      </div>

      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', padding:'12px 20px calc(28px + env(safe-area-inset-bottom))', display:'flex', gap:10 }}>
        {step > 0 && (
          <button onClick={() => setStep(s=>s-1)}
            style={{ flex:1, padding:'14px 0', borderRadius:14, border:'1.5px solid #E0E0E0', background:'white', color:'#555', fontSize:14, fontWeight:600, cursor:'pointer' }}>
            {tr('broadcast_backButton')}
          </button>
        )}
        <button
          onClick={() => { if(step<2) setStep(s=>s+1); else submitRequest(); }}
          disabled={saving || (step===0&&!service) || (step===1&&!selectedTime) || (step===2&&!area)}
          style={{ flex:2, padding:'14px 0', borderRadius:14, border:'none', background:(step===0&&service)||(step===1&&selectedTime)||(step===2&&area)?t.primary:'#E0E0E0', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          {saving ? tr('common_sending') : step===2 ? tr('broadcast_sendToAllButton') : tr('broadcast_continueButton')}
        </button>
      </div>
    </div>
  );
}