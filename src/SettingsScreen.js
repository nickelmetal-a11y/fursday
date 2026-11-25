import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { ChevronRight, LogOut, Save, ShieldCheck, Lock, Eye, Star } from 'lucide-react';
import { useLanguage } from './i18n';
import HelpScreen from './HelpScreen';
import SosSheet from './SosSheet';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB' },
  Pune:    { primary: '#6C5CE7', light: '#F0EEFF' },
};

const SITTER_STATUS = {
  active: { key: 'settings_statusActive', bg: '#E8F5E9', fg: '#2E7D32' },
  pending: { key: 'settings_statusPending', bg: '#FFF3E0', fg: '#E65100' },
  needs_changes: { key: 'settings_statusNeedsChanges', bg: '#FFF3E0', fg: '#E65100' },
  draft: { key: 'settings_statusDraft', bg: '#ECEFF1', fg: '#546E7A' },
  suspended: { key: 'settings_statusSuspended', bg: '#FCEBEB', fg: '#A32D2D' },
  rejected: { key: 'settings_statusRejected', bg: '#FCEBEB', fg: '#A32D2D' },
};

// Only the last 3 digits are ever shown, even to the account owner.
export const maskAadhaar = (n) => (n ? 'XXXX XXXX X' + String(n).replace(/\D/g, '').slice(-3) : null);
export const maskUpi = (u) => {
  if (!u || !u.includes('@')) return u || null;
  const [name, bank] = u.split('@');
  return name.slice(0, 2) + '•••@' + bank;
};
// "3 months", "1 year 2 months", "12 days" in the viewer's language.
export const durationSince = (iso, hi) => {
  if (!iso) return null;
  const start = new Date(iso), now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) {
    const days = Math.max(0, Math.floor((now - start) / 86400000));
    return hi ? days + ' दिन' : days + (days === 1 ? ' day' : ' days');
  }
  const y = Math.floor(months / 12), m = months % 12;
  const part = (v, en1, enN, h) => (hi ? v + ' ' + h : v + ' ' + (v === 1 ? en1 : enN));
  return [y ? part(y, 'year', 'years', 'साल') : null, m ? part(m, 'month', 'months', 'महीने') : null].filter(Boolean).join(' ');
};
const publicName = (full) => {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';
  return parts[0] + ' ' + parts[parts.length - 1][0] + '.';
};

