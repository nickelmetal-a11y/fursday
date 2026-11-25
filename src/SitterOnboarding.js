import React, { useState, useRef } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';


const compressImage = (file, maxPx = 1200) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxPx) { h = h * maxPx / w; w = maxPx; }
      if (h > maxPx) { w = w * maxPx / h; h = maxPx; }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.8);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
});

const ORANGE = '#FF6B35';
const ORANGE_LIGHT = '#FFF0EB';
const DARK = '#0f0f1a';
const DARK2 = '#1a1a2e';

const CITY_DATA = {
  Gurgaon: { avg: 22000, top: 45000 },
  Pune: { avg: 19000, top: 40000 },
};

const SERVICES = [
  { id: 'walk30', name: 'Request a walker', sub: '30 min per walk', icon: '🦮', avg: 320, default: 299, min: 149, max: 599, bookings: 20, nameKey: 'sitterOnboarding_serviceWalkName', subKey: 'sitterOnboarding_serviceWalkSub' },
  { id: 'boarding', name: 'Home boarding', sub: 'Per night', icon: '🏠', avg: 899, default: 799, min: 499, max: 1999, bookings: 4, nameKey: 'sitterOnboarding_serviceBoardingName', subKey: 'sitterOnboarding_serviceBoardingSub' },
  { id: 'daycare', name: 'Doggy daycare', sub: 'Per day', icon: '☀️', avg: 699, default: 599, min: 399, max: 1299, bookings: 8, nameKey: 'sitterOnboarding_serviceDaycareName', subKey: 'sitterOnboarding_serviceDaycareSub' },
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
  { emoji: '🦺', labelKey: 'sitterOnboarding_respKitLabel', detailKey: 'sitterOnboarding_respKitDetail', required: true },
  { emoji: '⏰', labelKey: 'sitterOnboarding_respTimeLabel', detailKey: 'sitterOnboarding_respTimeDetail', required: true },
  { emoji: '📱', labelKey: 'sitterOnboarding_respOtpLabel', detailKey: 'sitterOnboarding_respOtpDetail', required: true },
  { emoji: '🧹', labelKey: 'sitterOnboarding_respPottyLabel', detailKey: 'sitterOnboarding_respPottyDetail', required: true },
  { emoji: '🐾', labelKey: 'sitterOnboarding_respWipeLabel', detailKey: 'sitterOnboarding_respWipeDetail', required: true },
  { emoji: '📋', labelKey: 'sitterOnboarding_respReportLabel', detailKey: 'sitterOnboarding_respReportDetail', required: true },
  { emoji: '🚫', labelKey: 'sitterOnboarding_respNoFoodLabel', detailKey: 'sitterOnboarding_respNoFoodDetail', required: false },
  { emoji: '🔒', labelKey: 'sitterOnboarding_respPrivacyLabel', detailKey: 'sitterOnboarding_respPrivacyDetail', required: true },
  { emoji: '💰', labelKey: 'sitterOnboarding_respNoDealsLabel', detailKey: 'sitterOnboarding_respNoDealsDetail', required: true },
  { emoji: '🆘', labelKey: 'sitterOnboarding_respEmergencyLabel', detailKey: 'sitterOnboarding_respEmergencyDetail', required: true },
];

const VERIFY_STEP_KEYS = ['sitterOnboarding_verifyStep1', 'sitterOnboarding_verifyStep2', 'sitterOnboarding_verifyStep3'];
const COMPLETE_STEP_KEYS = ['sitterOnboarding_completeStep1', 'sitterOnboarding_completeStep2', 'sitterOnboarding_completeStep3'];

