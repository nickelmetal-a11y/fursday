import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { writeWithFallback } from './schemaFallback';
import { choosePhoto } from './photoPicker';
import { useLanguage } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';
import ServiceAreaPicker from './ServiceAreaPicker';
import AvailabilityCalendar from './AvailabilityCalendar';
import BoardingHomeEditor, { PROVIDER_TYPES, HOME_OPTIONS, homeOptionKey, homeStrength, isBoardingHost } from './BoardingHomeEditor';
import { compressImage } from './compressImage';
import ShareProfileCard from './ShareProfileCard';
import HostSettings, { RULE_FIELDS, DEFAULT_POLICY, CANCELLATION_POLICIES, upcomingHolidays, formatHoliday } from './HostSettings';

const SERVICES = [
  { id: 'walk30', nameKey: 'sitterEdit_svcWalkName', subKey: 'sitterEdit_svcWalkSub', icon: 'walk', min: 149, max: 599, step: 50 },
  { id: 'boarding', nameKey: 'sitterEdit_svcBoardingName', subKey: 'sitterEdit_svcBoardingSub', icon: 'boarding', min: 499, max: 1999, step: 100 },
  { id: 'daycare', nameKey: 'sitterEdit_svcDaycareName', subKey: 'sitterEdit_svcDaycareSub', icon: 'sun', min: 399, max: 1299, step: 50 },
];

const BOARDING = SERVICES.find(s => s.id === 'boarding');

const LANGUAGES = ['Hindi', 'English', 'Marathi', 'Punjabi', 'Tamil', 'Telugu', 'Kannada', 'Bengali'];
const LANGUAGE_KEYS = {
  Hindi: 'sitterEdit_langHindi', English: 'sitterEdit_langEnglish', Marathi: 'sitterEdit_langMarathi', Punjabi: 'sitterEdit_langPunjabi',
  Tamil: 'sitterEdit_langTamil', Telugu: 'sitterEdit_langTelugu', Kannada: 'sitterEdit_langKannada', Bengali: 'sitterEdit_langBengali',
};
const EXPERIENCE_OPTIONS = ['Less than 1 year', '1-2 years', '3-5 years', '5+ years'];
const EXPERIENCE_KEYS = {
  'Less than 1 year': 'sitterEdit_expLt1', '1-2 years': 'sitterEdit_exp1to2', '3-5 years': 'sitterEdit_exp3to5', '5+ years': 'sitterEdit_exp5plus',
};
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_KEYS = {
  Mon: 'sitterEdit_dayMon', Tue: 'sitterEdit_dayTue', Wed: 'sitterEdit_dayWed', Thu: 'sitterEdit_dayThu',
  Fri: 'sitterEdit_dayFri', Sat: 'sitterEdit_daySat', Sun: 'sitterEdit_daySun',
};
const ADVANCE_NOTICE_OPTIONS = ['Same day', '12hrs', '24hrs', '48hrs', '1 week'];
const ADVANCE_NOTICE_KEYS = {
  'Same day': 'sitterEdit_noticeSameDay', '12hrs': 'sitterEdit_notice12h', '24hrs': 'sitterEdit_notice24h',
  '48hrs': 'sitterEdit_notice48h', '1 week': 'sitterEdit_notice1week',
};

// Stored in English (sitter_profiles.highlights), shown translated.
export const HIGHLIGHTS = ['Large breeds', 'Puppies', 'Senior dogs', 'First-aid trained', 'Has own transport', 'Medication', 'Multiple dogs', 'Night stays'];
export const HIGHLIGHT_KEYS = {
  'Large breeds': 'highlight_largeBreeds', Puppies: 'highlight_puppies', 'Senior dogs': 'highlight_seniorDogs',
  'First-aid trained': 'highlight_firstAid', 'Has own transport': 'highlight_transport', Medication: 'highlight_medication',
  'Multiple dogs': 'highlight_multipleDogs', 'Night stays': 'highlight_nightStays',
};
export const MAX_HIGHLIGHTS = 4;
export const HEADLINE_MAX = 80;
export const ABOUT_MIN = 120;
export const ABOUT_MAX = 600;

// Profile strength: every check a parent notices, with the tab that fixes it.
// For boarding hosts the home profile counts too: half the score for
// boarding-only hosts, 30% for hosts who also walk.
export function profileStrength(p) {
  const base = sitterStrength(p);
  if (!isBoardingHost(p.providerType)) return base;
  const home = homeStrength(p.homeDetails, p.homePhotos);
  const w = p.providerType === 'boarding' ? 0.5 : 0.3;
  return {
    pct: Math.round(base.pct * (1 - w) + home.pct * w),
    missing: [...base.missing, ...home.missing.map(m => ({ id: 'home_' + m.id, labelKey: m.labelKey, tab: 'home' }))],
  };
}

function sitterStrength(p) {
  const checks = [
    { id: 'photo', labelKey: 'strength_photo', tab: 'profile', ok: !!p.photoUrl },
    { id: 'headline', labelKey: 'strength_headline', tab: 'profile', ok: !!(p.headline || '').trim() },
    { id: 'about', labelKey: 'strength_about', tab: 'profile', ok: (p.bio || '').trim().length >= ABOUT_MIN },
    { id: 'highlights', labelKey: 'strength_highlights', tab: 'profile', ok: (p.highlights || []).length > 0 },
    { id: 'portfolio', labelKey: 'strength_portfolio', tab: 'profile', ok: (p.photos || []).length > 0 },
    { id: 'experience', labelKey: 'strength_experience', tab: 'profile', ok: !!p.experience },
    { id: 'area', labelKey: 'strength_area', tab: 'availability', ok: !!p.baseArea },
    { id: 'services', labelKey: 'strength_services', tab: 'services', ok: (p.activeServices || []).length > 0 },
    { id: 'aadhaar', labelKey: 'strength_aadhaar', tab: 'profile', ok: !!p.aadhaarNumber },
    { id: 'upi', labelKey: 'strength_upi', tab: 'payout', ok: !!(p.upiId || '').trim() },
  ];
  const missing = checks.filter(c => !c.ok);
  return { pct: Math.round(((checks.length - missing.length) / checks.length) * 100), missing };
}

const HOME_LIST_FIELDS = ['outdoor', 'sizes'];

