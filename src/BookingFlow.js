import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { ArrowLeft, CheckCircle, Shield, Copy, Plus } from 'lucide-react';
import { useLanguage } from './i18n';


const ORANGE = '#FF6B35';
const ORANGE_LIGHT = '#FFF0EB';
const DARK = '#0f0f1a';

const SERVICES = [
  { id: 'walk30', icon: '🦮', price: 349 },
  { id: 'boarding', icon: '🏠', price: 849 },
  { id: 'daycare', icon: '☀️', price: 649 },
];

const SERVICE_I18N_KEYS = {
  walk30: { name: 'bookingFlow_svcWalkName', sub: 'bookingFlow_svcWalkSub', desc: 'bookingFlow_svcWalkDesc' },
  boarding: { name: 'bookingFlow_svcBoardingName', sub: 'bookingFlow_svcBoardingSub', desc: 'bookingFlow_svcBoardingDesc' },
  daycare: { name: 'bookingFlow_svcDaycareName', sub: 'bookingFlow_svcDaycareSub', desc: 'bookingFlow_svcDaycareDesc' },
};

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
  const { t: tr } = useLanguage();
  const steps = [tr('bookingFlow_stepService'), tr('bookingFlow_stepSchedule'), tr('bookingFlow_stepPet'), tr('bookingFlow_stepReview')];
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

