import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Clock, MapPin } from 'lucide-react';
import { supabase } from './supabase';

const ORANGE = '#FF6B35';
const ORANGE_LIGHT = '#FFF0EB';

const SERVICES = [
  { id:'walk30', name:'Request a walker', icon:'🦮', sub:'30 min' },
  { id:'boarding', name:'Home boarding', icon:'🏠', sub:'Per night' },
  { id:'daycare', name:'Doggy daycare', icon:'☀️', sub:'Per day' },
  { id:'dropin', name:'Drop-in visit', icon:'🔔', sub:'30 min' },
  { id:'housesit', name:'House sitting', icon:'🏡', sub:'Per night' },
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

  const days = getDays();
  const t = city === 'Pune'
    ? { primary:'#6C5CE7', light:'#F0EEFF', grad:'linear-gradient(135deg,#6C5CE7,#8E7CF3)' }
    : { primary:ORANGE, light:ORANGE_LIGHT, grad:'linear-gradient(135deg,#FF6B35,#FF8C5A)' };

  const AREAS = city === 'Pune'
    ? ['Koregaon Park','Baner','Viman Nagar','Kharadi','Aundh','Wakad','Kalyani Nagar','Other']
    : ['DLF Phase 1','DLF Phase 2','DLF Phase 3','DLF Phase 4','DLF Phase 5','Nirvana Country','Sushant Lok','Sector 56','Other'];

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
        <div style={{ color:'white', fontSize:20, fontWeight:700, marginBottom:4 }}>Request sent to all sitters!</div>
        <div style={{ color:'rgba(255,255,255,0.75)', fontSize:13 }}>Sitters near you are being notified now.</div>
      </div>

      <div style={{ padding:'20px 20px 0' }}>
        <div style={{ background:'white', borderRadius:16, padding:16, marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>Your request</div>
          {[
            { label:'Service', val: SERVICES.find(s=>s.id===service)?.name },
            { label:'Date', val: days[selectedDay] ? DAY_NAMES[days[selectedDay].getDay()]+', '+days[selectedDay].getDate()+' '+MONTH_NAMES[days[selectedDay].getMonth()] : '' },
            { label:'Time', val: selectedTime },
            { label:'Area', val: area },
          ].filter(x=>x.val).map((x,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #F8F8F8' }}>
              <span style={{ fontSize:12, color:'#888' }}>{x.label}</span>
              <span style={{ fontSize:12, color:'#1a1a1a', fontWeight:500 }}>{x.val}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:10 }}>
          Sitters who can help {loadingResponses ? '...' : '(' + responses.length + ')'}
        </div>

        {responses.length === 0 && (
          <div style={{ textAlign:'center', padding:'30px 20px', background:'white', borderRadius:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>⏳</div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>Waiting for sitters to respond</div>
            <div style={{ fontSize:13, color:'#888' }}>This usually takes 5–15 minutes. We will notify you.</div>
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
                <div style={{ fontSize:12, color:'#888' }}>Available for your request ✓</div>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:t.primary }}>Rs.{r.offered_price || '299'}</div>
            </div>
            <button onClick={() => acceptSitter(r)}
              style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              Book this sitter
            </button>
          </div>
        ))}

        <div style={{ background:'#E8F5E9', borderRadius:14, padding:'12px 16px', marginTop:8, fontSize:13, color:'#2E7D32' }}>
          💡 You will only be charged once you accept a sitter and confirm payment.
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
            <div style={{ color:'white', fontSize:17, fontWeight:700 }}>Request a sitter</div>
            <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>All available sitters in {city} will see this</div>
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
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>What do you need?</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>Select a service</div>
            {SERVICES.map(s => (
              <div key={s.id} onClick={() => setService(s.id)}
                style={{ background:'white', borderRadius:16, padding:'14px 16px', marginBottom:10, display:'flex', gap:14, alignItems:'center', cursor:'pointer', border:service===s.id?'2px solid '+t.primary:'2px solid transparent', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize:24 }}>{s.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a' }}>{s.name}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{s.sub}</div>
                </div>
                {service===s.id && <CheckCircle size={18} color={t.primary} />}
              </div>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>When do you need it?</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:14 }}>Pick a date and time</div>
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
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>Where are you?</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>Sitters in your area will respond</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {AREAS.map(a => (
                <button key={a} onClick={() => setArea(a)}
                  style={{ padding:'8px 14px', borderRadius:20, border:area===a?'2px solid '+t.primary:'1.5px solid #E0E0E0', background:area===a?t.light:'white', color:area===a?t.primary:'#555', fontSize:13, fontWeight:area===a?600:400, cursor:'pointer' }}>
                  {a}
                </button>
              ))}
            </div>
            <div style={{ background:'white', borderRadius:16, padding:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', marginBottom:14 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>Any notes for sitters?</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Dog is friendly. Lives in Tower B, flat 401."
                style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:13, color:'#1a1a1a', outline:'none', resize:'none', minHeight:80, lineHeight:1.6, fontFamily:'inherit', boxSizing:'border-box' }} />
            </div>
            <div style={{ background:'#E8F5E9', borderRadius:14, padding:'12px 16px', fontSize:13, color:'#2E7D32', lineHeight:1.6 }}>
              🔒 Your contact details are hidden until you choose a sitter.
            </div>
          </>
        )}
      </div>

      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', padding:'12px 20px 28px', display:'flex', gap:10 }}>
        {step > 0 && (
          <button onClick={() => setStep(s=>s-1)}
            style={{ flex:1, padding:'14px 0', borderRadius:14, border:'1.5px solid #E0E0E0', background:'white', color:'#555', fontSize:14, fontWeight:600, cursor:'pointer' }}>
            ← Back
          </button>
        )}
        <button
          onClick={() => { if(step<2) setStep(s=>s+1); else submitRequest(); }}
          disabled={saving || (step===0&&!service) || (step===1&&!selectedTime) || (step===2&&!area)}
          style={{ flex:2, padding:'14px 0', borderRadius:14, border:'none', background:(step===0&&service)||(step===1&&selectedTime)||(step===2&&area)?t.primary:'#E0E0E0', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
          {saving ? 'Sending...' : step===2 ? '📢 Send to all sitters' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}