import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import HelpScreen from './HelpScreen';
import SosSheet from './SosSheet';
import ReferralScreen from './ReferralScreen';
import { color, font, radius, shadow, ui, navPadding } from './theme';
import Icon from './ui/Icon';

const SITTER_STATUS = {
  active: { key: 'settings_statusActive', tone: 'success' },
  pending: { key: 'settings_statusPending', tone: 'warning' },
  needs_changes: { key: 'settings_statusNeedsChanges', tone: 'warning' },
  draft: { key: 'settings_statusDraft', tone: null },
  suspended: { key: 'settings_statusSuspended', tone: 'danger' },
  rejected: { key: 'settings_statusRejected', tone: 'danger' },
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

export default function SettingsScreen({ onBack, city, userName, onNav, activeNav, onSwitchRole, switchRoleLabel }) {
  const { t: tr, lang } = useLanguage();
  const hi = lang === 'hi';
  const locale = hi ? 'hi-IN' : 'en-IN';

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

  if (screen === 'refer') return <ReferralScreen onBack={() => setScreen(null)} />;
  if (screen === 'help') return <HelpScreen onBack={() => setScreen(null)} city={city} isSitter={!!sitter} />;
  if (screen === 'terms') { const T = require('./TermsAndConditions').default; return <T onBack={() => setScreen(null)} city={city} />; }
  if (screen === 'privacy') { const P = require('./PrivacyPolicy').default; return <P onBack={() => setScreen(null)} city={city} />; }

  const header = (withSub) => (
    <div style={ui.header}>
      <button onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}><Icon name="arrowLeft" size={20} /></button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={ui.headerTitle}>{tr('settings_title')}</h1>
        {withSub && <div style={{ fontSize: font.sm, color: color.muted }}>{tr('settings_subtitle')}</div>}
      </div>
    </div>
  );
  if (loading) return (
    <div role="status" aria-label={tr('settings_loading')} style={{ ...ui.page, paddingBottom: navPadding }}>
      {header(false)}
      <div style={{ padding: 16 }}>
        {[260, 150, 72, 220].map((h, i) => <div key={i} style={{ height: h, borderRadius: radius.lg, background: color.tile, marginBottom: 12 }} />)}
      </div>
    </div>
  );
  if (loadError) return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {header(false)}
      <div style={{ padding: 16 }}>
        <div style={{ ...ui.card, textAlign: 'center', padding: 28 }}>
          <div style={{ ...ui.iconTile, margin: '0 auto 12px', background: color.dangerSoft, color: color.danger }}><Icon name="alert" /></div>
          <div style={{ color: color.text, fontSize: font.md, marginBottom: 16 }}>{tr('common_error')}</div>
          <button onClick={() => setReloadKey(k => k + 1)} style={{ ...ui.primaryButton, width: '100%' }}>{tr('common_retry')}</button>
          <button onClick={onBack} style={{ ...ui.secondaryButton, width: '100%', marginTop: 8 }}>{tr('common_back')}</button>
        </div>
      </div>
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

  const card = { background: color.surface, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 16, border: `1px solid ${color.line}` };
  const sectionLabel = { fontSize: font.xs, fontWeight: 600, color: color.muted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.6 };
  const neutralBadge = { ...ui.badge(), background: color.tile, color: color.muted };
  const toneBadge = (tone) => (tone ? ui.badge(tone) : neutralBadge);
  const Field = ({ label, value, pill }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '11px 0', borderBottom: `1px solid ${color.line}` }}>
      <div style={{ fontSize: 13, color: color.muted, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: font.md, color: color.ink, fontWeight: 600, textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}>
        {value}{pill && <span style={{ ...toneBadge(pill.tone), marginLeft: 6, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{pill.text}</span>}
      </div>
    </div>
  );
  const Row = ({ icon, label, onClick, danger, sos }) => {
    const tone = sos || danger ? 'danger' : null;
    return (
      <button onClick={onClick}
        style={{ width: '100%', minHeight: 56, padding: '10px 16px', background: 'none', border: 'none', borderBottom: `1px solid ${color.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', fontSize: font.md, fontWeight: 600, fontFamily: font.family, color: tone ? color.danger : color.ink, textAlign: 'left' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ ...ui.iconTile, width: 36, height: 36, borderRadius: radius.sm, ...(tone ? { background: color.dangerSoft, color: color.danger } : null) }}><Icon name={icon} size={19} /></span>
          <span>{label}</span>
        </span>
        <Icon name="chevronRight" size={18} color={tone ? color.danger : color.faint} />
      </button>
    );
  };
  const Toggle = ({ label, sub, checked, onChange }) => (
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 56, padding: '6px 0', cursor: 'pointer', position: 'relative' }}>
      <span><span style={{ display: 'block', fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 2 }}>{label}</span><span style={{ fontSize: font.sm, color: color.muted }}>{sub}</span></span>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ position: 'absolute', opacity: 0, width: 1, height: 1, margin: 0 }} />
      <span aria-hidden="true" style={{ width: 44, height: 26, borderRadius: radius.pill, background: checked ? color.navy : color.line, position: 'relative', flexShrink: 0, transition: 'background 0.15s' }}>
        <span style={{ position: 'absolute', top: 3, left: checked ? 21 : 3, width: 20, height: 20, borderRadius: radius.pill, background: color.surface, boxShadow: shadow.card, transition: 'left 0.15s' }} />
      </span>
    </label>
  );

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {showSos && <SosSheet onClose={() => setShowSos(false)} userName={userNameEdit} />}

      {header(true)}

      <div style={{ padding: 16 }}>
        {saveSuccess && <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, background: color.successSoft, borderRadius: radius.md, padding: 12, marginBottom: 12, fontSize: 13, color: color.success, fontWeight: 600 }}><Icon name="check" size={16} strokeWidth={2.25} />{tr('settings_saved')}</div>}

        {/* Profile */}
        <div style={card}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ ...sectionLabel, marginBottom: 0 }}>{tr('settings_profile')}</div>
              <div role="tablist" style={{ display: 'flex', background: color.tile, borderRadius: radius.md, padding: 3 }}>
                {[['private', 'lock', 'settings_private'], ['public', 'eye', 'settings_public']].map(([id, icon, key]) => (
                  <button key={id} role="tab" aria-selected={profileView === id} onClick={() => { setProfileView(id); setEditingProfile(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, minHeight: 34, padding: '0 12px', borderRadius: radius.sm, border: 'none', fontSize: font.sm, fontWeight: 600, fontFamily: font.family, cursor: 'pointer', background: profileView === id ? color.surface : 'transparent', color: profileView === id ? color.navy : color.muted, boxShadow: profileView === id ? shadow.card : 'none' }}>
                    <Icon name={icon} size={14} />{tr(key)}
                  </button>
                ))}
              </div>
            </div>

            {profileView === 'private' && !editingProfile && (
              <>
                <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 4 }}>{tr('settings_privateNote')}</div>
                <Field label={tr('settings_fullName')} value={userNameEdit || tr('settings_notSet')} />
                <Field label={tr('settings_email')} value={userEmail} />
                <Field label={tr('settings_phone')} value={userPhone || tr('settings_notAdded')} pill={userPhone ? { text: tr('settings_notVerified'), tone: 'warning' } : null} />
                <Field label={tr('settings_memberSince')} value={fmtDate(joinedAt) ? fmtDate(joinedAt) + ' · ' + tr('settings_forDuration', { d: durationSince(joinedAt, hi) }) : '—'} />
                {sitter ? (
                  <>
                    <Field label={tr('settings_sitterStatus')} value={<span style={toneBadge(status.tone)}>{tr(status.key)}</span>} />
                    {sitter.status === 'active' && approvedAt && <Field label={tr('settings_approvedOn')} value={fmtDate(approvedAt) + ' · ' + tr('settings_forDuration', { d: durationSince(approvedAt, hi) })} />}
                    {sitter.status === 'needs_changes' && sitter.review_notes && <Field label={tr('settings_toFix')} value={sitter.review_notes} />}
                    <Field label={tr('settings_aadhaar')} value={maskAadhaar(pii?.aadhaar_number) || tr('settings_notAdded')}
                      pill={pii?.aadhaar_number ? (sitter.aadhaar_verified ? { text: tr('settings_verified') + (sitter.aadhaar_verified_at ? ' · ' + fmtDate(sitter.aadhaar_verified_at) : ''), tone: 'success' } : { text: tr('settings_inReview'), tone: 'warning' }) : null} />
                    <Field label={tr('settings_upi')} value={maskUpi(pii?.upi_id) || tr('settings_notAdded')} />
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
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: font.sm, fontWeight: 600, color: color.text, marginBottom: 6 }}>
                    <span>{tr('settings_completeness')}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{completeness}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: color.tile, overflow: 'hidden' }}><div style={{ width: completeness + '%', height: 6, borderRadius: 3, background: completeness === 100 ? color.success : color.saffron }} /></div>
                  {missing.length > 0 && <div style={{ fontSize: font.sm, color: color.muted, marginTop: 6 }}>{tr('settings_stillMissing')} {missing.join(', ')}</div>}
                </div>
              </>
            )}

            {profileView === 'private' && editingProfile && (
              <>
                <label htmlFor="settings-name" style={ui.label}>{tr('settings_fullName')}</label>
                <input id="settings-name" type="text" value={userNameEdit} maxLength={50}
                  onChange={e => { setUserNameEdit(e.target.value); setErrors(er => ({ ...er, name: undefined })); }}
                  style={{ ...ui.input, borderColor: errors.name ? color.danger : color.line, marginBottom: 4 }} />
                {errors.name && <div style={{ fontSize: font.sm, color: color.danger, marginBottom: 8 }}>{errors.name}</div>}
                <label htmlFor="settings-phone" style={{ ...ui.label, marginTop: 10 }}>{tr('settings_phone')}</label>
                <input id="settings-phone" type="tel" value={userPhone} placeholder="98765 43210"
                  onChange={e => { setUserPhone(e.target.value); setErrors(er => ({ ...er, phone: undefined })); }}
                  style={{ ...ui.input, borderColor: errors.phone ? color.danger : color.line, marginBottom: 4 }} />
                {errors.phone && <div style={{ fontSize: font.sm, color: color.danger }}>{errors.phone}</div>}
                {errors.save && <div role="alert" style={{ fontSize: font.sm, color: color.danger, marginTop: 8 }}>{errors.save}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={handleSaveProfile} style={{ ...ui.primaryButton, flex: 1, minHeight: 44 }}><Icon name="check" size={16} strokeWidth={2.25} />{tr('common_save')}</button>
                  <button onClick={() => { setEditingProfile(false); setUserNameEdit(userName || ''); setErrors({}); }} style={{ ...ui.secondaryButton, flex: 1, minHeight: 44 }}>{tr('common_cancel')}</button>
                </div>
              </>
            )}

            {profileView === 'public' && (
              <>
                <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 10 }}>{sitter ? tr('settings_publicNoteSitter') : tr('settings_publicNoteParent')}</div>
                <div style={{ border: `1px solid ${color.line}`, borderRadius: radius.lg, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-start', background: color.bg }}>
                  {sitter?.profile_photo_url
                    ? <img src={sitter.profile_photo_url} alt="" style={{ width: 56, height: 56, borderRadius: radius.md, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 56, height: 56, borderRadius: radius.md, background: color.navySoft, color: color.navy, fontSize: font.xl, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(userNameEdit || '?')[0]}</div>}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{publicName(userNameEdit) || tr('settings_notSet')}</div>
                    <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2 }}>{city} · {tr('settings_onFursdaySince', { date: monthYear(joinedAt) || '—' })}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {sitter?.aadhaar_verified && <span style={ui.badge('success')}><Icon name="shield" size={12} />{tr('settings_badgeVerified')}</span>}
                      {sitter?.is_founding_sitter && <span style={{ ...ui.badge(), background: color.saffronSoft, color: color.warning }}>{tr('settings_badgeFounding')}</span>}
                      {sitter?.is_top_sitter && <span style={{ ...ui.badge(), background: color.navySoft, color: color.navy }}>{tr('settings_badgeTop')}</span>}
                      {sitter && rating > 0 && <span style={{ ...ui.badge(), background: color.surface, color: color.ink, border: `1px solid ${color.line}` }}><Icon name="starFilled" size={11} color={color.saffron} />{rating.toFixed(1)} ({sitter.review_count || 0})</span>}
                    </div>
                    <div style={{ fontSize: font.sm, color: color.text, marginTop: 8 }}>
                      {sitter
                        ? tr('settings_publicJobs', { n: sitter.completedJobs }) + (sitter.languages?.length ? ' · ' + sitter.languages.join(', ') : '')
                        : tr('settings_publicBookings', { n: stats.completed }) + (stats.pets.length ? ' · ' + tr('settings_publicPets', { pets: stats.pets.join(', ') }) : '')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: font.sm, color: color.muted, marginTop: 10, lineHeight: 1.5 }}><Icon name="lock" size={14} style={{ marginTop: 2 }} />{tr('settings_contactShared')}</div>
              </>
            )}
          </div>
          {profileView === 'private' && !editingProfile && (
            <button onClick={() => setEditingProfile(true)}
              style={{ width: '100%', minHeight: 50, background: color.surface, border: 'none', borderTop: `1px solid ${color.line}`, color: color.navy, fontWeight: 600, fontFamily: font.family, cursor: 'pointer', fontSize: font.md, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
              {tr('settings_editProfile')}<Icon name="chevronRight" size={18} />
            </button>
          )}
        </div>

        {/* Notifications */}
        <div style={{ ...card, padding: '16px 16px 10px' }}>
          <div style={{ ...sectionLabel, marginBottom: 4 }}>{tr('settings_notifications')}</div>
          <Toggle label={tr('settings_push')} sub={tr('settings_pushSub')} checked={notificationsEnabled} onChange={e => { setNotificationsEnabled(e.target.checked); saveNotificationPrefs({ push_enabled: e.target.checked }); }} />
          <Toggle label={tr('settings_emailNotif')} sub={tr('settings_emailNotifSub')} checked={emailNotifications} onChange={e => { setEmailNotifications(e.target.checked); saveNotificationPrefs({ email_enabled: e.target.checked }); }} />
          <Toggle label={tr('settings_sms')} sub={tr('settings_smsSub')} checked={smsNotifications} onChange={e => { setSmsNotifications(e.target.checked); saveNotificationPrefs({ sms_enabled: e.target.checked }); }} />
        </div>

        {/* Language */}
        <div style={{ ...card, padding: 16 }}>
          <div style={sectionLabel}>{tr('settings_preferences')}</div>
          <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink, marginBottom: 2 }}>{tr('settings_language')}</div>
          <div style={{ fontSize: font.sm, color: color.muted }}>{tr('settings_languageNote')}</div>
        </div>

        {/* Help & safety */}
        <div style={card}>
          <div style={{ marginBottom: -1 }}>
            <Row icon="sos" label={tr('settings_sos')} onClick={() => setShowSos(true)} sos />
            <Row icon="message" label={tr('settings_help')} onClick={() => setScreen('help')} />
            <Row icon="fileText" label={tr('settings_terms')} onClick={() => setScreen('terms')} />
            <Row icon="shield" label={tr('settings_privacy')} onClick={() => setScreen('privacy')} />
            <Row icon="paw" label={tr('settings_about')} onClick={() => setShowAbout(a => !a)} />
            {showAbout && <div style={{ padding: '12px 16px 16px', fontSize: font.sm, color: color.text, lineHeight: 1.6, borderBottom: `1px solid ${color.line}` }}>{tr('settings_aboutText')}</div>}
          </div>
        </div>

        {/* Account */}
        <div style={card}>
          <Row icon="gift" label={tr('settings_referEarn')} onClick={() => setScreen('refer')} />
          {onSwitchRole && <Row icon="briefcase" label={switchRoleLabel} onClick={onSwitchRole} />}
          <button onClick={handleSignOut}
            style={{ width: '100%', minHeight: 56, padding: '10px 16px', background: 'none', border: 'none', borderBottom: `1px solid ${color.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, cursor: 'pointer', fontSize: font.md, fontWeight: 600, fontFamily: font.family, color: color.ink }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ ...ui.iconTile, width: 36, height: 36, borderRadius: radius.sm }}><Icon name="logout" size={19} /></span>
              <span>{tr('settings_signOut')}</span>
            </span>
            <Icon name="chevronRight" size={18} color={color.faint} />
          </button>
          {deletion ? (
            <div style={{ padding: 16, background: color.warningSoft }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: color.warning }}>{tr('settings_deletePending', { date: fmtDate(deletion.requested_at) })}</div>
              <div style={{ fontSize: font.sm, color: color.warning, marginTop: 4 }}>{tr('settings_deletePendingSub')}</div>
              <button onClick={cancelDeletion} style={{ ...ui.secondaryButton, marginTop: 12, minHeight: 44, fontSize: font.md }}>{tr('settings_deleteCancel')}</button>
            </div>
          ) : deleteStep === 'confirm' ? (
            <div style={{ padding: 16, background: color.dangerSoft }}>
              <div style={{ fontSize: font.md, fontWeight: 700, color: color.danger, marginBottom: 6 }}>{tr('settings_deleteConfirmTitle')}</div>
              <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.6, marginBottom: 10 }}>{tr('settings_deleteConfirmBody')}</div>
              <label htmlFor="delete-reason" style={ui.label}>{tr('settings_deleteReason')}</label>
              <textarea id="delete-reason" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={2}
                style={{ ...ui.input, fontSize: font.md, resize: 'vertical' }} />
              {deleteMsg && <div role="alert" style={{ fontSize: font.sm, color: color.danger, marginTop: 6 }}>{deleteMsg}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={requestDeletion} style={{ ...ui.primaryButton, flex: 1, minHeight: 44, background: color.danger }}>{tr('settings_deleteConfirmBtn')}</button>
                <button onClick={() => { setDeleteStep(null); setDeleteMsg(''); }} style={{ ...ui.secondaryButton, flex: 1, minHeight: 44 }}>{tr('common_cancel')}</button>
              </div>
            </div>
          ) : (
            <Row icon="trash" label={tr('settings_deleteAccount')} onClick={() => setDeleteStep('confirm')} danger />
          )}
          <div style={{ padding: '12px 16px', background: color.bg }}>
            <div style={{ fontSize: font.xs, color: color.muted, overflowWrap: 'anywhere' }}>{tr('settings_signedInAs', { email: userEmail })}</div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <div style={{ fontSize: font.xs, color: color.muted }}>Fursday v1.0.0</div>
          <div style={{ fontSize: font.xs, color: color.faint, marginTop: 4 }}>© 2026 Fursday</div>
        </div>
      </div>

    </div>
  );
}
