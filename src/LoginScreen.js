import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

// trustGps and bookingFlow_svcWalkDesc used to promise live GPS tracking,
// which the app doesn't have.
export default function LoginScreen({ onLogin, onBrowse, reason }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [showTermsLocal, setShowTermsLocal] = useState(false);
  const [showPrivacyLocal, setShowPrivacyLocal] = useState(false);
  const { t: tr } = useLanguage();

  const sendOtp = async () => {
    if (!email.includes('@')) { setError(tr('login_errInvalidEmail')); return; }
    if (!termsAccepted) { setShowTermsError(true); return; }
    setLoading(true);
    setError('');
    setShowTermsError(false);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true }
    });
    if (error) setError(error.message);
    else setStep('otp');
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (otp.length < 6) { setError(tr('login_errEnterCode')); return; }
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });
    if (error) { setError(tr('login_errInvalidCode')); setLoading(false); return; }
    if (data?.user) {
      await supabase.from('users').upsert({
        id: data.user.id,
        email: data.user.email,
        terms_agreed_at: new Date().toISOString(),
      }, { onConflict: 'id', ignoreDuplicates: false });
      onLogin(data.user);
    }
    setLoading(false);
  };

  const defaultCity = 'Gurgaon';
  const linkBtn = { background: 'none', border: 'none', padding: 0, font: 'inherit', color: color.navy, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2, cursor: 'pointer' };
  const emailReady = email.includes('@') && termsAccepted;
  const toggleTerms = () => { setTermsAccepted(!termsAccepted); setShowTermsError(false); };

  if (showTermsLocal) {
    const TermsAndConditions = require('./TermsAndConditions').default;
    return <TermsAndConditions onBack={() => setShowTermsLocal(false)} city={defaultCity} />;
  }
  if (showPrivacyLocal) {
    const PrivacyPolicy = require('./PrivacyPolicy').default;
    return <PrivacyPolicy onBack={() => setShowPrivacyLocal(false)} city={defaultCity} />;
  }

  return (
    <div style={{ ...ui.page, background: color.surface, display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: color.navy, padding: 'calc(48px + env(safe-area-inset-top)) 24px 52px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'linear-gradient(135deg,#F4A25B 0%,#FFFFFF 52%,#5FB088 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(0,0,0,0.25)', marginBottom: 14 }}>
          <Icon name="paw" size={40} color={color.navy} strokeWidth={2} />
        </div>
        <div style={{ color: color.surface, fontSize: font.xxl, fontWeight: 700, letterSpacing: -0.3 }}>Fursday</div>
        <div style={{ color: color.surface, opacity: 0.72, fontSize: font.sm, marginTop: 4 }}>{tr('splash_tagline')}</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: color.surface, borderRadius: `${radius.xl}px ${radius.xl}px 0 0`, marginTop: -24, padding: '28px 20px 0' }}>
        <h1 style={{ fontSize: font.xl, fontWeight: 700, color: color.ink, margin: '0 0 6px', letterSpacing: -0.2 }}>{tr('welcome')}</h1>
        <div style={{ fontSize: font.md, color: color.muted, lineHeight: 1.5, marginBottom: 20 }}>
          {step === 'email' ? tr('taglineEmail') : tr('taglineOtp')}
        </div>
        {reason && step === 'email' && (
          <div role="status" style={{ display: 'flex', gap: 10, alignItems: 'center', background: color.navySoft, borderRadius: radius.md, padding: '10px 12px', marginBottom: 18, fontSize: 13, color: color.navy, fontWeight: 600, lineHeight: 1.5 }}>
            <Icon name="lock" size={16} />{tr('login_signInToContinue')}
          </div>
        )}

        {step === 'email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
            {[
              { icon: 'shield', text: tr('trustAadhaar') },
              { icon: 'camera', text: tr('trustGps') },
              { icon: 'sos', text: tr('trustInsurance') },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ ...ui.iconTile, width: 32, height: 32, borderRadius: radius.sm, background: color.navySoft }}>
                  <Icon name={item.icon} size={17} />
                </span>
                <span style={{ fontSize: font.md, color: color.text, fontWeight: 500 }}>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div role="alert" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: color.dangerSoft, borderRadius: radius.md, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: color.danger, lineHeight: 1.5 }}>
            <Icon name="alert" size={16} style={{ marginTop: 2 }} />{error}
          </div>
        )}

        {step === 'email' && (
          <div>
            <label htmlFor="login-email" style={ui.label}>{tr('yourEmail')}</label>
            <input id="login-email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendOtp()}
              placeholder="your@email.com" type="email" autoComplete="email" aria-label={tr('yourEmail')}
              style={{ ...ui.input, minHeight: 50, marginBottom: 16 }} />

            <div onClick={toggleTerms}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16, cursor: 'pointer' }}>
              <div role="checkbox" aria-checked={termsAccepted} aria-label={tr('login_agreeCheckboxAria')} tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleTerms(); } }}
                style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${termsAccepted ? color.navy : color.faint}`, background: termsAccepted ? color.navy : color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, boxSizing: 'border-box' }}>
                {termsAccepted && <Icon name="check" size={14} color={color.surface} strokeWidth={2.5} />}
              </div>
              <div style={{ fontSize: font.sm, color: color.muted, lineHeight: 1.6 }}>
                {tr('login_agreePrefix')}{' '}
                <button type="button" onClick={e => { e.stopPropagation(); setShowTermsLocal(true); }} style={linkBtn}>{tr('login_termsOfService')}</button>
                {' '}{tr('login_and')}{' '}
                <button type="button" onClick={e => { e.stopPropagation(); setShowPrivacyLocal(true); }} style={linkBtn}>{tr('login_privacyPolicy')}</button>
                {tr('login_agreeSuffix')}
              </div>
            </div>
            {showTermsError && (
              <div role="alert" style={{ background: color.warningSoft, borderRadius: radius.sm, padding: '8px 12px', marginBottom: 12, fontSize: font.sm, color: color.warning }}>
                {tr('login_acceptTermsError')}
              </div>
            )}

            <button onClick={sendOtp} disabled={loading}
              style={{ ...ui.primaryButton, width: '100%', minHeight: 50, marginBottom: 14, opacity: emailReady || loading ? 1 : 0.55 }}>
              {loading ? tr('sending') : tr('continueWithEmail')}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <Icon name="lock" size={13} color={color.faint} />
              <span style={{ fontSize: font.xs, color: color.muted }}>{tr('noPasswordNeeded')}</span>
            </div>
            {onBrowse && (
              <button type="button" onClick={onBrowse} style={{ ...ui.secondaryButton, width: '100%', marginTop: 16 }}>
                <Icon name="search" size={18} />{tr('login_lookAround')}
              </button>
            )}
          </div>
        )}

        {step === 'otp' && (
          <div>
            <div style={{ ...ui.card, background: color.bg, padding: '12px 14px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ ...ui.iconTile, width: 40, height: 40, background: color.navySoft }}><Icon name="mail" size={20} /></span>
              <div style={{ fontSize: 13, color: color.text, lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>
                {tr('codeSentTo')} <span style={{ color: color.navy, fontWeight: 600 }}>{email}</span>.<br/>{tr('checkInbox')}
              </div>
            </div>
            <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
              onKeyDown={e => e.key === 'Enter' && verifyOtp()}
              placeholder="000000" type="tel" inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label={tr('login_otpAria')}
              style={{ ...ui.input, minHeight: 60, fontSize: 28, fontWeight: 600, letterSpacing: 10, textAlign: 'center', fontVariantNumeric: 'tabular-nums', marginBottom: 14 }} />
            <button onClick={verifyOtp} disabled={loading || otp.length < 6}
              style={{ ...ui.primaryButton, width: '100%', minHeight: 50, marginBottom: 10, opacity: otp.length === 6 ? 1 : 0.55, cursor: otp.length === 6 ? 'pointer' : 'not-allowed' }}>
              {loading ? tr('verifying') : tr('signIn')}
            </button>
            <button onClick={() => { setStep('email'); setOtp(''); setError(''); }}
              style={{ ...ui.secondaryButton, width: '100%', marginBottom: 12 }}>
              {tr('useDifferentEmail')}
            </button>
            <div style={{ textAlign: 'center' }}>
              <button type="button" onClick={sendOtp} style={{ ...linkBtn, fontSize: 13, minHeight: 44 }}>
                {tr('resendCode')}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', padding: '28px 0 calc(28px + env(safe-area-inset-bottom))', fontSize: font.xs, color: color.faint, textAlign: 'center', lineHeight: 1.6 }}>
          {tr('footerExpanding')}
        </div>
      </div>
    </div>
  );
}
