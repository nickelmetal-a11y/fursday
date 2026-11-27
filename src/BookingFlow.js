import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, shadow, ui } from './theme';
import Icon from './ui/Icon';
import { pointFor, serviceability, sitterCovers, formatKm } from './geo';
import { AddressForm, AreaSearch, loadSavedAddresses, addressIcon, addressLabelText, addressLine } from './AddressBook';
import { isSitterAvailable, toISODate, CALENDAR_DAYS } from './AvailabilityCalendar';
import PaymentScreen from './PaymentScreen';
import { createOrder, CHECKOUT_MODES } from './paymentsClient';
import { priceFor, NIGHT_SERVICES } from './pricing';
import { hostCapacity, dogsByNight, roomOn, loadNightsTaken } from './broadcastMatching';
import { writeWithFallback, BOOKING_OPTIONAL_GROUPS } from './schemaFallback';

const SERVICES = [
  { id: 'walk30', icon: 'walk', price: 349 },
  { id: 'boarding', icon: 'boarding', price: 849 },
  { id: 'daycare', icon: 'sun', price: 649 },
  { id: 'meet_greet', icon: 'users', price: 0 },
];

const SERVICE_I18N_KEYS = {
  walk30: { name: 'bookingFlow_svcWalkName', sub: 'bookingFlow_svcWalkSub', desc: 'bookingFlow_svcWalkDesc' },
  boarding: { name: 'bookingFlow_svcBoardingName', sub: 'bookingFlow_svcBoardingSub', desc: 'bookingFlow_svcBoardingDesc' },
  daycare: { name: 'bookingFlow_svcDaycareName', sub: 'bookingFlow_svcDaycareSub', desc: 'bookingFlow_svcDaycareDesc' },
  meet_greet: { name: 'bookingFlow_svcMeetName', sub: 'bookingFlow_svcMeetSub', desc: 'bookingFlow_svcMeetDesc' },
};

