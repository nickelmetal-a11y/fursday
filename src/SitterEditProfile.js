import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { choosePhoto } from './photoPicker';
import { useLanguage } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';

const SERVICES = [
  { id: 'walk30', nameKey: 'sitterEdit_svcWalkName', subKey: 'sitterEdit_svcWalkSub', icon: 'walk', min: 149, max: 599, step: 50 },
  { id: 'boarding', nameKey: 'sitterEdit_svcBoardingName', subKey: 'sitterEdit_svcBoardingSub', icon: 'boarding', min: 499, max: 1999, step: 100 },
  { id: 'daycare', nameKey: 'sitterEdit_svcDaycareName', subKey: 'sitterEdit_svcDaycareSub', icon: 'sun', min: 399, max: 1299, step: 50 },
];

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


const compressImage = (file) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      const maxPx = 1200;
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
export default function SitterEditProfile({ onBack, city }) {
  const { t } = useLanguage();
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

  useEffect(() => { loadProfile(); }, []);

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
      setAvailableDays(profile.availability_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      setMorningSlot(profile.morning_slot !== false);
      setAfternoonSlot(profile.afternoon_slot || false);
      setEveningSlot(profile.evening_slot !== false);
      setMaxDogs(profile.max_dogs || 1);
      setAdvanceNotice(profile.advance_notice || '24hrs');
      // Load sitter profile photos
      const { data: photoData } = await supabase.from('sitter_profile_photos').select('*').eq('sitter_id', profile.id).order('display_order');
      if (photoData && photoData.length > 0) {
        setPhotos(photoData.map(p => ({ id: p.id, url: p.photo_url })));
      }
      const { data: services } = await supabase.from('sitter_services').select('*').eq('sitter_id', profile.id);
      if (services && services.length > 0) {
        setActiveServices(services.map(s => s.service_type));
        const priceMap = {};
        services.forEach(s => { priceMap[s.service_type] = Math.round(s.price_paise / 100); });
        setPrices(priceMap);
      }
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

  const toggleService = (id) => {
    setActiveServices(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (!prices[id]) {
      const svc = SERVICES.find(s => s.id === id);
      if (svc) setPrices(prev => ({ ...prev, [id]: Math.round((svc.min + svc.max) / 2) }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updateData = {
        bio, experience_years: parseInt(experience) || 0, experience_text: experience || null, languages,
        is_paused: isPaused, profile_photo_url: photoUrl,
        availability_days: availableDays, morning_slot: morningSlot,
        afternoon_slot: afternoonSlot, evening_slot: eveningSlot,
        max_dogs: maxDogs, advance_notice: advanceNotice,
      };
      const { error: profileError } = await supabase.from('sitter_profiles').update(updateData).eq('user_id', user.id);
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
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert(t('sitterEdit_saveFailed', { error: e.message })); }
    setSaving(false);
  };

  const completeness = () => {
    const checks = [!!photoUrl, bio.length > 30, !!upiId, activeServices.length > 0, languages.length > 0, !!experience, !!sitterProfile?.aadhaar_number];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  };

  const pct = completeness();

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

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {header}
      <div style={{ padding: 16 }}>
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
              <span style={{ fontSize: font.sm, fontWeight: 600, color: color.text }}>{t('sitterEdit_completenessLabel')}</span>
              <span style={{ fontSize: font.sm, fontWeight: 700, color: pct === 100 ? color.success : color.navy, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
            </div>
            <div style={{ background: color.tile, borderRadius: radius.pill, height: 6 }}>
              <div style={{ background: pct === 100 ? color.success : color.navy, borderRadius: radius.pill, height: 6, width: pct + '%', transition: 'width 0.3s' }} />
            </div>
            {pct < 100 && <div style={{ color: color.muted, fontSize: font.xs, marginTop: 8, lineHeight: 1.5 }}>
              {!photoUrl && t('sitterEdit_hintPhoto')}{bio.length < 30 && t('sitterEdit_hintBio')}{!upiId && t('sitterEdit_hintUpi')}
            </div>}
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
          {[{ id: 'profile', labelKey: 'sitterEdit_tabProfile' }, { id: 'services', labelKey: 'sitterEdit_tabServices' }, { id: 'availability', labelKey: 'sitterEdit_tabSchedule' }, { id: 'payout', labelKey: 'sitterEdit_tabPayout' }].map(tabItem => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)} aria-pressed={tab === tabItem.id}
              style={{ ...ui.chip(tab === tabItem.id), minHeight: 40, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {t(tabItem.labelKey)}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div>
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
              <div style={cardTitle}>{t('sitterEdit_portfolioLabel')}</div>
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
              <label style={{ ...cardTitle, display: 'block', marginBottom: 8 }} htmlFor="sitter-edit-bio">{t('sitterEdit_bioLabel')}</label>
              <textarea id="sitter-edit-bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={300}
                placeholder={t('sitterEdit_bioPlaceholder')}
                style={{ ...ui.input, fontSize: font.md, resize: 'none', minHeight: 100, lineHeight: 1.6 }} />
              <div style={{ fontSize: font.xs, color: color.faint, textAlign: 'right', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{bio.length}/300</div>
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
            <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 12 }}>{t('sitterEdit_servicesHint')}</div>
            {SERVICES.map(s => {
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
          </div>
        )}
        {tab === 'availability' && (
          <div>
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