export default function BookingFlow({ onBack, sitter, city, initialService, repeatBooking, initialPromoCode }) {
  const { t: tr } = useLanguage();
  const [step, setStep] = useState(repeatBooking ? 1 : (initialService ? 1 : 0));
  const [sitterPrices, setSitterPrices] = useState({});
  const [selectedService, setSelectedService] = useState(repeatBooking ? repeatBooking.service_type : (initialService || null));
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [endDayOffset, setEndDayOffset] = useState(null);
  const [dropTime, setDropTime] = useState(null);
  const [pickTime, setPickTime] = useState(null);
  const [selectedPet, setSelectedPet] = useState(repeatBooking ? repeatBooking.pet_id : null);
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
  const [temperature, setTemperature] = useState(null);
  const [heatWarningDismissed, setHeatWarningDismissed] = useState(false);
  const [promoInput, setPromoInput] = useState(initialPromoCode || '');
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null); // {code, discountAmount} — preview only; the DB applies the real discount
  const [promoFailed, setPromoFailed] = useState(false);
  const autoApplyPromo = useRef(!!initialPromoCode);

  const days = getDays();

  // Simple heat advisory check based on date (approximation)
  const checkHeatAdvisory = () => {
    if (!day) return false;
    const month = day.getMonth() + 1; // 1-12
    const isHotMonth = [4, 5, 6, 7, 8, 9].includes(month); // Apr-Sep (typically hot)
    // In real implementation, would call actual weather API
    // For now, show advisory for hot months
    return isHotMonth;
  };
  const services = SERVICES.map(s => ({
    ...s,
    price: sitterPrices[s.id] ?? s.price,
    name: tr(SERVICE_I18N_KEYS[s.id].name),
    sub: tr(SERVICE_I18N_KEYS[s.id].sub),
    desc: tr(SERVICE_I18N_KEYS[s.id].desc),
  }));
  const service = services.find(s => s.id === selectedService);

  // Each sitter sets their own price per service; the SERVICES prices are only
  // a fallback while it loads or when a sitter hasn't priced a service.
  useEffect(() => {
    if (!sitter?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('sitter_services').select('service_type, price_paise').eq('sitter_id', sitter.id);
      if (cancelled || !data) return;
      setSitterPrices(Object.fromEntries(data.filter(r => r.price_paise > 0).map(r => [r.service_type, Math.round(r.price_paise / 100)])));
    })();
    return () => { cancelled = true; };
  }, [sitter?.id]);
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
  const finalPrice = Math.max(0, totalPrice - (appliedPromo?.discountAmount || 0));

  const promoErrorMessage = (res) => {
    if (res?.error === 'already_used') return tr('bookingFlow_promoErrAlreadyUsed');
    if (res?.error === 'exhausted') return tr('bookingFlow_promoErrExhausted');
    if (res?.error === 'min_amount') return tr('bookingFlow_promoErrMinAmount', { amount: tr('bookingFlow_currencyPrefix') + res.min_amount });
    return tr('bookingFlow_promoErrInvalid');
  };

  const applyPromoCode = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoApplying(true);
    setPromoError('');
    try {
      const { data: res, error } = await supabase.rpc('preview_promo', { p_code: code, p_amount_rupees: totalPrice });
      if (error || !res || res.error) {
        setPromoError(promoErrorMessage(res));
      } else {
        setAppliedPromo({ code: res.code, discountAmount: Number(res.discount) });
        setPromoInput('');
      }
    } catch (e) {
      setPromoError(tr('bookingFlow_promoErrInvalid'));
    }
    setPromoApplying(false);
  };

  // A discount previewed for one price is stale once the price changes (e.g.
  // the parent goes back and switches service) — re-check it on the Review step.
  const lastPricedAt = useRef(totalPrice);
  useEffect(() => {
    if (lastPricedAt.current === totalPrice) return;
    lastPricedAt.current = totalPrice;
    if (appliedPromo) {
      setPromoInput(appliedPromo.code);
      setAppliedPromo(null);
      autoApplyPromo.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPrice]);

  useEffect(() => {
    if (step === 3 && autoApplyPromo.current && promoInput.trim() && !appliedPromo) {
      autoApplyPromo.current = false;
      applyPromoCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, promoInput, appliedPromo]);

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
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      const ref = 'FUR' + Math.floor(Math.random() * 900000 + 100000);
      const startOtp = String(Math.floor(1000 + Math.random() * 9000));
      setBookingRef(ref);
      const bookingDate = new Date();
      bookingDate.setDate(bookingDate.getDate() + selectedDay);
      const { data: bookingData, error: bookingError } = await supabase.from('bookings').insert({
        pet_parent_id: user ? user.id : null,
        sitter_id: sitter?.id || null,
        city_id: cityRow?.id || null,
        service_type: selectedService,
        booking_date: bookingDate.toISOString().split('T')[0],
        time_slot: selectedTime || dropTime || '07:00',
        gross_amount_paise: totalPrice * 100,
        sitter_payout_paise: totalPrice * 100,
        end_date: isBoarding ? (() => { const d=new Date(); d.setDate(d.getDate()+endDayOffset); return d.toISOString().split('T')[0]; })() : null,
        pickup_time: isDaycare ? pickTime : null,
        status: 'pending',
        parent_notes: notes,
        address_flat: flat || null,
        address_tower: tower || null,
        address_society: floor || null,
        booking_ref: ref,
        start_otp: startOtp,
        pet_id: selectedPet || null,
      }).select('id').single();
      if (bookingError) {
        alert(tr('bookingFlow_alertCreateFailedPrefix') + bookingError.message);
        setProcessing(false);
        return;
      }

      // The booking exists at full price either way; only the DB can discount it.
      if (appliedPromo && bookingData?.id) {
        const { data: promoRes, error: promoErr } = await supabase.rpc('apply_promo_to_booking', { p_booking_id: bookingData.id, p_code: appliedPromo.code });
        if (promoErr || !promoRes || promoRes.error) {
          console.error('Promo not applied:', promoErr || promoRes);
          setPromoFailed(true);
        }
      }

      // TIER 3: Send heat advisory notification if booking is during hot months
      const isHotMonth = [4, 5, 6, 7, 8, 9].includes(bookingDate.getMonth() + 1);
      if (isHotMonth && isWalker) {
        try {
          const { data: sitterData } = await supabase.from('sitter_profiles').select('user_id').eq('id', sitter?.id).single();
          const { data: sitterContact } = sitterData?.user_id
            ? await supabase.rpc('get_user_contact', { target_id: sitterData.user_id })
            : { data: null };
          const { notifyHeatAdvisory } = await import('./notificationService');
          await notifyHeatAdvisory(
            sitterData?.user_id, // notifications.user_id is a real users.id FK, not sitter_profiles.id
            sitterContact?.[0]?.phone,
            user?.id,
            user?.phone,
            pet?.name || 'Your pet',
            bookingDate.toLocaleDateString('en-IN')
          );
        } catch(heatErr) { console.error('Heat advisory notification failed:', heatErr); }
      }

    } catch(e) {
      console.error('Booking save error:', e);
      alert(tr('bookingFlow_alertCreateFailedRetry'));
      setProcessing(false);
      return;
    }
    setProcessing(false);
    setConfirmed(true);
  };

  const canContinue = () => {
    if (step === 0) return !!selectedService;
    if (step === 1) {
      if (selectedDay === null) return false;
      if (isDaycare) return !!dropTime && !!pickTime;
      if (isBoarding) return !!selectedTime && endDayOffset !== null && endDayOffset > selectedDay;
      return !!selectedTime;
    }
    if (step === 2) return !!selectedPet && aggressionConfirmed;
    return true;
  };

  const getValidationError = () => {
    if (step === 1) {
      if (selectedDay === null) return tr('bookingFlow_errSelectDate');
      if (isDaycare && !dropTime) return tr('bookingFlow_errSelectDropoff');
      if (isDaycare && !pickTime) return tr('bookingFlow_errSelectPickup');
      if (!isDaycare && !selectedTime) return tr('bookingFlow_errSelectTime');
      if (isBoarding && (endDayOffset === null || endDayOffset <= selectedDay)) return tr('bookingFlow_errSelectCheckout');
    }
    if (step === 2) {
      if (!selectedPet) return tr('bookingFlow_errSelectPet');
      if (!aggressionConfirmed) return tr('bookingFlow_errAggressionConfirm');
    }
    return '';
  };

  const sitterName = sitter?.name || tr('bookingFlow_defaultSitterName');
  const sitterArea = sitter?.area || city || 'Gurgaon';

  if (confirmed) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:DARK, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 24px', fontFamily:'-apple-system,sans-serif', textAlign:'center' }}>
      <div style={{ fontSize:72, marginBottom:16 }}>🎉</div>
      <div style={{ fontSize:26, fontWeight:700, color:'white', marginBottom:6 }}>{tr('bookingFlow_confirmedTitle')}</div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:32, lineHeight:1.6 }}>
        {tr('bookingFlow_confirmedNotified', { name: sitterName })}<br/>{tr('bookingFlow_confirmedHearBack')}
      </div>
      <div style={{ background:'#1a1a2e', borderRadius:24, padding:20, width:'100%', marginBottom:16, border:'1px solid rgba(255,107,53,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12, paddingBottom:12, borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{tr('bookingFlow_labelBookingRef')}</span>
          <span style={{ fontSize:12, color:'white', fontWeight:600 }}>{bookingRef}</span>
        </div>
        {[
          { label:tr('bookingFlow_labelService'), val:service?.name },
          { label:tr('bookingFlow_labelSitter'), val:sitterName || tr('bookingFlow_defaultSitterName') },
          { label:tr('bookingFlow_labelDate'), val:day?DAY_NAMES[day.getDay()]+', '+day.getDate()+' '+MONTH_NAMES[day.getMonth()]:tr('bookingFlow_dateTbd') },
          { label:tr('bookingFlow_labelTime'), val:selectedTime },
          { label:tr('bookingFlow_labelPet'), val:pet?pet.name+(pet.breed?' ('+pet.breed+')':''):''},
          { label:tr('bookingFlow_labelAmount'), val:tr('bookingFlow_currencyPrefix')+(promoFailed ? totalPrice : finalPrice) },
        ].filter(x => x.val).map((item,i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{item.label}</span>
            <span style={{ fontSize:12, color:'white', fontWeight:500 }}>{item.val}</span>
          </div>
        ))}
      </div>
      {promoFailed && (
        <div style={{ background:'rgba(255,183,77,0.12)', border:'1px solid rgba(255,183,77,0.4)', borderRadius:14, padding:'10px 14px', width:'100%', marginBottom:16, fontSize:12, color:'#FFB74D', lineHeight:1.5, boxSizing:'border-box' }}>
          {tr('bookingFlow_promoNotApplied')}
        </div>
      )}
      <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:16, padding:'12px 16px', width:'100%', marginBottom:24, fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.6 }}>
        {tr('bookingFlow_paymentAfterAcceptNote', { name: sitterName })}
      </div>
      <button onClick={onBack}
        style={{ width:'100%', padding:14, borderRadius:14, border:'none', background:ORANGE, color:'white', fontSize:15, fontWeight:600, cursor:'pointer' }}>
        {tr('bookingFlow_backToHomeButton')}
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
          <div style={{ color:'white', fontSize:17, fontWeight:700 }}>{tr('bookingFlow_headerTitle')}</div>
          <div style={{ color:'rgba(255,255,255,0.75)', fontSize:12 }}>{sitterName} · {sitterArea}</div>
        </div>
      </div>

      <StepBar step={step} />

      <div style={{ padding:'20px 20px 0' }}>

        {step === 0 && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{tr('bookingFlow_whatDoYouNeed')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>{tr('bookingFlow_selectServiceHint')}</div>
            {services.map(s => (
              <div key={s.id} onClick={() => setSelectedService(s.id)}
                style={{ background:'white', borderRadius:18, padding:'14px 16px', marginBottom:10, display:'flex', gap:14, alignItems:'center', cursor:'pointer', border:selectedService===s.id?'2px solid '+ORANGE:'2px solid transparent', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ width:48, height:48, borderRadius:14, background:selectedService===s.id?ORANGE_LIGHT:'#F8F8F8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{s.icon}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:2 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{s.sub} · {s.desc}</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:ORANGE }}>{tr('bookingFlow_currencyPrefix')}{s.price}</div>
                  {selectedService===s.id && <CheckCircle size={16} color={ORANGE} style={{ marginTop:4 }} />}
                </div>
              </div>
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{isBoarding ? tr('bookingFlow_checkInDate') : tr('bookingFlow_pickDateTime')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:14 }}>{tr('bookingFlow_next14Days')}</div>
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
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>{tr('bookingFlow_checkOutDate')}</div>
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
                  {tr('bookingFlow_nightsCount', { n: nights, word: nights>1?tr('bookingFlow_nightsWord'):tr('bookingFlow_nightWord') })} · {tr('bookingFlow_currencyPrefix')}{basePrice} × {nights} = {tr('bookingFlow_currencyPrefix')}{basePrice*nights}
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>{tr('bookingFlow_dropOffTime')}</div>
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
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>{tr('bookingFlow_dropOffTime')}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {TIME_SLOTS.map(tt => (
                    <div key={tt} onClick={() => { setDropTime(tt); setSelectedTime(tt); }}
                      style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:dropTime===tt?ORANGE:'white', border:dropTime===tt?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:dropTime===tt?600:400, color:dropTime===tt?'white':'#555' }}>{tt}</div>
                  ))}
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>{tr('bookingFlow_pickUpTime')}</div>
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
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>{tr('bookingFlow_pickATime')}</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {TIME_SLOTS.map(tt => (
                    <div key={tt} onClick={() => setSelectedTime(tt)}
                      style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:selectedTime===tt?ORANGE:'white', border:selectedTime===tt?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:selectedTime===tt?600:400, color:selectedTime===tt?'white':'#555', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>{tt}</div>
                  ))}
                </div>
              </>
            )}
            <div style={{ background:'white', borderRadius:18, padding:16, marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>{tr('bookingFlow_dogSizeHeading')}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { id:'small', label:tr('bookingFlow_sizeSmallLabel'), sub:tr('bookingFlow_sizeSmallSub'), extra:'' },
                  { id:'medium', label:tr('bookingFlow_sizeMediumLabel'), sub:tr('bookingFlow_sizeMediumSub'), extra:'' },
                  { id:'large', label:tr('bookingFlow_sizeLargeLabel'), sub:tr('bookingFlow_sizeLargeSub'), extra:'+'+tr('bookingFlow_currencyPrefix')+'50' },
                  { id:'xlarge', label:tr('bookingFlow_sizeXlargeLabel'), sub:tr('bookingFlow_sizeXlargeSub'), extra:'+'+tr('bookingFlow_currencyPrefix')+'100' },
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
                📅 {DAY_NAMES[days[selectedDay].getDay()]}, {days[selectedDay].getDate()} {MONTH_NAMES[days[selectedDay].getMonth()]} {tr('bookingFlow_atWord')} {selectedTime}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{tr('bookingFlow_whichPet')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>{tr('bookingFlow_selectPetHint')}</div>
            {petsLoading && <div style={{ textAlign:'center', padding:20, color:'#888' }}>{tr('bookingFlow_loadingPets')}</div>}
            {!petsLoading && pets.map(p => (
              <div key={p.id} onClick={() => setSelectedPet(p.id)}
                style={{ background:'white', borderRadius:18, padding:'14px 16px', marginBottom:10, display:'flex', gap:14, alignItems:'center', cursor:'pointer', border:selectedPet===p.id?'2px solid '+ORANGE:'2px solid transparent', boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
                <div style={{ width:52, height:52, borderRadius:16, background:'#FFE0B2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>🐕</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a', marginBottom:2 }}>{p.name}</div>
                  <div style={{ fontSize:13, color:'#888' }}>{p.breed || tr('bookingFlow_mixedBreed')}{p.age_years?' · '+p.age_years+' '+tr('bookingFlow_yearsUnit'):''}</div>
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
                <div style={{ fontSize:14, color:'#888' }}>{tr('bookingFlow_addNewPet')}</div>
              </div>
            ) : (
              <div style={{ background:'white', borderRadius:18, padding:16, marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'2px solid '+ORANGE }}>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>{tr('bookingFlow_addYourPetHeading')}</div>
                <input value={newPetName} onChange={e => setNewPetName(e.target.value)} placeholder={tr('bookingFlow_petNamePlaceholder')}
                  style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:14, color:'#1a1a1a', outline:'none', marginBottom:8, boxSizing:'border-box' }} />
                <input value={newPetBreed} onChange={e => setNewPetBreed(e.target.value)} placeholder={tr('bookingFlow_petBreedPlaceholder')}
                  style={{ width:'100%', padding:'12px 14px', borderRadius:12, border:'1.5px solid #E0E0E0', fontSize:14, color:'#1a1a1a', outline:'none', marginBottom:12, boxSizing:'border-box' }} />
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={saveNewPet} disabled={!newPetName.trim() || savingPet}
                    style={{ flex:2, padding:'10px 0', borderRadius:12, border:'none', background:newPetName.trim()?ORANGE:'#E0E0E0', color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    {savingPet?tr('common_saving'):tr('bookingFlow_savePetButton')}
                  </button>
                  <button onClick={() => setAddingPet(false)}
                    style={{ flex:1, padding:'10px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#888', fontSize:13, cursor:'pointer' }}>
                    {tr('common_cancel')}
                  </button>
                </div>
              </div>
            )}
            <div style={{ background:'#FFF3E0', borderRadius:18, padding:16, marginBottom:14, border:'1.5px solid '+ORANGE }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <input type="checkbox" checked={aggressionConfirmed} onChange={e => setAggressionConfirmed(e.target.checked)}
                  style={{ width:20, height:20, marginTop:2, cursor:'pointer' }} />
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:4 }}>{tr('bookingFlow_aggressionTitle')}</div>
                  <div style={{ fontSize:12, color:'#E65100', lineHeight:1.5 }}>{tr('bookingFlow_aggressionText')}</div>
                </div>
              </div>
            </div>
            <div style={{ background:'white', borderRadius:18, padding:16, marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>{tr('bookingFlow_addressHeading')}</div>
              <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>{tr('bookingFlow_addressHint')}</div>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>{tr('bookingFlow_flatLabel')}</div>
                  <input value={flat} onChange={e => setFlat(e.target.value)} placeholder={tr('bookingFlow_flatPlaceholder')}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>{tr('bookingFlow_towerLabel')}</div>
                  <input value={tower} onChange={e => setTower(e.target.value)} placeholder={tr('bookingFlow_towerPlaceholder')}
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>{tr('bookingFlow_societyLabel')}</div>
                <input value={floor} onChange={e => setFloor(e.target.value)} placeholder={tr('bookingFlow_societyPlaceholder')}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>{tr('bookingFlow_notesHeading')}</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={tr('bookingFlow_notesPlaceholder')}
              style={{ width:'100%', padding:'12px 14px', borderRadius:14, border:'1.5px solid #E0E0E0', fontSize:13, color:'#1a1a1a', outline:'none', resize:'none', minHeight:90, lineHeight:1.6, fontFamily:'inherit', boxSizing:'border-box' }} />
          </>
        )}

        {step === 3 && service && (
          <>
            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{tr('bookingFlow_reviewBookingHeading')}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>{tr('bookingFlow_doubleCheckHint')}</div>
            {!heatWarningDismissed && checkHeatAdvisory() && (
              <div style={{ background:'#FFF3E0', borderRadius:14, padding:'12px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start', border:'1.5px solid #FFB74D' }}>
                <span style={{ fontSize:18, flexShrink:0 }}>⚠️</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#E65100', marginBottom:2 }}>{tr('bookingFlow_heatAdvisoryTitle')}</div>
                  <div style={{ fontSize:12, color:'#E65100', lineHeight:1.4 }}>{tr('bookingFlow_heatAdvisoryBody')}</div>
                  <button onClick={() => setHeatWarningDismissed(true)} style={{ marginTop:6, background:'none', border:'none', color:'#E65100', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'underline' }}>{tr('bookingFlow_dismissButton')}</button>
                </div>
              </div>
            )}
            <div style={{ background:'white', borderRadius:20, padding:16, marginBottom:12, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              {[
                { label:tr('bookingFlow_labelSitter'), val:sitterName },
                { label:tr('bookingFlow_labelService'), val:service.name+' · '+service.sub },
                { label:tr('bookingFlow_labelDate'), val:day?DAY_NAMES[day.getDay()]+', '+day.getDate()+' '+MONTH_NAMES[day.getMonth()]:tr('bookingFlow_dateTbd') },
                { label:tr('bookingFlow_labelTime'), val:selectedTime||tr('bookingFlow_dateTbd') },
                { label:tr('bookingFlow_labelPet'), val:pet?pet.name+(pet.breed?' ('+pet.breed+')':''):tr('bookingFlow_petNotSelected') },
              ].map((item,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:i<4?'1px solid #F8F8F8':'none' }}>
                  <span style={{ fontSize:12, color:'#888', width:56, flexShrink:0 }}>{item.label}</span>
                  <span style={{ fontSize:13, color:'#1a1a1a', fontWeight:500, flex:1 }}>{item.val}</span>
                </div>
              ))}
              {notes.length > 0 && (
                <div style={{ marginTop:10, padding:'8px 10px', background:'#F8F8F8', borderRadius:10 }}>
                  <div style={{ fontSize:11, color:'#888', marginBottom:3 }}>{tr('bookingFlow_notesToSitterLabel')}</div>
                  <div style={{ fontSize:13, color:'#555', lineHeight:1.5 }}>{notes}</div>
                </div>
              )}
            </div>
            <div style={{ background:'white', borderRadius:20, padding:16, marginBottom:12, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a', marginBottom:12 }}>{tr('bookingFlow_priceBreakdownHeading')}</div>
              {[
                { label:service.name, val:tr('bookingFlow_currencyPrefix')+service.price },
                getPriceAdjustment()>0?{ label:tr('bookingFlow_sizeNeedsAdjustment'), val:'+'+tr('bookingFlow_currencyPrefix')+getPriceAdjustment() }:null,
                { label:tr('bookingFlow_platformFee'), val:tr('bookingFlow_currencyPrefix')+'0' },
                appliedPromo?{ label:tr('bookingFlow_promoDiscountLine')+' ('+appliedPromo.code+')', val:'-'+tr('bookingFlow_currencyPrefix')+appliedPromo.discountAmount, highlight:true }:null,
                              ].filter(Boolean).map((item,i,arr) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:i<arr.length-1?'1px solid #F5F5F5':'none' }}>
                  <div>
                    <span style={{ fontSize:13, color:item.highlight?'#2E7D32':'#555' }}>{item.label}</span>
                    {item.note && <span style={{ fontSize:11, color:'#2E7D32', marginLeft:6 }}>{item.note}</span>}
                  </div>
                  <span style={{ fontSize:13, fontWeight:500, color:item.highlight?'#2E7D32':'#1a1a1a' }}>{item.val}</span>
                </div>
              ))}

              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid #F5F5F5' }}>
                {appliedPromo ? (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'#2E7D32', fontWeight:600 }}>✓ {tr('bookingFlow_promoAppliedLabel', { code: appliedPromo.code })}</span>
                    <button onClick={() => setAppliedPromo(null)} style={{ background:'none', border:'none', color:'#C62828', fontSize:12, fontWeight:600, cursor:'pointer' }}>{tr('bookingFlow_promoRemove')}</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:'flex', gap:8 }}>
                      <input value={promoInput} onChange={e => { setPromoInput(e.target.value); setPromoError(''); }} placeholder={tr('bookingFlow_promoCodePlaceholder')}
                        style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'1.5px solid #E8E8E8', fontSize:13, outline:'none', textTransform:'uppercase' }} />
                      <button onClick={applyPromoCode} disabled={promoApplying || !promoInput.trim()}
                        style={{ padding:'0 18px', borderRadius:10, border:'none', background:promoInput.trim()?ORANGE:'#F0F0F0', color:promoInput.trim()?'white':'#AAA', fontSize:13, fontWeight:700, cursor:promoInput.trim()?'pointer':'default' }}>
                        {promoApplying ? tr('bookingFlow_promoApplying') : tr('bookingFlow_promoApplyButton')}
                      </button>
                    </div>
                    {promoError && <div style={{ fontSize:11, color:'#C62828', marginTop:6 }}>{promoError}</div>}
                  </div>
                )}
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, paddingTop:10, borderTop:'2px solid #F0F0F0' }}>
                <span style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>{tr('bookingFlow_totalLabel')}</span>
                <span style={{ fontSize:18, fontWeight:800, color:ORANGE }}>{tr('bookingFlow_currencyPrefix')}{finalPrice}</span>
              </div>
            </div>
            <div style={{ background:'#E8F5E9', borderRadius:14, padding:'10px 14px', display:'flex', gap:8, marginBottom:12 }}>
              <Shield size={16} color="#2E7D32" style={{ flexShrink:0, marginTop:1 }} />
              <div style={{ fontSize:12, color:'#2E7D32', lineHeight:1.55 }}>
                <strong>{tr('bookingFlow_paymentAfterAcceptBold')}</strong> {tr('bookingFlow_paymentAfterAcceptBody', { name: sitterName })}
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

      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', padding:'12px 20px calc(28px + env(safe-area-inset-bottom))', display:'flex', gap:10 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s-1)}
            style={{ flex:1, padding:'14px 0', borderRadius:14, border:'1.5px solid #E0E0E0', background:'white', color:'#555', fontSize:14, fontWeight:600, cursor:'pointer' }}>
            {tr('bookingFlow_backButton')}
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
          {processing?tr('common_saving') : step===3?tr('bookingFlow_requestBookingButton') : tr('bookingFlow_continueButton')}
        </button>
      </div>
    </div>
  );
}