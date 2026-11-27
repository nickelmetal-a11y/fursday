import React, { useState, useRef } from 'react';
import { supabase } from './supabase';
import { writeWithFallback } from './schemaFallback';
import { choosePhoto } from './photoPicker';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import ServiceAreaPicker from './ServiceAreaPicker';
import BoardingHomeEditor, { PROVIDER_TYPES, MAX_GUEST_DOGS } from './BoardingHomeEditor';
import { compressImage } from './compressImage';
import { nearestLocality } from './geo';

const CITY_DATA = {
  Gurgaon: { avg: 22000, top: 45000 },
  Pune: { avg: 19000, top: 40000 },
};

// A typical nightly boarding price, used for the estimate until the host sets their own.
const CITY_NIGHTLY = { Gurgaon: 900, Pune: 800 };
const DEFAULT_NIGHTLY = 850;
const MAX_NIGHTS = 30;

const SERVICES = [
  { id: 'walk30', name: 'Request a walker', sub: '30 min per walk', icon: 'walk', avg: 320, default: 299, min: 149, max: 599, bookings: 20, nameKey: 'sitterOnboarding_serviceWalkName', subKey: 'sitterOnboarding_serviceWalkSub' },
  { id: 'boarding', name: 'Home boarding', sub: 'Per night', icon: 'boarding', avg: 899, default: 799, min: 499, max: 1999, bookings: 4, nameKey: 'sitterOnboarding_serviceBoardingName', subKey: 'sitterOnboarding_serviceBoardingSub' },
  { id: 'daycare', name: 'Doggy daycare', sub: 'Per day', icon: 'sun', avg: 699, default: 599, min: 399, max: 1299, bookings: 8, nameKey: 'sitterOnboarding_serviceDaycareName', subKey: 'sitterOnboarding_serviceDaycareSub' },
];

const EXPERIENCE_OPTIONS = ['Less than 1 year', '1-2 years', '3-5 years', '5+ years'];
const EXPERIENCE_KEYS = {
  'Less than 1 year': 'sitterOnboarding_expLessThan1',
  '1-2 years': 'sitterOnboarding_exp1to2',
  '3-5 years': 'sitterOnboarding_exp3to5',
  '5+ years': 'sitterOnboarding_exp5plus',
};

const LANGUAGES = ['Hindi', 'English', 'Marathi', 'Punjabi', 'Tamil', 'Telugu', 'Kannada', 'Bengali'];
const LANGUAGE_KEYS = {
  Hindi: 'sitterOnboarding_langHindi',
  English: 'sitterOnboarding_langEnglish',
  Marathi: 'sitterOnboarding_langMarathi',
  Punjabi: 'sitterOnboarding_langPunjabi',
  Tamil: 'sitterOnboarding_langTamil',
  Telugu: 'sitterOnboarding_langTelugu',
  Kannada: 'sitterOnboarding_langKannada',
  Bengali: 'sitterOnboarding_langBengali',
};

const DAY_KEYS = {
  Mon: 'sitterOnboarding_dayMon', Tue: 'sitterOnboarding_dayTue', Wed: 'sitterOnboarding_dayWed',
  Thu: 'sitterOnboarding_dayThu', Fri: 'sitterOnboarding_dayFri', Sat: 'sitterOnboarding_daySat', Sun: 'sitterOnboarding_daySun',
};

const ADVANCE_NOTICE_KEYS = {
  'Same day': 'sitterOnboarding_noticeSameDay', '12hrs': 'sitterOnboarding_notice12hrs',
  '24hrs': 'sitterOnboarding_notice24hrs', '48hrs': 'sitterOnboarding_notice48hrs', '1 week': 'sitterOnboarding_notice1Week',
};

const RESPONSIBILITIES = [
  { icon: 'briefcase', labelKey: 'sitterOnboarding_respKitLabel', detailKey: 'sitterOnboarding_respKitDetail', required: true, walkOnly: true },
  { icon: 'clock', labelKey: 'sitterOnboarding_respTimeLabel', detailKey: 'sitterOnboarding_respTimeDetail', required: true },
  { icon: 'smartphone', labelKey: 'sitterOnboarding_respOtpLabel', detailKey: 'sitterOnboarding_respOtpDetail', required: true },
  { icon: 'check', labelKey: 'sitterOnboarding_respPottyLabel', detailKey: 'sitterOnboarding_respPottyDetail', required: true },
  { icon: 'paw', labelKey: 'sitterOnboarding_respWipeLabel', detailKey: 'sitterOnboarding_respWipeDetail', required: true, walkOnly: true },
  { icon: 'fileText', labelKey: 'sitterOnboarding_respReportLabel', detailKey: 'sitterOnboarding_respReportDetail', required: true, walkOnly: true },
  { icon: 'alert', labelKey: 'sitterOnboarding_respNoFoodLabel', detailKey: 'sitterOnboarding_respNoFoodDetail', required: false, walkOnly: true },
  { icon: 'droplet', labelKey: 'onbResp_feedLabel', detailKey: 'onbResp_feedDetail', required: true, boardingOnly: true },
  { icon: 'camera', labelKey: 'onbResp_updatesLabel', detailKey: 'onbResp_updatesDetail', required: true, boardingOnly: true },
  { icon: 'lock', labelKey: 'onbResp_safeLabel', detailKey: 'onbResp_safeDetail', required: true, boardingOnly: true },
  { icon: 'lock', labelKey: 'sitterOnboarding_respPrivacyLabel', detailKey: 'sitterOnboarding_respPrivacyDetail', required: true },
  { icon: 'wallet', labelKey: 'sitterOnboarding_respNoDealsLabel', detailKey: 'sitterOnboarding_respNoDealsDetail', required: true },
  { icon: 'sos', labelKey: 'sitterOnboarding_respEmergencyLabel', detailKey: 'sitterOnboarding_respEmergencyDetail', required: true },
];

const VERIFY_STEP_KEYS = ['sitterOnboarding_verifyStep1', 'sitterOnboarding_verifyStep2', 'sitterOnboarding_verifyStep3'];
const COMPLETE_STEP_KEYS = ['sitterOnboarding_completeStep1', 'sitterOnboarding_completeStep2', 'sitterOnboarding_completeStep3'];

// Screen ids are stored as sitter_profiles.onboarding_step for resume, so the
// home step gets a new id instead of renumbering the existing screens.
const HOME = 10;
const FLOWS = {
  sitter: [1, 2, 3, 4, 5, 6, 7, 8],
  boarding: [1, HOME, 3, 4, 5, 6, 7, 8],
  both: [1, 2, HOME, 3, 4, 5, 6, 7, 8],
};

// Drafts saved before migration 037 have no provider_type; guess it from what they offer.
const inferProviderType = (serviceTypes, step) =>
  serviceTypes.includes('boarding') && !serviceTypes.includes('walk30') ? 'boarding' : step === HOME ? 'both' : 'sitter';