export default function SettingsScreen({ onBack, city, userName, onNav, activeNav }) {
  const { t: tr, lang } = useLanguage();
  const hi = lang === 'hi';
  const locale = hi ? 'hi-IN' : 'en-IN';
  const theme = THEMES[city] || THEMES.Gurgaon;

  const [user, setUser] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userNameEdit, setUserNameEdit] = useState('');
  const [joinedAt, setJoinedAt] = useState(null);
  const [stats, setStats] = useState({ pets: [], completed: 0, upcoming: 0 });
  const [sitter, setSitter] = useState(null);
  const [pii, setPii] = useState(null);
  const [deletion, setDeletion] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileView, setProfileView] = useState('private');
  const [editingProfile, setEditingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [screen, setScreen] = useState(null); // 'help' | 'terms' | 'privacy'
  const [showSos, setShowSos] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [deleteStep, setDeleteStep] = useState(null); // null | 'confirm'
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteMsg, setDeleteMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        setUser(user);
        setUserEmail(user?.email || '');
        setUserNameEdit(userName || '');
        if (user) {
          const { data: row } = await supabase.from('users').select('created_at').eq('id', user.id).single();
          setJoinedAt(row?.created_at || null);
          const { data: contact } = await supabase.rpc('get_user_contact', { target_id: user.id });
          setUserPhone(contact?.[0]?.phone || '');

          const { data: bookings } = await supabase.from('bookings').select('id, status').eq('pet_parent_id', user.id);
          const { data: pets } = await supabase.from('pet_profiles').select('name').eq('user_id', user.id);
          setStats({
            pets: (pets || []).map(p => p.name),
            completed: (bookings || []).filter(b => b.status === 'completed').length,
            upcoming: (bookings || []).filter(b => ['pending', 'confirmed', 'active'].includes(b.status)).length,
          });

          const { data: sp } = await supabase.from('sitter_profiles').select('*').eq('user_id', user.id).maybeSingle();
          if (sp) {
            const { data: jobs } = await supabase.from('bookings').select('id').eq('sitter_id', sp.id).eq('status', 'completed');
            setSitter({ ...sp, completedJobs: (jobs || []).length });
            const { data: piiRow } = await supabase.from('sitter_pii').select('aadhaar_number, upi_id').eq('sitter_id', sp.id).maybeSingle();
            setPii(piiRow || null);
          }

          const { data: prefs } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).single();
          if (prefs) {
            setNotificationsEnabled(prefs.push_enabled);
            setEmailNotifications(prefs.email_enabled);
            setSmsNotifications(prefs.sms_enabled);
          }

          const { data: del } = await supabase.from('account_deletion_requests').select('id, requested_at, status').eq('user_id', user.id).eq('status', 'requested').maybeSingle();
          setDeletion(del || null);
        }
      } catch (e) {
        // A thrown failure (e.g. a network blip) must not leave the screen stuck on "Loading".
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userName, reloadKey]);

  const validatePhone = (phone) => !phone || /^(\+?91[-\s]?)?[6-9]\d{9}$/.test(phone.replace(/[\s-]/g, ''));

  const handleSaveProfile = async () => {
    const newErrors = {};
    if (userNameEdit.trim().length < 2 || userNameEdit.trim().length > 50) newErrors.name = tr('settings_errName');
    if (userPhone && !validatePhone(userPhone)) newErrors.phone = tr('settings_errPhone');
    setErrors(newErrors);
    if (Object.keys(newErrors).length || !user) return;
    const { error } = await supabase.from('users').update({ name: userNameEdit.trim(), phone: userPhone.trim() || null }).eq('id', user.id);
    if (error) { setErrors({ save: tr('settings_errSave') + error.message }); return; }
    setSaveSuccess(true);
    setEditingProfile(false);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const saveNotificationPrefs = async (overrides = {}) => {
    if (!user) return;
    const prefs = { user_id: user.id, push_enabled: notificationsEnabled, email_enabled: emailNotifications, sms_enabled: smsNotifications, ...overrides };
    const { error } = await supabase.from('notification_preferences').upsert(prefs, { onConflict: 'user_id' });
    if (error) console.error('Could not save notification preferences:', error.message);
  };

  const handleSignOut = async () => {
    if (window.confirm(tr('settings_signOutConfirm'))) {
      await supabase.auth.signOut();
      window.location.href = '/';
    }
  };

  const requestDeletion = async () => {
    const { data, error } = await supabase.from('account_deletion_requests')
      .insert({ user_id: user.id, reason: deleteReason.trim() || null }).select().single();
    if (error) { setDeleteMsg(tr('settings_deleteFailed')); return; }
    setDeletion(data);
    setDeleteStep(null);
    setDeleteMsg('');
  };

  const cancelDeletion = async () => {
    const { error } = await supabase.from('account_deletion_requests').update({ status: 'cancelled' }).eq('id', deletion.id);
    if (!error) setDeletion(null);
  };

  if (screen === 'help') return <HelpScreen onBack={() => setScreen(null)} city={city} isSitter={!!sitter} />;
  if (screen === 'terms') { const T = require('./TermsAndConditions').default; return <T onBack={() => setScreen(null)} city={city} />; }
  if (screen === 'privacy') { const P = require('./PrivacyPolicy').default; return <P onBack={() => setScreen(null)} city={city} />; }

  const page = { maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#F5F5F5' };
  if (loading) return (
    <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div><div style={{ color: '#888', fontSize: 13 }}>{tr('settings_loading')}</div></div>
    </div>
  );
  if (loadError) return (
    <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: '0 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ color: '#666', fontSize: 13 }}>{tr('common_error')}</div>
      <button onClick={() => setReloadKey(k => k + 1)} style={{ background: theme.primary, color: 'white', border: 'none', padding: '12px 20px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{tr('common_retry')}</button>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#999', fontSize: 13, cursor: 'pointer', minHeight: 44 }}>{tr('common_back')}</button>
    </div>
  );

  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : null);
  const monthYear = (iso) => (iso ? new Date(iso).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) : null);
  const status = sitter ? (SITTER_STATUS[sitter.status] || SITTER_STATUS.pending) : null;
  const approvedAt = sitter?.approved_at || (sitter?.status === 'active' ? sitter?.updated_at || sitter?.created_at : null);
  const rating = Number(sitter?.avg_rating || sitter?.rating || 0);

  const missing = [
    !userPhone && tr('settings_missingPhone'),
    !sitter && stats.pets.length === 0 && tr('settings_missingPet'),
    sitter && !sitter.profile_photo_url && tr('settings_missingPhoto'),
    sitter && !pii?.aadhaar_number && tr('settings_missingAadhaar'),
    sitter && !pii?.upi_id && tr('settings_missingUpi'),
  ].filter(Boolean);
  const totalChecks = sitter ? 4 : 2;
  const completeness = Math.round(((totalChecks - missing.length) / totalChecks) * 100);

  const card = { background: 'white', borderRadius: 14, overflow: 'hidden', marginBottom: 12, border: '0.5px solid #E8E8E8' };
  const sectionLabel = { fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' };
  const Field = ({ label, value, pill }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: '0.5px solid #F2F2F2' }}>
      <div style={{ fontSize: 12, color: '#888', flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 600, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>
        {value}{pill && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: pill.bg, color: pill.fg, whiteSpace: 'nowrap' }}>{pill.text}</span>}
      </div>
    </div>
  );
  const Row = ({ icon, label, onClick, danger, sos }) => (
    <button onClick={onClick}
      style={{ width: '100%', minHeight: 52, padding: '14px 16px', background: sos ? '#FFEBEE' : 'none', border: 'none', borderBottom: '0.5px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 14, fontWeight: sos ? 700 : 600, color: sos || danger ? '#C62828' : '#1a1a1a', textAlign: 'left' }}>
      <span>{icon} {label}</span><ChevronRight size={16} color={sos || danger ? '#C62828' : '#888'} />
    </button>
  );
  const Toggle = ({ label, sub, checked, onChange }) => (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, cursor: 'pointer' }}>
      <span><span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>{label}</span><span style={{ fontSize: 11, color: '#888' }}>{sub}</span></span>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 22, height: 22, cursor: 'pointer', accentColor: theme.primary }} />
    </label>
  );

  return (
    <div style={{ ...page, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', paddingBottom: 20 }}>
      {showSos && <SosSheet onClose={() => setShowSos(false)} userName={userNameEdit} />}

      <div style={{ background: 'white', padding: 'calc(12px + env(safe-area-inset-top)) 16px 12px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '0.5px solid #E8E8E8', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={onBack} aria-label={tr('common_back')} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', width: 44, height: 44 }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>{tr('settings_title')}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{tr('settings_subtitle')}</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {saveSuccess && <div role="status" style={{ background: '#E8F5E9', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 13, color: '#2E7D32', fontWeight: 600 }}>✅ {tr('settings_saved')}</div>}

        {/* Profile */}
        <div style={card}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ ...sectionLabel, marginBottom: 0 }}>{tr('settings_profile')}</div>
              <div role="tablist" style={{ display: 'flex', background: '#F2F2F2', borderRadius: 10, padding: 3 }}>
                {[['private', Lock, 'settings_private'], ['public', Eye, 'settings_public']].map(([id, Icon, key]) => (
                  <button key={id} role="tab" aria-selected={profileView === id} onClick={() => { setProfileView(id); setEditingProfile(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 34, padding: '0 10px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: profileView === id ? 'white' : 'transparent', color: profileView === id ? theme.primary : '#777', boxShadow: profileView === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                    <Icon size={12} />{tr(key)}
                  </button>
                ))}
              </div>
            </div>

            {profileView === 'private' && !editingProfile && (
              <>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>{tr('settings_privateNote')}</div>
                <Field label={tr('settings_fullName')} value={userNameEdit || tr('settings_notSet')} />
                <Field label={tr('settings_email')} value={userEmail} />
                <Field label={tr('settings_phone')} value={userPhone || tr('settings_notAdded')} pill={userPhone ? { text: tr('settings_notVerified'), bg: '#FFF3E0', fg: '#E65100' } : null} />
                <Field label={tr('settings_memberSince')} value={fmtDate(joinedAt) ? fmtDate(joinedAt) + ' · ' + tr('settings_forDuration', { d: durationSince(joinedAt, hi) }) : '—'} />
                {sitter ? (
                  <>
                    <Field label={tr('settings_sitterStatus')} value={<span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, background: status.bg, color: status.fg }}>{tr(status.key)}</span>} />
                    {sitter.status === 'active' && approvedAt && <Field label={tr('settings_approvedOn')} value={fmtDate(approvedAt) + ' · ' + tr('settings_forDuration', { d: durationSince(approvedAt, hi) })} />}
                    {sitter.status === 'needs_changes' && sitter.review_notes && <Field label={tr('settings_toFix')} value={sitter.review_notes} />}
                    <Field label={tr('settings_aadhaar')} value={maskAadhaar(pii?.aadhaar_number) || tr('settings_notAdded')}
                      pill={pii?.aadhaar_number ? (sitter.aadhaar_verified ? { text: tr('settings_verified') + (sitter.aadhaar_verified_at ? ' · ' + fmtDate(sitter.aadhaar_verified_at) : ''), bg: '#E8F5E9', fg: '#2E7D32' } : { text: tr('settings_inReview'), bg: '#FFF3E0', fg: '#E65100' }) : null} />
                    <Field label={tr('settings_upi')} value={maskUpi(pii?.upi_id) || tr('settings_notAdded')} />
                    <Field label={tr('settings_commission')} value={sitter.is_founding_sitter ? tr('settings_commissionFounding') : tr('settings_commissionStandard')} />
                    <Field label={tr('settings_jobsDone')} value={String(sitter.completedJobs)} />
                    <Field label={tr('settings_rating')} value={rating ? '★ ' + rating.toFixed(1) + ' · ' + tr('settings_reviewsCount', { n: sitter.review_count || 0 }) : tr('settings_noReviews')} />
                    {sitter.languages?.length > 0 && <Field label={tr('settings_languages')} value={sitter.languages.join(', ')} />}
                  </>
                ) : (
                  <>
                    <Field label={tr('settings_pets')} value={stats.pets.length ? stats.pets.join(', ') : tr('settings_noPets')} />
                    <Field label={tr('settings_bookingsDone')} value={String(stats.completed)} />
                    <Field label={tr('settings_bookingsUpcoming')} value={String(stats.upcoming)} />
                  </>
                )}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>
                    <span>{tr('settings_completeness')}</span><span>{completeness}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: '#F0F0F0' }}><div style={{ width: completeness + '%', height: 6, borderRadius: 3, background: completeness === 100 ? '#2E7D32' : theme.primary }} /></div>
                  {missing.length > 0 && <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>{tr('settings_stillMissing')} {missing.join(', ')}</div>}
                </div>
              </>
            )}

            {profileView === 'private' && editingProfile && (
              <>
                <label htmlFor="settings-name" style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6, fontWeight: 600 }}>{tr('settings_fullName')}</label>
                <input id="settings-name" type="text" value={userNameEdit} maxLength={50}
                  onChange={e => { setUserNameEdit(e.target.value); setErrors(er => ({ ...er, name: undefined })); }}
                  style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid ' + (errors.name ? '#E53935' : '#DDD'), fontSize: 15, boxSizing: 'border-box', marginBottom: 4 }} />
                {errors.name && <div style={{ fontSize: 11, color: '#E53935', marginBottom: 8 }}>{errors.name}</div>}
                <label htmlFor="settings-phone" style={{ fontSize: 12, color: '#666', display: 'block', margin: '10px 0 6px', fontWeight: 600 }}>{tr('settings_phone')}</label>
                <input id="settings-phone" type="tel" value={userPhone} placeholder="98765 43210"
                  onChange={e => { setUserPhone(e.target.value); setErrors(er => ({ ...er, phone: undefined })); }}
                  style={{ width: '100%', padding: 12, borderRadius: 10, border: '1px solid ' + (errors.phone ? '#E53935' : '#DDD'), fontSize: 15, boxSizing: 'border-box', marginBottom: 4 }} />
                {errors.phone && <div style={{ fontSize: 11, color: '#E53935' }}>{errors.phone}</div>}
                {errors.save && <div role="alert" style={{ fontSize: 12, color: '#A32D2D', marginTop: 8 }}>{errors.save}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={handleSaveProfile} style={{ flex: 1, minHeight: 44, background: theme.primary, color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Save size={14} /> {tr('common_save')}</button>
                  <button onClick={() => { setEditingProfile(false); setUserNameEdit(userName || ''); setErrors({}); }} style={{ flex: 1, minHeight: 44, background: '#F5F5F5', color: '#666', border: '1px solid #DDD', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>{tr('common_cancel')}</button>
                </div>
              </>
            )}

            {profileView === 'public' && (
              <>
                <div style={{ fontSize: 11, color: '#999', marginBottom: 10 }}>{sitter ? tr('settings_publicNoteSitter') : tr('settings_publicNoteParent')}</div>
                <div style={{ border: '1px solid #EEE', borderRadius: 14, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {sitter?.profile_photo_url
                    ? <img src={sitter.profile_photo_url} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 56, height: 56, borderRadius: 14, background: theme.light, color: theme.primary, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(userNameEdit || '?')[0]}</div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>{publicName(userNameEdit) || tr('settings_notSet')}</div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{city} · {tr('settings_onFursdaySince', { date: monthYear(joinedAt) || '—' })}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {sitter?.aadhaar_verified && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#2E7D32', background: '#E8F5E9', borderRadius: 10, padding: '3px 8px' }}><ShieldCheck size={12} />{tr('settings_badgeVerified')}</span>}
                      {sitter?.is_founding_sitter && <span style={{ fontSize: 11, fontWeight: 700, color: theme.primary, background: theme.light, borderRadius: 10, padding: '3px 8px' }}>{tr('settings_badgeFounding')}</span>}
                      {sitter?.is_top_sitter && <span style={{ fontSize: 11, fontWeight: 700, color: '#6A1B9A', background: '#F3E5F5', borderRadius: 10, padding: '3px 8px' }}>{tr('settings_badgeTop')}</span>}
                      {sitter && rating > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: '#8D6E00', background: '#FFF8E1', borderRadius: 10, padding: '3px 8px' }}><Star size={11} fill="#FFC107" color="#FFC107" />{rating.toFixed(1)} ({sitter.review_count || 0})</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
                      {sitter
                        ? tr('settings_publicJobs', { n: sitter.completedJobs }) + (sitter.languages?.length ? ' · ' + sitter.languages.join(', ') : '')
                        : tr('settings_publicBookings', { n: stats.completed }) + (stats.pets.length ? ' · ' + tr('settings_publicPets', { pets: stats.pets.join(', ') }) : '')}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 10, lineHeight: 1.5 }}>🔒 {tr('settings_contactShared')}</div>
              </>
            )}
          </div>
          {profileView === 'private' && !editingProfile && (
            <button onClick={() => setEditingProfile(true)}
              style={{ width: '100%', minHeight: 48, background: 'white', border: 'none', borderTop: '0.5px solid #F0F0F0', color: theme.primary, fontWeight: 600, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
              {tr('settings_editProfile')}<ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Notifications */}
        <div style={{ ...card, padding: 16 }}>
          <div style={sectionLabel}>{tr('settings_notifications')}</div>
          <Toggle label={tr('settings_push')} sub={tr('settings_pushSub')} checked={notificationsEnabled} onChange={e => { setNotificationsEnabled(e.target.checked); saveNotificationPrefs({ push_enabled: e.target.checked }); }} />
          <Toggle label={tr('settings_emailNotif')} sub={tr('settings_emailNotifSub')} checked={emailNotifications} onChange={e => { setEmailNotifications(e.target.checked); saveNotificationPrefs({ email_enabled: e.target.checked }); }} />
          <Toggle label={tr('settings_sms')} sub={tr('settings_smsSub')} checked={smsNotifications} onChange={e => { setSmsNotifications(e.target.checked); saveNotificationPrefs({ sms_enabled: e.target.checked }); }} />
        </div>

        {/* Language */}
        <div style={{ ...card, padding: 16 }}>
          <div style={sectionLabel}>{tr('settings_preferences')}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 2 }}>{tr('settings_language')}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{tr('settings_languageNote')}</div>
        </div>

        {/* Help & safety */}
        <div style={card}>
          <Row icon="🆘" label={tr('settings_sos')} onClick={() => setShowSos(true)} sos />
          <Row icon="📖" label={tr('settings_help')} onClick={() => setScreen('help')} />
          <Row icon="📋" label={tr('settings_terms')} onClick={() => setScreen('terms')} />
          <Row icon="🔒" label={tr('settings_privacy')} onClick={() => setScreen('privacy')} />
          <Row icon="ℹ️" label={tr('settings_about')} onClick={() => setShowAbout(a => !a)} />
          {showAbout && <div style={{ padding: '0 16px 16px', fontSize: 12, color: '#666', lineHeight: 1.6 }}>{tr('settings_aboutText')}</div>}
        </div>

        {/* Account */}
        <div style={card}>
          <button onClick={handleSignOut}
            style={{ width: '100%', minHeight: 52, padding: '0 16px', background: 'none', border: 'none', borderBottom: '0.5px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#E53935' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LogOut size={16} />{tr('settings_signOut')}</span><ChevronRight size={16} />
          </button>
          {deletion ? (
            <div style={{ padding: 16, background: '#FFF8E1' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8D6E00' }}>{tr('settings_deletePending', { date: fmtDate(deletion.requested_at) })}</div>
              <div style={{ fontSize: 12, color: '#8D6E00', marginTop: 4 }}>{tr('settings_deletePendingSub')}</div>
              <button onClick={cancelDeletion} style={{ marginTop: 10, minHeight: 40, padding: '0 14px', borderRadius: 10, border: '1px solid #D7B600', background: 'white', color: '#8D6E00', fontWeight: 600, cursor: 'pointer' }}>{tr('settings_deleteCancel')}</button>
            </div>
          ) : deleteStep === 'confirm' ? (
            <div style={{ padding: 16, background: '#FFF5F5' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#A32D2D', marginBottom: 6 }}>{tr('settings_deleteConfirmTitle')}</div>
              <div style={{ fontSize: 12, color: '#7A2E2E', lineHeight: 1.6, marginBottom: 10 }}>{tr('settings_deleteConfirmBody')}</div>
              <label htmlFor="delete-reason" style={{ fontSize: 12, color: '#666' }}>{tr('settings_deleteReason')}</label>
              <textarea id="delete-reason" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={2}
                style={{ width: '100%', marginTop: 4, padding: 10, borderRadius: 10, border: '1px solid #E0C0C0', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' }} />
              {deleteMsg && <div role="alert" style={{ fontSize: 12, color: '#A32D2D', marginTop: 6 }}>{deleteMsg}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={requestDeletion} style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 'none', background: '#C62828', color: 'white', fontWeight: 700, cursor: 'pointer' }}>{tr('settings_deleteConfirmBtn')}</button>
                <button onClick={() => { setDeleteStep(null); setDeleteMsg(''); }} style={{ flex: 1, minHeight: 44, borderRadius: 10, border: '1px solid #DDD', background: 'white', color: '#555', fontWeight: 600, cursor: 'pointer' }}>{tr('common_cancel')}</button>
              </div>
            </div>
          ) : (
            <Row icon="🗑️" label={tr('settings_deleteAccount')} onClick={() => setDeleteStep('confirm')} danger />
          )}
          <div style={{ padding: '12px 16px', background: '#FAFAFA' }}>
            <div style={{ fontSize: 11, color: '#888' }}>{tr('settings_signedInAs', { email: userEmail })}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, paddingBottom: 70 }}>
          <div style={{ fontSize: 11, color: '#999' }}>Fursday v1.0.0</div>
          <div style={{ fontSize: 10, color: '#BBB', marginTop: 4 }}>© 2026 Fursday</div>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, maxWidth: '100%', background: 'white', borderTop: '1px solid #F0F0F0', display: 'flex', justifyContent: 'space-around', padding: '10px 0 calc(16px + env(safe-area-inset-bottom))', zIndex: 100 }}>
        {[
          { id: 'home', key: 'nav_home', emoji: '🏠' },
          { id: 'book', key: 'nav_bookings', emoji: '📋' },
          { id: 'explore', key: 'nav_explore', emoji: '🔍' },
          { id: 'profile', key: 'nav_myPets', emoji: '🐕' },
          { id: 'settings', key: 'nav_settings', emoji: '⚙️' },
        ].map(n => (
          <button key={n.id} onClick={() => { if (n.id === 'settings') return; if (onNav) onNav(n.id); else onBack(); }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', background: 'none', border: 'none', minWidth: 56, minHeight: 44 }}>
            <span style={{ fontSize: 20 }}>{n.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: n.id === 'settings' ? 700 : 400, color: n.id === 'settings' ? theme.primary : '#999' }}>{tr(n.key)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