const TIME_SLOTS = ['6:00 AM','7:00 AM','8:00 AM','10:00 AM','11:00 AM','4:00 PM','5:00 PM','6:00 PM','7:00 PM'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SIZE_PRICES = { small: 0, medium: 0, large: 50, xlarge: 100 };
const REPEATABLE = ['walk30', 'dropin'];
const AT_HOST_HOME = ['boarding', 'daycare'];
const MAX_PLAN_DAYS = 55; // 8 weeks, counting the first day
const BUTTON_RESET = { font:'inherit', color:'inherit', textAlign:'inherit' };
const onKeyActivate = (fn) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

const getDays = () => {
  const days = [];
  const now = new Date();
  for (let i = 0; i < CALENDAR_DAYS; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    days.push(d);
  }
  return days;
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const rs = (n) => (n < 0 ? '-Rs.' + Math.abs(n) : 'Rs.' + n);

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

const dayIndexOf = (iso) => {
  if (!iso) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const i = Math.round((new Date(iso + 'T00:00:00') - today) / 86400000);
  return i >= 0 && i < CALENDAR_DAYS ? i : null;
};

export default function BookingFlow({ onBack, sitter, city, initialService, repeatBooking, initialPromoCode, onChooseSitter, initialDate, initialEndDate, initialTime, agreedPriceRupees, broadcastRequestId, onAddCertificate }) {
  const { t: tr, lang } = useLanguage();
  const dayName = (d) => lang === 'hi' ? d.toLocaleDateString('hi-IN', { weekday:'short' }) : DAY_NAMES[d.getDay()];
  const monthName = (d) => lang === 'hi' ? d.toLocaleDateString('hi-IN', { month:'short' }) : MONTH_NAMES[d.getMonth()];
  const [step, setStep] = useState(repeatBooking ? 1 : (initialService ? 1 : 0));
  const [sitterPrices, setSitterPrices] = useState({});
  const [selectedService, setSelectedService] = useState(repeatBooking ? repeatBooking.service_type : (initialService || null));
  const [selectedDay, setSelectedDay] = useState(() => dayIndexOf(initialDate));
  const [selectedTime, setSelectedTime] = useState(initialTime || null);
  const [validationError, setValidationError] = useState('');
  const [endDayOffset, setEndDayOffset] = useState(() => dayIndexOf(initialEndDate));
  const [dropTime, setDropTime] = useState(initialService === 'daycare' ? initialTime || null : null);
  const [pickTime, setPickTime] = useState(null);
  const [selectedPets, setSelectedPets] = useState(() => (repeatBooking ? (repeatBooking.pet_ids?.length ? repeatBooking.pet_ids : [repeatBooking.pet_id]).filter(Boolean) : []));
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
  const [checkout, setCheckout] = useState(null);
  const [checkoutLeft, setCheckoutLeft] = useState(false);
  const [repeatOn, setRepeatOn] = useState(false);
  const [repeatDays, setRepeatDays] = useState([]);
  const [repeatUntil, setRepeatUntil] = useState('');
  const [pickup, setPickup] = useState(false);
  const [houseRulesAccepted, setHouseRulesAccepted] = useState(false);
  const [nightBookings, setNightBookings] = useState([]);
  const [repeatClient, setRepeatClient] = useState(false);
  const [bookedCount, setBookedCount] = useState(1);
  const [bookedInstant, setBookedInstant] = useState(false);
  const stripRef = useRef(null);

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
    price: s.id === 'meet_greet' ? 0 : agreedPriceRupees && s.id === selectedService ? agreedPriceRupees : sitterPrices[s.id] ?? s.price,
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

  // The sitter row carries their base area, travel radius, capacity and rules.
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

  // The sitter's calendar: blocked days and custom slots.
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

  const isBoarding = NIGHT_SERVICES.includes(selectedService);
  const isDaycare = selectedService === 'daycare';
  const isWalker = selectedService === 'walk30';
  const isMeetGreet = selectedService === 'meet_greet';

  // Nights other parents already have with this host, so a full home can't be booked twice.
  useEffect(() => {
    if (!sitter?.id || !isBoarding) return;
    let cancelled = false;
    loadNightsTaken(supabase, [sitter.id], toISODate(days[0]), toISODate(days[days.length - 1])).then(rows => { if (!cancelled) setNightBookings(rows); });
    return () => { cancelled = true; };
  }, [sitter?.id, isBoarding]); // eslint-disable-line react-hooks/exhaustive-deps

  // Instant book is only for parents this sitter has already looked after.
  useEffect(() => {
    if (!sitter?.id || !sitterBase?.instant_book) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from('bookings').select('id').eq('pet_parent_id', user.id).eq('sitter_id', sitter.id).eq('status', 'completed').limit(1);
        if (!cancelled) setRepeatClient(Array.isArray(data) && data.length > 0);
      } catch (e) { /* stays a normal request */ }
    })();
    return () => { cancelled = true; };
  }, [sitter?.id, sitterBase?.instant_book]);

  const taken = dogsByNight(nightBookings, sitter?.id);
  const capacity = isBoarding ? hostCapacity(sitterBase) : (Number(sitterBase?.max_dogs) > 0 ? Number(sitterBase.max_dogs) : null);
  const nightFull = (i) => isBoarding && !!sitterBase && roomOn(sitterBase, taken, toISODate(days[i])) < 1;
  // Until the sitter row loads, nothing is greyed out.
  const dayOpen = (i) => !sitterBase || (isSitterAvailable(sitterBase, availRows, toISODate(days[i])) && !nightFull(i));
  const timeOpen = (tt) => selectedDay === null || !sitterBase || isSitterAvailable(sitterBase, availRows, toISODate(days[selectedDay]), tt);
  // A stay can end on day j only if every night from check-in to j-1 is open.
  const checkoutOpen = (j) => {
    if (selectedDay === null || j <= selectedDay) return false;
    for (let k = selectedDay; k < j; k++) if (!dayOpen(k)) return false;
    return true;
  };
  // Only on the date step: clearing a choice later would leave the review screen without a date.
  useEffect(() => {
    if (step !== 1) return;
    if (selectedDay !== null && !dayOpen(selectedDay)) { setSelectedDay(null); return; }
    if (isBoarding && endDayOffset !== null && selectedDay !== null && !checkoutOpen(endDayOffset)) setEndDayOffset(null);
    if (selectedTime && !timeOpen(selectedTime)) { setSelectedTime(null); setDropTime(null); }
  }, [step, selectedDay, endDayOffset, selectedTime, sitterBase, availRows, nightBookings]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const selectedPet = selectedPets[0] || null;
  const chosenPets = selectedPets.map(id => pets.find(p => p.id === id)).filter(Boolean);
  const pet = chosenPets[0] || null;
  const day = selectedDay !== null ? days[selectedDay] : undefined;
  const startISO = day ? toISODate(day) : null;
  const endISO = isBoarding && endDayOffset !== null ? toISODate(days[endDayOffset]) : null;

  const getPriceAdjustment = () => {
    if (agreedPriceRupees || !isWalker) return 0;
    return SIZE_PRICES[dogSize] || 0;
  };

  // A weekly plan: every chosen weekday from the first date to "until", minus the sitter's days off.
  const repeatable = REPEATABLE.includes(selectedService) && !broadcastRequestId && !agreedPriceRupees;
  const planOn = repeatable && repeatOn && !!day;
  const planLastISO = day ? toISODate(addDays(day, MAX_PLAN_DAYS)) : '';
  const planUntil = !day ? null : (!repeatUntil || repeatUntil < startISO) ? startISO : repeatUntil > planLastISO ? planLastISO : repeatUntil;
  const planDates = [];
  if (planOn) {
    for (let d = new Date(day); toISODate(d) <= planUntil; d = addDays(d, 1)) {
      const iso = toISODate(d);
      if (repeatDays.includes(d.getDay()) && (!sitterBase || isSitterAvailable(sitterBase, availRows, iso, selectedTime))) planDates.push(iso);
    }
  }
  const visitDates = planOn ? planDates : (startISO ? [startISO] : []);
  const visits = planOn ? planDates.length : 1;

  const nights = Math.max(1, (endDayOffset ?? 0) - (selectedDay ?? 0));
  const stayNightsISO = isBoarding && day ? Array.from({ length: nights }, (_, k) => toISODate(addDays(day, k))) : [];
  const roomLeft = isBoarding && sitterBase && stayNightsISO.length ? Math.min(...stayNightsISO.map(d => roomOn(sitterBase, taken, d))) : Infinity;
  const maxPets = Math.min(capacity ?? Infinity, roomLeft);
  const pricingRules = agreedPriceRupees ? {} : (sitterBase?.pricing_rules || {});
  const pickupFee = Number(pricingRules.pickup_fee_rupees) > 0 && AT_HOST_HOME.includes(selectedService) ? Math.round(Number(pricingRules.pickup_fee_rupees)) : 0;
  const dogCount = Math.max(1, selectedPets.length);
  const quote = priceFor({
    service: selectedService, basePriceRupees: service ? service.price : 0, startDate: day, nights,
    dogs: dogCount, puppies: chosenPets.filter(p => p.is_puppy).length, pickup: pickup && pickupFee > 0, rules: pricingRules,
  });
  const sizeExtra = getPriceAdjustment() * dogCount;
  const perVisit = quote.total + sizeExtra;
  const totalPrice = perVisit * visits;
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

  // Hosts can ask for a certificate valid for the whole booking.
  const needsVaccine = !!sitterBase?.requires_vaccination && !isMeetGreet;
  const lastDateISO = endISO || visitDates[visitDates.length - 1] || toISODate(days[0]);
  const vaccineOk = (p) => !!p.vaccination_cert_url && !!p.vaccinated_until && String(p.vaccinated_until).slice(0, 10) >= lastDateISO && String(p.vaccinated_until).slice(0, 10) > toISODate(days[0]);
  const unvaccinated = needsVaccine ? chosenPets.filter(p => !vaccineOk(p)) : [];
  const houseRules = AT_HOST_HOME.includes(selectedService) ? String(sitterBase?.home_details?.rules || '').trim() : '';
  const instant = !!sitterBase?.instant_book && repeatClient && !isMeetGreet;
  const policy = ['flexible', 'moderate', 'strict'].includes(sitterBase?.cancellation_policy) ? sitterBase.cancellation_policy : null;

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

  // A promo is redeemed on one booking, so a plan previews it against one visit.
  const promoBase = perVisit;
  const applyPromoCode = async () => {
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    setPromoApplying(true);
    setPromoError('');
    try {
      const { data: res, error } = await supabase.rpc('preview_promo', { p_code: code, p_amount_rupees: promoBase });
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
    if (step === 3 && autoApplyPromo.current && promoInput.trim() && !appliedPromo && !isMeetGreet) {
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

  const togglePet = (id) => {
    setValidationError('');
    if (selectedPets.includes(id)) { setSelectedPets(list => list.filter(x => x !== id)); return; }
    if (selectedPets.length >= maxPets) {
      setValidationError(roomLeft < (capacity ?? Infinity)
        ? tr('bookingFlow_errNoRoom', { name: sitterName, n: maxPets })
        : tr('bookingFlow_maxDogs', { name: sitterName, n: maxPets }));
      return;
    }
    setSelectedPets(list => [...list, id]);
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
      setSelectedPets(list => (list.length < maxPets ? [...list, data.id] : list));
      setAddingPet(false);
      setNewPetName('');
      setNewPetBreed('');
    }
    setSavingPet(false);
  };

  const saveBooking = async () => {
    if (houseRules && !houseRulesAccepted) { setValidationError(tr('bookingFlow_errHouseRules')); return; }
    setValidationError('');
    setProcessing(true);
    let ids = [], newBookingRef = '';
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      let seriesId = null;
      if (planOn && planDates.length > 1) {
        try {
          const { data: series, error: seriesErr } = await supabase.from('booking_series').insert({
            pet_parent_id: user ? user.id : null, sitter_id: sitter?.id || null, service_type: selectedService,
            weekdays: [...repeatDays].sort(), time_slot: selectedTime || '07:00', start_date: planDates[0], end_date: planDates[planDates.length - 1], status: 'active',
          }).select('id').single();
          if (!seriesErr) seriesId = series?.id || null;
        } catch (e) { /* before migration 038: the visits are booked one by one */ }
      }
      const amountPaise = perVisit * 100;
      const makeRow = (dateISO) => {
        const ref = 'FUR' + Math.floor(Math.random() * 900000 + 100000);
        return {
          pet_parent_id: user ? user.id : null,
          sitter_id: sitter?.id || null,
          city_id: cityRow?.id || null,
          service_type: selectedService,
          booking_date: dateISO,
          time_slot: selectedTime || dropTime || '07:00',
          gross_amount_paise: amountPaise,
          sitter_payout_paise: amountPaise,
          end_date: isBoarding ? endISO : null,
          pickup_time: isDaycare ? pickTime : null,
          status: broadcastRequestId || instant ? 'confirmed' : 'pending',
          parent_notes: pickup && pickupFee ? ['Pick-up and drop-back requested.', notes].filter(Boolean).join('\n') : notes,
          address_flat: bookingAddress.flat || null,
          address_tower: bookingAddress.building || null,
          address_society: bookingAddress.society || null,
          booking_ref: ref,
          start_otp: String(Math.floor(1000 + Math.random() * 9000)),
          pet_id: selectedPet,
          ...Object.fromEntries(Object.entries({
            address_area: bookingAddress.area || null,
            address_pincode: bookingAddress.pincode || null,
            address_lat: addressPoint?.lat ?? null,
            address_lng: addressPoint?.lng ?? null,
          }).filter(([, v]) => v != null)),
          pet_ids: selectedPets,
          is_meet_greet: isMeetGreet,
          ...(seriesId ? { series_id: seriesId } : {}),
          ...(houseRules ? { house_rules_accepted_at: new Date().toISOString() } : {}),
          ...(policy ? { cancellation_policy: policy } : {}),
        };
      };
      const rows = visitDates.map(makeRow);
      newBookingRef = rows[0].booking_ref;
      setBookingRef(newBookingRef);
      const single = rows.length === 1;
      const write = (r) => (single ? supabase.from('bookings').insert(r).select('id').single() : supabase.from('bookings').insert(r).select('id'));
      const { data: bookingData, error: bookingError } = await writeWithFallback(write, single ? rows[0] : rows, BOOKING_OPTIONAL_GROUPS);
      if (bookingError) {
        alert(tr('bookingFlow_alertCreateFailedPrefix') + bookingError.message);
        setProcessing(false);
        return;
      }
      ids = (Array.isArray(bookingData) ? bookingData : [bookingData]).map(b => b?.id).filter(Boolean);
      setBookedCount(rows.length);
      setBookedInstant(instant);
      if (broadcastRequestId && ids[0]) {
        const { error: linkErr } = await supabase.from('broadcast_requests').update({ booking_id: ids[0] }).eq('id', broadcastRequestId);
        if (linkErr) console.error('Could not link the request to its booking:', linkErr.message);
      }

      // The booking exists at full price either way; only the DB can discount it.
      if (appliedPromo && ids[0]) {
        const { data: promoRes, error: promoErr } = await supabase.rpc('apply_promo_to_booking', { p_booking_id: ids[0], p_code: appliedPromo.code });
        if (promoErr || !promoRes || promoRes.error) {
          console.error('Promo not applied:', promoErr || promoRes);
          setPromoFailed(true);
        }
      }

      // TIER 3: Send heat advisory notification if booking is during hot months
      const bookingDate = day || new Date();
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
    // Parents pay as they book; the money is only held until the sitter accepts.
    // Without online payments (not set up yet) the request goes out unpaid as before.
    // A plan is one checkout for all its visits; a free meet & greet has none.
    if (ids.length && !isMeetGreet) {
      try {
        const order = await createOrder(ids.length > 1 ? ids : ids[0]);
        if (CHECKOUT_MODES.includes(order.mode)) {
          setCheckout({ order, booking: { id: ids[0], ids, ref: newBookingRef, service: service?.name, amount: order.amount, sitterName } });
          setProcessing(false);
          return;
        }
      } catch (e) { console.error('Checkout unavailable, booking stays unpaid:', e.message); }
    }
    setProcessing(false);
    setConfirmed(true);
  };

  const canContinue = () => {
    if (step === 0) return !!selectedService;
    if (step === 1) {
      if (selectedDay === null) return false;
      if (isDaycare) return !!dropTime && !!pickTime;
      if (isBoarding) return !!selectedTime && endDayOffset !== null && checkoutOpen(endDayOffset);
      if (planOn && planDates.length === 0) return false;
      return !!selectedTime;
    }
    if (step === 2) return selectedPets.length > 0 && selectedPets.length <= maxPets && unvaccinated.length === 0 && aggressionConfirmed && !(cityHasZones && (!areaName || !zoneCheck.serviceable));
    return true;
  };

  const getValidationError = () => {
    if (step === 1) {
      if (selectedDay === null) return tr('bookingFlow_errSelectDate');
      if (isDaycare && !dropTime) return tr('bookingFlow_errSelectDropoff');
      if (isDaycare && !pickTime) return tr('bookingFlow_errSelectPickup');
      if (!isDaycare && !selectedTime) return tr('bookingFlow_errSelectTime');
      if (isBoarding && (endDayOffset === null || !checkoutOpen(endDayOffset))) return tr('bookingFlow_errSelectCheckout');
      if (planOn && planDates.length === 0) return tr('bookingFlow_errRepeatDays');
    }
    if (step === 2) {
      if (!selectedPets.length) return tr('bookingFlow_errSelectPet');
      if (selectedPets.length > maxPets) return tr('bookingFlow_errNoRoom', { name: sitterName, n: maxPets });
      if (unvaccinated.length) return tr('bookingFlow_errVaccine');
      if (!aggressionConfirmed) return tr('bookingFlow_errAggressionConfirm');
      if (cityHasZones && !areaName) return tr('bookingFlow_errPickArea');
      if (!zoneCheck.serviceable) return tr('bookingFlow_errNotServiceable');
    }
    return '';
  };

  const toggleRepeat = () => {
    if (!repeatOn && day) {
      if (!repeatDays.length) setRepeatDays([day.getDay()]);
      if (!repeatUntil) setRepeatUntil(toISODate(addDays(day, 27)));
    }
    setRepeatOn(on => !on);
  };

  const jumpTo = (i) => {
    const el = stripRef.current?.children?.[i];
    if (el && stripRef.current) stripRef.current.scrollLeft = el.offsetLeft - stripRef.current.offsetLeft;
  };

  const sitterName = sitter?.name || tr('bookingFlow_defaultSitterName');
  const sitterArea = sitter?.area || city || 'Gurgaon';
  const dateText = (d) => dayName(d) + ', ' + d.getDate() + ' ' + monthName(d);
  const isoText = (iso) => { const [y, m, dd] = iso.split('-').map(Number); return dateText(new Date(y, m - 1, dd)); };

  const choiceCard = (on) => ({ ...BUTTON_RESET, width:'100%', textAlign:'left', background:color.surface, borderRadius:radius.lg, padding:'14px 16px', marginBottom:10, display:'flex', gap:14, alignItems:'center', cursor:'pointer', border:`1px solid ${on ? color.navy : color.line}`, boxShadow:on ? `inset 0 0 0 1px ${color.navy}` : 'none', fontFamily:font.family });
  const timeSlot = (on) => ({ ...BUTTON_RESET, width:'100%', minHeight:44, padding:'0 8px', borderRadius:radius.md, textAlign:'center', cursor:'pointer', background:on ? color.navy : color.surface, border:`1px solid ${on ? color.navy : color.line}`, fontSize:13, fontWeight:600, color:on ? 'white' : color.text, fontVariantNumeric:'tabular-nums', fontFamily:font.family });
  const dateTile = (on) => ({ flexShrink:0, width:54, borderRadius:radius.md, padding:'10px 6px', textAlign:'center', cursor:'pointer', background:on ? color.navy : color.surface, border:`1px solid ${on ? color.navy : color.line}`, boxSizing:'border-box' });
  const stepTitle = { fontSize:font.xl, fontWeight:700, color:color.ink, margin:'0 0 4px', letterSpacing:-0.2 };
  const stepHint = { fontSize:font.md, color:color.muted, marginBottom:16 };
  const subHeading = { fontSize:font.md, fontWeight:600, color:color.ink, marginBottom:10 };
  const slotGrid = { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:20 };
  const dateStrip = { display:'flex', gap:8, overflowX:'auto', paddingBottom:8, marginBottom:20, scrollbarWidth:'none' };
  const renderDateTile = (d, i, on, onPick, closed = false, full = false) => (
    <div key={i} onClick={closed ? undefined : onPick} role="button" tabIndex={closed ? -1 : 0} aria-pressed={on} aria-disabled={closed || undefined}
      aria-label={dateText(d) + (closed ? ' · ' + (full ? tr('bookingFlow_fullShort') : tr('bookingFlow_offShort')) : '')}
      title={closed ? (full ? tr('bookingFlow_fullShort') : tr('bookingFlow_sitterOff')) : undefined} onKeyDown={closed ? undefined : onKeyActivate(onPick)}
      style={closed ? { ...dateTile(false), cursor:'not-allowed', opacity:0.4, background:color.tile } : dateTile(on)}>
      <div aria-hidden="true" style={{ fontSize:font.xs, color:on ? 'rgba(255,255,255,0.75)' : color.muted, marginBottom:4, fontWeight:500 }}>{dayName(d)}</div>
      <div aria-hidden="true" style={{ fontSize:font.lg + 1, fontWeight:700, color:on ? 'white' : color.ink, fontVariantNumeric:'tabular-nums', textDecoration:closed ? 'line-through' : 'none' }}>{d.getDate()}</div>
      <div aria-hidden="true" style={{ fontSize:font.xs, color:on ? 'rgba(255,255,255,0.7)' : color.faint, marginTop:2 }}>{closed ? (full ? tr('bookingFlow_fullShort') : tr('bookingFlow_offShort')) : monthName(d)}</div>
    </div>
  );
  const monthStarts = days.reduce((acc, d, i) => (i === 0 || d.getDate() === 1 ? [...acc, i] : acc), []);
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
  const switchButton = (on, onToggle, label) => (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle}
      style={{ ...BUTTON_RESET, width:'100%', minHeight:44, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background:'none', border:'none', padding:0, cursor:'pointer', fontFamily:font.family }}>
      <span style={{ fontSize:font.md, fontWeight:600, color:color.ink }}>{label}</span>
      <span aria-hidden="true" style={{ width:44, height:26, borderRadius:radius.pill, background:on ? color.navy : color.line, position:'relative', flexShrink:0, transition:'background 0.15s' }}>
        <span style={{ position:'absolute', top:3, left:on ? 21 : 3, width:20, height:20, borderRadius:radius.pill, background:color.surface, boxShadow:shadow.card, transition:'left 0.15s' }} />
      </span>
    </button>
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

  if (checkout) return (
    <PaymentScreen city={city} booking={checkout.booking} order={checkout.order}
      onSuccess={() => setCheckout(c => ({ ...c, paid: true }))}
      onBack={() => { if (checkout.paid) { onBack(); return; } setCheckout(null); setCheckoutLeft(true); setConfirmed(true); }} />
  );

  if (confirmed) return (
    <div style={{ ...ui.page, background:color.surface, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'calc(40px + env(safe-area-inset-top)) 16px calc(32px + env(safe-area-inset-bottom))', textAlign:'center', boxSizing:'border-box' }}>
      <div style={{ width:64, height:64, borderRadius:radius.pill, background:color.successSoft, color:color.success, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
        <Icon name="check" size={32} strokeWidth={2.4} />
      </div>
      <div style={{ fontSize:font.xxl, fontWeight:700, color:color.ink, marginBottom:6, letterSpacing:-0.3 }}>{tr(bookedInstant ? 'bookingFlow_instantTitle' : 'bookingFlow_confirmedTitle')}</div>
      <div style={{ fontSize:font.md, color:color.muted, marginBottom:24, lineHeight:1.6 }}>
        {bookedInstant ? tr('bookingFlow_instantBody', { name: sitterName }) : <>{tr('bookingFlow_confirmedNotified', { name: sitterName })}<br/>{tr('bookingFlow_confirmedHearBack')}</>}
        {bookedCount > 1 && <><br/>{tr('bookingFlow_seriesCreated', { n: bookedCount })}</>}
      </div>
      <div style={{ ...ui.card, width:'100%', marginBottom:12, textAlign:'left', boxSizing:'border-box' }}>
        <div style={{ display:'flex', justifyContent:'space-between', paddingBottom:10, borderBottom:`1px solid ${color.line}` }}>
          <span style={{ fontSize:font.sm, color:color.muted }}>{tr('bookingFlow_labelBookingRef')}</span>
          <span style={{ fontSize:font.sm, color:color.ink, fontWeight:700, letterSpacing:0.4 }}>{bookingRef}</span>
        </div>
        {[
          { label:tr('bookingFlow_labelService'), val:service?.name },
          { label:tr('bookingFlow_labelSitter'), val:sitterName || tr('bookingFlow_defaultSitterName') },
          { label:tr('bookingFlow_labelDate'), val:day?dateText(day):tr('bookingFlow_dateTbd') },
          { label:tr('bookingFlow_labelTime'), val:selectedTime },
          { label:chosenPets.length > 1 ? tr('bookingFlow_labelPets') : tr('bookingFlow_labelPet'), val:chosenPets.map(p => p.name + (p.breed && chosenPets.length === 1 ? ' ('+p.breed+')' : '')).join(', ') },
          { label:tr('bookingFlow_labelAmount'), val:isMeetGreet ? tr('bookingFlow_free') : tr('bookingFlow_currencyPrefix')+(promoFailed ? totalPrice : finalPrice) },
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
        {isMeetGreet ? tr('bookingFlow_meetNote', { name: sitterName }) : tr(checkoutLeft ? 'bookingFlow_checkoutLeftNote' : 'bookingFlow_paymentAfterAcceptNote', { name: sitterName })}
      </div>
      <button type="button" onClick={onBack} style={{ ...ui.primaryButton, width:'100%' }}>
        {tr('bookingFlow_backToHomeButton')}
      </button>
    </div>
  );

  const continueReady = canContinue() || step === 3;
  const priceLines = [
    ...quote.lines.map(l => ({ label: l.label === 'pricing_visitLine' ? service?.name : tr(l.label, l.vars), val: rs(l.amount), highlight: l.amount < 0 })),
    sizeExtra > 0 ? { label:tr('bookingFlow_sizeNeedsAdjustment'), val:'+'+rs(sizeExtra) } : null,
    visits > 1 ? { label:tr('bookingFlow_perVisit'), val:rs(perVisit), strong:true } : null,
    visits > 1 ? { label:tr('bookingFlow_timesVisits', { n: visits }), val:rs(totalPrice), strong:true } : null,
    { label:tr('bookingFlow_platformFee'), val:tr('bookingFlow_currencyPrefix')+'0' },
    appliedPromo ? { label:tr('bookingFlow_promoDiscountLine')+' ('+appliedPromo.code+')', val:'-'+tr('bookingFlow_currencyPrefix')+appliedPromo.discountAmount, highlight:true } : null,
  ].filter(Boolean);

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
                    <div style={{ fontSize:15, fontWeight:700, color:s.price ? color.ink : color.success, fontVariantNumeric:'tabular-nums' }}>{s.price ? tr('bookingFlow_currencyPrefix') + s.price : tr('bookingFlow_free')}</div>
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
            <div style={stepHint}>{tr('bookingFlow_next60Days')}</div>
            <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
              {monthStarts.map(i => (
                <button type="button" key={i} onClick={() => jumpTo(i)} aria-label={tr('bookingFlow_jumpToMonth', { month: days[i].toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month:'long' }) })}
                  style={{ ...ui.chip(false), minHeight:32, padding:'0 12px', fontSize:font.sm }}>
                  {days[i].toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month:'long' })}
                </button>
              ))}
            </div>
            <div ref={stripRef} style={dateStrip}>
              {days.map((d,i) => renderDateTile(d, i, selectedDay===i, () => setSelectedDay(i), !dayOpen(i), nightFull(i)))}
            </div>
            {days.some((d, i) => !dayOpen(i)) && (
              <div style={{ fontSize:font.sm, color:color.muted, margin:'-12px 0 16px' }}>
                {tr('bookingFlow_calendarNote')}{isBoarding && days.some((d, i) => nightFull(i)) ? ' ' + tr('bookingFlow_fullNote', { name: sitterName }) : ''}
              </div>
            )}
            {/* Boarding: end date picker */}
            {isBoarding && (
              <>
                <div style={subHeading}>{tr('bookingFlow_checkOutDate')}</div>
                <div style={{ ...dateStrip, marginBottom:12 }}>
                  {days.map((d,i) => (
                    i > (selectedDay ?? -1) && selectedDay !== null ? renderDateTile(d, i, endDayOffset===i, () => setEndDayOffset(i), !checkoutOpen(i)) : null
                  ))}
                </div>
                <div style={{ background:color.navySoft, borderRadius:radius.md, padding:'10px 14px', marginBottom:20, fontSize:13, color:color.navy, fontWeight:600, textAlign:'center', fontVariantNumeric:'tabular-nums' }}>
                  {tr('bookingFlow_nightsCount', { n: nights, word: nights>1?tr('bookingFlow_nightsWord'):tr('bookingFlow_nightWord') })} · {tr('bookingFlow_currencyPrefix')}{quote.total}
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

            {/* Walks and meet & greet: single time */}
            {!isBoarding && !isDaycare && (
              <>
                <div style={subHeading}>{tr('bookingFlow_pickATime')}</div>
                <div style={slotGrid}>
                  {TIME_SLOTS.map(tt => slotButton(tt, selectedTime===tt, () => setSelectedTime(tt)))}
                </div>
              </>
            )}

            {repeatable && day && (
              <div style={{ ...ui.card, marginBottom:14 }}>
                {switchButton(repeatOn, toggleRepeat, tr('bookingFlow_repeatWeekly'))}
                <div style={{ fontSize:font.sm, color:color.muted, lineHeight:1.5 }}>{tr('bookingFlow_repeatHint')}</div>
                {repeatOn && (
                  <>
                    <div style={{ ...ui.label, marginTop:12 }}>{tr('bookingFlow_repeatDays')}</div>
                    <div role="group" aria-label={tr('bookingFlow_repeatDays')} style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4, marginBottom:12 }}>
                      {WEEK_ORDER.map(wd => {
                        const on = repeatDays.includes(wd);
                        const sample = addDays(day, (wd - day.getDay() + 7) % 7);
                        return (
                          <button type="button" key={wd} aria-pressed={on} onClick={() => setRepeatDays(list => on ? list.filter(x => x !== wd) : [...list, wd])}
                            style={{ ...ui.chip(on), minHeight:44, padding:0, minWidth:0, borderRadius:radius.md, fontSize:font.sm }}>
                            {dayName(sample)}
                          </button>
                        );
                      })}
                    </div>
                    <label htmlFor="bf-repeat-until" style={ui.label}>{tr('bookingFlow_repeatUntil')}</label>
                    <input id="bf-repeat-until" type="date" value={planUntil || ''} min={startISO} max={planLastISO}
                      onChange={e => setRepeatUntil(e.target.value)} style={{ ...ui.input, marginBottom:10 }} />
                    <div role="status" style={{ fontSize:font.sm, fontWeight:600, color:planDates.length ? color.navy : color.danger }}>
                      {planDates.length ? tr('bookingFlow_repeatCount', { n: planDates.length, name: sitterName }) : tr('bookingFlow_repeatNone')}
                    </div>
                  </>
                )}
              </div>
            )}

            {isWalker && (
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
            )}
            {selectedTime && day && (
              <div style={{ background:color.navySoft, borderRadius:radius.md, padding:'10px 14px', fontSize:13, color:color.navy, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
                <Icon name="calendar" size={16} />
                <span>{dateText(day)} {tr('bookingFlow_atWord')} {selectedTime}</span>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={stepTitle}>{tr('bookingFlow_whichPet')}</h2>
            <div style={stepHint}>
              {tr('bookingFlow_selectPetHint')}
              {maxPets > 1 && <> · {tr('bookingFlow_multiPetHint')}</>}
              {Number.isFinite(maxPets) && <div style={{ fontSize:font.sm, marginTop:4 }}>{roomLeft < (capacity ?? Infinity) ? tr('bookingFlow_errNoRoom', { name: sitterName, n: maxPets }) : tr('bookingFlow_maxDogs', { name: sitterName, n: maxPets })}</div>}
            </div>
            {petsLoading && [0, 1].map(i => <div key={i} aria-hidden="true" style={{ height:80, borderRadius:radius.lg, background:color.tile, marginBottom:10 }} />)}
            {!petsLoading && pets.map(p => {
              const on = selectedPets.includes(p.id);
              return (
                <button type="button" key={p.id} onClick={() => togglePet(p.id)} aria-pressed={on} style={choiceCard(on)}>
                  <div style={{ ...ui.iconTile, width:52, height:52, background:on ? color.navySoft : color.tile, overflow:'hidden' }}>
                    {p.photo_url ? <img src={p.photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <Icon name="paw" size={24} />}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:color.ink, marginBottom:2 }}>{p.name}</div>
                    <div style={{ fontSize:13, color:color.muted }}>{p.breed || tr('bookingFlow_mixedBreed')}{p.age_years?' · '+p.age_years+' '+tr('bookingFlow_yearsUnit'):''}</div>
                  </div>
                  <span style={{ width:22, height:22, borderRadius:radius.sm, border:`1.5px solid ${on ? color.navy : color.line}`, background:on ? color.navy : 'transparent', color:'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    {on && <Icon name="check" size={14} strokeWidth={2.6} />}
                  </span>
                </button>
              );
            })}
            {unvaccinated.length > 0 && (
              <div role="status" style={{ background:color.dangerSoft, borderRadius:radius.lg, padding:'12px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
                <Icon name="shield" size={18} color={color.danger} style={{ marginTop:1, flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:font.md, fontWeight:600, color:color.danger, marginBottom:2 }}>{tr('bookingFlow_vaccineTitle', { name: sitterName })}</div>
                  <div style={{ fontSize:font.sm, color:color.text, lineHeight:1.5 }}>{tr('bookingFlow_vaccineMissing', { pets: unvaccinated.map(p => p.name).join(', ') })}</div>
                  {onAddCertificate && (
                    <button type="button" onClick={() => onAddCertificate(unvaccinated[0])} style={{ marginTop:4, minHeight:44, padding:0, background:'none', border:'none', color:color.navy, fontSize:font.sm, fontWeight:600, cursor:'pointer', fontFamily:font.family }}>{tr('bookingFlow_addCertificate')}</button>
                  )}
                </div>
              </div>
            )}
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
            {instant && (
              <div role="status" style={{ background:color.successSoft, borderRadius:radius.lg, padding:'12px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start', fontSize:font.sm, color:color.success, lineHeight:1.5 }}>
                <Icon name="check" size={18} style={{ marginTop:1, flexShrink:0 }} />{tr('bookingFlow_instantNote', { name: sitterName })}
              </div>
            )}
            <div style={{ ...ui.card, padding:'6px 16px', marginBottom:12 }}>
              {[
                { label:tr('bookingFlow_labelSitter'), val:sitterName },
                { label:tr('bookingFlow_labelService'), val:service.name+' · '+service.sub },
                { label:tr('bookingFlow_labelDate'), val:day ? dateText(day) + (endISO ? ' – ' + isoText(endISO) : '') : tr('bookingFlow_dateTbd') },
                planOn && planDates.length ? { label:tr('bookingFlow_labelPlan'), val:tr('bookingFlow_planSummary', { n: planDates.length, date: isoText(planDates[planDates.length - 1]) }) } : null,
                { label:tr('bookingFlow_labelTime'), val:selectedTime||tr('bookingFlow_dateTbd') },
                { label:chosenPets.length > 1 ? tr('bookingFlow_labelPets') : tr('bookingFlow_labelPet'), val:chosenPets.length ? chosenPets.map(p => p.name + (p.breed && chosenPets.length === 1 ? ' ('+p.breed+')' : '')).join(', ') : tr('bookingFlow_petNotSelected') },
                addressLine(bookingAddress) ? { label:tr('bookingFlow_labelAddress'), val:addressLine(bookingAddress) } : null,
                policy ? { label:tr('bookingFlow_cancelPolicyLabel'), val:tr('bookingFlow_policy_' + policy) } : null,
              ].filter(Boolean).map((item,i) => summaryRow(item.label, item.val, i))}
              {notes.length > 0 && (
                <div style={{ margin:'4px 0 10px', padding:'10px 12px', background:color.tile, borderRadius:radius.md }}>
                  <div style={{ fontSize:font.xs, color:color.muted, marginBottom:3, fontWeight:600 }}>{tr('bookingFlow_notesToSitterLabel')}</div>
                  <div style={{ fontSize:13, color:color.text, lineHeight:1.5 }}>{notes}</div>
                </div>
              )}
            </div>
            {houseRules && (
              <div style={{ ...ui.card, marginBottom:12 }}>
                <div style={ui.sectionTitle}>{tr('bookingFlow_houseRulesTitle')}</div>
                <div style={{ fontSize:13, color:color.text, lineHeight:1.6, whiteSpace:'pre-wrap', marginBottom:12 }}>{houseRules}</div>
                <label style={{ display:'flex', gap:10, alignItems:'center', minHeight:44, cursor:'pointer' }}>
                  <input type="checkbox" checked={houseRulesAccepted} onChange={e => { setHouseRulesAccepted(e.target.checked); setValidationError(''); }}
                    style={{ width:20, height:20, cursor:'pointer', accentColor:color.navy, flexShrink:0 }} />
                  <span style={{ fontSize:font.md, fontWeight:600, color:color.ink }}>{tr('bookingFlow_houseRulesAccept')}</span>
                </label>
              </div>
            )}
            {isMeetGreet ? (
              <div style={{ background:color.successSoft, borderRadius:radius.md, padding:'12px 14px', display:'flex', gap:10, marginBottom:12, fontSize:font.sm, color:color.success, lineHeight:1.55 }}>
                <Icon name="users" size={18} style={{ marginTop:1 }} />{tr('bookingFlow_meetNote', { name: sitterName })}
              </div>
            ) : (
            <div style={{ ...ui.card, marginBottom:12 }}>
              <div style={ui.sectionTitle}>{tr('bookingFlow_priceBreakdownHeading')}</div>
              {pickupFee > 0 && (
                <div style={{ marginBottom:6 }}>{switchButton(pickup, () => setPickup(p => !p), tr('bookingFlow_pickupToggle', { amount: pickupFee }))}</div>
              )}
              {priceLines.map((item,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:'6px 0', borderTop:item.strong ? `1px dashed ${color.line}` : 'none' }}>
                  <span style={{ fontSize:13, color:item.highlight ? color.success : color.text, fontWeight:item.strong ? 600 : 400 }}>{item.label}</span>
                  <span style={{ fontSize:13, fontWeight:item.strong ? 700 : 500, color:item.highlight ? color.success : color.ink, fontVariantNumeric:'tabular-nums', flexShrink:0 }}>{item.val}</span>
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
            )}
            {!isMeetGreet && (
              <div style={{ background:color.successSoft, borderRadius:radius.md, padding:'12px 14px', display:'flex', gap:10, marginBottom:12 }}>
                <Icon name="shield" size={18} color={color.success} style={{ marginTop:1 }} />
                <div style={{ fontSize:font.sm, color:color.success, lineHeight:1.55 }}>
                  <strong>{tr('bookingFlow_paymentAfterAcceptBold')}</strong> {tr('bookingFlow_paymentAfterAcceptBody', { name: sitterName })}
                </div>
              </div>
            )}
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
            <button type="button" onClick={() => { setValidationError(''); setStep(s => s-1); }} style={{ ...ui.secondaryButton, flex:1 }}>
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
            {processing?tr('common_saving') : step===3?(isMeetGreet ? tr('bookingFlow_requestMeetButton') : tr('bookingFlow_requestBookingButton')) : tr('bookingFlow_continueButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
