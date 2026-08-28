import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { ArrowLeft, CheckCircle, Shield, Copy, Plus } from 'lucide-react';

const ORANGE = '#FF6B35';
const ORANGE_LIGHT = '#FFF0EB';
const DARK = '#0f0f1a';

const SERVICES = [
  { id: 'walk30', name: 'Request a walker', sub: '30 minutes', icon: '🦮', price: 349, desc: 'GPS-tracked walk with walk report and paw wipe' },
  { id: 'boarding', name: 'Home boarding', sub: 'per night', icon: '🏠', price: 849, desc: 'Your dog stays at the sitter home, safe and cosy' },
  { id: 'daycare', name: 'Doggy daycare', sub: 'per day', icon: '☀️', price: 649, desc: 'Drop off in the morning, pick up in the evening' },
];

const TIME_SLOTS = ['6:00 AM','7:00 AM','8:00 AM','10:00 AM','11:00 AM','4:00 PM','5:00 PM','6:00 PM','7:00 PM'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SIZE_PRICES = { small: 0, medium: 0, large: 50, xlarge: 100 };
const NEEDS_PRICES = { senior: 50, special: 100, reactive: 75, puppy: 50 };

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

function StepBar({ step }) {
  const steps = ['Service','Schedule','Pet','Review'];
  return (
    <div style={{ display:'flex', alignItems:'center', padding:'12px 20px', background:'white', borderBottom:'1px solid #F5F5F5' }}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <div style={{ width:26, height:26, borderRadius:8, background:i<step?'#2E7D32':i===step?ORANGE:'#F0F0F0', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {i < step ? <CheckCircle size={14} color="white" /> : <span style={{ fontSize:11, fontWeight:600, color:i===step?'white':'#BBB' }}>{i+1}</span>}
            </div>
            <span style={{ fontSize:9, color:i===step?ORANGE:i<step?'#2E7D32':'#CCC', fontWeight:i===step?600:400 }}>{s}</span>
          </div>
          {i < steps.length-1 && <div style={{ flex:1, height:2, background:i<step?'#2E7D32':'#F0F0F0', margin:'0 4px 12px' }} />}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function BookingFlow({ onBack, sitter, city, initialService }) {
  const [step, setStep] = useState(initialService ? 1 : 0);
  const [selectedService, setSelectedService] = useState(initialService || null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [endDayOffset, setEndDayOffset] = useState(1);
  const [dropTime, setDropTime] = useState(null);
  const [pickTime, setPickTime] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);
  const [pets, setPets] = useState([]);
  const [petsLoading, setPetsLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [flat, setFlat] = useState('');
  const [tower, setTower] = useState('');
  const [floor, setFloor] = useState('');
  const [dogSize, setDogSize] = useState('medium');
  const [dogNeeds, setDogNeeds] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [newPetName, setNewPetName] = useState('');
  const [newPetBreed, setNewPetBreed] = useState('');
  const [addingPet, setAddingPet] = useState(false);
  const [savingPet, setSavingPet] = useState(false);
  const [aggressionConfirmed, setAggressionConfirmed] = useState(false);

  const days = getDays();
  const service = SERVICES.find(s => s.id === selectedService);
  const pet = pets.find(p => p.id === selectedPet);
  const day = days[selectedDay];

  const getPriceAdjustment = () => {
    const sizeAdj = SIZE_PRICES[dogSize] || 0;
    const needsAdj = dogNeeds.reduce((sum, n) => sum + (NEEDS_PRICES[n] || 0), 0);
    return sizeAdj + needsAdj;
  };

  const nights = Math.max(1, endDayOffset - selectedDay);
  const isBoarding = selectedService === 'boarding';
  const isDaycare = selectedService === 'daycare';
  const isWalker = selectedService === 'walk30';
  const basePrice = service ? service.price + getPriceAdjustment() : 0;
  const totalPrice = isBoarding ? basePrice * nights : basePrice;

  useEffect(() => { loadPets(); }, []);

  const loadPets = async () => {
    setPetsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('pet_profiles').select('*').eq('user_id', user.id);
      setPets(data || []);
    }
    setPetsLoading(false);
  };

  const saveNewPet = async () => {
    if (!newPetName.trim()) return;
    setSavingPet(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('pet_profiles').insert({
      user_id: user.id,
      name: newPetName.trim(),
      breed: newPetBreed.trim() || null,
    }).select().single();
    if (data) {
      setPets(prev => [...prev, data]);
      setSelectedPet(data.id);
      setAddingPet(false);
      setNewPetName('');
      setNewPetBreed('');
    }
    setSavingPet(false);
  };

  const saveBooking = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const ref = 'FUR' + Math.floor(Math.random() * 900000 + 100000);
      const startOtp = String(Math.floor(1000 + Math.random() * 9000));
      setBookingRef(ref);
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + selectedDay);
      await supabase.from('bookings').insert({
        pet_parent_id: user ? user.id : null,
        sitter_id: sitter?.id || null,
        service_type: selectedService,
        scheduled_date: bookingDate.toISOString().split('T')[0],
        scheduled_time: selectedTime || dropTime || '07:00',
        gross_amount_paise: totalPrice * 100,
        end_date: isBoarding ? (() => { const d=new Date(); d.setDate(d.getDate()+endDayOffset); return d.toISOString().split('T')[0]; })() : null,
        pickup_time: isDaycare ? pickTime : null,
        status: 'pending',
        notes: notes,
        address_flat: flat || null,
        address_tower: tower || null,
        address_society: floor || null,
        booking_ref: ref,
        start_otp: startOtp,
        pet_id: selectedPet || null,
      });
    } catch(e) { console.log('Booking save error:', e); }
    setProcessing(false);
    setConfirmed(true);
  };

  const canContinue = () => {
    if (step === 0) return !!selectedService;
    if (step === 1) {
      if (selectedDay === null) return false;
      if (isDaycare) return !!dropTime && !!pickTime;
      return !!selectedTime;
    }
    if (step === 2) return !!selectedPet;
    return true;
  };

  const getValidationError = () => {
    if (step === 1) {
      if (selectedDay === null) return 'Please select a date';
      if (isDaycare && !dropTime) return 'Please select drop-off time';
      if (isDaycare && !pickTime) return 'Please select pick-up time';
      if (!isDaycare && !selectedTime) return 'Please select a time';
    }
    if (step === 2) {
      if (!selectedPet) return 'Please select a pet';
      if (!aggressionConfirmed) return 'Please confirm your dog does not have aggression issues';
    }
    return '';
  };

  const sitterName = sitter?.name || 'your sitter';
  const sitterArea = sitter?.area || city || 'Gurgaon';

  if (confirmed) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:DARK, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px', fontFamily:'-apple-system,sans-serif', textAlign:'center' }}>
      <div style={{ fontSize:72, marginBottom:16 }}>🎉</div>
      <div style={{ fontSize:26, fontWeight:700, color:'white', marginBottom:6 }}>Booking requested!</div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:32, lineHeight:1.6 }}>
        {sitterName} has been notified.<br/>You'll hear back within 1 hour.
      </div>
      <div style={{ background:'#1a1a2e', borderRadius:24, padding:20, width:'100%', marginBottom:16, border:'1px solid rgba(255,107,53,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12, paddingBottom:12, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>Booking ref</span>
          <span style={{ fontSize:12, color:'white', fontWeight:600 }}>{bookingRef}</span>
        </div>
        {[
          { label:'Service', val:service?.name },
          { label:'Sitter', val:sitterName || 'Your sitter' },
          { label:'Date', val:day?DAY_NAMES[day.getDay()]+', '+day.getDate()+' '+MONTH_NAMES[day.getMonth()]:'TBD' },
          { label:'Time', val:selectedTime },
          { label:'Pet', val:pet?pet.name+(pet.breed?' ('+pet.breed+')':''):''},
          { label:'Amount', val:'Rs.'+totalPrice },
        ].filter(x => x.val).map((item,i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{item.label}</span>
            <span style={{ fontSize:12, color:'white', fontWeight:500 }}>{item.val}</span>
          </div>
        ))}
      </div>
      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:16, padding:'12px 16px', width:'100%', marginBottom:24, fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.6 }}>
        Payment is collected after {sitterName} accepts your booking. Check My Bookings for updates.
      </div>
      <button onClick={onBack}
        style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:ORANGE, color:'white', fontSize:15, fontWeight:600, cursor:'pointer' }}>
        Back to home 🐾
      </button>
    </div>
  );

  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      <div style={{ background:ORANGE, padding:'48px 20px 16px', display:'flex', alignItems:'center', gap:12 }}>
        <div onClick={onBack} style={{ width:36, height:36, borderRadius:12, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
          <ArrowLeft size={18} color="white" />
        </div>
        <div>
          <div style={{ color:'white', fontSize:17, fontWeight:700 }}>Book a sitter</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>{sitterName} · {sitterArea}</div>
        </div>
      </div>

      <StepBar step={step} />

      <div style={{ padding:'20px 20px 0' }}>

        {step === 0 && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>What do you need?</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>Select a service to continue</div>
            {SERVICES.map(s => (
              <div key={s.id} onClick={() => setSelectedService(s.id)}
                style={{ background:'white', borderRadius:18, padding:'14px 16px', marginBottom:10, display:'flex', gap:14, alignItems:'center', cursor:'pointer', border:selectedService===s.id?'2px solid '+ORANGE:'2px solid transparent', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ width:48, height:48, borderRadius:14, background:selectedService===s.id?ORANGE_LIGHT:'#F8F8F8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{s.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{s.sub} · {s.desc}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:ORANGE }}>Rs.{s.price}</div>
                  {selectedService===s.id && <CheckCircle size={16} color={ORANGE} style={{ marginTop:4 }} />}
                </div>
              </div>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{isBoarding ? 'Check-in date' : 'Pick a date & time'}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:14 }}>Next 14 days available</div>
            <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:8, marginBottom:20, scrollbarWidth:'none' }}>
              {days.map((d,i) => (
                <div key={i} onClick={() => setSelectedDay(i)}
                  style={{ flexShrink:0, width:54, borderRadius:14, padding:'10px 6px', textAlign:'center', cursor:'pointer', background:selectedDay===i?ORANGE:'white', border:selectedDay===i?'none':'1px solid #F0F0F0', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize:10, color:selectedDay===i?'rgba(255,255,255,0.8)':'#AAA', marginBottom:4, fontWeight:500 }}>{DAY_NAMES[d.getDay()]}</div>
                  <div style={{ fontSize:17, fontWeight:700, color:selectedDay===i?'white':'#1a1a1a' }}>{d.getDate()}</div>
                  <div style={{ fontSize:10, color:selectedDay===i?'rgba(255,255,255,0.7)':'#CCC', marginTop:2 }}>{MONTH_NAMES[d.getMonth()]}</div>
                </div>
              ))}
            </div>
            {/* Boarding: end date picker */}
            {isBoarding && (
              <>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>Check-out date</div>
                <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:8, marginBottom:16, scrollbarWidth:'none' }}>
                  {days.map((d,i) => (
                    i > selectedDay ? (
                    <div key={i} onClick={() => setEndDayOffset(i)}
                      style={{ flexShrink:0, width:54, borderRadius:14, padding:'10px 6px', textAlign:'center', cursor:'pointer', background:endDayOffset===i?'#2E7D32':'white', border:endDayOffset===i?'none':'1px solid #F0F0F0', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize:10, color:endDayOffset===i?'rgba(255,255,255,0.8)':'#AAA', marginBottom:4 }}>{DAY_NAMES[d.getDay()]}</div>
                      <div style={{ fontSize:17, fontWeight:700, color:endDayOffset===i?'white':'#1a1a1a' }}>{d.getDate()}</div>
                      <div style={{ fontSize:10, color:endDayOffset===i?'rgba(255,255,255,0.7)':'#CCC', marginTop:2 }}>{MONTH_NAMES[d.getMonth()]}</div>
                    </div>
                    ) : null
                  ))}
                </div>
                <div style={{ background:'#E8F5E9', borderRadius:12, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#2E7D32', fontWeight:600, textAlign:'center' }}>
                  {nights} night{nights>1?'s':''} · Rs.{basePrice} × {nights} = Rs.{basePrice*nights}
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Drop-off time</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {TIME_SLOTS.map(tt => (
                    <div key={tt} onClick={() => setSelectedTime(tt)}
                      style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:selectedTime===tt?ORANGE:'white', border:selectedTime===tt?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:selectedTime===tt?600:400, color:selectedTime===tt?'white':'#555' }}>{tt}</div>
                  ))}
                </div>
              </>
            )}

            {/* Daycare: drop-off + pick-up times */}
            {isDaycare && (
              <>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Drop-off time</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {TIME_SLOTS.map(tt => (
                    <div key={tt} onClick={() => { setDropTime(tt); setSelectedTime(tt); }}
                      style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:dropTime===tt?ORANGE:'white', border:dropTime===tt?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:dropTime===tt?600:400, color:dropTime===tt?'white':'#555' }}>{tt}</div>
                  ))}
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Pick-up time</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {TIME_SLOTS.map(tt => (
                    <div key={tt} onClick={() => setPickTime(tt)}
                      style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:pickTime===tt?'#2E7D32':'white', border:pickTime===tt?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:pickTime===tt?600:400, color:pickTime===tt?'white':'#555' }}>{tt}</div>
                  ))}
                </div>
              </>
            )}

            {/* Walker: single time */}
            {isWalker && (
              <>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Pick a time</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {TIME_SLOTS.map(tt => (
                    <div key={tt} onClick={() => setSelectedTime(tt)}
                      style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:selectedTime===tt?ORANGE:'white', border:selectedTime===tt?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:selectedTime===tt?600:400, color:selectedTime===tt?'white':'#555', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>{tt}</div>
                  ))}
                </div>
              </>
            )}
            <div style={{ background:'white', borderRadius:18, padding:16, marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Dog size</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { id:'small', label:'Small', sub:'Under 10kg', extra:'' },
                  { id:'medium', label:'Medium', sub:'10-25kg', extra:'' },
                  { id:'large', label:'Large', sub:'25-40kg', extra:'+Rs.50' },
                  { id:'xlarge', label:'Extra Large', sub:'40kg+', extra:'+Rs.100' },
                ].map(s => (
                  <div key={s.id} onClick={() => setDogSize(s.id)}
                    style={{ padding:'12px', borderRadius:14, border:dogSize===s.id?'2px solid '+ORANGE:'1.5px solid #E0E0E0', background:dogSize===s.id?ORANGE_LIGHT:'white', cursor:'pointer', textAlign:'center' }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{s.label}</div>
                    <div style={{ fontSize:11, color:'#888' }}>{s.sub}</div>
                    {s.extra && <div style={{ fontSize:11, color:ORANGE, fontWeight:600, marginTop:2 }}>{s.extra}</div>}
                  </div>
                ))}
              </div>
            </div>
            {selectedTime && (
              <div style={{ background:ORANGE_LIGHT, borderRadius:14, padding:'10px 14px', fontSize:13, color:ORANGE, fontWeight:500 }}>
                📅 {DAY_NAMES[days[selectedDay].getDay()]}, {days[selectedDay].getDate()} {MONTH_NAMES[days[selectedDay].getMonth()]} at {selectedTime}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>Which pet?</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>Select the pet this booking is for</div>
            {petsLoading && <div style={{ textAlign:'center', padding:20, color:'#888' }}>Loading pets...</div>}
            {!petsLoading && pets.map(p => (
              <div key={p.id} onClick={() => setSelectedPet(p.id)}
                style={{ background:'white', borderRadius:18, padding:'14px 16px', marginBottom:10, display:'flex', gap:14, alignItems:'center', cursor:'pointer', border:selectedPet===p.id?'2px solid '+ORANGE:'2px solid transparent', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ width:52, height:52, borderRadius:16, background:'#FFE0B2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>🐕</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a', marginBottom:2 }}>{p.name}</div>
                  <div style={{ fontSize:13, color:'#888' }}>{p.breed || 'Mixed breed'}{p.age_years?' · '+p.age_years+' yrs':''}</div>
                </div>
                {selectedPet===p.id && <CheckCircle size={20} color={ORANGE} />}
              </div>
            ))}
            {!addingPet ? (
              <div onClick={() => setAddingPet(true)}
                style={{ background:'white', borderRadius:18, padding:'14px 16px', marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'2px dashed #E0E0E0', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
                <div style={{ width:52, height:52, borderRadius:16, background:'#F5F5F5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                  <Plus size={22} color="#CCC" />
                </div>
                <div style={{ fontSize:14, color:'#888' }}>Add a new pet</div>
              </div>
            ) : (
              <div style={{ background:'white', borderRadius:18, padding:16, marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'2px solid '+ORANGE }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Add your pet</div>
                <input value={newPetName} onChange={e => setNewPetName(e.target.value)} placeholder="Pet name (e.g. Bruno)"
                  style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:14, color:'#1a1a1a', outline:'none', marginBottom:8, boxSizing:'border-box' }} />
                <input value={newPetBreed} onChange={e => setNewPetBreed(e.target.value)} placeholder="Breed (e.g. Labrador)"
                  style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:14, color:'#1a1a1a', outline:'none', marginBottom:12, boxSizing:'border-box' }} />
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={saveNewPet} disabled={!newPetName.trim() || savingPet}
                    style={{ flex:2, padding:'10px 0', borderRadius:12, border:'none', background:newPetName.trim()?ORANGE:'#E0E0E0', color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    {savingPet?'Saving...':'Save pet'}
                  </button>
                  <button onClick={() => setAddingPet(false)}
                    style={{ flex:1, padding:'10px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#888', fontSize:13, cursor:'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div style={{ background:'#FFF3E0', borderRadius:18, padding:16, marginBottom:14, border:'1.5px solid '+ORANGE }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <input type="checkbox" checked={aggressionConfirmed} onChange={e => setAggressionConfirmed(e.target.checked)}
                  style={{ width:20, height:20, marginTop:2, cursor:'pointer' }} />
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>Dog Aggression Disclosure</div>
                  <div style={{ fontSize:12, color:'#E65100', lineHeight:1.5 }}>I confirm my dog does not have known aggression issues and will be safe with the sitter.</div>
                </div>
              </div>
            </div>
            <div style={{ background:'white', borderRadius:18, padding:16, marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Your address details</div>
              <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>Needed for society/apartment access</div>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>Flat / Unit</div>
                  <input value={flat} onChange={e => setFlat(e.target.value)} placeholder="e.g. A-401"
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>Tower / Block</div>
                  <input value={tower} onChange={e => setTower(e.target.value)} placeholder="e.g. Tower B"
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>Society / Building name</div>
                <input value={floor} onChange={e => setFloor(e.target.value)} placeholder="e.g. DLF The Crest"
                  style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>Notes for sitter</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Bruno gets anxious in traffic. Feeds at 7pm. Vet is Dr Sharma at 98XXXXXXXX."
              style={{ width:'100%', padding:'12px 14px', borderRadius:14, border:'1.5px solid #E0E0E0', fontSize:13, color:'#1a1a1a', outline:'none', resize:'none', minHeight:90, lineHeight:1.6, fontFamily:'inherit', boxSizing:'border-box' }} />
          </>
        )}

        {step === 3 && service && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>Review booking</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>Double-check before confirming</div>
            <div style={{ background:'white', borderRadius:20, padding:16, marginBottom:12, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              {[
                { label:'Sitter', val:sitterName },
                { label:'Service', val:service.name+' · '+service.sub },
                { label:'Date', val:day?DAY_NAMES[day.getDay()]+', '+day.getDate()+' '+MONTH_NAMES[day.getMonth()]:'TBD' },
                { label:'Time', val:selectedTime||'TBD' },
                { label:'Pet', val:pet?pet.name+(pet.breed?' ('+pet.breed+')':''):'Not selected' },
              ].map((item,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:i<4?'1px solid #F8F8F8':'none' }}>
                  <span style={{ fontSize:12, color:'#888', width:56, flexShrink:0 }}>{item.label}</span>
                  <span style={{ fontSize:13, color:'#1a1a1a', fontWeight:500, flex:1 }}>{item.val}</span>
                </div>
              ))}
              {notes.length > 0 && (
                <div style={{ marginTop:10, padding:'8px 10px', background:'#F8F8F8', borderRadius:10 }}>
                  <div style={{ fontSize:11, color:'#888', marginBottom:3 }}>Notes to sitter</div>
                  <div style={{ fontSize:13, color:'#555', lineHeight:1.5 }}>{notes}</div>
                </div>
              )}
            </div>
            <div style={{ background:'white', borderRadius:20, padding:16, marginBottom:12, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', marginBottom:12 }}>Price breakdown</div>
              {[
                { label:service.name, val:'Rs.'+service.price },
                getPriceAdjustment()>0?{ label:'Size/needs adjustment', val:'+Rs.'+getPriceAdjustment() }:null,
                { label:'Platform fee', val:'Rs.0', note:'Pilot offer' },
                              ].filter(Boolean).map((item,i,arr) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:i<arr.length-1?'1px solid #F5F5F5':'none' }}>
                  <div>
                    <span style={{ fontSize:13, color:'#555' }}>{item.label}</span>
                    {item.note && <span style={{ fontSize:11, color:'#2E7D32', marginLeft:6 }}>{item.note}</span>}
                  </div>
                  <span style={{ fontSize:13, fontWeight:500, color:'#1a1a1a' }}>{item.val}</span>
                </div>
              ))}
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, paddingTop:10, borderTop:'2px solid #F0F0F0' }}>
                <span style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>Total</span>
                <span style={{ fontSize:18, fontWeight:800, color:ORANGE }}>Rs.{totalPrice}</span>
              </div>
            </div>
            <div style={{ background:'#E8F5E9', borderRadius:14, padding:'10px 14px', display:'flex', gap:8, marginBottom:12 }}>
              <Shield size={16} color="#2E7D32" style={{ flexShrink:0, marginTop:1 }} />
              <div style={{ fontSize:12, color:'#2E7D32', lineHeight:1.55 }}>
                <strong>Payment after acceptance.</strong> You'll only be charged once {sitterName} accepts your booking.
              </div>
            </div>
          </>
        )}
      </div>

      {validationError && (
        <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', width:'calc(100% - 40px)', maxWidth:350, background:'#FFEBEE', borderRadius:12, padding:'12px 14px', fontSize:13, color:'#C62828', display:'flex', alignItems:'center', gap:8, boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
          <span>⚠️</span>
          <span>{validationError}</span>
        </div>
      )}

      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', padding:'12px 20px 28px', display:'flex', gap:10 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s-1)}
            style={{ flex:1, padding:'14px 0', borderRadius:14, border:'1.5px solid #E0E0E0', background:'white', color:'#555', fontSize:14, fontWeight:600, cursor:'pointer' }}>
            ← Back
          </button>
        )}
        <button onClick={() => {
            if (step === 3) { saveBooking(); return; }
            if (!canContinue()) {
              setValidationError(getValidationError());
              return;
            }
            setValidationError('');
            setStep(s => s+1);
          }}
          disabled={processing}
          style={{ flex:2, padding:'14px 0', borderRadius:14, border:'none', background:canContinue()||step===3?ORANGE:'#E0E0E0', color:canContinue()||step===3?'white':'#AAA', fontSize:14, fontWeight:700, cursor:canContinue()||step===3?'pointer':'not-allowed' }}>
          {processing?'Saving...' : step===3?'Request booking 🐾' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}