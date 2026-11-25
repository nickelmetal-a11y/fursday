import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle, Camera, Star, TrendingUp, Eye, Award } from 'lucide-react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';

const ORANGE = '#FF6B35';
const ORANGE_LIGHT = '#FFF0EB';

const SERVICES = [
  { id: 'walk30', nameKey: 'sitterEdit_svcWalkName', subKey: 'sitterEdit_svcWalkSub', icon: '🦮', min: 149, max: 599, step: 50 },
  { id: 'boarding', nameKey: 'sitterEdit_svcBoardingName', subKey: 'sitterEdit_svcBoardingSub', icon: '🏠', min: 499, max: 1999, step: 100 },
  { id: 'daycare', nameKey: 'sitterEdit_svcDaycareName', subKey: 'sitterEdit_svcDaycareSub', icon: '☀️', min: 399, max: 1299, step: 50 },
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

  const theme = city === 'Pune'
    ? { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' }
    : { primary: ORANGE, light: ORANGE_LIGHT, grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' };

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
      // Load PII from sitter_pii table (UPI was moved to separate table)
      const { data: piiData } = await supabase.from('sitter_pii').select('upi_id').eq('sitter_id', profile.id).single().catch(() => ({ data: {} }));
      setUpiId(piiData?.upi_id || profile.upi_id || '');
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
    } catch (e) { alert('Upload failed: ' + (e.message || e)); }
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
    } catch (e) { alert('Upload failed: ' + (e.message || e)); }
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
      // Update sitter_profiles (upi_id removed after migration)
      const updateData = {
        bio, experience_years: parseInt(experience) || 0, experience_text: experience || null, languages,
        is_paused: isPaused, profile_photo_url: photoUrl,
        availability_days: availableDays, morning_slot: morningSlot,
        afternoon_slot: afternoonSlot, evening_slot: eveningSlot,
        max_dogs: maxDogs, advance_notice: advanceNotice,
      };
      // For backward compatibility, include upi_id if the column still exists
      if (sitterProfile?.upi_id !== undefined) updateData.upi_id = upiId || null;

      await supabase.from('sitter_profiles').update(updateData).eq('user_id', user.id);

      // Update sitter_pii with UPI data
      if (sitterProfile) {
        if (upiId) {
          await supabase.from('sitter_pii').upsert({
            sitter_id: sitterProfile.id,
            upi_id: upiId,
          });
        }

        await supabase.from('sitter_services').delete().eq('sitter_id', sitterProfile.id);
        if (activeServices.length > 0) {
          await supabase.from('sitter_services').insert(
            activeServices.map(id => ({ sitter_id: sitterProfile.id, service_type: id, price_paise: (prices[id] || 299) * 100, is_active: true }))
          );
        }

        // Save profile photos
        await supabase.from('sitter_profile_photos').delete().eq('sitter_id', sitterProfile.id);
        if (photos.length > 0) {
          await supabase.from('sitter_profile_photos').insert(
            photos.map((p, idx) => ({ sitter_id: sitterProfile.id, photo_url: p.url, display_order: idx }))
          );
        }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert('Save failed: ' + e.message); }
    setSaving(false);
  };

  const completeness = () => {
    const checks = [!!photoUrl, bio.length > 30, !!upiId, activeServices.length > 0, languages.length > 0, !!experience, !!sitterProfile?.aadhaar_number];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  };

  const pct = completeness();

  if (loading) return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#F8F8F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 40 }}>🐾</div>
      <div style={{ fontSize: 14, color: '#888' }}>{t('sitterEdit_loadingProfile')}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#F8F8F8', fontFamily: '-apple-system,sans-serif', paddingBottom: 100 }}>
      <div style={{ background: theme.grad, padding: '48px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 12, padding: '8px 12px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <ArrowLeft size={16} /> {t('common_back')}
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ background: saved ? '#2E7D32' : 'white', border: 'none', borderRadius: 12, padding: '8px 16px', color: saved ? 'white' : theme.primary, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            {saving ? t('common_saving') : saved ? t('sitterEdit_savedShort') : t('common_save')}
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div onClick={() => avatarInputRef.current?.click()}
              style={{ width: 72, height: 72, borderRadius: 22, background: photoUrl ? 'transparent' : 'rgba(255,255,255,0.2)', border: '3px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden' }}>
              {photoUrl ? <img src={photoUrl} alt="profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center' }}><Camera size={20} color="white" /><div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, marginTop: 2 }}>{t('sitterEdit_avatarAddPhoto')}</div></div>}
            </div>
            {uploadingPhoto && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: 'white', fontSize: 10 }}>...</div></div>}
            <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{sitterProfile?.users?.name || t('sitterEdit_defaultProfileName')}</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>{city} · {sitterProfile?.status === 'active' ? t('sitterEdit_statusLive') : t('sitterEdit_statusPending')}</div>
            <div onClick={() => setIsPaused(!isPaused)}
              style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: isPaused ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)', borderRadius: 20, padding: '4px 12px', cursor: 'pointer' }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: isPaused ? '#FFC107' : '#4CAF50' }} />
              <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>{isPaused ? t('sitterEdit_pausedLabel') : t('sitterEdit_acceptingLabel')}</span>
            </div>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'white', fontSize: 12, fontWeight: 600 }}>{t('sitterEdit_completenessLabel')}</span>
            <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>{pct}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, height: 6 }}>
            <div style={{ background: pct === 100 ? '#4CAF50' : 'white', borderRadius: 4, height: 6, width: pct + '%', transition: 'width 0.3s' }} />
          </div>
          {pct < 100 && <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 }}>
            {!photoUrl && t('sitterEdit_hintPhoto')}{bio.length < 30 && t('sitterEdit_hintBio')}{!upiId && t('sitterEdit_hintUpi')}
          </div>}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, padding: '14px 16px 0' }}>
        {[
          { icon: <TrendingUp size={14} color={theme.primary} />, val: t('sitterEdit_currencyPrefix') + stats.totalEarnings.toLocaleString('en-IN'), label: t('sitterEdit_statEarned') },
          { icon: <Star size={14} color="#FFC107" fill="#FFC107" />, val: stats.responseRate + '%', label: t('sitterEdit_statResponse') },
          { icon: <Eye size={14} color={theme.primary} />, val: stats.profileViews, label: t('sitterEdit_statViews') },
          { icon: <Award size={14} color={theme.primary} />, val: stats.repeatClients, label: t('sitterEdit_statRepeats') },
        ].map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 14, padding: '10px 8px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{s.val}</div>
            <div style={{ fontSize: 10, color: '#AAA' }}>{s.label}</div>
          </div>
        ))}
      </div>
      {sitterProfile?.is_top_sitter && (
        <div style={{ margin: '12px 16px 0', background: 'linear-gradient(135deg,#FFF9C4,#FFF3E0)', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid #FFC107' }}>
          <span style={{ fontSize: 24 }}>⭐</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E65100' }}>{t('sitterEdit_topBadgeTitle')}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{t('sitterEdit_topBadgeDesc')}</div>
          </div>
        </div>
      )}
      <div style={{ padding: '14px 16px 0' }}>
        <div style={{ background: 'white', borderRadius: 14, padding: 4, display: 'flex', gap: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          {[{ id: 'profile', labelKey: 'sitterEdit_tabProfile' }, { id: 'services', labelKey: 'sitterEdit_tabServices' }, { id: 'availability', labelKey: 'sitterEdit_tabSchedule' }, { id: 'payout', labelKey: 'sitterEdit_tabPayout' }].map(tabItem => (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', background: tab === tabItem.id ? theme.primary : 'transparent', color: tab === tabItem.id ? 'white' : '#888', fontSize: 11, fontWeight: tab === tabItem.id ? 700 : 400, cursor: 'pointer' }}>
              {t(tabItem.labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: '14px 16px 0' }}>
        {tab === 'profile' && (
          <div>
            <div style={{ background: sitterProfile?.aadhaar_number ? '#E8F5E9' : '#FFF3E0', borderRadius: 16, padding: '12px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, border: '1px solid ' + (sitterProfile?.aadhaar_number ? '#A5D6A7' : '#FFCC80') }}>
              <span style={{ fontSize: 20 }}>{sitterProfile?.aadhaar_verified ? '✅' : sitterProfile?.aadhaar_number ? '🔄' : '🪪'}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{sitterProfile?.aadhaar_verified ? t('sitterEdit_aadhaarVerified') : sitterProfile?.aadhaar_number ? t('sitterEdit_aadhaarPending') : t('sitterEdit_aadhaarNotSubmitted')}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{sitterProfile?.aadhaar_verified ? t('sitterEdit_aadhaarVerifiedDesc') : t('sitterEdit_aadhaarRequiredDesc')}</div>
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{t('sitterEdit_portfolioLabel')}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {photos.map((photo, i) => (
                  <div key={i} style={{ position: 'relative', width: 90, height: 90 }}>
                    <img src={photo.url} alt={t('sitterEdit_photoAlt', { n: i + 1 })} style={{ width: 90, height: 90, borderRadius: 14, objectFit: 'cover' }} />
                    <div onClick={() => handlePhotoDelete(i)}
                      style={{ position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 14, background: '#D32F2F', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                      <span style={{ color: 'white', fontSize: 18, fontWeight: 'bold', lineHeight: 1 }}>×</span>
                    </div>
                  </div>
                ))}
                {photos.length < 3 && (
                  <div onClick={() => fileInputRef.current?.click()}
                    style={{ width: 90, height: 90, borderRadius: 14, background: theme.light, border: '2px dashed ' + theme.primary, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4 }}>
                    {uploadingPhoto ? <span style={{ fontSize: 12, color: theme.primary }}>...</span> : <><Camera size={20} color={theme.primary} /><span style={{ fontSize: 10, color: theme.primary, textAlign: 'center' }}>{photos.length === 0 ? t('sitterEdit_addPhotoButton') : t('sitterEdit_morePhotos')}</span></>}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#AAA', marginTop: 8 }}>{t('sitterEdit_photosUploadedCount', { count: photos.length })}</div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>{t('sitterEdit_bioLabel')}</div>
              <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={300}
                placeholder={t('sitterEdit_bioPlaceholder')}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 13, color: '#1a1a1a', outline: 'none', resize: 'none', minHeight: 100, lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' }} />
              <div style={{ fontSize: 11, color: '#CCC', textAlign: 'right', marginTop: 4 }}>{bio.length}/300</div>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{t('sitterEdit_experienceLabel')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {EXPERIENCE_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => setExperience(opt)}
                    style={{ padding: '8px 14px', borderRadius: 20, border: experience === opt ? '2px solid ' + theme.primary : '1.5px solid #E0E0E0', background: experience === opt ? theme.light : 'white', color: experience === opt ? theme.primary : '#555', fontSize: 13, fontWeight: experience === opt ? 600 : 400, cursor: 'pointer' }}>
                    {t(EXPERIENCE_KEYS[opt])}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{t('sitterEdit_languagesLabel')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {LANGUAGES.map(lang => (
                  <button key={lang} onClick={() => setLanguages(prev => prev.includes(lang) ? prev.filter(x => x !== lang) : [...prev, lang])}
                    style={{ padding: '8px 14px', borderRadius: 20, border: languages.includes(lang) ? '2px solid ' + theme.primary : '1.5px solid #E0E0E0', background: languages.includes(lang) ? theme.light : 'white', color: languages.includes(lang) ? theme.primary : '#555', fontSize: 13, fontWeight: languages.includes(lang) ? 600 : 400, cursor: 'pointer' }}>
                    {t(LANGUAGE_KEYS[lang])}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'services' && (
          <div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>{t('sitterEdit_servicesHint')}</div>
            {SERVICES.map(s => {
              const active = activeServices.includes(s.id);
              const price = prices[s.id] || Math.round((s.min + s.max) / 2);
              return (
                <div key={s.id} style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: active ? '1.5px solid ' + theme.primary : '1.5px solid transparent' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: active ? 14 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{s.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{t(s.nameKey)}</div>
                        <div style={{ fontSize: 11, color: '#888' }}>{t(s.subKey)}</div>
                      </div>
                    </div>
                    <div onClick={() => toggleService(s.id)} role="switch" aria-checked={active} aria-label={t('sitterEdit_serviceToggleLabel', { service: t(s.nameKey) })}
                      style={{ width: 44, height: 24, borderRadius: 12, background: active ? theme.primary : '#E0E0E0', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 2, left: active ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                    </div>
                  </div>
                  {active && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#888' }}>{t('sitterEdit_yourPriceLabel')}</span>
                        <span style={{ fontSize: 18, fontWeight: 800, color: theme.primary }}>{t('sitterEdit_currencyPrefix')}{price}</span>
                      </div>
                      <input type="range" min={s.min} max={s.max} step={s.step} value={price}
                        onChange={e => setPrices(prev => ({ ...prev, [s.id]: parseInt(e.target.value) }))}
                        style={{ width: '100%', accentColor: theme.primary, marginBottom: 8 }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: '#CCC' }}>{t('sitterEdit_minLabel')} {t('sitterEdit_currencyPrefix')}{s.min}</span>
                        <span style={{ fontSize: 11, color: '#CCC' }}>{t('sitterEdit_maxLabel')} {t('sitterEdit_currencyPrefix')}{s.max}</span>
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
            <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{t('sitterEdit_availableDaysLabel')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                {DAYS.map(day => {
                  const sel = availableDays.includes(day);
                  return (
                    <button key={day} onClick={() => setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                      style={{ padding: '8px 14px', borderRadius: 20, border: sel ? '2px solid ' + theme.primary : '1.5px solid #E0E0E0', background: sel ? theme.light : 'white', color: sel ? theme.primary : '#555', fontSize: 13, fontWeight: sel ? 600 : 400, cursor: 'pointer' }}>
                      {t(DAY_KEYS[day])}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[{ labelKey: 'sitterEdit_weekdays', days: ['Mon','Tue','Wed','Thu','Fri'] }, { labelKey: 'sitterEdit_weekends', days: ['Sat','Sun'] }, { labelKey: 'sitterEdit_allDays', days: DAYS }].map(p => (
                  <button key={p.labelKey} onClick={() => setAvailableDays(p.days)}
                    style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid #E0E0E0', background: 'white', color: '#888', fontSize: 11, cursor: 'pointer' }}>
                    {t(p.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{t('sitterEdit_timeSlotsLabel')}</div>
              {[
                { labelKey: 'sitterEdit_morning', subKey: 'sitterEdit_morningHours', val: morningSlot, set: setMorningSlot },
                { labelKey: 'sitterEdit_afternoon', subKey: 'sitterEdit_afternoonHours', val: afternoonSlot, set: setAfternoonSlot },
                { labelKey: 'sitterEdit_evening', subKey: 'sitterEdit_eveningHours', val: eveningSlot, set: setEveningSlot },
              ].map((slot, i, arr) => (
                <div key={slot.labelKey} onClick={() => slot.set(!slot.val)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid #F5F5F5' : 'none', cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{t(slot.labelKey)}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{t(slot.subKey)}</div>
                  </div>
                  <div style={{ width: 44, height: 24, borderRadius: 12, background: slot.val ? theme.primary : '#E0E0E0', position: 'relative', cursor: 'pointer', transition: 'background 0.2s' }}>
                    <div style={{ position: 'absolute', top: 2, left: slot.val ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{t('sitterEdit_maxDogsLabel')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3,4].map(n => (
                  <button key={n} onClick={() => setMaxDogs(n)}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: maxDogs === n ? '2px solid ' + theme.primary : '1.5px solid #E0E0E0', background: maxDogs === n ? theme.light : 'white', color: maxDogs === n ? theme.primary : '#555', fontSize: 16, fontWeight: maxDogs === n ? 700 : 400, cursor: 'pointer' }}>
                    {n}{n === 4 ? '+' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>{t('sitterEdit_advanceNoticeLabel')}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ADVANCE_NOTICE_OPTIONS.map(n => (
                  <button key={n} onClick={() => setAdvanceNotice(n)}
                    style={{ padding: '8px 14px', borderRadius: 20, border: advanceNotice === n ? '2px solid ' + theme.primary : '1.5px solid #E0E0E0', background: advanceNotice === n ? theme.light : 'white', color: advanceNotice === n ? theme.primary : '#555', fontSize: 12, fontWeight: advanceNotice === n ? 600 : 400, cursor: 'pointer' }}>
                    {t(ADVANCE_NOTICE_KEYS[n])}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'payout' && (
          <div>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>{t('sitterEdit_upiLabel')}</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>{t('sitterEdit_upiHint')}</div>
              <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder={t('sitterEdit_upiPlaceholder')}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 15, color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
              {upiId && upiId.includes('@') && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} color="#2E7D32" /><span style={{ fontSize: 12, color: '#2E7D32' }}>{t('sitterEdit_upiValid')}</span></div>}
              {upiId && !upiId.includes('@') && <div style={{ marginTop: 8, fontSize: 12, color: '#E65100' }}>{t('sitterEdit_upiInvalid')}</div>}
            </div>
            <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>{t('sitterEdit_earningsSummaryLabel')}</div>
              {[
                { labelKey: 'sitterEdit_totalEarnedLabel', val: t('sitterEdit_currencyPrefix') + stats.totalEarnings.toLocaleString('en-IN') },
                { labelKey: 'sitterEdit_totalBookingsLabel', val: stats.totalBookings },
                { labelKey: 'sitterEdit_repeatClientsLabel', val: stats.repeatClients },
                { labelKey: 'sitterEdit_responseRateLabel', val: stats.responseRate + '%' },
              ].map((row, i, arr) => (
                <div key={row.labelKey} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < arr.length - 1 ? '1px solid #F5F5F5' : 'none' }}>
                  <span style={{ fontSize: 13, color: '#888' }}>{t(row.labelKey)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{row.val}</span>
                </div>
              ))}
            </div>
            <div style={{ background: theme.light, borderRadius: 16, padding: 14, border: '1px solid ' + theme.primary }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.primary, marginBottom: 4 }}>{t('sitterEdit_payoutInfoTitle')}</div>
              <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>{t('sitterEdit_payoutInfoBody')}</div>
            </div>
          </div>
        )}
      </div>
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, background: 'white', borderTop: '1px solid #F0F0F0', padding: '12px 20px 24px' }}>
        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: saved ? '#2E7D32' : theme.primary, color: 'white', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? t('common_saving') : saved ? t('sitterEdit_changesSaved') : t('sitterEdit_saveChangesButton')}
        </button>
      </div>
    </div>
  );
}
