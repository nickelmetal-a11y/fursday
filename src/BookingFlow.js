import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, shadow, ui } from './theme';
import Icon from './ui/Icon';
import { pointFor, serviceability, sitterCovers, formatKm } from './geo';
import { AddressForm, AreaSearch, loadSavedAddresses, addressIcon, addressLabelText, addressLine } from './AddressBook';
import { isSitterAvailable, toISODate } from './AvailabilityCalendar';

const SERVICES = [
  { id: 'walk30', icon: 'walk', price: 349 },
  { id: 'boarding', icon: 'boarding', price: 849 },
  { id: 'daycare', icon: 'sun', price: 649 },
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
const BUTTON_RESET = { font:'inherit', color:'inherit', textAlign:'inherit' };
const onKeyActivate = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

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
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${steps.length}, 1fr)`, gap:6, padding:'12px 16px 14px', background:color.surface, borderBottom:`1px solid ${color.line}` }}>
      {steps.map((s, i) => (
        <div key={i} aria-current={i===step ? 'step' : undefined} style={{ display:'flex', flexDirection:'column', gap:6, minWidth:0 }}>
          <div style={{ height:4, borderRadius:radius.pill, background:i<=step?color.navy:color.line }} />
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:font.xs, color:i===step?color.ink:i<step?color.text:color.faint, fontWeight:i===step?700:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {i < step && <Icon name="check" size={12} color={color.success} strokeWidth={2.4} />}{s}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function BookingFlow({ onBack, sitter, city, initialService, repeatBooking, initialPromoCode, onChooseSitter }) {
  const { t: tr, lang } = useLanguage();
  const dayName = (d) => lang === 'hi' ? d.toLocaleDateString('hi-IN', { weekday:'short' }) : DAY_NAMES[d.getDay()];
  const monthName = (d) => lang === 'hi' ? d.toLocaleDateString('hi-IN', { month:'short' }) : MONTH_NAMES[d.getMonth()];
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
  const [processing, setProcessing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [newPetName, setNewPetName] = useState('');
  const [newPetBreed, setNewPetBreed] = useState('');
  const [addingPet, setAddingPet] = useState(false);
  const [savingPet, setSavingPet] = useState(false);
  const [aggressionConfirmed, setAggressionConfirmed] = useState(false);
  const [heatWarningDismissed, setHeatWarningDismissed] = useState(false);
  const [promoInput, setPromoInput] = useState(initialPromoCode || '');
  const [promoApplying, setPromoApplying] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null); // {code, discountAmount} — preview only; the DB applies the real discount
  const [promoFailed, setPromoFailed] = useState(false);
  const autoApplyPromo = useRef(!!initialPromoCode);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [manualArea, setManualArea] = useState({ text:'', pincode:'', lat:null, lng:null });
  const [cityId, setCityId] = useState(null);
  const [zones, setZones] = useState([]);
  const [sitterBase, setSitterBase] = useState(null);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

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

  // The sitter row carries their base area and travel radius.
  useEffect(() => {
    if (!sitter?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('sitter_profiles').select('*').eq('id', sitter.id);
        if (!cancelled && Array.isArray(data) && data[0]) setSitterBase(data[0]);
      } catch (e) { /* radius check just stays off */ }
    })();
    return () => { cancelled = true; };
  }, [sitter?.id]);

  // The sitter's calendar: blocked days and custom slots for the next 14 days.
  const [availRows, setAvailRows] = useState([]);
  useEffect(() => {
    if (!sitter?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('sitter_availability').select('*').eq('sitter_id', sitter.id);
        if (!cancelled && Array.isArray(data)) setAvailRows(data);
      } catch (e) { /* no calendar: the weekly schedule applies */ }
    })();
    return () => { cancelled = true; };
  }, [sitter?.id]);
  // Until the sitter row loads, nothing is greyed out.
  const dayOpen = (i) => !sitterBase || isSitterAvailable(sitterBase, availRows, toISODate(days[i]));
  const timeOpen = (tt) => selectedDay === null || !sitterBase || isSitterAvailable(sitterBase, availRows, toISODate(days[selectedDay]), tt);
  // Only on the date step: clearing a choice later would leave the review screen without a date.
  useEffect(() => {
    if (step !== 1) return;
    if (selectedDay !== null && !dayOpen(selectedDay)) { setSelectedDay(null); return; }
    if (selectedTime && !timeOpen(selectedTime)) { setSelectedTime(null); setDropTime(null); }
  }, [step, selectedDay, selectedTime, sitterBase, availRows]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadSavedAddresses();
      if (cancelled) return;
      setSavedAddresses(list);
      if (list.length) setAddressId(id => id || list[0].id);
      try {
        const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
        if (cancelled || !cityRow?.id) return;
        setCityId(cityRow.id);
        const { data } = await supabase.from('service_zones').select('*').eq('city_id', cityRow.id);
        if (!cancelled && Array.isArray(data)) setZones(data);
      } catch (e) { /* no zones table yet: the city stays fully open */ }
    })();
    return () => { cancelled = true; };
  }, [city]);

  const pet = pets.find(p => p.id === selectedPet);
  const day = days[selectedDay];

  const getPriceAdjustment = () => {
    const sizeAdj = SIZE_PRICES[dogSize] || 0;
    return sizeAdj;
  };

  const nights = Math.max(1, endDayOffset - selectedDay);
  const isBoarding = selectedService === 'boarding';
  const isDaycare = selectedService === 'daycare';
  const isWalker = selectedService === 'walk30';
  const basePrice = service ? service.price + getPriceAdjustment() : 0;
  const totalPrice = isBoarding ? basePrice * nights : basePrice;
  const finalPrice = Math.max(0, totalPrice - (appliedPromo?.discountAmount || 0));

  const savedAddress = savedAddresses.find(a => a.id === addressId) || null;
  const bookingAddress = savedAddress
    ? { flat:savedAddress.flat, building:savedAddress.building, society:savedAddress.society, area:savedAddress.area, pincode:savedAddress.pincode, lat:savedAddress.lat, lng:savedAddress.lng }
    : { flat, building:tower, society:floor, area:manualArea.text.trim(), pincode:manualArea.pincode, lat:manualArea.lat, lng:manualArea.lng };
  const addressPoint = pointFor(bookingAddress);
  const areaName = bookingAddress.area || bookingAddress.pincode || '';
  const cityHasZones = zones.some(z => !cityId || z.city_id === cityId);
  const zoneCheck = serviceability(bookingAddress, zones, cityId);
  const areaBlocked = !!areaName && !zoneCheck.serviceable;
  const sitterInfo = { ...sitter, ...sitterBase };
  const coverage = sitterCovers(sitterInfo, addressPoint);

  const joinWaitlist = async () => {
    setJoiningWaitlist(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('zone_waitlist').insert({ user_id:user?.id || null, city_id:cityId, area:bookingAddress.area || null, pincode:bookingAddress.pincode || null });
      if (error) alert(tr('common_error'));
      else setWaitlistJoined(true);
    } catch (e) {
      alert(tr('common_error'));
    }
    setJoiningWaitlist(false);
  };

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
      const row = {
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
        address_flat: bookingAddress.flat || null,
        address_tower: bookingAddress.building || null,
        address_society: bookingAddress.society || null,
        booking_ref: ref,
        start_otp: startOtp,
        pet_id: selectedPet || null,
      };
      const areaFields = Object.fromEntries(Object.entries({
        address_area: bookingAddress.area || null,
        address_pincode: bookingAddress.pincode || null,
        address_lat: addressPoint?.lat ?? null,
        address_lng: addressPoint?.lng ?? null,
      }).filter(([, v]) => v != null));
      const insertBooking = (r) => supabase.from('bookings').insert(r).select('id').single();
      let { data: bookingData, error: bookingError } = await insertBooking({ ...row, ...areaFields });
      // Until migration 035 adds these columns, PostgREST rejects them; book without them.
      if (bookingError && Object.keys(areaFields).length && /address_(area|pincode|lat|lng)/.test(bookingError.message || '')) {
        ({ data: bookingData, error: bookingError } = await insertBooking(row));
      }
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
    if (step === 2) return !!selectedPet && aggressionConfirmed && !(cityHasZones && (!areaName || !zoneCheck.serviceable));
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
      if (cityHasZones && !areaName) return tr('bookingFlow_errPickArea');
      if (!zoneCheck.serviceable) return tr('bookingFlow_errNotServiceable');
    }
    return '';
  };

  const sitterName = sitter?.name || tr('bookingFlow_defaultSitterName');
  const sitterArea = sitter?.area || city || 'Gurgaon';

  const choiceCard = (on) => ({ ...BUTTON_RESET, width:'100%', textAlign:'left', background:color.surface, borderRadius:radius.lg, padding:'14px 16px', marginBottom:10, display:'flex', gap:14, alignItems:'center', cursor:'pointer', border:`1px solid ${on ? color.navy : color.line}`, boxShadow:on ? `inset 0 0 0 1px ${color.navy}` : 'none', fontFamily:font.family });
  const timeSlot = (on) => ({ ...BUTTON_RESET, width:'100%', minHeight:44, padding:'0 8px', borderRadius:radius.md, textAlign:'center', cursor:'pointer', background:on ? color.navy : color.surface, border:`1px solid ${on ? color.navy : color.line}`, fontSize:13, fontWeight:600, color:on ? 'white' : color.text, fontVariantNumeric:'tabular-nums', fontFamily:font.family });
  const dateTile = (on) => ({ flexShrink:0, width:54, borderRadius:radius.md, padding:'10px 6px', textAlign:'center', cursor:'pointer', background:on ? color.navy : color.surface, border:`1px solid ${on ? color.navy : color.line}`, boxSizing:'border-box' });
  const stepTitle = { fontSize:font.xl, fontWeight:700, color:color.ink, margin:'0 0 4px', letterSpacing:-0.2 };
  const stepHint = { fontSize:font.md, color:color.muted, marginBottom:16 };
  const subHeading = { fontSize:font.md, fontWeight:600, color:color.ink, marginBottom:10 };
  const slotGrid = { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:20 };
  const dateStrip = { display:'flex', gap:8, overflowX:'auto', paddingBottom:8, marginBottom:20, scrollbarWidth:'none' };
  const renderDateTile = (d, i, on, onPick, closed = false) => (
    <div key={i} onClick={closed ? undefined : onPick} role="button" tabIndex={closed ? -1 : 0} aria-pressed={on} aria-disabled={closed || undefined}
      title={closed ? tr('bookingFlow_sitterOff') : undefined} onKeyDown={closed ? undefined : onKeyActivate(onPick)}
      style={closed ? { ...dateTile(false), cursor:'not-allowed', opacity:0.4, background:color.tile } : dateTile(on)}>
      <div style={{ fontSize:font.xs, color:on ? 'rgba(255,255,255,0.75)' : color.muted, marginBottom:4, fontWeight:500 }}>{dayName(d)}</div>
      <div style={{ fontSize:font.lg + 1, fontWeight:700, color:on ? 'white' : color.ink, fontVariantNumeric:'tabular-nums', textDecoration:closed ? 'line-through' : 'none' }}>{d.getDate()}</div>
      <div style={{ fontSize:font.xs, color:on ? 'rgba(255,255,255,0.7)' : color.faint, marginTop:2 }}>{closed ? tr('bookingFlow_offShort') : monthName(d)}</div>
    </div>
  );
  const slotButton = (tt, on, onPick) => {
    const closed = !timeOpen(tt);
    return (
      <button type="button" key={tt} onClick={onPick} disabled={closed} aria-pressed={on}
        style={closed ? { ...timeSlot(false), cursor:'not-allowed', opacity:0.4, background:color.tile, textDecoration:'line-through' } : timeSlot(on)}>{tt}</button>
    );
  };
  const summaryRow = (label, val, i) => (
    <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 0', borderTop:i ? `1px solid ${color.line}` : 'none' }}>
      <span style={{ fontSize:font.sm, color:color.muted, width:64, flexShrink:0 }}>{label}</span>
      <span style={{ fontSize:font.md, color:color.ink, fontWeight:500, flex:1, minWidth:0 }}>{val}</span>
    </div>
  );

  const radiusWarning = () => (!areaBlocked && !coverage.covers) ? (
    <div role="status" style={{ background:color.warningSoft, borderRadius:radius.lg, padding:'12px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
      <Icon name="alert" size={18} color={color.warning} style={{ marginTop:1, flexShrink:0 }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:600, color:color.warning, marginBottom:2 }}>{tr('bookingFlow_radiusWarnTitle', { name: sitterName })}</div>
        <div style={{ fontSize:font.sm, color:color.text, lineHeight:1.5 }}>{tr('bookingFlow_radiusWarnBody', { km: formatKm(coverage.km), radius: Number(sitterInfo.service_radius_km || 5) })}</div>
        <button type="button" onClick={onChooseSitter || onBack} style={{ marginTop:4, minHeight:44, padding:0, background:'none', border:'none', color:color.navy, fontSize:font.sm, fontWeight:600, cursor:'pointer', fontFamily:font.family }}>{tr('bookingFlow_chooseAnotherSitter')}</button>
      </div>
    </div>
  ) : null;

  if (confirmed) return (
    <div style={{ ...ui.page, background:color.surface, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'calc(40px + env(safe-area-inset-top)) 16px calc(32px + env(safe-area-inset-bottom))', textAlign:'center', boxSizing:'border-box' }}>
      <div style={{ width:64, height:64, borderRadius:radius.pill, background:color.successSoft, color:color.success, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
        <Icon name="check" size={32} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize:font.xxl, fontWeight:700, color:color.ink, marginBottom:6, letterSpacing:-0.3 }}>{tr('bookingFlow_confirmedTitle')}</div>
      <div style={{ fontSize:font.md, color:color.muted, marginBottom:24, lineHeight:1.6 }}>
        {tr('bookingFlow_confirmedNotified', { name: sitterName })}<br/>{tr('bookingFlow_confirmedHearBack')}
      </div>
      <div style={{ ...ui.card, width:'100%', marginBottom:12, textAlign:'left', boxSizing:'border-box' }}>
        <div style={{ display:'flex', justifyContent:'space-between', paddingBottom:10, borderBottom:`1px solid ${color.line}` }}>
          <span style={{ fontSize:font.sm, color:color.muted }}>{tr('bookingFlow_labelBookingRef')}</span>
          <span style={{ fontSize:font.sm, color:color.ink, fontWeight:700, letterSpacing:0.4 }}>{bookingRef}</span>
        </div>
        {[
          { label:tr('bookingFlow_labelService'), val:service?.name },
          { label:tr('bookingFlow_labelSitter'), val:sitterName || tr('bookingFlow_defaultSitterName') },
          { label:tr('bookingFlow_labelDate'), val:day?dayName(day)+', '+day.getDate()+' '+monthName(day):tr('bookingFlow_dateTbd') },
          { label:tr('bookingFlow_labelTime'), val:selectedTime },
          { label:tr('bookingFlow_labelPet'), val:pet?pet.name+(pet.breed?' ('+pet.breed+')':''):''},
          { label:tr('bookingFlow_labelAmount'), val:tr('bookingFlow_currencyPrefix')+(promoFailed ? totalPrice : finalPrice) },
        ].filter(x => x.val).map((item,i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'8px 0', borderTop:i ? `1px solid ${color.line}` : 'none' }}>
            <span style={{ fontSize:font.sm, color:color.muted }}>{item.label}</span>
            <span style={{ fontSize:font.sm, color:color.ink, fontWeight:600, textAlign:'right', fontVariantNumeric:'tabular-nums' }}>{item.val}</span>
          </div>
        ))}
      </div>
      {promoFailed && (
        <div style={{ background:color.warningSoft, borderRadius:radius.md, padding:'10px 14px', width:'100%', marginBottom:12, fontSize:font.sm, color:color.warning, lineHeight:1.5, boxSizing:'border-box', textAlign:'left' }}>
          {tr('bookingFlow_promoNotApplied')}
        </div>
      )}
      <div style={{ background:color.tile, borderRadius:radius.md, padding:'12px 14px', width:'100%', marginBottom:24, fontSize:13, color:color.text, lineHeight:1.6, boxSizing:'border-box', textAlign:'left' }}>
        {tr('bookingFlow_paymentAfterAcceptNote', { name: sitterName })}
      </div>
      <button type="button" onClick={onBack} style={{ ...ui.primaryButton, width:'100%' }}>
        {tr('bookingFlow_backToHomeButton')}
      </button>
    </div>
  );

  const continueReady = canContinue() || step === 3;

  return (
    <div style={{ ...ui.page, paddingBottom:'calc(96px + env(safe-area-inset-bottom))' }}>
      <div style={ui.header}>
        <button type="button" onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}>
          <Icon name="arrowLeft" size={20} />
        </button>
        <div style={{ minWidth:0 }}>
          <h1 style={ui.headerTitle}>{tr('bookingFlow_headerTitle')}</h1>
          <div style={{ color:color.muted, fontSize:font.sm, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sitterName} · {sitterArea}</div>
        </div>
      </div>

      <StepBar step={step} />

      <div style={{ padding:'20px 16px 0' }}>

        {step === 0 && (
          <>
            <h2 style={stepTitle}>{tr('bookingFlow_whatDoYouNeed')}</h2>
            <div style={stepHint}>{tr('bookingFlow_selectServiceHint')}</div>
            {services.map(s => {
              const on = selectedService === s.id;
              return (
                <button type="button" key={s.id} onClick={() => setSelectedService(s.id)} aria-pressed={on} style={choiceCard(on)}>
                  <div style={{ ...ui.iconTile, background:on ? color.navySoft : color.tile }}><Icon name={s.icon} size={24} /></div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:font.md + 1, fontWeight:600, color:color.ink, marginBottom:2 }}>{s.name}</div>
                    <div style={{ fontSize:font.sm, color:color.muted, lineHeight:1.4 }}>{s.sub} · {s.desc}</div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:color.ink, fontVariantNumeric:'tabular-nums' }}>{tr('bookingFlow_currencyPrefix')}{s.price}</div>
                    <span style={{ width:20, height:20, borderRadius:radius.pill, border:`1.5px solid ${on ? color.navy : color.line}`, background:on ? color.navy : 'transparent', color:'white', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {on && <Icon name="check" size={13} strokeWidth={2.6} />}
                    </span>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={stepTitle}>{isBoarding ? tr('bookingFlow_checkInDate') : tr('bookingFlow_pickDateTime')}</h2>
            <div style={stepHint}>{tr('bookingFlow_next14Days')}</div>
            <div style={dateStrip}>
              {days.map((d,i) => renderDateTile(d, i, selectedDay===i, () => setSelectedDay(i), !dayOpen(i)))}
            </div>
            {days.some((d, i) => !dayOpen(i)) && (
              <div style={{ fontSize:font.sm, color:color.muted, margin:'-12px 0 16px' }}>{tr('bookingFlow_calendarNote')}</div>
            )}
            {/* Boarding: end date picker */}
            {isBoarding && (
              <>
                <div style={subHeading}>{tr('bookingFlow_checkOutDate')}</div>
                <div style={{ ...dateStrip, marginBottom:12 }}>
                  {days.map((d,i) => (
                    i > selectedDay ? renderDateTile(d, i, endDayOffset===i, () => setEndDayOffset(i)) : null
                  ))}
                </div>
                <div style={{ background:color.navySoft, borderRadius:radius.md, padding:'10px 14px', marginBottom:20, fontSize:13, color:color.navy, fontWeight:600, textAlign:'center', fontVariantNumeric:'tabular-nums' }}>
                  {tr('bookingFlow_nightsCount', { n: nights, word: nights>1?tr('bookingFlow_nightsWord'):tr('bookingFlow_nightWord') })} · {tr('bookingFlow_currencyPrefix')}{basePrice} × {nights} = {tr('bookingFlow_currencyPrefix')}{basePrice*nights}
                </div>
                <div style={subHeading}>{tr('bookingFlow_dropOffTime')}</div>
                <div style={slotGrid}>
                  {TIME_SLOTS.map(tt => slotButton(tt, selectedTime===tt, () => setSelectedTime(tt)))}
                </div>
              </>
            )}

            {/* Daycare: drop-off + pick-up times */}
            {isDaycare && (
              <>
                <div style={subHeading}>{tr('bookingFlow_dropOffTime')}</div>
                <div style={slotGrid}>
                  {TIME_SLOTS.map(tt => slotButton(tt, dropTime===tt, () => { setDropTime(tt); setSelectedTime(tt); }))}
                </div>
                <div style={subHeading}>{tr('bookingFlow_pickUpTime')}</div>
                <div style={slotGrid}>
                  {TIME_SLOTS.map(tt => (
                    <button type="button" key={tt} onClick={() => setPickTime(tt)} aria-pressed={pickTime===tt} style={timeSlot(pickTime===tt)}>{tt}</button>
                  ))}
                </div>
              </>
            )}

            {/* Walker: single time */}
            {isWalker && (
              <>
                <div style={subHeading}>{tr('bookingFlow_pickATime')}</div>
                <div style={slotGrid}>
                  {TIME_SLOTS.map(tt => slotButton(tt, selectedTime===tt, () => setSelectedTime(tt)))}
                </div>
              </>
            )}
            <div style={{ ...ui.card, marginBottom:14 }}>
              <div style={subHeading}>{tr('bookingFlow_dogSizeHeading')}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { id:'small', label:tr('bookingFlow_sizeSmallLabel'), sub:tr('bookingFlow_sizeSmallSub'), extra:'' },
                  { id:'medium', label:tr('bookingFlow_sizeMediumLabel'), sub:tr('bookingFlow_sizeMediumSub'), extra:'' },
                  { id:'large', label:tr('bookingFlow_sizeLargeLabel'), sub:tr('bookingFlow_sizeLargeSub'), extra:'+'+tr('bookingFlow_currencyPrefix')+'50' },
                  { id:'xlarge', label:tr('bookingFlow_sizeXlargeLabel'), sub:tr('bookingFlow_sizeXlargeSub'), extra:'+'+tr('bookingFlow_currencyPrefix')+'100' },
                ].map(s => {
                  const on = dogSize === s.id;
                  return (
                    <button type="button" key={s.id} onClick={() => setDogSize(s.id)} aria-pressed={on}
                      style={{ ...BUTTON_RESET, width:'100%', minHeight:60, padding:'10px 8px', borderRadius:radius.md, border:`1px solid ${on ? color.navy : color.line}`, boxShadow:on ? `inset 0 0 0 1px ${color.navy}` : 'none', background:on ? color.navySoft : color.surface, cursor:'pointer', textAlign:'center', fontFamily:font.family }}>
                      <div style={{ fontSize:13, fontWeight:600, color:color.ink }}>{s.label}</div>
                      <div style={{ fontSize:font.xs, color:color.muted, marginTop:2 }}>{s.sub}</div>
                      {s.extra && <div style={{ fontSize:font.xs, color:color.text, fontWeight:600, marginTop:2 }}>{s.extra}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
            {selectedTime && (
              <div style={{ background:color.navySoft, borderRadius:radius.md, padding:'10px 14px', fontSize:13, color:color.navy, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
                <Icon name="calendar" size={16} />
                <span>{dayName(days[selectedDay])}, {days[selectedDay].getDate()} {monthName(days[selectedDay])} {tr('bookingFlow_atWord')} {selectedTime}</span>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={stepTitle}>{tr('bookingFlow_whichPet')}</h2>
            <div style={stepHint}>{tr('bookingFlow_selectPetHint')}</div>
            {petsLoading && [0, 1].map(i => <div key={i} aria-hidden="true" style={{ height:80, borderRadius:radius.lg, background:color.tile, marginBottom:10 }} />)}
            {!petsLoading && pets.map(p => {
              const on = selectedPet === p.id;
              return (
                <button type="button" key={p.id} onClick={() => setSelectedPet(p.id)} aria-pressed={on} style={choiceCard(on)}>
                  <div style={{ ...ui.iconTile, width:52, height:52, background:on ? color.navySoft : color.tile, overflow:'hidden' }}>
                    {p.photo_url ? <img src={p.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <Icon name="paw" size={24} />}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:color.ink, marginBottom:2 }}>{p.name}</div>
                    <div style={{ fontSize:13, color:color.muted }}>{p.breed || tr('bookingFlow_mixedBreed')}{p.age_years?' · '+p.age_years+' '+tr('bookingFlow_yearsUnit'):''}</div>
                  </div>
                  <span style={{ width:22, height:22, borderRadius:radius.pill, border:`1.5px solid ${on ? color.navy : color.line}`, background:on ? color.navy : 'transparent', color:'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {on && <Icon name="check" size={14} strokeWidth={2.6} />}
                  </span>
                </button>
              );
            })}
            {!addingPet ? (
              <button type="button" onClick={() => setAddingPet(true)}
                style={{ ...BUTTON_RESET, width:'100%', textAlign:'left', background:color.surface, borderRadius:radius.lg, padding:'14px 16px', marginBottom:14, border:`1px dashed ${color.faint}`, display:'flex', alignItems:'center', gap:14, cursor:'pointer', fontFamily:font.family }}>
                <div style={{ ...ui.iconTile, width:52, height:52 }}>
                  <Icon name="plus" size={22} />
                </div>
                <div style={{ fontSize:font.md, fontWeight:600, color:color.navy }}>{tr('bookingFlow_addNewPet')}</div>
              </button>
            ) : (
              <div style={{ ...ui.card, marginBottom:14, border:`1px solid ${color.navy}` }}>
                <div style={subHeading}>{tr('bookingFlow_addYourPetHeading')}</div>
                <input value={newPetName} onChange={e => setNewPetName(e.target.value)} placeholder={tr('bookingFlow_petNamePlaceholder')}
                  style={{ ...ui.input, marginBottom:8 }} />
                <input value={newPetBreed} onChange={e => setNewPetBreed(e.target.value)} placeholder={tr('bookingFlow_petBreedPlaceholder')}
                  style={{ ...ui.input, marginBottom:12 }} />
                <div style={{ display:'flex', gap:8 }}>
                  <button type="button" onClick={saveNewPet} disabled={!newPetName.trim() || savingPet}
                    style={{ ...ui.primaryButton, flex:2, minHeight:44, background:newPetName.trim() ? color.navy : color.line, color:newPetName.trim() ? 'white' : color.faint, cursor:newPetName.trim() ? 'pointer' : 'not-allowed' }}>
                    {savingPet?tr('common_saving'):tr('bookingFlow_savePetButton')}
                  </button>
                  <button type="button" onClick={() => setAddingPet(false)} style={{ ...ui.secondaryButton, flex:1, minHeight:44, color:color.muted }}>
                    {tr('common_cancel')}
                  </button>
                </div>
              </div>
            )}
            <label style={{ display:'block', background:color.warningSoft, borderRadius:radius.lg, padding:16, marginBottom:14, border:`1px solid ${color.saffron}`, cursor:'pointer' }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <input type="checkbox" checked={aggressionConfirmed} onChange={e => setAggressionConfirmed(e.target.checked)} aria-label={tr('bookingFlow_aggressionTitle')}
                  style={{ width:20, height:20, marginTop:1, cursor:'pointer', accentColor:color.navy, flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:font.md, fontWeight:600, color:color.ink, marginBottom:4 }}>{tr('bookingFlow_aggressionTitle')}</div>
                  <div style={{ fontSize:font.sm, color:color.warning, lineHeight:1.5 }}>{tr('bookingFlow_aggressionText')}</div>
                </div>
              </div>
            </label>
            <div style={{ ...ui.card, marginBottom:14 }}>
              <div style={{ ...subHeading, marginBottom:4 }}>{tr('bookingFlow_addressHeading')}</div>
              <div style={{ fontSize:font.sm, color:color.muted, marginBottom:12 }}>{tr('bookingFlow_addressHint')}</div>
              {!addingAddress && savedAddresses.map(a => {
                const on = a.id === addressId;
                return (
                  <button type="button" key={a.id} onClick={() => { setAddressId(a.id); setWaitlistJoined(false); }} aria-pressed={on} style={choiceCard(on)}>
                    <div style={{ ...ui.iconTile, width:40, height:40, background:on ? color.navySoft : color.tile }}><Icon name={addressIcon(a.label)} size={20} /></div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:font.md, fontWeight:600, color:color.ink }}>{addressLabelText(tr, a.label)}</div>
                      <div style={{ fontSize:font.sm, color:color.muted, lineHeight:1.4 }}>{addressLine(a)}</div>
                    </div>
                    <span style={{ width:22, height:22, borderRadius:radius.pill, border:`1.5px solid ${on ? color.navy : color.line}`, background:on ? color.navy : 'transparent', color:'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      {on && <Icon name="check" size={14} strokeWidth={2.6} />}
                    </span>
                  </button>
                );
              })}
              {!addingAddress && savedAddresses.length === 0 && (
                <>
                  <div style={{ marginBottom:10 }}>
                    <div style={ui.label}>{tr('addr_area')}</div>
                    <AreaSearch city={city} value={manualArea.text}
                      onChange={v => { setManualArea({ text:v, pincode:'', lat:null, lng:null }); setWaitlistJoined(false); }}
                      onPick={l => { setManualArea({ text:l.name, pincode:l.pincode, lat:l.lat, lng:l.lng }); setWaitlistJoined(false); }} />
                  </div>
                  <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={ui.label}>{tr('bookingFlow_flatLabel')}</div>
                      <input value={flat} onChange={e => setFlat(e.target.value)} aria-label={tr('bookingFlow_flatLabel')} placeholder={tr('bookingFlow_flatPlaceholder')}
                        style={ui.input} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={ui.label}>{tr('bookingFlow_towerLabel')}</div>
                      <input value={tower} onChange={e => setTower(e.target.value)} aria-label={tr('bookingFlow_towerLabel')} placeholder={tr('bookingFlow_towerPlaceholder')}
                        style={ui.input} />
                    </div>
                  </div>
                  <div style={{ marginBottom:12 }}>
                    <div style={ui.label}>{tr('bookingFlow_societyLabel')}</div>
                    <input value={floor} onChange={e => setFloor(e.target.value)} aria-label={tr('bookingFlow_societyLabel')} placeholder={tr('bookingFlow_societyPlaceholder')}
                      style={ui.input} />
                  </div>
                </>
              )}
              {addingAddress ? (
                <AddressForm city={city} isFirst={savedAddresses.length === 0} onCancel={() => setAddingAddress(false)}
                  onSaved={a => {
                    setSavedAddresses(prev => [...prev.map(x => (a.is_default ? { ...x, is_default:false } : x)), a]);
                    setAddressId(a.id);
                    setAddingAddress(false);
                    setWaitlistJoined(false);
                  }} />
              ) : (
                <button type="button" onClick={() => setAddingAddress(true)}
                  style={{ ...ui.secondaryButton, width:'100%', minHeight:44, borderStyle:'dashed', color:color.navy }}>
                  <Icon name="plus" size={18} />{tr('addr_addNew')}
                </button>
              )}
            </div>
            {areaBlocked && (
              <div role="status" style={{ background:color.dangerSoft, borderRadius:radius.lg, padding:'14px 16px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
                <Icon name="pin" size={18} color={color.danger} style={{ marginTop:1, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:font.md, fontWeight:600, color:color.danger, marginBottom:4 }}>{tr('bookingFlow_notServiceableTitle', { area: areaName })}</div>
                  <div style={{ fontSize:font.sm, color:color.text, lineHeight:1.5 }}>
                    {waitlistJoined ? tr('bookingFlow_waitlistJoined', { area: areaName }) : tr('bookingFlow_notServiceableBody')}
                  </div>
                  {!waitlistJoined && (
                    <button type="button" onClick={joinWaitlist} disabled={joiningWaitlist} style={{ ...ui.primaryButton, minHeight:44, marginTop:10 }}>
                      {joiningWaitlist ? tr('common_sending') : tr('bookingFlow_joinWaitlist')}
                    </button>
                  )}
                </div>
              </div>
            )}
            {radiusWarning()}
            <div style={subHeading}>{tr('bookingFlow_notesHeading')}</div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} aria-label={tr('bookingFlow_notesHeading')}
              placeholder={tr('bookingFlow_notesPlaceholder')}
              style={{ ...ui.input, resize:'none', minHeight:96, lineHeight:1.6, fontSize:14 }} />
          </>
        )}

        {step === 3 && service && (
          <>
            <h2 style={stepTitle}>{tr('bookingFlow_reviewBookingHeading')}</h2>
            <div style={stepHint}>{tr('bookingFlow_doubleCheckHint')}</div>
            {!heatWarningDismissed && checkHeatAdvisory() && (
              <div style={{ background:color.warningSoft, borderRadius:radius.lg, padding:'12px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
                <Icon name="thermometer" size={20} color={color.warning} style={{ marginTop:1 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:color.warning, marginBottom:2 }}>{tr('bookingFlow_heatAdvisoryTitle')}</div>
                  <div style={{ fontSize:font.sm, color:color.text, lineHeight:1.5 }}>{tr('bookingFlow_heatAdvisoryBody')}</div>
                  <button type="button" onClick={() => setHeatWarningDismissed(true)} style={{ marginTop:4, minHeight:32, padding:0, background:'none', border:'none', color:color.warning, fontSize:font.sm, fontWeight:600, cursor:'pointer', fontFamily:font.family }}>{tr('bookingFlow_dismissButton')}</button>
                </div>
              </div>
            )}
            {radiusWarning()}
            <div style={{ ...ui.card, padding:'6px 16px', marginBottom:12 }}>
              {[
                { label:tr('bookingFlow_labelSitter'), val:sitterName },
                { label:tr('bookingFlow_labelService'), val:service.name+' · '+service.sub },
                { label:tr('bookingFlow_labelDate'), val:day?dayName(day)+', '+day.getDate()+' '+monthName(day):tr('bookingFlow_dateTbd') },
                { label:tr('bookingFlow_labelTime'), val:selectedTime||tr('bookingFlow_dateTbd') },
                { label:tr('bookingFlow_labelPet'), val:pet?pet.name+(pet.breed?' ('+pet.breed+')':''):tr('bookingFlow_petNotSelected') },
                addressLine(bookingAddress) ? { label:tr('bookingFlow_labelAddress'), val:addressLine(bookingAddress) } : null,
              ].filter(Boolean).map((item,i) => summaryRow(item.label, item.val, i))}
              {notes.length > 0 && (
                <div style={{ margin:'4px 0 10px', padding:'10px 12px', background:color.tile, borderRadius:radius.md }}>
                  <div style={{ fontSize:font.xs, color:color.muted, marginBottom:3, fontWeight:600 }}>{tr('bookingFlow_notesToSitterLabel')}</div>
                  <div style={{ fontSize:13, color:color.text, lineHeight:1.5 }}>{notes}</div>
                </div>
              )}
            </div>
            <div style={{ ...ui.card, marginBottom:12 }}>
              <div style={ui.sectionTitle}>{tr('bookingFlow_priceBreakdownHeading')}</div>
              {[
                { label:service.name, val:tr('bookingFlow_currencyPrefix')+service.price },
                getPriceAdjustment()>0?{ label:tr('bookingFlow_sizeNeedsAdjustment'), val:'+'+tr('bookingFlow_currencyPrefix')+getPriceAdjustment() }:null,
                { label:tr('bookingFlow_platformFee'), val:tr('bookingFlow_currencyPrefix')+'0' },
                appliedPromo?{ label:tr('bookingFlow_promoDiscountLine')+' ('+appliedPromo.code+')', val:'-'+tr('bookingFlow_currencyPrefix')+appliedPromo.discountAmount, highlight:true }:null,
              ].filter(Boolean).map((item,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:'6px 0' }}>
                  <div>
                    <span style={{ fontSize:13, color:item.highlight ? color.success : color.text }}>{item.label}</span>
                    {item.note && <span style={{ fontSize:font.xs, color:color.success, marginLeft:6 }}>{item.note}</span>}
                  </div>
                  <span style={{ fontSize:13, fontWeight:500, color:item.highlight ? color.success : color.ink, fontVariantNumeric:'tabular-nums' }}>{item.val}</span>
                </div>
              ))}

              <div style={{ marginTop:10, paddingTop:12, borderTop:`1px solid ${color.line}` }}>
                {appliedPromo ? (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <span style={{ ...ui.badge('success'), fontSize:font.sm, padding:'5px 10px' }}><Icon name="check" size={14} strokeWidth={2.4} />{tr('bookingFlow_promoAppliedLabel', { code: appliedPromo.code })}</span>
                    <button type="button" onClick={() => setAppliedPromo(null)} style={{ minHeight:36, padding:'0 4px', background:'none', border:'none', color:color.danger, fontSize:font.sm, fontWeight:600, cursor:'pointer', fontFamily:font.family }}>{tr('bookingFlow_promoRemove')}</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:'flex', gap:8 }}>
                      <div style={{ flex:1, minWidth:0, position:'relative' }}>
                        <Icon name="tag" size={16} color={color.muted} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                        <input value={promoInput} onChange={e => { setPromoInput(e.target.value); setPromoError(''); }} placeholder={tr('bookingFlow_promoCodePlaceholder')}
                          style={{ ...ui.input, minHeight:44, padding:'0 12px 0 36px', fontSize:14, textTransform:'uppercase', letterSpacing:0.4, borderColor:promoError ? color.danger : color.line }} />
                      </div>
                      <button type="button" onClick={applyPromoCode} disabled={promoApplying || !promoInput.trim()}
                        style={{ ...ui.secondaryButton, minHeight:44, padding:'0 16px', fontSize:14, color:promoInput.trim() ? color.navy : color.faint, borderColor:promoInput.trim() ? color.navy : color.line, cursor:promoInput.trim() ? 'pointer' : 'default', flexShrink:0 }}>
                        {promoApplying ? tr('bookingFlow_promoApplying') : tr('bookingFlow_promoApplyButton')}
                      </button>
                    </div>
                    {promoError && <div style={{ fontSize:font.sm, color:color.danger, marginTop:6 }}>{promoError}</div>}
                  </div>
                )}
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginTop:12, paddingTop:12, borderTop:`1px solid ${color.line}` }}>
                <span style={{ fontSize:15, fontWeight:700, color:color.ink }}>{tr('bookingFlow_totalLabel')}</span>
                <span style={{ fontSize:font.xl, fontWeight:700, color:color.ink, fontVariantNumeric:'tabular-nums' }}>{tr('bookingFlow_currencyPrefix')}{finalPrice}</span>
              </div>
            </div>
            <div style={{ background:color.successSoft, borderRadius:radius.md, padding:'12px 14px', display:'flex', gap:10, marginBottom:12 }}>
              <Icon name="shield" size={18} color={color.success} style={{ marginTop:1 }} />
              <div style={{ fontSize:font.sm, color:color.success, lineHeight:1.55 }}>
                <strong>{tr('bookingFlow_paymentAfterAcceptBold')}</strong> {tr('bookingFlow_paymentAfterAcceptBody', { name: sitterName })}
              </div>
            </div>
          </>
        )}
      </div>

      {validationError && (
        <div role="alert" style={{ position:'fixed', bottom:'calc(84px + env(safe-area-inset-bottom))', left:16, right:16, maxWidth:448, margin:'0 auto', background:color.dangerSoft, borderRadius:radius.md, padding:'12px 14px', fontSize:13, color:color.danger, fontWeight:500, display:'flex', alignItems:'center', gap:8, boxShadow:shadow.card, zIndex:101 }}>
          <Icon name="alert" size={18} />
          <span>{validationError}</span>
        </div>
      )}

      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:color.surface, borderTop:`1px solid ${color.line}`, zIndex:100 }}>
        <div style={{ maxWidth:480, margin:'0 auto', padding:'12px 16px calc(12px + env(safe-area-inset-bottom))', display:'flex', gap:10, boxSizing:'border-box' }}>
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s-1)} style={{ ...ui.secondaryButton, flex:1 }}>
              {tr('bookingFlow_backButton')}
            </button>
          )}
          <button type="button" onClick={() => {
              if (step === 3) { saveBooking(); return; }
              if (!canContinue()) {
                setValidationError(getValidationError());
                return;
              }
              setValidationError('');
              setStep(s => s+1);
            }}
            disabled={processing}
            style={{ ...ui.primaryButton, flex:2, background:continueReady ? color.navy : color.line, color:continueReady ? 'white' : color.faint, cursor:continueReady ? 'pointer' : 'not-allowed' }}>
            {processing?tr('common_saving') : step===3?tr('bookingFlow_requestBookingButton') : tr('bookingFlow_continueButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