// Flat home_details fields, keyed 'home:<field>' so they can't clash with sitter fields like max_dogs.
function homeSnapshot(details, photos) {
  const d = details || {};
  const snap = {};
  ['home_type', 'outdoor', 'someone_home', 'kids', 'other_pets', 'sleeping', 'ac', 'max_dogs', 'sizes', 'vet_km', 'updates', 'rules'].forEach(f => {
    const v = d[f];
    snap['home:' + f] = HOME_LIST_FIELDS.includes(f) ? (v || [])
      : f === 'ac' ? (typeof v === 'boolean' ? v : null)
      : f === 'rules' ? (v || '').trim()
      : f === 'max_dogs' || f === 'vet_km' ? (v == null || v === '' ? null : Number(v))
      : (v || '');
  });
  snap['home:photos'] = (photos || []).length || null;
  return snap;
}

// One flat, comparable picture of everything the Save button writes.
export function profileSnapshot(s) {
  const snap = {
    headline: (s.headline || '').trim(), bio: (s.bio || '').trim(), highlights: s.highlights || [],
    base_area: s.area?.base_area || '', service_radius_km: Number(s.area?.service_radius_km) || 5,
    experience: s.experience || '', languages: s.languages || [], availability_days: s.availableDays || [],
    morning_slot: !!s.morningSlot, afternoon_slot: !!s.afternoonSlot, evening_slot: !!s.eveningSlot,
    max_dogs: s.maxDogs || 1, advance_notice: s.advanceNotice || '', accepting: !s.isPaused,
    profile_photo: s.photoUrl || '', portfolio: (s.photos || []).length, upi: (s.upiId || '').trim(),
  };
  SERVICES.forEach(svc => { snap['svc_' + svc.id] = (s.activeServices || []).includes(svc.id) ? (s.prices?.[svc.id] || 299) : null; });
  snap.provider_type = s.providerType || 'sitter';
  const rules = s.pricingRules || {};
  RULE_FIELDS.forEach(f => { snap['rule:' + f.id] = rules[f.id] == null || rules[f.id] === '' ? null : Number(rules[f.id]); });
  snap['rule:holidays'] = rules.holidays || [];
  snap.cancellation_policy = s.cancellationPolicy || DEFAULT_POLICY;
  snap.instant_book = !!s.instantBook;
  snap.requires_vaccination = !!s.requiresVaccination;
  return isBoardingHost(snap.provider_type) ? { ...snap, ...homeSnapshot(s.homeDetails, s.homePhotos) } : snap;
}

// Field-by-field differences between two snapshots, in snapshot key order.
export function diffProfile(before, after) {
  const empty = (v) => v == null || v === '';
  return Object.keys(after).flatMap(field => {
    const from = before?.[field], to = after[field];
    if (Array.isArray(to) || Array.isArray(from)) {
      const a = from || [], b = to || [];
      const added = b.filter(x => !a.includes(x)), removed = a.filter(x => !b.includes(x));
      return added.length || removed.length ? [{ field, from: a, to: b, added, removed }] : [];
    }
    if ((empty(from) && empty(to)) || from === to) return [];
    return [{ field, from, to }];
  });
}