export default function SitterOnboarding({ onDone, city }) {
  const { t: tr } = useLanguage();
  const [screen, setScreen] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [chatStep, setChatStep] = useState(0);
  const [services, setServices] = useState([]);
  const [prices, setPrices] = useState(Object.fromEntries(SERVICES.map(s => [s.id, s.default])));
  const [pricingIdx, setPricingIdx] = useState(0);
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [languages, setLanguages] = useState(['Hindi', 'English']);
  const [aadhaar, setAadhaar] = useState('');
  const [upiId, setUpiId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [availableDays, setAvailableDays] = useState(['Mon','Tue','Wed','Thu','Fri']);
  const [morningSlot, setMorningSlot] = useState(true);
  const [eveningSlot, setEveningSlot] = useState(true);
  const [afternoonSlot, setAfternoonSlot] = useState(false);
  const [maxDogs, setMaxDogs] = useState('1');
  const [advanceNotice, setAdvanceNotice] = useState('24hrs');
  const [saving, setSaving] = useState(false);
  const [area, setArea] = useState({ base_area: '', base_pincode: '', lat: null, lng: null, service_radius_km: 5 });
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [draftSitterId, setDraftSitterId] = useState(null);
  const [restoringDraft, setRestoringDraft] = useState(true);
  const [providerType, setProviderType] = useState('sitter');
  const [homeDaycare, setHomeDaycare] = useState(false);
  const [homeDetails, setHomeDetails] = useState({});
  const [homePhotos, setHomePhotos] = useState([]);
  const [boardingDogs, setBoardingDogs] = useState(2);
  const [boardingNights, setBoardingNights] = useState(8);
  const [boardingPriceKnown, setBoardingPriceKnown] = useState(false);
  const photoInputRef = useRef(null);

  // Resume-in-progress onboarding: a closed tab/app used to lose the whole
  // flow (nothing persisted until the final "Go live" submit). Now every
  // step upserts a `status: 'draft'` row, and on mount we restore from it.
  React.useEffect(() => {
    const restore = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setRestoringDraft(false); return; }
        const { data: draft } = await supabase.from('sitter_profiles').select('*').eq('user_id', user.id).eq('status', 'draft').single();
        if (draft) {
          setDraftSitterId(draft.id);
          if (draft.bio) setBio(draft.bio);
          if (draft.experience_text) setExperience(draft.experience_text);
          if (draft.languages?.length) setLanguages(draft.languages);
          if (draft.availability_days?.length) setAvailableDays(draft.availability_days);
          if (draft.morning_slot != null) setMorningSlot(draft.morning_slot);
          if (draft.afternoon_slot != null) setAfternoonSlot(draft.afternoon_slot);
          if (draft.evening_slot != null) setEveningSlot(draft.evening_slot);
          if (draft.max_dogs) setMaxDogs(String(draft.max_dogs));
          if (draft.advance_notice) setAdvanceNotice(draft.advance_notice);
          if (draft.profile_photo_url) setPhotoUrl(draft.profile_photo_url);
          if (draft.home_details) setHomeDetails(draft.home_details);
          if (draft.home_photos?.length) setHomePhotos(draft.home_photos);
          if (draft.base_area || draft.service_radius_km) setArea({ base_area: draft.base_area || '', base_pincode: draft.base_pincode || '', lat: draft.lat ?? null, lng: draft.lng ?? null, service_radius_km: Number(draft.service_radius_km) || 5 });

          const { data: userRow } = await supabase.from('users').select('name').eq('id', user.id).single();
          if (userRow?.name && userRow.name.toLowerCase() !== user.email?.toLowerCase()) setName(userRow.name);
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: user.id });
          if (contact?.[0]?.phone) setPhone(contact[0].phone.replace(/^\+?91/, ''));

          const { data: svcRows } = await supabase.from('sitter_services').select('service_type, price_paise').eq('sitter_id', draft.id);
          const svcTypes = (svcRows || []).map(r => r.service_type);
          if (svcRows?.length) {
            setServices(svcTypes);
            setPrices(prev => { const next = { ...prev }; svcRows.forEach(r => { next[r.service_type] = Math.round(r.price_paise / 100); }); return next; });
            if (svcTypes.includes('boarding')) setBoardingPriceKnown(true);
          }
          const step = Math.max(draft.onboarding_step || 1, 1);
          const type = PROVIDER_TYPES.includes(draft.provider_type) ? draft.provider_type : inferProviderType(svcTypes, step);
          setProviderType(type);
          setHomeDaycare(svcTypes.includes('daycare'));
          if (!svcTypes.length && type !== 'sitter') setServices(type === 'boarding' ? ['boarding'] : ['walk30', 'boarding']);

          const { data: pii } = await supabase.from('sitter_pii').select('aadhaar_number, upi_id').eq('sitter_id', draft.id).maybeSingle();
          if (pii?.aadhaar_number) setAadhaar(pii.aadhaar_number);
          if (pii?.upi_id) setUpiId(pii.upi_id);

          setScreen(FLOWS[type].includes(step) ? step : 1);
        }
      } catch (e) { /* no draft yet — fresh start */ }
      setRestoringDraft(false);
    };
    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Upserts the sitter_profiles draft row with whatever's known so far, so
  // closing mid-flow never loses progress. Returns the draft row's id.
  const saveDraft = async (step, extra = {}) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      const { data: draft, error } = await writeWithFallback(row => supabase.from('sitter_profiles').upsert(row, { onConflict: 'user_id' }).select().single(), {
        user_id: user.id, city_id: cityRow?.id, status: 'draft', onboarding_step: step,
        bio, experience_years: parseInt(experience) || 0, experience_text: experience || null,
        languages, availability_days: availableDays, morning_slot: morningSlot,
        afternoon_slot: afternoonSlot, evening_slot: eveningSlot, max_dogs: maxDogsValue(),
        advance_notice: advanceNotice, profile_photo_url: photoUrl, ...areaFields(), ...providerFields(),
        ...extra,
      });
      if (error) { console.log('Draft save error:', error.message); return draftSitterId; }
      setDraftSitterId(draft.id);
      return draft.id;
    } catch (e) { return draftSitterId; }
  };

  const saveDraftServices = async (sitterId) => {
    if (!sitterId) return;
    const activeNow = SERVICES.filter(s => services.includes(s.id));
    await supabase.from('sitter_services').delete().eq('sitter_id', sitterId);
    if (activeNow.length) {
      await supabase.from('sitter_services').insert(activeNow.map(s => ({ sitter_id: sitterId, service_type: s.id, price_paise: prices[s.id] * 100, is_active: true })));
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert(tr('sitterOnboarding_pleaseLogInFirst')); setUploadingPhoto(false); return; }
      const compressed = await compressImage(file);
      const path = `onboarding-${user.id}-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('sitter-photos').upload(path, compressed);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('sitter-photos').getPublicUrl(path);
      setPhotoUrl(publicUrl);
    } catch (err) {
      alert(tr('sitterOnboarding_photoUploadFailed', { error: err.message || err }));
    }
    setUploadingPhoto(false);
  };

  // A GPS fix pre-fills the base area (the sitter can still change it on the
  // availability step); a draft restored later or a manual pick always wins.
  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const loc = nearestLocality(pos.coords.latitude, pos.coords.longitude, city);
          if (loc) setArea(prev => (prev.base_area ? prev : { ...prev, base_area: loc.name, base_pincode: loc.pincode, lat: loc.lat, lng: loc.lng }));
        },
        () => {}
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const areaFields = () => ({
    base_area: area.base_area || null, base_pincode: area.base_pincode || null,
    lat: area.lat ?? null, lng: area.lng ?? null, service_radius_km: Number(area.service_radius_km) || 5,
  });

  const providerFields = () => ({ provider_type: providerType, home_details: homeDetails, home_photos: homePhotos });
  // Boarding-only hosts set their guest-dog limit on the home step, not the walk availability step.
  const maxDogsValue = () => (providerType === 'boarding' && homeDetails.max_dogs) || parseInt(maxDogs) || 1;

  const flow = FLOWS[providerType];
  const nextOf = (s) => flow[flow.indexOf(s) + 1];
  const goNext = async (from) => { const to = nextOf(from); await saveDraft(to); setScreen(to); };
  const boardingOnly = providerType === 'boarding';

  const typicalNightly = CITY_NIGHTLY[city] || DEFAULT_NIGHTLY;
  const estimateNightly = boardingPriceKnown ? prices.boarding : typicalNightly;
  const beginSignup = () => {
    if (providerType !== 'sitter' && !boardingPriceKnown) { setPrices(prev => ({ ...prev, boarding: typicalNightly })); setBoardingPriceKnown(true); }
    if (providerType === 'boarding') setServices(['boarding', ...(homeDaycare ? ['daycare'] : [])]);
    else if (providerType === 'both') setServices(prev => [...new Set([...prev, 'walk30', 'boarding'])]);
    setScreen(1);
  };

  const cityInfo = CITY_DATA[city];
  const activeServices = SERVICES.filter(s => services.includes(s.id));
  const monthlyFor = (s) => (s.id === 'boarding' ? prices.boarding * boardingDogs * boardingNights : prices[s.id] * s.bookings);
  const estimated = activeServices.reduce((sum, s) => sum + monthlyFor(s), 0);
  const pricingService = activeServices[pricingIdx];

  const toggleService = id => setServices(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const toggleLang = lang => setLanguages(prev =>
    prev.includes(lang) ? prev.filter(x => x !== lang) : [...prev, lang]
  );

  const requestNotificationPermission = async () => {
    if (typeof window.Notification === 'function' && typeof Notification.requestPermission === 'function') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(tr('sitterOnboarding_notifWelcomeTitle'), {
          body: tr('sitterOnboarding_notifWelcomeBody'),
          icon: '/favicon.ico',
        });
      }
    }
  };

  const handleGoLive = async () => {
    setSaving(true);
    await requestNotificationPermission();
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) { alert(tr('sitterOnboarding_notLoggedIn')); setSaving(false); return; }
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      if (!cityRow) {
        alert(tr('sitterOnboarding_cityNotFound', { city }));
        setSaving(false);
        return;
      }

      const { error: userError } = await supabase.from('users').upsert(
        { id: currentUser.id, name, phone: '+91' + phone, city_id: cityRow.id }
      );
      if (userError) { alert(tr('sitterOnboarding_couldNotSaveDetails', { error: userError.message })); setSaving(false); return; }

      const { data: sitter, error: sitterError } = await writeWithFallback(row => supabase.from('sitter_profiles').upsert(row, { onConflict: 'user_id' }).select().single(), {
        user_id: currentUser.id, city_id: cityRow.id,
        bio, experience_years: parseInt(experience) || 0,
        experience_text: experience || null,
        languages, status: 'pending',
        availability_days: availableDays,
        morning_slot: morningSlot,
        afternoon_slot: afternoonSlot,
        evening_slot: eveningSlot,
        max_dogs: maxDogsValue(),
        advance_notice: advanceNotice,
        profile_photo_url: photoUrl,
        ...areaFields(),
        ...providerFields(),
      });
      if (sitterError) { alert(tr('sitterOnboarding_couldNotSaveSitterProfile', { error: sitterError.message })); setSaving(false); return; }

      // Replace any previous services (re-running onboarding shouldn't duplicate rows)
      await supabase.from('sitter_services').delete().eq('sitter_id', sitter.id);
      const rows = activeServices.map(s => ({
        sitter_id: sitter.id, service_type: s.id,
        price_paise: prices[s.id] * 100, is_active: true,
      }));
      const { error: servicesError } = await supabase.from('sitter_services').insert(rows);
      if (servicesError) { alert(tr('sitterOnboarding_couldNotSaveServices', { error: servicesError.message })); setSaving(false); return; }

      if (aadhaar || upiId) {
        const { error: piiError } = await supabase.from('sitter_pii').upsert({
          sitter_id: sitter.id,
          aadhaar_number: aadhaar || null,
          upi_id: upiId || null,
        }, { onConflict: 'sitter_id' });
        if (piiError) { alert(tr('sitterOnboarding_couldNotSaveVerificationDetails', { error: piiError.message })); setSaving(false); return; }
      }
    } catch(e) {
      alert(tr('sitterOnboarding_somethingWentWrong'));
      setSaving(false);
      return;
    }
    setSaving(false);
    setScreen(9);
  };

  const money = { fontVariantNumeric: 'tabular-nums' };
  const wrap = (children) => (
    <div style={{ ...ui.page, paddingBottom: 'calc(104px + env(safe-area-inset-bottom))' }}>
      {children}
    </div>
  );
  const body = { padding: '20px 16px 0' };
  const title = { fontSize: font.xxl, fontWeight: 700, color: color.ink, margin: '0 0 4px', letterSpacing: -0.3, lineHeight: 1.25 };
  const subtitle = { fontSize: font.md, color: color.muted, margin: '0 0 20px', lineHeight: 1.5 };
  const card = { ...ui.card, marginBottom: 12 };
  const cardTitle = { fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 10 };
  const chipRow = { display: 'flex', flexWrap: 'wrap', gap: 8 };
  const hint = { fontSize: font.xs, color: color.muted, marginTop: 6, lineHeight: 1.5 };
  const switchVisual = (on) => (
    <span aria-hidden="true" style={{ width: 44, height: 26, borderRadius: radius.pill, background: on ? color.navy : color.line, position: 'relative', transition: 'background 0.2s', flexShrink: 0, display: 'block' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: radius.pill, background: color.surface, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(16,24,40,0.2)' }} />
    </span>
  );
  const botAvatar = (size) => (
    <div style={{ width: size, height: size, borderRadius: radius.md, background: color.navy, color: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name="paw" size={Math.round(size * 0.55)} />
    </div>
  );
  const botBubble = (text) => (
    <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
      {botAvatar(32)}
      <div style={{ background: color.surface, border: `1px solid ${color.line}`, borderRadius: '16px 16px 16px 4px', padding: '12px 14px', fontSize: font.md, color: color.ink, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
  const smallPrimary = { ...ui.primaryButton, minHeight: 44, padding: '0 20px', fontSize: font.md };

  const stepHeader = () => {
    const idx = flow.indexOf(screen);
    const step = idx + 1, total = flow.length;
    return (
      <div style={{ ...ui.header, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setScreen(idx > 0 ? flow[idx - 1] : 0)} aria-label={tr('common_back')} style={ui.backButton}><Icon name="arrowLeft" size={20} /></button>
          <span style={{ fontSize: font.sm, fontWeight: 600, color: color.muted }}>{tr('sitterOnboarding_stepOf', { step, total })}</span>
        </div>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step} style={{ background: color.tile, height: 6, borderRadius: radius.pill, overflow: 'hidden' }}>
          <div style={{ width: (step / total * 100) + '%', background: color.navy, height: 6, borderRadius: radius.pill, transition: 'width 0.3s' }} />
        </div>
      </div>
    );
  };

  const bottomBar = (label, onClick, disabled) => (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60, background: color.surface, borderTop: `1px solid ${color.line}` }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', boxSizing: 'border-box' }}>
        <button onClick={onClick} disabled={disabled}
          style={{ ...ui.primaryButton, width: '100%', background: disabled ? color.tile : color.navy, color: disabled ? color.faint : color.surface, cursor: disabled ? 'not-allowed' : 'pointer' }}>
          {label}
        </button>
      </div>
    </div>
  );

  if (restoringDraft) return wrap(
    <div role="status" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      {botAvatar(44)}
      <div style={{ color: color.muted, fontSize: font.sm }}>{tr('common_loading')}</div>
    </div>
  );

  const stepper = (label, value, set, min, max, lessKey, moreKey) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: font.xs, color: color.faint, marginBottom: 6 }}>{tr(label)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button type="button" onClick={() => set(Math.max(min, value - 1))} disabled={value <= min} aria-label={tr(lessKey)}
          style={{ width: 44, height: 44, borderRadius: radius.md, border: 'none', background: color.navyHover, color: color.surface, fontSize: font.xl, cursor: value <= min ? 'default' : 'pointer', opacity: value <= min ? 0.5 : 1, fontFamily: 'inherit' }}>−</button>
        <span aria-live="polite" aria-label={tr(label) + ': ' + value} style={{ ...money, minWidth: 28, textAlign: 'center', fontSize: font.lg, fontWeight: 700 }}>{value}</span>
        <button type="button" onClick={() => set(Math.min(max, value + 1))} disabled={value >= max} aria-label={tr(moreKey)}
          style={{ width: 44, height: 44, borderRadius: radius.md, border: 'none', background: color.navyHover, color: color.surface, fontSize: font.xl, cursor: value >= max ? 'default' : 'pointer', opacity: value >= max ? 0.5 : 1, fontFamily: 'inherit' }}>+</button>
      </div>
    </div>
  );
  const boardingEstimate = (alsoWalks) => (
    <section aria-label={tr(alsoWalks ? 'onbEst_titleBoth' : 'onbEst_title')} style={{ background: color.navy, color: color.surface, borderRadius: radius.lg, padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: font.sm, fontWeight: 600, color: color.faint }}>{tr(alsoWalks ? 'onbEst_titleBoth' : 'onbEst_title')}</div>
      <div style={{ fontSize: font.md, fontWeight: 600, marginTop: 6 }}>{tr(boardingDogs === 1 ? 'onbEst_lineOne' : 'onbEst_line', { dogs: boardingDogs, nights: boardingNights })}</div>
      <div data-testid="boarding-estimate" style={{ ...money, fontSize: 32, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.5, marginTop: 4 }}>
        ≈ Rs.{(estimateNightly * boardingDogs * boardingNights).toLocaleString('en-IN')} <span style={{ fontSize: font.md, fontWeight: 600 }}>{tr('onbEst_perMonth')}</span>
      </div>
      <div style={{ fontSize: font.sm, color: color.faint, marginTop: 6, lineHeight: 1.5 }}>
        {boardingPriceKnown ? tr('onbEst_priceOwn', { price: estimateNightly }) : tr('onbEst_price', { price: estimateNightly, city: city || 'Gurgaon' })} {tr('onbEst_fee')}
      </div>
      <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
        {stepper('onbEst_dogs', boardingDogs, setBoardingDogs, 1, MAX_GUEST_DOGS, 'onbEst_fewerDogs', 'onbEst_moreDogs')}
        {stepper('onbEst_nights', boardingNights, setBoardingNights, 1, MAX_NIGHTS, 'onbEst_fewerNights', 'onbEst_moreNights')}
      </div>
    </section>
  );

  // SCREEN 0 — City + earnings
  if (screen === 0) return wrap(
    <div style={{ padding: 'calc(20px + env(safe-area-inset-top)) 16px 24px', display: 'flex', flexDirection: 'column', minHeight: '100vh', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {botAvatar(36)}
        <span style={{ color: color.ink, fontSize: font.lg, fontWeight: 700 }}>Fursday</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: font.xs, fontWeight: 600, letterSpacing: 0.5, color: color.muted, marginBottom: 8 }}>{tr('sitterOnboarding_yourCity')}</div>
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', marginBottom: 16 }}>
          <Icon name="pin" size={20} color={color.navy} />
          <span style={{ fontSize: font.lg, fontWeight: 600, color: color.ink }}>{city || 'Gurgaon'}</span>
        </div>
        {boardingOnly ? boardingEstimate(false) : (
          <div style={{ background: color.navy, color: color.surface, borderRadius: radius.lg, padding: 20, marginBottom: 16 }}>
            <div style={{ ...money, fontSize: 32, fontWeight: 700, lineHeight: 1.1, letterSpacing: -0.5 }}>Rs.{cityInfo.avg.toLocaleString('en-IN')}</div>
            <div style={{ fontSize: font.lg, fontWeight: 600, marginTop: 6 }}>{tr('sitterOnboarding_averagePerMonth')}</div>
            <div style={{ fontSize: font.sm, color: color.faint, marginTop: 4, lineHeight: 1.5 }}>{tr('sitterOnboarding_topSittersEarn', { amount: cityInfo.top.toLocaleString('en-IN'), city })}</div>
          </div>
        )}
        {providerType === 'both' && boardingEstimate(true)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
          {[
            { icon: 'calendar', v: tr('sitterOnboarding_statSetOwnSchedule'), s: tr('sitterOnboarding_statSetOwnScheduleSub') },
            { icon: 'key', v: tr('sitterOnboarding_statNoLockIn'), s: tr('sitterOnboarding_statNoLockInSub') },
            { icon: 'wallet', v: 'Rs.0', s: tr('sitterOnboarding_statFreeToJoinSub') },
          ].map((x, i) => (
            <div key={i} style={{ ...ui.card, padding: '12px 8px', textAlign: 'center', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: color.navy, marginBottom: 6 }}><Icon name={x.icon} size={18} /></div>
              <div style={{ fontSize: font.sm, fontWeight: 700, color: color.ink, lineHeight: 1.3 }}>{x.v}</div>
              <div style={{ fontSize: font.xs, color: color.muted, marginTop: 2, lineHeight: 1.3 }}>{x.s}</div>
            </div>
          ))}
        </div>
        <div id="onb-type-title" style={{ fontSize: font.md, fontWeight: 700, color: color.ink, marginBottom: 10 }}>{tr('onbType_title')}</div>
        <div role="group" aria-labelledby="onb-type-title" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {[{ id: 'sitter', icon: 'walk' }, { id: 'boarding', icon: 'boarding' }, { id: 'both', icon: 'paw' }].map(opt => {
            const sel = providerType === opt.id;
            return (
              <button key={opt.id} type="button" onClick={() => setProviderType(opt.id)} aria-pressed={sel}
                style={{ width: '100%', minHeight: 56, fontFamily: 'inherit', textAlign: 'left', color: 'inherit', background: color.surface, borderRadius: radius.lg, padding: '10px 14px', border: `1.5px solid ${sel ? color.navy : color.line}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ ...ui.iconTile, width: 40, height: 40, background: sel ? color.navySoft : color.tile }}><Icon name={opt.icon} size={20} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr('bhome_type_' + opt.id)}</span>
                  <span style={{ display: 'block', fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr('bhome_type_' + opt.id + 'Sub')}</span>
                </span>
                {sel && <Icon name="check" size={18} color={color.navy} />}
              </button>
            );
          })}
        </div>
        {boardingOnly && (
          <button type="button" onClick={() => setHomeDaycare(v => !v)} role="switch" aria-checked={homeDaycare}
            style={{ ...card, width: '100%', fontFamily: 'inherit', textAlign: 'left', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', marginBottom: 16 }}>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr('onbType_daycare')}</span>
              <span style={{ display: 'block', fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr('onbType_daycareSub')}</span>
            </span>
            {switchVisual(homeDaycare)}
          </button>
        )}
        <button onClick={beginSignup} style={{ ...ui.primaryButton, width: '100%', minHeight: 52, fontSize: font.lg }}>
          {tr('sitterOnboarding_iWantToEarnThis')}
        </button>
        <button onClick={onDone}
          style={{ width: '100%', marginTop: 8, minHeight: 44, border: 'none', background: 'transparent', color: color.muted, fontSize: font.md, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          {tr('sitterOnboarding_notNow')}
        </button>
      </div>
    </div>
  );

  // SCREEN 1 — Name + WhatsApp chat
  if (screen === 1) return wrap(
    <>
      {stepHeader()}
      <div style={body}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          {botAvatar(40)}
          <div>
            <div style={{ color: color.ink, fontSize: font.md, fontWeight: 700 }}>Fursday</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: color.success, fontSize: font.xs, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: radius.pill, background: color.success }} />{tr('sitterOnboarding_onlineNow')}
            </div>
          </div>
        </div>
        {botBubble(tr('sitterOnboarding_welcomeAskName'))}
        <input value={name} onChange={e => setName(e.target.value)} placeholder={tr('sitterOnboarding_fullNamePlaceholder')} aria-label={tr('sitterOnboarding_fullNamePlaceholder')}
          style={{ ...ui.input, marginBottom: 8 }} />
        {name.length > 1 && chatStep === 0 && (
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <button onClick={() => setChatStep(1)} style={smallPrimary}>{tr('sitterOnboarding_send')}</button>
          </div>
        )}
        {chatStep >= 1 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
              <div style={{ background: color.navy, color: color.surface, borderRadius: '16px 16px 4px 16px', padding: '10px 14px', fontSize: font.md, maxWidth: '80%', wordBreak: 'break-word' }}>{name}</div>
            </div>
            {botBubble(tr('sitterOnboarding_greatAskWhatsapp', { name }))}
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ ...ui.input, width: 'auto', background: color.tile, color: color.muted, flexShrink: 0 }}>+91</div>
              <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder={tr('sitterOnboarding_whatsappNumberPlaceholder')} inputMode="numeric" aria-label={tr('sitterOnboarding_whatsappNumberPlaceholder')}
                style={{ ...ui.input, flex: 1, minWidth: 0, ...money }} />
            </div>
            {phone.length === 10 && !/^[6-9]\d{9}$/.test(phone) && (
              <div role="alert" style={{ fontSize: font.sm, color: color.danger, marginBottom: 8 }}>{tr('sitterOnboarding_invalidMobileNumber')}</div>
            )}
            {phone.length === 10 && /^[6-9]\d{9}$/.test(phone) && (
              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <button onClick={async () => { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('users').upsert({ id: user.id, name, phone: '+91' + phone }); await goNext(1); }} style={smallPrimary}>{tr('common_next')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  // SCREEN 2 — Services
  if (screen === 2) return wrap(
    <>
      {stepHeader()}
      <div style={body}>
        <h1 style={title}>{tr('sitterOnboarding_whatWillYouOffer')}</h1>
        <p style={subtitle}>{tr('sitterOnboarding_selectAllThatApply')}</p>
        <div style={{ ...card, background: color.navySoft, border: `1px solid ${color.navySoft}` }}>
          <div style={{ fontSize: font.sm, color: color.text, marginBottom: 2 }}>{tr('sitterOnboarding_estimatedMonthlyEarnings')}</div>
          <div style={{ ...money, fontSize: 28, fontWeight: 700, color: services.length > 0 ? color.navy : color.faint, letterSpacing: -0.3 }}>
            Rs.{estimated.toLocaleString('en-IN')}
          </div>
          {services.length === 0 && <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr('sitterOnboarding_selectServicesToSeeEarnings')}</div>}
        </div>
        {SERVICES.map(s => {
          const sel = services.includes(s.id);
          return (
            <button type="button" key={s.id} onClick={() => toggleService(s.id)} aria-pressed={sel} aria-label={tr('sitterOnboarding_toggleServiceLabel', { service: tr(s.nameKey) })}
              style={{ width: '100%', fontFamily: 'inherit', textAlign: 'left', color: 'inherit', background: color.surface, borderRadius: radius.lg, padding: 14, marginBottom: 10, border: `1.5px solid ${sel ? color.navy : color.line}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...ui.iconTile, width: 44, height: 44, background: sel ? color.navySoft : color.tile }}><Icon name={s.icon} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr(s.nameKey)}</div>
                <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr(s.subKey)} · {tr('sitterOnboarding_avgPrice', { amount: s.avg })}</div>
                {sel && <div style={{ ...money, fontSize: font.sm, fontWeight: 700, color: color.success, marginTop: 4 }}>+Rs.{monthlyFor(s).toLocaleString('en-IN')}{tr('sitterOnboarding_perMonthShort')}</div>}
              </div>
              <span style={{ width: 28, height: 28, borderRadius: radius.sm, border: sel ? 'none' : `1.5px solid ${color.line}`, background: sel ? color.navy : color.surface, color: sel ? color.surface : color.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={sel ? 'check' : 'plus'} size={16} strokeWidth={2.2} />
              </span>
            </button>
          );
        })}
      </div>
      {bottomBar(services.length > 0 ? tr('sitterOnboarding_setMyPrices') : tr('sitterOnboarding_selectAtLeastOneService'), async () => { if(services.length > 0){ const to = nextOf(2); const id = await saveDraft(to); await saveDraftServices(id); setPricingIdx(0); setScreen(to); } }, services.length === 0)}
    </>
  );

  // SCREEN 3 — Pricing
  if (screen === 3) return wrap(
    <>
      {stepHeader()}
      <div style={body}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: font.sm, color: color.muted }}>{tr('sitterOnboarding_pricingOf', { idx: pricingIdx + 1, total: activeServices.length })}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {activeServices.map((_, i) => (
              <div key={i} style={{ width: i === pricingIdx ? 20 : 8, height: 6, borderRadius: radius.pill, background: i <= pricingIdx ? color.navy : color.line }} />
            ))}
          </div>
        </div>
        {pricingService && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={ui.iconTile}><Icon name={pricingService.icon} /></span>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ ...title, margin: 0 }}>{tr(pricingService.nameKey)}</h1>
                <div style={{ fontSize: font.md, color: color.muted }}>{tr(pricingService.subKey)}</div>
              </div>
            </div>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: font.sm, color: color.muted }}>{tr('sitterOnboarding_yourPrice')}</div>
                  <div style={{ ...money, fontSize: 32, fontWeight: 700, color: color.navy, letterSpacing: -0.5 }}>Rs.{prices[pricingService.id]}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: font.xs, color: color.muted }}>{tr('sitterOnboarding_marketAvg')}</div>
                  <div style={{ ...money, fontSize: font.xl, fontWeight: 700, color: color.ink }}>Rs.{pricingService.avg}</div>
                </div>
              </div>
              <input type="range" min={pricingService.min} max={pricingService.max} step={50} value={prices[pricingService.id]}
                aria-label={tr('sitterOnboarding_yourPrice')}
                onChange={e => setPrices(prev => ({ ...prev, [pricingService.id]: parseInt(e.target.value) }))}
                style={{ width: '100%', marginBottom: 14, accentColor: color.navy }} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {[{l:tr('sitterOnboarding_low'),v:pricingService.min},{l:tr('sitterOnboarding_avgLabel'),v:pricingService.avg},{l:tr('sitterOnboarding_high'),v:pricingService.max}].map(btn => (
                  <button key={btn.v} onClick={() => setPrices(prev => ({ ...prev, [pricingService.id]: btn.v }))} aria-pressed={prices[pricingService.id] === btn.v}
                    style={{ ...ui.chip(prices[pricingService.id] === btn.v), flex: 1, minHeight: 40, padding: '0 6px' }}>
                    {btn.l}
                  </button>
                ))}
              </div>
              <div style={{ background: color.navySoft, borderRadius: radius.md, padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: font.sm, color: color.text }}>{tr('sitterOnboarding_monthlyEstimate')}</div>
                <div style={{ ...money, fontSize: font.md, fontWeight: 700, color: color.navy }}>Rs.{monthlyFor(pricingService).toLocaleString('en-IN')}{tr('sitterOnboarding_perMonthShort')}</div>
              </div>
            </div>
          </div>
        )}
      </div>
      {bottomBar(pricingIdx < activeServices.length - 1 ? tr('sitterOnboarding_nextService') : tr('sitterOnboarding_doneWithPricing'), async () => { if(pricingIdx < activeServices.length - 1) setPricingIdx(i => i + 1); else { await saveDraftServices(draftSitterId); await goNext(3); } })}
    </>
  );

  if (screen === HOME) return wrap(
    <>
      {stepHeader()}
      <div style={body}>
        <h1 style={title}>{tr('onbHome_title')}</h1>
        <p style={subtitle}>{tr('onbHome_subtitle')}</p>
        <BoardingHomeEditor details={homeDetails} photos={homePhotos} onChange={setHomeDetails} onPhotosChange={setHomePhotos} />
      </div>
      {bottomBar(tr('sitterOnboarding_continue'), async () => { const to = nextOf(HOME); const id = await saveDraft(to); await saveDraftServices(id); setPricingIdx(0); setScreen(to); })}
    </>
  );

  // SCREEN 4 — About you
  if (screen === 4) return wrap(
    <>
      {stepHeader()}
      <div style={body}>
        <h1 style={title}>{tr('sitterOnboarding_aboutYou')}</h1>
        <p style={subtitle}>{tr('sitterOnboarding_helpPetParentsTrust')}</p>

        <div style={card}>
          <div style={cardTitle}>{tr('sitterOnboarding_profilePhoto')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button type="button" onClick={() => choosePhoto(photoInputRef, handlePhotoUpload)} aria-label={tr('sitterOnboarding_profilePhoto')}
              style={{ width: 72, height: 72, padding: 0, fontFamily: 'inherit', borderRadius: radius.lg, background: color.tile, border: photoUrl ? 'none' : `1.5px dashed ${color.faint}`, color: color.navy, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, overflow: 'hidden' }}>
              {uploadingPhoto ? <span style={{ fontSize: font.xs }}>...</span>
                : photoUrl ? <img src={photoUrl} alt={tr('sitterOnboarding_profilePhotoAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <><Icon name="camera" size={22} /><span style={{ fontSize: font.xs, fontWeight: 600, marginTop: 2 }}>{tr('sitterOnboarding_addPhoto')}</span></>}
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
            <div style={{ fontSize: font.sm, color: color.muted, lineHeight: 1.6 }}>{tr('sitterOnboarding_photoHint')}</div>
          </div>
        </div>

        <div style={card}>
          <label htmlFor="onb-bio" style={{ ...cardTitle, display: 'block', marginBottom: 8 }}>{tr('sitterOnboarding_bio')}</label>
          <textarea id="onb-bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={200}
            placeholder={tr('sitterOnboarding_bioPlaceholder')}
            style={{ ...ui.input, fontSize: font.md, resize: 'none', minHeight: 96, lineHeight: 1.6 }} />
          <div style={{ ...money, fontSize: font.xs, color: color.faint, textAlign: 'right', marginTop: 4 }}>{bio.length}/200</div>
        </div>

        <div style={card}>
          <div style={cardTitle}>{tr('sitterOnboarding_experienceWithPets')}</div>
          <div style={chipRow}>
            {EXPERIENCE_OPTIONS.map(opt => (
              <button key={opt} onClick={() => setExperience(opt)} aria-pressed={experience === opt} style={ui.chip(experience === opt)}>
                {tr(EXPERIENCE_KEYS[opt])}
              </button>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>{tr('sitterOnboarding_languagesSpoken')}</div>
          <div style={chipRow}>
            {LANGUAGES.map(lang => (
              <button key={lang} onClick={() => toggleLang(lang)} aria-pressed={languages.includes(lang)} style={ui.chip(languages.includes(lang))}>
                {tr(LANGUAGE_KEYS[lang])}
              </button>
            ))}
          </div>
        </div>
      </div>
      {bottomBar(tr('sitterOnboarding_continue'), () => goNext(4))}
    </>
  );

  // SCREEN 5 — Availability
  if (screen === 5) return wrap(
    <>
      {stepHeader()}
      <div style={body}>
        <h1 style={title}>{tr('sitterOnboarding_yourAvailability')}</h1>
        <p style={subtitle}>{tr('sitterOnboarding_setScheduleChangeAnytime')}</p>

        <div style={card}>
          <div style={{ ...cardTitle, marginBottom: 4 }}>{tr('area_title')}</div>
          <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 12 }}>{tr('area_subtitle')}</div>
          <ServiceAreaPicker city={city} value={area} onChange={patch => setArea(prev => ({ ...prev, ...patch }))} />
        </div>

        <div style={card}>
          <div style={cardTitle}>{tr('sitterOnboarding_availableDays')}</div>
          <div style={chipRow}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
              const sel = availableDays.includes(day);
              return (
                <button key={day} onClick={() => setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} aria-pressed={sel} style={ui.chip(sel)}>
                  {tr(DAY_KEYS[day])}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {[
              { label: tr('sitterOnboarding_weekdays'), days: ['Mon','Tue','Wed','Thu','Fri'] },
              { label: tr('sitterOnboarding_weekends'), days: ['Sat','Sun'] },
              { label: tr('sitterOnboarding_allDays'), days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
            ].map(p => (
              <button key={p.label} onClick={() => setAvailableDays(p.days)}
                style={{ ...ui.secondaryButton, flex: 1, minHeight: 40, padding: '0 6px', fontSize: font.sm, color: color.text }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {!boardingOnly && <div style={card}>
          <div style={{ ...cardTitle, marginBottom: 2 }}>{tr('sitterOnboarding_availableTimeSlots')}</div>
          {[
            { label: tr('sitterOnboarding_slotMorning'), sub: tr('sitterEdit_morningHours'), key: 'morning', val: morningSlot, set: setMorningSlot },
            { label: tr('sitterOnboarding_slotAfternoon'), sub: tr('sitterEdit_afternoonHours'), key: 'afternoon', val: afternoonSlot, set: setAfternoonSlot },
            { label: tr('sitterOnboarding_slotEvening'), sub: tr('sitterEdit_eveningHours'), key: 'evening', val: eveningSlot, set: setEveningSlot },
          ].map((slot, i) => (
            <button type="button" key={slot.key} onClick={() => slot.set(!slot.val)} role="switch" aria-checked={slot.val}
              style={{ width: '100%', fontFamily: 'inherit', textAlign: 'left', color: 'inherit', background: 'none', border: 'none', borderTop: i ? `1px solid ${color.line}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{slot.label}</div>
                <div style={{ fontSize: font.sm, color: color.muted }}>{slot.sub}</div>
              </div>
              {switchVisual(slot.val)}
            </button>
          ))}
        </div>}

        {!boardingOnly && <div style={card}>
          <div style={cardTitle}>{tr('sitterOnboarding_maxDogsAtOneTime')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['1','2','3','4+'].map(n => (
              <button key={n} onClick={() => setMaxDogs(n)} aria-pressed={maxDogs === n}
                style={{ ...ui.chip(maxDogs === n), flex: 1, minHeight: 44, borderRadius: radius.md, fontSize: font.lg }}>
                {n}
              </button>
            ))}
          </div>
        </div>}

        <div style={card}>
          <div style={cardTitle}>{tr('sitterOnboarding_advanceNoticeNeeded')}</div>
          <div style={chipRow}>
            {['Same day','12hrs','24hrs','48hrs','1 week'].map(n => (
              <button key={n} onClick={() => setAdvanceNotice(n)} aria-pressed={advanceNotice === n} style={ui.chip(advanceNotice === n)}>
                {tr(ADVANCE_NOTICE_KEYS[n])}
              </button>
            ))}
          </div>
        </div>
      </div>
      {bottomBar(tr('sitterOnboarding_continue'), () => goNext(5))}
    </>
  );

  // SCREEN 6 — ID Verification
  if (screen === 6) return wrap(
    <>
      {stepHeader()}
      <div style={body}>
        <h1 style={title}>{tr('sitterOnboarding_idVerification')}</h1>
        <p style={subtitle}>{tr('sitterOnboarding_requiredBeforeFirstBooking')}</p>

        <div style={{ background: color.infoSoft, borderRadius: radius.lg, padding: '12px 14px', marginBottom: 12, display: 'flex', gap: 10 }}>
          <Icon name="shield" size={20} color={color.info} style={{ marginTop: 1 }} />
          <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.6 }}>
            <strong style={{ color: color.info }}>{tr('sitterOnboarding_whyWeVerifyTitle')}</strong> {tr('sitterOnboarding_whyWeVerifyBody')}
          </div>
        </div>

        <div style={card}>
          <label htmlFor="onb-aadhaar" style={{ ...cardTitle, display: 'block', marginBottom: 8 }}>{tr('sitterOnboarding_aadhaarNumber')}</label>
          <input id="onb-aadhaar" value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/\D/g,'').slice(0,12))}
            placeholder="XXXX XXXX XXXX" inputMode="numeric"
            style={{ ...ui.input, fontSize: font.lg, letterSpacing: 3, ...money }} />
          <div style={hint}>{tr('sitterOnboarding_aadhaarHint')}</div>
        </div>

        <div style={card}>
          <label htmlFor="onb-upi" style={{ ...cardTitle, display: 'block', marginBottom: 8 }}>{tr('sitterOnboarding_upiIdForPayouts')}</label>
          <input id="onb-upi" value={upiId} onChange={e => setUpiId(e.target.value)}
            placeholder={tr('sitterOnboarding_upiPlaceholder')}
            style={ui.input} />
          <div style={hint}>{tr('sitterOnboarding_upiHint')}</div>
        </div>

        <div style={card}>
          <div style={{ ...cardTitle, marginBottom: 2 }}>{tr('sitterOnboarding_whatHappensNext')}</div>
          {VERIFY_STEP_KEYS.map((key, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
              <Icon name="check" size={17} color={color.success} style={{ marginTop: 1 }} />
              <span style={{ fontSize: font.md, color: color.text, lineHeight: 1.5 }}>{tr(key)}</span>
            </div>
          ))}
        </div>
      </div>
      {bottomBar(tr('sitterOnboarding_continue'), async () => { const id = await saveDraft(nextOf(6)); if (id && (aadhaar || upiId)) { await supabase.from('sitter_pii').upsert({ sitter_id: id, aadhaar_number: aadhaar || null, upi_id: upiId || null }, { onConflict: 'sitter_id' }); } setScreen(nextOf(6)); })}
    </>
  );

  // SCREEN 7 — Sitter responsibilities
  if (screen === 7) return wrap(
    <>
      {stepHeader()}
      <div style={body}>
        <h1 style={title}>{tr('sitterOnboarding_yourResponsibilities')}</h1>
        <p style={subtitle}>{tr('sitterOnboarding_whatFursdayExpects')}</p>

        <div style={{ background: color.navySoft, borderRadius: radius.lg, padding: '12px 14px', marginBottom: 12, display: 'flex', gap: 10 }}>
          <Icon name="info" size={20} color={color.navy} style={{ marginTop: 1 }} />
          <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.6 }}>{tr('sitterOnboarding_responsibilitiesIntro')}</div>
        </div>

        <div style={{ background: color.surface, borderRadius: radius.lg, border: `1px solid ${color.line}`, overflow: 'hidden', marginBottom: 12 }}>
          {RESPONSIBILITIES.filter(item => (providerType === 'sitter' ? !item.boardingOnly : providerType === 'boarding' ? !item.walkOnly : true)).map((item, i) => (
            <div key={i} style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
              <span style={{ ...ui.iconTile, width: 40, height: 40 }}><Icon name={item.icon} size={19} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
                  <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{tr(item.labelKey)}</div>
                  {item.required && <span style={ui.badge('warning')}>{tr('common_required')}</span>}
                </div>
                <div style={{ fontSize: font.sm, color: color.muted, lineHeight: 1.5 }}>{tr(item.detailKey)}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: color.successSoft, borderRadius: radius.lg, padding: '12px 14px', display: 'flex', gap: 10 }}>
          <Icon name="check" size={18} color={color.success} style={{ marginTop: 1 }} />
          <div style={{ fontSize: font.sm, color: color.success, lineHeight: 1.6 }}>{tr('sitterOnboarding_responsibilitiesFooter')}</div>
        </div>
      </div>
      {bottomBar(tr('sitterOnboarding_acceptResponsibilities'), () => goNext(7))}
    </>
  );

  // SCREEN 8 — Review + agree
  if (screen === 8) return wrap(
    <>
      {stepHeader()}
      <div style={body}>
        <h1 style={title}>{tr('sitterOnboarding_reviewAndGoLive')}</h1>
        <p style={subtitle}>{tr('sitterOnboarding_almostThere')}</p>

        <div style={{ background: color.navy, color: color.surface, borderRadius: radius.lg, padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: font.sm, color: color.faint, marginBottom: 2 }}>{tr('sitterOnboarding_estimatedMonthlyEarnings')}</div>
          <div style={{ ...money, fontSize: 28, fontWeight: 700, letterSpacing: -0.3 }}>Rs.{estimated.toLocaleString('en-IN')}{tr('sitterOnboarding_perMonthShort')}</div>
          <div style={{ fontSize: font.sm, color: color.faint, margin: '2px 0 12px' }}>
            {tr('sitterOnboarding_acrossInCity', { count: activeServices.length, unit: tr(activeServices.length > 1 ? 'sitterOnboarding_servicesWord' : 'sitterOnboarding_serviceWord'), city })}
          </div>
          {activeServices.map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '9px 0', borderTop: `1px solid ${color.navyHover}` }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: font.md }}><Icon name={s.icon} size={17} color={color.faint} />{tr(s.nameKey)}</span>
              <span style={{ ...money, fontSize: font.md, fontWeight: 700 }}>Rs.{prices[s.id]}</span>
            </div>
          ))}
        </div>

        <div style={card}>
          <div style={{ ...cardTitle, marginBottom: 2 }}>{tr('sitterOnboarding_completeAfterApproval')}</div>
          {COMPLETE_STEP_KEYS.map((key, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
              <span style={{ width: 18, height: 18, borderRadius: radius.pill, border: `1.5px solid ${color.faint}`, flexShrink: 0 }} />
              <span style={{ fontSize: font.md, color: color.text }}>{tr(key)}</span>
            </div>
          ))}
        </div>

        <button type="button" onClick={() => setAgreed(!agreed)} role="checkbox" aria-checked={agreed}
          style={{ width: '100%', fontFamily: 'inherit', textAlign: 'left', color: 'inherit', background: color.surface, borderRadius: radius.lg, padding: 14, marginBottom: 12, cursor: 'pointer', display: 'flex', gap: 12, border: `1.5px solid ${agreed ? color.navy : color.line}` }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, border: agreed ? 'none' : `1.5px solid ${color.faint}`, background: agreed ? color.navy : color.surface, color: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
            {agreed && <Icon name="check" size={15} strokeWidth={2.4} />}
          </span>
          <span style={{ fontSize: font.sm, color: color.text, lineHeight: 1.7 }}>
            {tr('sitterOnboarding_agreeTermsPart1')} <span style={{ color: color.navy, fontWeight: 600 }}>{tr('sitterOnboarding_sitterTermsOfService')}</span>{tr('sitterOnboarding_agreeTermsPart2')}
          </span>
        </button>
      </div>
      {bottomBar(saving ? tr('common_saving') : tr('sitterOnboarding_goLiveOnFursday'), () => agreed && !saving && handleGoLive(), !agreed || saving)}
    </>
  );

  // SCREEN 9 — Celebration
  return wrap(
    <div style={{ minHeight: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', textAlign: 'center' }}>
      <div style={{ width: 72, height: 72, borderRadius: radius.pill, background: color.successSoft, color: color.success, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Icon name="check" size={36} strokeWidth={2.2} />
      </div>
      <div style={{ fontSize: font.xxl, fontWeight: 700, color: color.ink, marginBottom: 8, lineHeight: 1.3 }}>
        {tr('sitterOnboarding_youreLive')}<br /><span style={{ color: color.navy }}>{name}!</span>
      </div>
      <div style={{ fontSize: font.md, color: color.muted, marginBottom: 24, lineHeight: 1.6 }}>
        {tr('sitterOnboarding_profileUnderReview')}<br />{tr('sitterOnboarding_whatsappWithin24h')}
      </div>
      <div style={{ ...card, width: '100%', boxSizing: 'border-box' }}>
        <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 4 }}>{tr('sitterOnboarding_yourEarningPotential')}</div>
        <div style={{ ...money, fontSize: 32, fontWeight: 700, color: color.navy, letterSpacing: -0.5 }}>Rs.{estimated.toLocaleString('en-IN')}</div>
        <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2 }}>{tr('sitterOnboarding_estimatedMonthlyInCity', { city })}</div>
      </div>
      <div style={{ background: color.successSoft, borderRadius: radius.lg, padding: '14px 16px', width: '100%', boxSizing: 'border-box', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ ...ui.iconTile, width: 40, height: 40, background: color.surface, color: color.success }}><Icon name="message" size={20} /></span>
        <div style={{ textAlign: 'left', minWidth: 0 }}>
          <div style={{ color: color.ink, fontSize: font.md, fontWeight: 600 }}>{tr('sitterOnboarding_whatsappNotification')}</div>
          <div style={{ color: color.muted, fontSize: font.sm }}>{tr('sitterOnboarding_phoneWhenApproved', { phone })}</div>
        </div>
        <Icon name="check" size={20} color={color.success} style={{ marginLeft: 'auto' }} />
      </div>
      <button onClick={() => { if(window.confirm) { onDone('sitter'); } else { onDone(); } }}
        style={{ ...ui.primaryButton, width: '100%' }}>
        {tr('sitterOnboarding_goToSitterDashboard')}
      </button>
    </div>
  );
}