const TOTAL_STEPS = 8;

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
  const [sitterLat, setSitterLat] = useState(null);
  const [sitterLng, setSitterLng] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [draftSitterId, setDraftSitterId] = useState(null);
  const [restoringDraft, setRestoringDraft] = useState(true);
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
          if (draft.upi_id) setUpiId(draft.upi_id);

          const { data: userRow } = await supabase.from('users').select('name').eq('id', user.id).single();
          if (userRow?.name && userRow.name.toLowerCase() !== user.email?.toLowerCase()) setName(userRow.name);
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: user.id });
          if (contact?.[0]?.phone) setPhone(contact[0].phone.replace(/^\+?91/, ''));

          const { data: svcRows } = await supabase.from('sitter_services').select('service_type, price_paise').eq('sitter_id', draft.id);
          if (svcRows?.length) {
            setServices(svcRows.map(r => r.service_type));
            setPrices(prev => { const next = { ...prev }; svcRows.forEach(r => { next[r.service_type] = Math.round(r.price_paise / 100); }); return next; });
          }

          const { data: pii } = await supabase.from('sitter_pii').select('aadhaar_number').eq('sitter_id', draft.id).single();
          if (pii?.aadhaar_number) setAadhaar(pii.aadhaar_number);

          setScreen(Math.max(draft.onboarding_step || 1, 1));
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
      const { data: draft, error } = await supabase.from('sitter_profiles').upsert({
        user_id: user.id, city_id: cityRow?.id, status: 'draft', onboarding_step: step,
        bio, experience_years: parseInt(experience) || 0, experience_text: experience || null,
        languages, availability_days: availableDays, morning_slot: morningSlot,
        afternoon_slot: afternoonSlot, evening_slot: eveningSlot, max_dogs: parseInt(maxDogs) || 1,
        advance_notice: advanceNotice, profile_photo_url: photoUrl, upi_id: upiId || null,
        ...extra,
      }, { onConflict: 'user_id' }).select().single();
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

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setSitterLat(pos.coords.latitude); setSitterLng(pos.coords.longitude); },
        () => {}
      );
    }
  }, []);

  const cityInfo = CITY_DATA[city];
  const activeServices = SERVICES.filter(s => services.includes(s.id));
  const estimated = activeServices.reduce((sum, s) => sum + prices[s.id] * s.bookings, 0);
  const pricingService = activeServices[pricingIdx];

  const toggleService = id => setServices(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const toggleLang = lang => setLanguages(prev =>
    prev.includes(lang) ? prev.filter(x => x !== lang) : [...prev, lang]
  );

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
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

      const { data: sitter, error: sitterError } = await supabase.from('sitter_profiles').upsert({
        user_id: currentUser.id, city_id: cityRow.id,
        bio, experience_years: parseInt(experience) || 0,
        experience_text: experience || null,
        languages, status: 'pending',
        availability_days: availableDays,
        morning_slot: morningSlot,
        afternoon_slot: afternoonSlot,
        evening_slot: eveningSlot,
        max_dogs: parseInt(maxDogs) || 1,
        advance_notice: advanceNotice,
        profile_photo_url: photoUrl,
      }, { onConflict: 'user_id' }).select().single();
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

  const wrap = (children, dark) => (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: dark ? DARK : '#F8F8F8', fontFamily: '-apple-system,sans-serif', paddingBottom: 100 }}>
      {children}
    </div>
  );

  const BackBtn = ({ to, dark }) => (
    <button onClick={() => setScreen(to)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: dark ? 'rgba(255,255,255,0.5)' : '#888', fontSize: 13, padding: '56px 24px 0', marginBottom: 24 }}>
      <ArrowLeft size={16} /> {tr('common_back')}
    </button>
  );

  const ProgressBar = ({ step, dark }) => (
    <div style={{ padding: '0 24px', marginBottom: 20 }}>
      <div style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.4)' : '#AAA', marginBottom: 6 }}>{tr('sitterOnboarding_stepOf', { step, total: TOTAL_STEPS })}</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i < step ? ORANGE : (dark ? 'rgba(255,255,255,0.1)' : '#E8E8E8') }} />
        ))}
      </div>
    </div>
  );

  const BottomBtn = ({ label, onClick, disabled, dark }) => (
    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, padding: '12px 24px calc(28px + env(safe-area-inset-bottom))', background: dark ? DARK : 'white', borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#F0F0F0'}` }}>
      <button onClick={onClick} disabled={disabled}
        style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: disabled ? '#E0E0E0' : ORANGE, color: disabled ? '#AAA' : 'white', fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {label}
      </button>
    </div>
  );

  if (restoringDraft) return wrap(
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{tr('common_loading')}</div>
    </div>
  , true);

  // SCREEN 0 — City + earnings
  if (screen === 0) return wrap(
    <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ paddingTop: 56, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🐾</div>
        <span style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>Fursday</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{tr('sitterOnboarding_yourCity')}</div>
        <div style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 16, fontWeight: 600, marginBottom: 28 }}>
          {city === 'Pune' ? '🌴' : '🏙️'} {city || 'Gurgaon'}
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, color: ORANGE, lineHeight: 1, marginBottom: 4 }}>Rs.{cityInfo.avg.toLocaleString('en-IN')}</div>
        <div style={{ fontSize: 16, color: 'white', fontWeight: 600, marginBottom: 6 }}>{tr('sitterOnboarding_averagePerMonth')}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>{tr('sitterOnboarding_topSittersEarn', { amount: cityInfo.top.toLocaleString('en-IN'), city })}</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          {[
            { v: tr('sitterOnboarding_statSetOwnSchedule'), s: tr('sitterOnboarding_statSetOwnScheduleSub') },
            { v: tr('sitterOnboarding_statNoLockIn'), s: tr('sitterOnboarding_statNoLockInSub') },
            { v: 'Rs.0', s: tr('sitterOnboarding_statFreeToJoinSub') },
          ].map((x,i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{x.v}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{x.s}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setScreen(1)}
          style={{ width: '100%', padding: '18px 0', borderRadius: 18, border: 'none', background: ORANGE, color: 'white', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
          {tr('sitterOnboarding_iWantToEarnThis')}
        </button>
        <button onClick={onDone}
          style={{ width: '100%', marginTop: 12, padding: '12px 0', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer' }}>
          {tr('sitterOnboarding_notNow')}
        </button>
      </div>
    </div>
  , true);

  // SCREEN 1 — Name + WhatsApp chat
  if (screen === 1) return wrap(
    <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <BackBtn to={0} dark={true} />
      <ProgressBar step={1} dark={true} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🐾</div>
        <div>
          <div style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>Fursday</div>
          <div style={{ color: '#2ECC71', fontSize: 11 }}>{tr('sitterOnboarding_onlineNow')}</div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🐾</div>
          <div style={{ background: DARK2, borderRadius: '18px 18px 18px 4px', padding: '12px 16px' }}>
            <div style={{ color: 'white', fontSize: 14, lineHeight: 1.5 }}>{tr('sitterOnboarding_welcomeAskName')}</div>
          </div>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={tr('sitterOnboarding_fullNamePlaceholder')}
          style={{ width: '100%', padding: '14px 16px', borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', fontSize: 15, color: 'white', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
        {name.length > 1 && chatStep === 0 && (
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <button onClick={() => setChatStep(1)} style={{ padding: '8px 20px', borderRadius: 20, border: 'none', background: ORANGE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{tr('sitterOnboarding_send')}</button>
          </div>
        )}
        {chatStep >= 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <div style={{ background: ORANGE, borderRadius: '18px 18px 4px 18px', padding: '10px 16px' }}>
                <div style={{ color: 'white', fontSize: 14 }}>{name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🐾</div>
              <div style={{ background: DARK2, borderRadius: '18px 18px 18px 4px', padding: '12px 16px' }}>
                <div style={{ color: 'white', fontSize: 14 }}>{tr('sitterOnboarding_greatAskWhatsapp', { name })}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ padding: '14px 12px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>+91</div>
              <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder={tr('sitterOnboarding_whatsappNumberPlaceholder')}
                style={{ flex: 1, padding: '14px 16px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', fontSize: 15, color: 'white', outline: 'none' }} />
            </div>
            {phone.length === 10 && !/^[6-9]\d{9}$/.test(phone) && (
              <div style={{ fontSize: 12, color: '#FF6B35', marginBottom: 8 }}>{tr('sitterOnboarding_invalidMobileNumber')}</div>
            )}
            {phone.length === 10 && /^[6-9]\d{9}$/.test(phone) && (
              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <button onClick={async () => { const { data: { user } } = await supabase.auth.getUser(); if (user) await supabase.from('users').upsert({ id: user.id, name, phone: '+91' + phone }); await saveDraft(2); setScreen(2); }} style={{ padding: '8px 20px', borderRadius: 20, border: 'none', background: ORANGE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{tr('common_next')}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  , true);

  // SCREEN 2 — Services
  if (screen === 2) return wrap(
    <div style={{ padding: '0 24px 100px', minHeight: '100vh' }}>
      <BackBtn to={1} dark={true} />
      <ProgressBar step={2} dark={true} />
      <div style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 4, paddingTop: 0 }}>{tr('sitterOnboarding_whatWillYouOffer')}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>{tr('sitterOnboarding_selectAllThatApply')}</div>
      <div style={{ background: DARK2, borderRadius: 20, padding: '16px 20px', marginBottom: 20, border: '1px solid rgba(255,107,53,0.3)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{tr('sitterOnboarding_estimatedMonthlyEarnings')}</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: services.length > 0 ? ORANGE : 'rgba(255,255,255,0.2)' }}>
          Rs.{estimated.toLocaleString('en-IN')}
        </div>
        {services.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{tr('sitterOnboarding_selectServicesToSeeEarnings')}</div>}
      </div>
      {SERVICES.map(s => {
        const sel = services.includes(s.id);
        return (
          <div key={s.id} onClick={() => toggleService(s.id)}
            style={{ background: sel ? 'rgba(255,107,53,0.12)' : DARK2, borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: sel ? '1.5px solid ' + ORANGE : '1.5px solid rgba(255,255,255,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{tr(s.nameKey)}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{tr(s.subKey)} · avg Rs.{s.avg}</div>
            </div>
            {sel
              ? <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ORANGE }}>+Rs.{(prices[s.id] * s.bookings).toLocaleString('en-IN')}/mo</div>
                  <CheckCircle size={16} color={ORANGE} style={{ marginTop: 2 }} />
                </div>
              : <div style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 20 }}>+</div>
            }
          </div>
        );
      })}
      <BottomBtn label={services.length > 0 ? tr('sitterOnboarding_setMyPrices') : tr('sitterOnboarding_selectAtLeastOneService')} onClick={async () => { if(services.length > 0){ const id = await saveDraft(3); await saveDraftServices(id); setPricingIdx(0); setScreen(3); } }} disabled={services.length === 0} dark={true} />
    </div>
  , true);

  // SCREEN 3 — Pricing
  if (screen === 3) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={2} dark={false} />
      <ProgressBar step={3} dark={false} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: '#888' }}>{tr('sitterOnboarding_pricingOf', { idx: pricingIdx + 1, total: activeServices.length })}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {activeServices.map((_, i) => (
            <div key={i} style={{ width: i === pricingIdx ? 20 : 8, height: 6, borderRadius: 3, background: i <= pricingIdx ? ORANGE : '#E0E0E0' }} />
          ))}
        </div>
      </div>
      {pricingService && (
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 2 }}>{pricingService.icon} {tr(pricingService.nameKey)}</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr(pricingService.subKey)}</div>
          <div style={{ background: 'white', borderRadius: 20, padding: 20, marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: '#888' }}>{tr('sitterOnboarding_yourPrice')}</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: ORANGE }}>Rs.{prices[pricingService.id]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#AAA' }}>{tr('sitterOnboarding_marketAvg')}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Rs.{pricingService.avg}</div>
              </div>
            </div>
            <input type="range" min={pricingService.min} max={pricingService.max} step={50} value={prices[pricingService.id]}
              onChange={e => setPrices(prev => ({ ...prev, [pricingService.id]: parseInt(e.target.value) }))}
              style={{ width: '100%', marginBottom: 14, accentColor: ORANGE }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[{l:tr('sitterOnboarding_low'),v:pricingService.min},{l:tr('sitterOnboarding_avgLabel'),v:pricingService.avg},{l:tr('sitterOnboarding_high'),v:pricingService.max}].map(btn => (
                <button key={btn.v} onClick={() => setPrices(prev => ({ ...prev, [pricingService.id]: btn.v }))}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: prices[pricingService.id] === btn.v ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: prices[pricingService.id] === btn.v ? ORANGE_LIGHT : 'white', color: prices[pricingService.id] === btn.v ? ORANGE : '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {btn.l}
                </button>
              ))}
            </div>
            <div style={{ background: ORANGE_LIGHT, borderRadius: 12, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: '#888' }}>{tr('sitterOnboarding_monthlyEstimate')}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: ORANGE }}>Rs.{(prices[pricingService.id] * pricingService.bookings).toLocaleString('en-IN')}/mo</div>
            </div>
          </div>
        </div>
      )}
      <BottomBtn label={pricingIdx < activeServices.length - 1 ? tr('sitterOnboarding_nextService') : tr('sitterOnboarding_doneWithPricing')} onClick={async () => { if(pricingIdx < activeServices.length - 1) setPricingIdx(i => i + 1); else { await saveDraftServices(draftSitterId); await saveDraft(4); setScreen(4); } }} dark={false} />
    </div>
  , false);

  // SCREEN 4 — About you
  if (screen === 4) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={3} dark={false} />
      <ProgressBar step={4} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterOnboarding_aboutYou')}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr('sitterOnboarding_helpPetParentsTrust')}</div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterOnboarding_profilePhoto')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div onClick={() => photoInputRef.current?.click()}
            style={{ width: 72, height: 72, borderRadius: 20, background: photoUrl ? 'transparent' : ORANGE_LIGHT, border: photoUrl ? 'none' : '2px dashed ' + ORANGE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, overflow: 'hidden' }}>
            {uploadingPhoto ? <span style={{ fontSize: 11, color: ORANGE }}>...</span>
              : photoUrl ? <img src={photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <><span style={{ fontSize: 24 }}>📷</span><span style={{ fontSize: 10, color: ORANGE, marginTop: 2 }}>{tr('sitterOnboarding_addPhoto')}</span></>}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>{tr('sitterOnboarding_photoHint')}</div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>{tr('sitterOnboarding_bio')}</div>
        <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={200}
          placeholder={tr('sitterOnboarding_bioPlaceholder')}
          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 13, color: '#1a1a1a', outline: 'none', resize: 'none', minHeight: 90, lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#CCC', textAlign: 'right', marginTop: 4 }}>{bio.length}/200</div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{tr('sitterOnboarding_experienceWithPets')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXPERIENCE_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setExperience(opt)}
              style={{ padding: '8px 14px', borderRadius: 20, border: experience === opt ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: experience === opt ? ORANGE_LIGHT : 'white', color: experience === opt ? ORANGE : '#555', fontSize: 13, fontWeight: experience === opt ? 600 : 400, cursor: 'pointer' }}>
              {tr(EXPERIENCE_KEYS[opt])}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{tr('sitterOnboarding_languagesSpoken')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {LANGUAGES.map(lang => (
            <button key={lang} onClick={() => toggleLang(lang)}
              style={{ padding: '8px 14px', borderRadius: 20, border: languages.includes(lang) ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: languages.includes(lang) ? ORANGE_LIGHT : 'white', color: languages.includes(lang) ? ORANGE : '#555', fontSize: 13, fontWeight: languages.includes(lang) ? 600 : 400, cursor: 'pointer' }}>
              {tr(LANGUAGE_KEYS[lang])}
            </button>
          ))}
        </div>
      </div>

      <BottomBtn label={tr('sitterOnboarding_continue')} onClick={async () => { await saveDraft(5); setScreen(5); }} dark={false} />
    </div>
  , false);

  // SCREEN 5 — Availability
  if (screen === 5) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={4} dark={false} />
      <ProgressBar step={5} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterOnboarding_yourAvailability')}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr('sitterOnboarding_setScheduleChangeAnytime')}</div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterOnboarding_availableDays')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
            const sel = availableDays.includes(day);
            return (
              <button key={day} onClick={() => setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                style={{ padding: '8px 14px', borderRadius: 20, border: sel ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: sel ? ORANGE_LIGHT : 'white', color: sel ? ORANGE : '#555', fontSize: 13, fontWeight: sel ? 600 : 400, cursor: 'pointer' }}>
                {tr(DAY_KEYS[day])}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => setAvailableDays(['Mon','Tue','Wed','Thu','Fri'])}
            style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid #E0E0E0', background: 'white', color: '#888', fontSize: 12, cursor: 'pointer' }}>
            {tr('sitterOnboarding_weekdays')}
          </button>
          <button onClick={() => setAvailableDays(['Sat','Sun'])}
            style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid #E0E0E0', background: 'white', color: '#888', fontSize: 12, cursor: 'pointer' }}>
            {tr('sitterOnboarding_weekends')}
          </button>
          <button onClick={() => setAvailableDays(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])}
            style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid #E0E0E0', background: 'white', color: '#888', fontSize: 12, cursor: 'pointer' }}>
            {tr('sitterOnboarding_allDays')}
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterOnboarding_availableTimeSlots')}</div>
        {[
          { label: tr('sitterOnboarding_slotMorning'), sub: '6am - 10am', key: 'morning', val: morningSlot, set: setMorningSlot },
          { label: tr('sitterOnboarding_slotAfternoon'), sub: '12pm - 4pm', key: 'afternoon', val: afternoonSlot, set: setAfternoonSlot },
          { label: tr('sitterOnboarding_slotEvening'), sub: '5pm - 8pm', key: 'evening', val: eveningSlot, set: setEveningSlot },
        ].map(slot => (
          <div key={slot.key} onClick={() => slot.set(!slot.val)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: slot.key !== 'evening' ? '1px solid #F5F5F5' : 'none', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{slot.label}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{slot.sub}</div>
            </div>
            <div style={{ width: 44, height: 24, borderRadius: 12, background: slot.val ? ORANGE : '#E0E0E0', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
              <div style={{ position: 'absolute', top: 2, left: slot.val ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{tr('sitterOnboarding_maxDogsAtOneTime')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['1','2','3','4+'].map(n => (
            <button key={n} onClick={() => setMaxDogs(n)}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: maxDogs === n ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: maxDogs === n ? ORANGE_LIGHT : 'white', color: maxDogs === n ? ORANGE : '#555', fontSize: 16, fontWeight: maxDogs === n ? 700 : 400, cursor: 'pointer' }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{tr('sitterOnboarding_advanceNoticeNeeded')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Same day','12hrs','24hrs','48hrs','1 week'].map(n => (
            <button key={n} onClick={() => setAdvanceNotice(n)}
              style={{ padding: '8px 14px', borderRadius: 20, border: advanceNotice === n ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: advanceNotice === n ? ORANGE_LIGHT : 'white', color: advanceNotice === n ? ORANGE : '#555', fontSize: 12, fontWeight: advanceNotice === n ? 600 : 400, cursor: 'pointer' }}>
              {tr(ADVANCE_NOTICE_KEYS[n])}
            </button>
          ))}
        </div>
      </div>

      <BottomBtn label={tr('sitterOnboarding_continue')} onClick={async () => { await saveDraft(6); setScreen(6); }} dark={false} />
    </div>
  , false);

  // SCREEN 6 — ID Verification
  if (screen === 6) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={5} dark={false} />
      <ProgressBar step={6} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterOnboarding_idVerification')}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr('sitterOnboarding_requiredBeforeFirstBooking')}</div>

      <div style={{ background: '#E3F2FD', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🛡️</span>
        <div style={{ fontSize: 12, color: '#1565C0', lineHeight: 1.6 }}>
          <strong>{tr('sitterOnboarding_whyWeVerifyTitle')}</strong> {tr('sitterOnboarding_whyWeVerifyBody')}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>{tr('sitterOnboarding_aadhaarNumber')}</div>
        <input value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/\D/g,'').slice(0,12))}
          placeholder="XXXX XXXX XXXX"
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 16, color: '#1a1a1a', outline: 'none', letterSpacing: 4, boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#AAA', marginTop: 6 }}>{tr('sitterOnboarding_aadhaarHint')}</div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>{tr('sitterOnboarding_upiIdForPayouts')}</div>
        <input value={upiId} onChange={e => setUpiId(e.target.value)}
          placeholder={tr('sitterOnboarding_upiPlaceholder')}
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 15, color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#AAA', marginTop: 6 }}>{tr('sitterOnboarding_upiHint')}</div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>{tr('sitterOnboarding_whatHappensNext')}</div>
        {VERIFY_STEP_KEYS.map((key, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid #F5F5F5' : 'none' }}>
            <CheckCircle size={16} color={ORANGE} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: '#555' }}>{tr(key)}</span>
          </div>
        ))}
      </div>

      <BottomBtn label={tr('sitterOnboarding_continue')} onClick={async () => { const id = await saveDraft(7); if (id && (aadhaar || upiId)) { await supabase.from('sitter_pii').upsert({ sitter_id: id, aadhaar_number: aadhaar || null, upi_id: upiId || null }, { onConflict: 'sitter_id' }); } setScreen(7); }} dark={false} />
    </div>
  , false);

  // SCREEN 7 — Sitter responsibilities
  if (screen === 7) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={6} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterOnboarding_yourResponsibilities')}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr('sitterOnboarding_whatFursdayExpects')}</div>

      <div style={{ background:'#FFF0EB', borderRadius:14, padding:'12px 16px', marginBottom:14, display:'flex', gap:10 }}>
        <span style={{ fontSize:18 }}>ℹ️</span>
        <div style={{ fontSize:12, color:'#FF6B35', lineHeight:1.6 }}>{tr('sitterOnboarding_responsibilitiesIntro')}</div>
      </div>

      {RESPONSIBILITIES.map((item, i) => (
        <div key={i} style={{ background:'white', borderRadius:14, padding:'12px 14px', marginBottom:8, display:'flex', gap:12, alignItems:'flex-start', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ width:38, height:38, borderRadius:10, background:item.required?'#FFF0EB':'#F8F8F8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{item.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{tr(item.labelKey)}</div>
              {item.required && <span style={{ fontSize:10, background:'#FCEBEB', color:'#A32D2D', borderRadius:6, padding:'1px 6px', fontWeight:600 }}>{tr('common_required')}</span>}
            </div>
            <div style={{ fontSize:12, color:'#888', lineHeight:1.5 }}>{tr(item.detailKey)}</div>
          </div>
        </div>
      ))}

      <div style={{ background:'#E8F5E9', borderRadius:14, padding:'12px 16px', marginBottom:16, display:'flex', gap:10 }}>
        <span style={{ fontSize:16 }}>✓</span>
        <div style={{ fontSize:12, color:'#2E7D32', lineHeight:1.6 }}>{tr('sitterOnboarding_responsibilitiesFooter')}</div>
      </div>

      <BottomBtn label={tr('sitterOnboarding_acceptResponsibilities')} onClick={async () => { await saveDraft(8); setScreen(8); }} dark={false} />
    </div>
  , false);

  // SCREEN 8 — Review + agree
  if (screen === 8) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={7} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>{tr('sitterOnboarding_reviewAndGoLive')}</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{tr('sitterOnboarding_almostThere')}</div>

      <div style={{ background: DARK, borderRadius: 24, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{tr('sitterOnboarding_estimatedMonthlyEarnings')}</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: ORANGE, marginBottom: 4 }}>Rs.{estimated.toLocaleString('en-IN')}/mo</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>
          {tr('sitterOnboarding_acrossInCity', { count: activeServices.length, unit: tr(activeServices.length > 1 ? 'sitterOnboarding_servicesWord' : 'sitterOnboarding_serviceWord'), city })}
        </div>
        {activeServices.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < activeServices.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{s.icon} {tr(s.nameKey)}</span>
            <span style={{ fontSize: 13, color: ORANGE, fontWeight: 600 }}>Rs.{prices[s.id]}</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{tr('sitterOnboarding_completeAfterApproval')}</div>
        {COMPLETE_STEP_KEYS.map((key, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid #F5F5F5' : 'none' }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: '#CCC' }}>○</span>
            </div>
            <span style={{ fontSize: 13, color: '#555' }}>{tr(key)}</span>
          </div>
        ))}
      </div>

      <div onClick={() => setAgreed(!agreed)}
        style={{ background: agreed ? '#E8F5E9' : 'white', borderRadius: 16, padding: '14px 16px', marginBottom: 14, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', gap: 10, border: agreed ? '1.5px solid #A5D6A7' : '1.5px solid transparent' }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, border: agreed ? 'none' : '1.5px solid #DDD', background: agreed ? ORANGE : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          {agreed && <CheckCircle size={14} color="white" />}
        </div>
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
          {tr('sitterOnboarding_agreeTermsPart1')} <span style={{ color: ORANGE, fontWeight: 600 }}>{tr('sitterOnboarding_sitterTermsOfService')}</span>{tr('sitterOnboarding_agreeTermsPart2')}
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, padding: '12px 20px calc(28px + env(safe-area-inset-bottom))', background: '#F8F8F8', borderTop: '1px solid #E0E0E0' }}>
        <button onClick={() => agreed && !saving && handleGoLive()} disabled={!agreed || saving}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: agreed && !saving ? ORANGE : '#E0E0E0', color: agreed && !saving ? 'white' : '#AAA', fontSize: 15, fontWeight: 700, cursor: agreed && !saving ? 'pointer' : 'not-allowed' }}>
          {saving ? tr('common_saving') : tr('sitterOnboarding_goLiveOnFursday')}
        </button>
      </div>
    </div>
  , false);

  // SCREEN 9 — Celebration
  return wrap(
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 8, lineHeight: 1.2 }}>
        {tr('sitterOnboarding_youreLive')}<br /><span style={{ color: ORANGE }}>{name}!</span>
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.6 }}>
        {tr('sitterOnboarding_profileUnderReview')}<br />{tr('sitterOnboarding_whatsappWithin24h')}
      </div>
      <div style={{ background: DARK2, borderRadius: 24, padding: 20, width: '100%', marginBottom: 16, border: '1px solid rgba(255,107,53,0.2)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{tr('sitterOnboarding_yourEarningPotential')}</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: ORANGE }}>Rs.{estimated.toLocaleString('en-IN')}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{tr('sitterOnboarding_estimatedMonthlyInCity', { city })}</div>
      </div>
      <div style={{ background: '#128C7E', borderRadius: 18, padding: '14px 20px', width: '100%', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>💬</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{tr('sitterOnboarding_whatsappNotification')}</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{tr('sitterOnboarding_phoneWhenApproved', { phone })}</div>
        </div>
        <CheckCircle size={18} color="white" style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </div>
      <button onClick={() => { if(window.confirm) { onDone('sitter'); } else { onDone(); } }}
        style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: ORANGE, color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
        {tr('sitterOnboarding_goToSitterDashboard')}
      </button>
    </div>
  , true);
}