export default function SitterEditProfile({ onBack, city }) {
  const { t, lang } = useLanguage();
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sitterProfile, setSitterProfile] = useState(null);
  const [stats, setStats] = useState({ totalEarnings: 0, totalBookings: 0, repeatClients: 0, profileViews: 0, responseRate: 100 });
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [languages, setLanguages] = useState(['Hindi', 'English']);
  const [upiId, setUpiId] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photos, setPhotos] = useState([]);
  const fileInputRef = useRef(null);
  const avatarInputRef = useRef(null);
  const [availableDays, setAvailableDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [morningSlot, setMorningSlot] = useState(true);
  const [afternoonSlot, setAfternoonSlot] = useState(false);
  const [eveningSlot, setEveningSlot] = useState(true);
  const [maxDogs, setMaxDogs] = useState(1);
  const [advanceNotice, setAdvanceNotice] = useState('24hrs');
  const [activeServices, setActiveServices] = useState([]);
  const [prices, setPrices] = useState({});
  const [headline, setHeadline] = useState('');
  const [highlights, setHighlights] = useState([]);
  const [area, setArea] = useState({ base_area: '', base_pincode: '', lat: null, lng: null, service_radius_km: 5 });
  const [showCalendar, setShowCalendar] = useState(false);
  const [changes, setChanges] = useState(null);
  const [providerType, setProviderType] = useState('sitter');
  const [homeDetails, setHomeDetails] = useState({});
  const [homePhotos, setHomePhotos] = useState([]);
  const [pricingRules, setPricingRules] = useState({});
  const [cancellationPolicy, setCancellationPolicy] = useState(DEFAULT_POLICY);
  const [instantBook, setInstantBook] = useState(false);
  const [requiresVaccination, setRequiresVaccination] = useState(false);
  const savedSnapshot = useRef(null);
  const changesRef = useRef(null);

  useEffect(() => { loadProfile(); }, []);
  useEffect(() => { if (changes && changesRef.current?.scrollIntoView) changesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [changes]);

  const loadProfile = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from('sitter_profiles').select('*, users(name)').eq('user_id', user.id).single();
    if (profile) {
      setSitterProfile(profile);
      setBio(profile.bio || '');
      setExperience(profile.experience_text || (profile.experience_years ? profile.experience_years + ' years' : ''));
      setLanguages(profile.languages || ['Hindi', 'English']);
      const { data: piiData } = await supabase.from('sitter_pii').select('upi_id, aadhaar_number').eq('sitter_id', profile.id).maybeSingle();
      setUpiId(piiData?.upi_id || '');
      setSitterProfile({ ...profile, aadhaar_number: piiData?.aadhaar_number || null });
      setIsPaused(profile.is_paused || false);
      setPhotoUrl(profile.profile_photo_url || null);
      setAvailableDays(profile.availability_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
      setMorningSlot(profile.morning_slot !== false);
      setAfternoonSlot(profile.afternoon_slot || false);
      setEveningSlot(profile.evening_slot !== false);
      setMaxDogs(profile.max_dogs || 1);
      setAdvanceNotice(profile.advance_notice || '24hrs');
      setHeadline(profile.headline || '');
      setHighlights(profile.highlights || []);
      const loadedType = PROVIDER_TYPES.includes(profile.provider_type) ? profile.provider_type : 'sitter';
      setProviderType(loadedType);
      setHomeDetails(profile.home_details || {});
      setHomePhotos(profile.home_photos || []);
      const loadedRules = { holidays: upcomingHolidays(), ...(profile.pricing_rules || {}) };
      const loadedPolicy = CANCELLATION_POLICIES.includes(profile.cancellation_policy) ? profile.cancellation_policy : DEFAULT_POLICY;
      setPricingRules(loadedRules);
      setCancellationPolicy(loadedPolicy);
      setInstantBook(!!profile.instant_book);
      setRequiresVaccination(!!profile.requires_vaccination);
      const loadedArea = { base_area: profile.base_area || '', base_pincode: profile.base_pincode || '', lat: profile.lat ?? null, lng: profile.lng ?? null, service_radius_km: Number(profile.service_radius_km) || 5 };
      setArea(loadedArea);
      const { data: photoData } = await supabase.from('sitter_profile_photos').select('*').eq('sitter_id', profile.id).order('display_order');
      const loadedPhotos = (photoData || []).map(p => ({ id: p.id, url: p.photo_url }));
      if (loadedPhotos.length > 0) setPhotos(loadedPhotos);
      const { data: services } = await supabase.from('sitter_services').select('*').eq('sitter_id', profile.id);
      const priceMap = {};
      (services || []).forEach(s => { priceMap[s.service_type] = Math.round(s.price_paise / 100); });
      if (services && services.length > 0) {
        setActiveServices(services.map(s => s.service_type));
        setPrices(priceMap);
      }
      savedSnapshot.current = profileSnapshot({
        headline: profile.headline, bio: profile.bio, highlights: profile.highlights, area: loadedArea,
        experience: profile.experience_text || (profile.experience_years ? profile.experience_years + ' years' : ''),
        languages: profile.languages || ['Hindi', 'English'], availableDays: profile.availability_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        morningSlot: profile.morning_slot !== false, afternoonSlot: profile.afternoon_slot || false, eveningSlot: profile.evening_slot !== false,
        maxDogs: profile.max_dogs || 1, advanceNotice: profile.advance_notice || '24hrs', isPaused: profile.is_paused || false,
        photoUrl: profile.profile_photo_url, photos: loadedPhotos, activeServices: (services || []).map(s => s.service_type), prices: priceMap,
        upiId: piiData?.upi_id || '',
        providerType: loadedType, homeDetails: profile.home_details || {}, homePhotos: profile.home_photos || [],
        pricingRules: loadedRules, cancellationPolicy: loadedPolicy, instantBook: !!profile.instant_book, requiresVaccination: !!profile.requires_vaccination,
      });
      const { data: bookings } = await supabase.from('bookings').select('gross_amount_paise, pet_parent_id, status').eq('sitter_id', profile.id);
      if (bookings) {
        const completed = bookings.filter(b => b.status === 'completed');
        const totalEarnings = completed.reduce((sum, b) => sum + (b.gross_amount_paise || 0) / 100, 0);
        const parentIds = completed.map(b => b.pet_parent_id);
        const uniqueParents = [...new Set(parentIds)];
        const repeatClients = uniqueParents.filter(id => parentIds.filter(p => p === id).length > 1).length;
        setStats({ totalEarnings, totalBookings: completed.length, repeatClients, profileViews: profile.profile_views || 0, responseRate: profile.response_rate || 100 });
      }
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const compressed = await compressImage(file);
      const path = 'avatar-' + user.id + '-' + Date.now() + '.jpg';
      const { error: uploadError } = await supabase.storage.from('sitter-photos').upload(path, compressed);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('sitter-photos').getPublicUrl(path);
      setPhotoUrl(publicUrl);
    } catch (e) { alert(t('sitterEdit_uploadFailed', { error: e.message || e })); }
    setUploadingPhoto(false);
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || photos.length >= 3) return;
    setUploadingPhoto(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      for (let file of files.slice(0, 3 - photos.length)) {
        const compressed = await compressImage(file);
        const path = 'sitter-' + user.id + '-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg';
        const { error: uploadError } = await supabase.storage.from('sitter-photos').upload(path, compressed);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('sitter-photos').getPublicUrl(path);
        setPhotos(prev => [...prev, { id: null, url: publicUrl }]);
      }
    } catch (e) { alert(t('sitterEdit_uploadFailed', { error: e.message || e })); }
    setUploadingPhoto(false);
  };

  const handlePhotoDelete = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const chooseProviderType = (type) => {
    setProviderType(type);
    if (isBoardingHost(type)) {
      if (!prices.boarding) setPrices(prev => ({ ...prev, boarding: Math.round((BOARDING.min + BOARDING.max) / 2) }));
      setActiveServices(prev => (prev.includes('boarding') ? prev : [...prev, 'boarding']));
    }
    if (type === 'boarding') setActiveServices(prev => prev.filter(x => x !== 'walk30'));
    if (!isBoardingHost(type) && tab === 'home') setTab('services');
  };

  const toggleService = (id) => {
    setActiveServices(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (!prices[id]) {
      const svc = SERVICES.find(s => s.id === id);
      if (svc) setPrices(prev => ({ ...prev, [id]: Math.round((svc.min + svc.max) / 2) }));
    }
  };

  const currentSnapshot = () => profileSnapshot({
    headline, bio, highlights, area, experience, languages, availableDays, morningSlot, afternoonSlot, eveningSlot,
    maxDogs, advanceNotice, isPaused, photoUrl, photos, activeServices, prices, upiId,
    providerType, homeDetails, homePhotos, pricingRules, cancellationPolicy, instantBook, requiresVaccination,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const after = currentSnapshot();
      const updateData = {
        bio, experience_years: parseInt(experience) || 0, experience_text: experience || null, languages,
        is_paused: isPaused, profile_photo_url: photoUrl,
        availability_days: availableDays, morning_slot: morningSlot,
        afternoon_slot: afternoonSlot, evening_slot: eveningSlot,
        max_dogs: maxDogs, advance_notice: advanceNotice,
        headline: headline.trim() || null, highlights,
        base_area: area.base_area || null, base_pincode: area.base_pincode || null,
        lat: area.lat ?? null, lng: area.lng ?? null, service_radius_km: Number(area.service_radius_km) || 5,
        profile_updated_at: new Date().toISOString(),
        provider_type: providerType, home_details: homeDetails, home_photos: homePhotos,
        pricing_rules: pricingRules, cancellation_policy: cancellationPolicy, instant_book: instantBook, requires_vaccination: requiresVaccination,
      };
      const { error: profileError } = await writeWithFallback(row => supabase.from('sitter_profiles').update(row).eq('user_id', user.id), updateData);
      if (profileError) throw profileError;

      if (sitterProfile) {
        if (upiId) {
          const { error: piiError } = await supabase.from('sitter_pii').upsert({
            sitter_id: sitterProfile.id,
            upi_id: upiId,
          }, { onConflict: 'sitter_id' });
          if (piiError) throw piiError;
        }

        const { error: svcDelError } = await supabase.from('sitter_services').delete().eq('sitter_id', sitterProfile.id);
        if (svcDelError) throw svcDelError;
        if (activeServices.length > 0) {
          const { error: svcError } = await supabase.from('sitter_services').insert(
            activeServices.map(id => ({ sitter_id: sitterProfile.id, service_type: id, price_paise: (prices[id] || 299) * 100, is_active: true }))
          );
          if (svcError) throw svcError;
        }

        const { error: photoDelError } = await supabase.from('sitter_profile_photos').delete().eq('sitter_id', sitterProfile.id);
        if (photoDelError) throw photoDelError;
        if (photos.length > 0) {
          const { error: photoError } = await supabase.from('sitter_profile_photos').insert(
            photos.map((p, idx) => ({ sitter_id: sitterProfile.id, photo_url: p.url, display_order: idx }))
          );
          if (photoError) throw photoError;
        }
      }
      setChanges({ list: diffProfile(savedSnapshot.current || {}, after), at: new Date() });
      savedSnapshot.current = after;
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert(t('sitterEdit_saveFailed', { error: e.message })); }
    setSaving(false);
  };

  const strength = profileStrength({
    photoUrl, headline, bio, highlights, photos, experience, baseArea: area.base_area,
    activeServices, aadhaarNumber: sitterProfile?.aadhaar_number, upiId,
    providerType, homeDetails, homePhotos,
  });
  const pct = strength.pct;
  const strengthWord = pct === 100 ? t('strength_levelComplete') : pct >= 70 ? t('strength_levelGood') : pct >= 40 ? t('strength_levelFair') : t('strength_levelWeak');

  // "What changed" lines, e.g. "Headline: (empty) → 'Calm walker for big dogs'".
  const FIELD_KEYS = {
    headline: 'changes_headline', bio: 'changes_about', highlights: 'changes_highlights', base_area: 'changes_baseArea',
    service_radius_km: 'changes_radius', experience: 'changes_experience', languages: 'changes_languages',
    availability_days: 'changes_days', morning_slot: 'sitterEdit_morning', afternoon_slot: 'sitterEdit_afternoon',
    evening_slot: 'sitterEdit_evening', max_dogs: 'changes_maxDogs', advance_notice: 'changes_notice', accepting: 'changes_accepting',
    profile_photo: 'changes_profilePhoto', portfolio: 'changes_portfolio', upi: 'changes_upi',
    svc_walk30: 'sitterEdit_svcWalkName', svc_boarding: 'sitterEdit_svcBoardingName', svc_daycare: 'sitterEdit_svcDaycareName',
    provider_type: 'sitterEdit_providerTitle', 'home:photos': 'changes_homePhotos',
    'rule:holidays': 'host_holidaysTitle', cancellation_policy: 'host_policyTitle', instant_book: 'host_instantBook', requires_vaccination: 'host_requireVacc',
  };
  const ruleField = (field) => (field.startsWith('rule:') ? RULE_FIELDS.find(f => 'rule:' + f.id === field) : null);
  const homeField = (field) => (field.startsWith('home:') ? field.slice(5) : null);
  const listLabel = (field, v) => field === 'rule:holidays' ? formatHoliday(v, lang === 'hi' ? 'hi-IN' : 'en-IN') : homeField(field) ? t(homeOptionKey(homeField(field), v)) : field === 'highlights' ? t(HIGHLIGHT_KEYS[v] || v) : field === 'languages' ? t(LANGUAGE_KEYS[v] || v) : field === 'availability_days' ? t(DAY_KEYS[v] || v) : v;
  const clip = (s) => (s.length > 60 ? s.slice(0, 57) + '…' : s);
  const fmtValue = (field, v) => {
    if (v == null || v === '') return field.startsWith('svc_') ? t('changes_off') : t('changes_empty');
    const hf = homeField(field);
    if (hf === 'ac') return t(v ? 'bhome_ac_yes' : 'bhome_ac_no');
    if (hf === 'vet_km') return t('area_km', { n: v });
    if (hf && HOME_OPTIONS[hf]) return t(homeOptionKey(hf, v));
    if (field === 'provider_type') return t('bhome_type_' + v);
    if (field === 'cancellation_policy') return t('host_policy_' + v);
    const rf = ruleField(field);
    if (rf) return rf.unit === 'pct' ? v + '%' : rf.unit === 'rupees' ? t('sitterEdit_currencyPrefix') + v : t('host_nightsN', { n: v });
    if (typeof v === 'boolean') return v ? t('changes_on') : t('changes_off');
    if (field === 'service_radius_km') return t('area_km', { n: v });
    if (field.startsWith('svc_')) return t('sitterEdit_currencyPrefix') + v;
    if (field === 'experience') return t(EXPERIENCE_KEYS[v] || v);
    if (field === 'advance_notice') return t(ADVANCE_NOTICE_KEYS[v] || v);
    if (typeof v === 'number') return String(v);
    return "'" + clip(String(v)) + "'";
  };
  const changeLine = (c) => {
    const label = t(FIELD_KEYS[c.field] || (ruleField(c.field) ? 'host_rule_' + ruleField(c.field).id : homeField(c.field) ? 'bhome_field_' + homeField(c.field) : c.field));
    if (c.added || c.removed) {
      const parts = [];
      if (c.added.length) parts.push(t('changes_added', { items: c.added.map(v => listLabel(c.field, v)).join(', ') }));
      if (c.removed.length) parts.push(t('changes_removed', { items: c.removed.map(v => listLabel(c.field, v)).join(', ') }));
      return label + ': ' + parts.join('; ');
    }
    if (c.field === 'profile_photo') return label + ': ' + (!c.from ? t('changes_photoAdded') : !c.to ? t('changes_photoRemoved') : t('changes_photoReplaced'));
    if (c.field === 'upi') return label + ': ' + t('changes_updated');
    return label + ': ' + fmtValue(c.field, c.from) + ' → ' + fmtValue(c.field, c.to);
  };

  const card = { ...ui.card, marginBottom: 12 };
  const cardTitle = { fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 10 };
  const chipRow = { display: 'flex', flexWrap: 'wrap', gap: 8 };
  const switchVisual = (on) => (
    <span aria-hidden="true" style={{ width: 44, height: 26, borderRadius: radius.pill, background: on ? color.navy : color.line, position: 'relative', transition: 'background 0.2s', flexShrink: 0, display: 'block' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: radius.pill, background: color.surface, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(16,24,40,0.2)' }} />
    </span>
  );
  const statusLabel = sitterProfile?.status === 'active' ? t('sitterEdit_statusLive')
    : sitterProfile?.status === 'needs_changes' ? t('sitterEdit_statusNeedsChanges')
    : t('sitterEdit_statusPending');
  const aadhaarTone = sitterProfile?.aadhaar_verified ? 'success' : sitterProfile?.aadhaar_number ? 'info' : 'warning';

  const header = (
    <div style={ui.header}>
      <button onClick={onBack} aria-label={t('common_back')} style={ui.backButton}><Icon name="arrowLeft" size={20} /></button>
      <h1 style={{ ...ui.headerTitle, flex: 1 }}>{t('nav_sitterProfile')}</h1>
      {!loading && (
        <button onClick={handleSave} disabled={saving}
          style={{ ...ui.primaryButton, minHeight: 40, padding: '0 16px', fontSize: font.md, background: saved ? color.success : color.navy }}>
          {saving ? t('common_saving') : saved ? t('sitterEdit_savedShort') : t('common_save')}
        </button>
      )}
    </div>
  );

  if (loading) return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {header}
      <div role="status" style={{ padding: 16 }}>
        {[132, 64, 180].map((h, i) => <div key={i} style={{ height: h, borderRadius: radius.lg, background: color.tile, marginBottom: 12 }} />)}
        <div style={{ fontSize: font.sm, color: color.muted, textAlign: 'center' }}>{t('sitterEdit_loadingProfile')}</div>
      </div>
    </div>
  );

  if (showCalendar && sitterProfile?.id) return (
    <AvailabilityCalendar sitterId={sitterProfile.id} onBack={() => setShowCalendar(false)}
      weekly={{ availability_days: availableDays, morning_slot: morningSlot, afternoon_slot: afternoonSlot, evening_slot: eveningSlot }} />
  );

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {header}
      <div style={{ padding: 16 }}>
        {changes && (
          <div ref={changesRef} role="status" aria-label={t('changes_title')} style={{ ...card, border: `1px solid ${color.success}`, background: color.successSoft }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <Icon name="check" size={20} color={color.success} style={{ marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink }}>{t('changes_title')}</div>
                <div style={{ fontSize: font.xs, color: color.muted, marginBottom: 6 }}>
                  {t('changes_savedAt', { time: changes.at.toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' }) })}
                </div>
                {changes.list.length === 0 ? (
                  <div style={{ fontSize: font.sm, color: color.text }}>{t('changes_none')}</div>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: font.sm, color: color.text, lineHeight: 1.6 }}>
                    {changes.list.map(c => <li key={c.field} style={{ overflowWrap: 'anywhere' }}>{changeLine(c)}</li>)}
                  </ul>
                )}
              </div>
              <button type="button" onClick={() => setChanges(null)} aria-label={t('common_close')} style={{ ...ui.backButton, width: 32, height: 32, background: color.surface }}><Icon name="close" size={14} /></button>
            </div>
          </div>
        )}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button type="button" onClick={() => choosePhoto(avatarInputRef, handleAvatarUpload)} aria-label={t('sitterEdit_changeProfilePhoto')}
                style={{ width: 72, height: 72, padding: 0, fontFamily: 'inherit', borderRadius: radius.lg, background: color.tile, border: photoUrl ? 'none' : `1.5px dashed ${color.faint}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', color: color.navy }}>
                {photoUrl ? <img src={photoUrl} alt={t('sitterEdit_profilePhotoAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ textAlign: 'center' }}><Icon name="camera" size={22} /><div style={{ fontSize: font.xs, fontWeight: 600, marginTop: 2 }}>{t('sitterEdit_avatarAddPhoto')}</div></div>}
              </button>
              {photoUrl && (
                <span aria-hidden="true" style={{ position: 'absolute', right: -4, bottom: -4, width: 26, height: 26, borderRadius: radius.pill, background: color.navy, color: color.surface, border: `2px solid ${color.surface}`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <Icon name="camera" size={13} />
                </span>
              )}
              {uploadingPhoto && <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,37,74,0.55)', borderRadius: radius.lg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: color.surface, fontSize: font.xs }}>...</div></div>}
              <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink, lineHeight: 1.3 }}>{sitterProfile?.users?.name || t('sitterEdit_defaultProfileName')}</div>
              <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2 }}>{city} · {statusLabel}</div>
              <button type="button" onClick={() => setIsPaused(!isPaused)} aria-pressed={isPaused}
                style={{ ...ui.badge(isPaused ? 'warning' : 'success'), marginTop: 8, minHeight: 32, padding: '0 12px', border: 'none', fontFamily: 'inherit', fontSize: font.sm, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 8, height: 8, borderRadius: radius.pill, background: 'currentColor', flexShrink: 0 }} />
                <span>{isPaused ? t('sitterEdit_pausedLabel') : t('sitterEdit_acceptingLabel')}</span>
              </button>
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${color.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: font.sm, fontWeight: 600, color: color.text }}>{t('strength_title')} · {strengthWord}</span>
              <span style={{ fontSize: font.sm, fontWeight: 700, color: pct === 100 ? color.success : color.navy, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
            </div>
            <div role="meter" aria-label={t('strength_title')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ background: color.tile, borderRadius: radius.pill, height: 6 }}>
              <div style={{ background: pct === 100 ? color.success : pct >= 70 ? color.navy : color.saffron, borderRadius: radius.pill, height: 6, width: pct + '%', transition: 'width 0.3s' }} />
            </div>
            {strength.missing.length > 0 ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: font.xs, fontWeight: 600, color: color.muted, marginBottom: 6 }}>{t('strength_missingTitle', { n: strength.missing.length })}</div>
                <ul aria-label={t('strength_missingTitle', { n: strength.missing.length })} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {strength.missing.map(m => (
                    <li key={m.id}>
                      <button type="button" onClick={() => setTab(m.tab)}
                        style={{ minHeight: 32, padding: '0 10px', borderRadius: radius.pill, border: `1px dashed ${color.faint}`, background: color.surface, color: color.text, fontSize: font.sm, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="plus" size={13} />{t(m.labelKey)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: color.success, fontSize: font.sm, marginTop: 8 }}><Icon name="check" size={15} />{t('strength_allDone')}</div>
            )}
          </div>
        </div>

        {sitterProfile?.status === 'needs_changes' && (
          <div role="alert" style={{ background: color.warningSoft, border: `1px solid ${color.line}`, borderRadius: radius.lg, padding: '12px 14px', marginBottom: 12, display: 'flex', gap: 10 }}>
            <Icon name="alert" size={20} color={color.warning} style={{ marginTop: 1 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: font.md, fontWeight: 700, color: color.warning, marginBottom: 4 }}>{t('sitterEdit_needsChangesTitle')}</div>
              <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.5 }}>{sitterProfile.review_notes || t('sitterEdit_needsChangesGeneric')}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { icon: 'wallet', val: t('sitterEdit_currencyPrefix') + stats.totalEarnings.toLocaleString('en-IN'), label: t('sitterEdit_statEarned') },
            { icon: 'message', val: stats.responseRate + '%', label: t('sitterEdit_statResponse') },
            { icon: 'eye', val: stats.profileViews, label: t('sitterEdit_statViews') },
            { icon: 'repeat', val: stats.repeatClients, label: t('sitterEdit_statRepeats') },
          ].map((s, i) => (
            <div key={i} style={{ background: color.surface, border: `1px solid ${color.line}`, borderRadius: radius.md, padding: '10px 4px', textAlign: 'center', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'center', color: color.navy, marginBottom: 4 }}><Icon name={s.icon} size={16} /></div>
              <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.val}</div>
              <div style={{ fontSize: font.xs, color: color.muted, lineHeight: 1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {sitterProfile?.is_top_sitter && (
          <div style={{ background: color.saffronSoft, borderRadius: radius.lg, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ ...ui.iconTile, width: 40, height: 40, background: color.surface, color: color.saffron }}><Icon name="starFilled" size={20} /></span>
            <div>
              <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink }}>{t('sitterEdit_topBadgeTitle')}</div>
              <div style={{ fontSize: font.sm, color: color.muted }}>{t('sitterEdit_topBadgeDesc')}</div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '4px -16px 14px', padding: '0 16px 2px', scrollbarWidth: 'none' }}>
          {[{ id: 'profile', labelKey: 'sitterEdit_tabProfile' }, { id: 'services', labelKey: 'sitterEdit_tabServices' }, ...(isBoardingHost(providerType) ? [{ id: 'home', labelKey: 'sitterEdit_tabHome' }] : []), { id: 'availability', labelKey: 'sitterEdit_tabSchedule' }, { id: 'payout', labelKey: 'sitterEdit_tabPayout' }].map(tabItem => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)} aria-pressed={tab === tabItem.id}
              style={{ ...ui.chip(tab === tabItem.id), minHeight: 40, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {t(tabItem.labelKey)}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div>
            <ShareProfileCard />
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...ui.iconTile, width: 40, height: 40, background: color[aadhaarTone + 'Soft'], color: color[aadhaarTone] }}>
                <Icon name={sitterProfile?.aadhaar_verified ? 'shield' : sitterProfile?.aadhaar_number ? 'clock' : 'card'} size={20} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{sitterProfile?.aadhaar_verified ? t('sitterEdit_aadhaarVerified') : sitterProfile?.aadhaar_number ? t('sitterEdit_aadhaarPending') : t('sitterEdit_aadhaarNotSubmitted')}</div>
                <div style={{ fontSize: font.sm, color: color.muted }}>{sitterProfile?.aadhaar_verified ? t('sitterEdit_aadhaarVerifiedDesc') : t('sitterEdit_aadhaarRequiredDesc')}</div>
              </div>
            </div>
            <div style={card}>
              <label htmlFor="sitter-edit-headline" style={{ ...cardTitle, display: 'block', marginBottom: 4 }}>{t('sitterEdit_headlineLabel')}</label>
              <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 8 }}>{t('sitterEdit_headlineHint')}</div>
              <input id="sitter-edit-headline" value={headline} maxLength={HEADLINE_MAX} onChange={e => setHeadline(e.target.value.slice(0, HEADLINE_MAX))}
                placeholder={t('sitterEdit_headlinePlaceholder')} style={ui.input} />
              <div style={{ fontSize: font.xs, color: color.faint, textAlign: 'right', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{headline.length}/{HEADLINE_MAX}</div>
            </div>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <div style={{ ...cardTitle, marginBottom: 0 }}>{t('sitterEdit_highlightsLabel')}</div>
                <span style={{ fontSize: font.xs, color: color.muted, fontVariantNumeric: 'tabular-nums' }}>{highlights.length}/{MAX_HIGHLIGHTS}</span>
              </div>
              <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 10 }}>{t('sitterEdit_highlightsHint', { n: MAX_HIGHLIGHTS })}</div>
              <div style={chipRow}>
                {HIGHLIGHTS.map(h => {
                  const on = highlights.includes(h);
                  const full = !on && highlights.length >= MAX_HIGHLIGHTS;
                  return (
                    <button key={h} type="button" aria-pressed={on} disabled={full}
                      onClick={() => setHighlights(prev => on ? prev.filter(x => x !== h) : prev.length >= MAX_HIGHLIGHTS ? prev : [...prev, h])}
                      style={{ ...ui.chip(on), opacity: full ? 0.45 : 1, cursor: full ? 'not-allowed' : 'pointer' }}>
                      {t(HIGHLIGHT_KEYS[h])}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={card}>
              <div style={cardTitle}>{t('sitterEdit_portfolioLabel')}</div>
              <div style={{ background: color.navySoft, borderRadius: radius.md, padding: '10px 12px', marginBottom: 12, display: 'flex', gap: 8 }}>
                <Icon name="camera" size={16} color={color.navy} style={{ marginTop: 2 }} />
                <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.5 }}>
                  <div>{t('sitterEdit_photoTipFace')}</div>
                  <div>{t('sitterEdit_photoTipDogs')}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {photos.map((photo, i) => (
                  <div key={i} style={{ position: 'relative', aspectRatio: '1' }}>
                    <img src={photo.url} alt={t('sitterEdit_photoAlt', { n: i + 1 })} style={{ width: '100%', height: '100%', borderRadius: radius.md, objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={() => handlePhotoDelete(i)} aria-label={t('sitterEdit_removePhotoLabel', { n: i + 1 })}
                      style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, padding: 0, border: 'none', borderRadius: radius.pill, background: color.surface, color: color.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(16,24,40,0.2)' }}>
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                ))}
                {photos.length < 3 && (
                  <button type="button" onClick={() => choosePhoto(fileInputRef, handlePhotoUpload)} aria-label={t('sitterEdit_addPortfolioPhotoLabel')}
                    style={{ aspectRatio: '1', padding: 0, fontFamily: 'inherit', borderRadius: radius.md, background: color.tile, border: `1.5px dashed ${color.faint}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4, color: color.navy }}>
                    {uploadingPhoto ? <span style={{ fontSize: font.sm }}>...</span> : <><Icon name="camera" size={20} /><span style={{ fontSize: font.xs, fontWeight: 600, textAlign: 'center' }}>{photos.length === 0 ? t('sitterEdit_addPhotoButton') : t('sitterEdit_morePhotos')}</span></>}
                  </button>
                )}
              </div>
              <div style={{ fontSize: font.xs, color: color.muted, marginTop: 10 }}>{t('sitterEdit_photosUploadedCount', { count: photos.length })}</div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>
            <div style={card}>
              <label style={{ ...cardTitle, display: 'block', marginBottom: 4 }} htmlFor="sitter-edit-bio">{t('sitterEdit_aboutLabel')}</label>
              <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 8 }}>{t('sitterEdit_aboutHint')}</div>
              <textarea id="sitter-edit-bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={ABOUT_MAX}
                placeholder={t('sitterEdit_bioPlaceholder')}
                style={{ ...ui.input, fontSize: font.md, resize: 'vertical', minHeight: 140, lineHeight: 1.6 }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                <span aria-live="polite" style={{ fontSize: font.xs, color: bio.trim().length >= ABOUT_MIN ? color.success : color.warning }}>
                  {bio.trim().length >= ABOUT_MIN ? t('sitterEdit_aboutEnough') : t('sitterEdit_aboutMore', { n: ABOUT_MIN - bio.trim().length, min: ABOUT_MIN })}
                </span>
                <span style={{ fontSize: font.xs, color: color.faint, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{bio.length}/{ABOUT_MAX}</span>
              </div>
            </div>
            <div style={card}>
              <div style={cardTitle}>{t('sitterEdit_experienceLabel')}</div>
              <div style={chipRow}>
                {EXPERIENCE_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => setExperience(opt)} aria-pressed={experience === opt} style={ui.chip(experience === opt)}>
                    {t(EXPERIENCE_KEYS[opt])}
                  </button>
                ))}
              </div>
            </div>
            <div style={card}>
              <div style={cardTitle}>{t('sitterEdit_languagesLabel')}</div>
              <div style={chipRow}>
                {LANGUAGES.map(lang => (
                  <button key={lang} onClick={() => setLanguages(prev => prev.includes(lang) ? prev.filter(x => x !== lang) : [...prev, lang])} aria-pressed={languages.includes(lang)} style={ui.chip(languages.includes(lang))}>
                    {t(LANGUAGE_KEYS[lang])}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'services' && (
          <div>
            <div style={card}>
              <div id="sitter-edit-provider" style={{ ...cardTitle, marginBottom: 4 }}>{t('sitterEdit_providerTitle')}</div>
              <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 10 }}>{t('sitterEdit_providerHint')}</div>
              <div role="group" aria-labelledby="sitter-edit-provider" style={chipRow}>
                {PROVIDER_TYPES.map(type => (
                  <button key={type} type="button" aria-pressed={providerType === type} onClick={() => chooseProviderType(type)} style={{ ...ui.chip(providerType === type), minHeight: 44 }}>
                    {t('bhome_type_' + type)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 12 }}>{t('sitterEdit_servicesHint')}</div>
            {SERVICES.filter(s => !(providerType === 'boarding' && s.id === 'walk30')).map(s => {
              const active = activeServices.includes(s.id);
              const price = prices[s.id] || Math.round((s.min + s.max) / 2);
              return (
                <div key={s.id} style={{ ...card, border: `1px solid ${active ? color.navy : color.line}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <span style={{ ...ui.iconTile, width: 44, height: 44 }}><Icon name={s.icon} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{t(s.nameKey)}</div>
                        <div style={{ fontSize: font.sm, color: color.muted }}>{t(s.subKey)}</div>
                      </div>
                    </div>
                    <button type="button" onClick={() => toggleService(s.id)} role="switch" aria-checked={active} aria-label={t('sitterEdit_serviceToggleLabel', { service: t(s.nameKey) })}
                      style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>
                      {switchVisual(active)}
                    </button>
                  </div>
                  {active && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${color.line}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                        <span style={{ fontSize: font.sm, color: color.muted }}>{t('sitterEdit_yourPriceLabel')}</span>
                        <span style={{ fontSize: font.xl, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums' }}>{t('sitterEdit_currencyPrefix')}{price}</span>
                      </div>
                      <input type="range" min={s.min} max={s.max} step={s.step} value={price}
                        onChange={e => setPrices(prev => ({ ...prev, [s.id]: parseInt(e.target.value) }))}
                        style={{ width: '100%', accentColor: color.navy, marginBottom: 6 }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: font.xs, color: color.faint }}>{t('sitterEdit_minLabel')} {t('sitterEdit_currencyPrefix')}{s.min}</span>
                        <span style={{ fontSize: font.xs, color: color.faint }}>{t('sitterEdit_maxLabel')} {t('sitterEdit_currencyPrefix')}{s.max}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <HostSettings nightly={prices.boarding || Math.round((BOARDING.min + BOARDING.max) / 2)} isBoarding={isBoardingHost(providerType)}
              rules={pricingRules} policy={cancellationPolicy} instantBook={instantBook} requiresVaccination={requiresVaccination} houseRules={(homeDetails.rules || '').trim()}
              onChange={patch => {
                if ('rules' in patch) setPricingRules(patch.rules);
                if ('policy' in patch) setCancellationPolicy(patch.policy);
                if ('instantBook' in patch) setInstantBook(patch.instantBook);
                if ('requiresVaccination' in patch) setRequiresVaccination(patch.requiresVaccination);
              }} />
          </div>
        )}
        {tab === 'home' && isBoardingHost(providerType) && (
          <BoardingHomeEditor details={homeDetails} photos={homePhotos} onChange={setHomeDetails} onPhotosChange={setHomePhotos} />
        )}
        {tab === 'availability' && (
          <div>
            <div style={card}>
              <div style={{ ...cardTitle, marginBottom: 4 }}>{t('area_title')}</div>
              <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 12 }}>{t('area_subtitle')}</div>
              <ServiceAreaPicker city={city} value={area} onChange={patch => setArea(prev => ({ ...prev, ...patch }))} />
            </div>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...ui.iconTile, width: 44, height: 44 }}><Icon name="calendar" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{t('sitterEdit_calendarTitle')}</div>
                <div style={{ fontSize: font.sm, color: color.muted }}>{t('sitterEdit_calendarSub')}</div>
              </div>
              <button type="button" onClick={() => setShowCalendar(true)} disabled={!sitterProfile?.id}
                style={{ ...ui.secondaryButton, minHeight: 44, padding: '0 14px', fontSize: font.md, flexShrink: 0 }}>
                {t('sitterEdit_calendarOpen')}
              </button>
            </div>
            <div style={card}>
              <div style={cardTitle}>{t('sitterEdit_availableDaysLabel')}</div>
              <div style={{ ...chipRow, marginBottom: 12 }}>
                {DAYS.map(day => {
                  const sel = availableDays.includes(day);
                  return (
                    <button key={day} onClick={() => setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])} aria-pressed={sel} style={ui.chip(sel)}>
                      {t(DAY_KEYS[day])}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ labelKey: 'sitterEdit_weekdays', days: ['Mon','Tue','Wed','Thu','Fri'] }, { labelKey: 'sitterEdit_weekends', days: ['Sat','Sun'] }, { labelKey: 'sitterEdit_allDays', days: DAYS }].map(p => (
                  <button key={p.labelKey} onClick={() => setAvailableDays(p.days)}
                    style={{ ...ui.secondaryButton, flex: 1, minHeight: 40, padding: '0 6px', fontSize: font.sm, color: color.text }}>
                    {t(p.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div style={card}>
              <div style={{ ...cardTitle, marginBottom: 2 }}>{t('sitterEdit_timeSlotsLabel')}</div>
              {[
                { labelKey: 'sitterEdit_morning', subKey: 'sitterEdit_morningHours', val: morningSlot, set: setMorningSlot },
                { labelKey: 'sitterEdit_afternoon', subKey: 'sitterEdit_afternoonHours', val: afternoonSlot, set: setAfternoonSlot },
                { labelKey: 'sitterEdit_evening', subKey: 'sitterEdit_eveningHours', val: eveningSlot, set: setEveningSlot },
              ].map((slot, i) => (
                <button type="button" key={slot.labelKey} onClick={() => slot.set(!slot.val)} role="switch" aria-checked={slot.val}
                  style={{ width: '100%', fontFamily: 'inherit', textAlign: 'left', color: 'inherit', background: 'none', border: 'none', borderTop: i ? `1px solid ${color.line}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 0', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{t(slot.labelKey)}</div>
                    <div style={{ fontSize: font.sm, color: color.muted }}>{t(slot.subKey)}</div>
                  </div>
                  {switchVisual(slot.val)}
                </button>
              ))}
            </div>
            <div style={card}>
              <div style={cardTitle}>{t('sitterEdit_maxDogsLabel')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3,4].map(n => (
                  <button key={n} onClick={() => setMaxDogs(n)} aria-pressed={maxDogs === n}
                    style={{ ...ui.chip(maxDogs === n), flex: 1, minHeight: 44, borderRadius: radius.md, fontSize: font.lg }}>
                    {n}{n === 4 ? '+' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div style={card}>
              <div style={cardTitle}>{t('sitterEdit_advanceNoticeLabel')}</div>
              <div style={chipRow}>
                {ADVANCE_NOTICE_OPTIONS.map(n => (
                  <button key={n} onClick={() => setAdvanceNotice(n)} aria-pressed={advanceNotice === n} style={ui.chip(advanceNotice === n)}>
                    {t(ADVANCE_NOTICE_KEYS[n])}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'payout' && (
          <div>
            <div style={card}>
              <label htmlFor="sitter-edit-upi" style={{ ...cardTitle, display: 'block', marginBottom: 4 }}>{t('sitterEdit_upiLabel')}</label>
              <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 12 }}>{t('sitterEdit_upiHint')}</div>
              <input id="sitter-edit-upi" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder={t('sitterEdit_upiPlaceholder')} style={ui.input} />
              {upiId && upiId.includes('@') && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: color.success }}><Icon name="check" size={16} /><span style={{ fontSize: font.sm }}>{t('sitterEdit_upiValid')}</span></div>}
              {upiId && !upiId.includes('@') && <div style={{ marginTop: 8, fontSize: font.sm, color: color.warning }}>{t('sitterEdit_upiInvalid')}</div>}
            </div>
            <div style={card}>
              <div style={{ ...cardTitle, marginBottom: 2 }}>{t('sitterEdit_earningsSummaryLabel')}</div>
              {[
                { labelKey: 'sitterEdit_totalEarnedLabel', val: t('sitterEdit_currencyPrefix') + stats.totalEarnings.toLocaleString('en-IN') },
                { labelKey: 'sitterEdit_totalBookingsLabel', val: stats.totalBookings },
                { labelKey: 'sitterEdit_repeatClientsLabel', val: stats.repeatClients },
                { labelKey: 'sitterEdit_responseRateLabel', val: stats.responseRate + '%' },
              ].map((row, i) => (
                <div key={row.labelKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, minHeight: 44, borderTop: i ? `1px solid ${color.line}` : 'none' }}>
                  <span style={{ fontSize: font.md, color: color.muted }}>{t(row.labelKey)}</span>
                  <span style={{ fontSize: font.md, fontWeight: 700, color: color.ink, fontVariantNumeric: 'tabular-nums' }}>{row.val}</span>
                </div>
              ))}
            </div>
            <div style={{ background: color.infoSoft, borderRadius: radius.lg, padding: 14, marginBottom: 12, display: 'flex', gap: 10 }}>
              <Icon name="info" size={20} color={color.info} style={{ marginTop: 1 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: font.md, fontWeight: 600, color: color.info, marginBottom: 4 }}>{t('sitterEdit_payoutInfoTitle')}</div>
                <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.6 }}>{t('sitterEdit_payoutInfoBody')}</div>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleSave} disabled={saving}
          style={{ ...ui.primaryButton, width: '100%', marginTop: 4, background: saved ? color.success : color.navy, opacity: saving ? 0.7 : 1 }}>
          {saving ? t('common_saving') : saved ? t('sitterEdit_changesSaved') : t('sitterEdit_saveChangesButton')}
        </button>
      </div>
    </div>
  );
}
