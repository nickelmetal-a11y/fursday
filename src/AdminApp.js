import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import AdminPanel from './AdminPanel';
import { A, AdminStyles, Notice, Skeleton } from './AdminUI';

// Signed-out screens: one centred white card on the cream page.
function Shell({ icon = 'paw', title, subtitle, children }) {
  return (
    <div className="adm-root" style={{ minHeight: '100vh', background: color.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', fontFamily: font.family, color: color.ink }}>
      <AdminStyles />
      <div style={{ ...ui.card, width: '100%', maxWidth: 400, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: radius.md, background: color.navy, color: color.surface, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={24} /></div>
        {title && <h1 style={{ margin: 0, fontSize: font.xl, fontWeight: 700, textAlign: 'center' }}>{title}</h1>}
        {subtitle && <div style={{ fontSize: font.md, color: color.muted, textAlign: 'center', lineHeight: 1.6, marginBottom: 4 }}>{subtitle}</div>}
        {children}
      </div>
    </div>
  );
}
const field = { ...A.input, fontSize: font.lg, minHeight: 48 };
const button = { ...ui.primaryButton, width: '100%' };
const linkButton = { background: 'transparent', border: 'none', color: color.navy, fontSize: font.md, fontWeight: 600, cursor: 'pointer', minHeight: 40, fontFamily: 'inherit' };
const Loading = ({ label }) => <Shell><div style={{ width: '100%' }}><Skeleton rows={2} label={label} /></div></Shell>;

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async () => {
    if (!email.includes('@')) { setError('Enter a valid email address'); return; }
    setBusy(true); setError('');
    // shouldCreateUser:false — the admin site must never sign up new accounts.
    const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
    setBusy(false);
    if (err) setError(/not found|signups not allowed/i.test(err.message) ? 'No Fursday account uses this email.' : err.message);
    else setStep('code');
  };

  const verify = async () => {
    if (code.length < 6) { setError('Enter the 6-digit code from your email'); return; }
    setBusy(true); setError('');
    const { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
    setBusy(false);
    if (err) setError('Invalid or expired code. Try again.');
  };

  return (
    <Shell title="Fursday Admin" subtitle={step === 'email' ? 'Sign in with your admin email' : 'We emailed a 6-digit code to ' + email}>
      {error && <div style={{ width: '100%' }}><Notice tone="danger" icon="alert">{error}</Notice></div>}
      {step === 'email' ? (
        <>
          <input aria-label="Admin email" type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendCode()} placeholder="you@example.com" style={field} />
          <button onClick={sendCode} disabled={busy} style={{ ...button, opacity: busy ? 0.6 : 1 }}>{busy ? 'Sending...' : 'Send code'}</button>
        </>
      ) : (
        <>
          <input aria-label="Code" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => e.key === 'Enter' && verify()} placeholder="123456" style={{ ...field, letterSpacing: 6, textAlign: 'center' }} />
          <button onClick={verify} disabled={busy} style={{ ...button, opacity: busy ? 0.6 : 1 }}>{busy ? 'Checking...' : 'Sign in'}</button>
          <button onClick={() => { setStep('email'); setCode(''); setError(''); }} style={linkButton}>Use a different email</button>
        </>
      )}
    </Shell>
  );
}

// Second factor: an authenticator-app code (TOTP). Admin data in the database
// requires an aal2 session (migration 034), so the emailed code alone is not enough.
function AdminTwoFactor({ onDone }) {
  const [mode, setMode] = useState('loading'); // loading | enroll | challenge | notAdmin
  const [factorId, setFactorId] = useState(null);
  const [qr, setQr] = useState(null);
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      // Only admin accounts are asked to set up two-factor at all.
      let { data: isAdmin, error: rpcErr } = await supabase.rpc('is_admin_account');
      if (rpcErr) ({ data: isAdmin } = await supabase.rpc('is_admin_user'));
      if (isAdmin !== true) { setMode('notAdmin'); return; }
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = (factors?.totp || []).find(f => f.status === 'verified');
      if (verified) { setFactorId(verified.id); setMode('challenge'); return; }
      for (const f of (factors?.all || []).filter(f => f.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Fursday admin ' + new Date().toISOString().slice(0, 10) });
      if (enrollErr) { setError(enrollErr.message); setMode('enroll'); return; }
      setFactorId(data.id); setQr(data.totp.qr_code); setSecret(data.totp.secret); setMode('enroll');
    })();
  }, []);

  const verify = async () => {
    if (code.length !== 6) { setError('Enter the 6-digit code from your authenticator app'); return; }
    setBusy(true); setError('');
    const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setBusy(false);
    if (vErr) { setError('That code did not match. Check the time on your phone and try the newest code.'); setCode(''); return; }
    onDone();
  };

  if (mode === 'loading') return <Loading label="Checking your account..." />;
  if (mode === 'notAdmin') return <AdminPanel onSignOut={() => supabase.auth.signOut()} />;
  return (
    <Shell icon="lock" title={mode === 'enroll' ? 'Set up two-step sign-in' : 'Two-step sign-in'}
      subtitle={mode === 'enroll'
        ? 'Scan this with Google Authenticator, Microsoft Authenticator or Authy, then enter the 6-digit code it shows. You only do this once.'
        : 'Open your authenticator app and enter the 6-digit Fursday admin code.'}>
      {mode === 'enroll' && qr && <img src={qr} alt="QR code for your authenticator app" style={{ width: 180, height: 180, background: color.surface, border: `1px solid ${color.line}`, borderRadius: radius.md, padding: 8 }} />}
      {mode === 'enroll' && secret && <div style={{ fontSize: font.sm, color: color.muted, wordBreak: 'break-all', textAlign: 'center' }}>Can't scan? Enter this key: <span style={{ color: color.ink, fontFamily: 'monospace' }}>{secret}</span></div>}
      {error && <div style={{ width: '100%' }}><Notice tone="danger" icon="alert">{error}</Notice></div>}
      <input aria-label="Authenticator code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => e.key === 'Enter' && verify()} placeholder="123456" style={{ ...field, letterSpacing: 6, textAlign: 'center' }} />
      <button onClick={verify} disabled={busy} style={{ ...button, opacity: busy ? 0.6 : 1 }}>{busy ? 'Checking...' : 'Verify'}</button>
      <button onClick={() => supabase.auth.signOut()} style={linkButton}>Sign out</button>
    </Shell>
  );
}

const IDLE_LIMIT_MS = 30 * 60 * 1000;
// Phase 1 (before launch): set REACT_APP_ADMIN_REQUIRE_2FA=true for the admin
// build, set ADMIN_REQUIRE_2FA=true in Vercel, and run migration 034.
// Off during Phase 0 (preparation) by the owner's decision.
export const REQUIRE_TWO_FACTOR = process.env.REACT_APP_ADMIN_REQUIRE_2FA === 'true';

export default function AdminApp() {
  const [session, setSession] = useState(undefined);
  const [aal, setAal] = useState(null);

  const refreshAal = async () => {
    if (!REQUIRE_TWO_FACTOR) { setAal('aal1'); return; }
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setAal(data?.currentLevel || 'aal1');
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) refreshAal(); else setAal(null); }, [session]);

  // Sign out after 30 minutes without any interaction.
  useEffect(() => {
    if (!session) return;
    let timer;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => supabase.auth.signOut(), IDLE_LIMIT_MS); };
    const events = ['pointerdown', 'keydown', 'scroll', 'visibilitychange'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)); };
  }, [session]);

  // Record each admin sign-in (at two-factor level once that is required).
  useEffect(() => {
    if (!session || !aal || (REQUIRE_TWO_FACTOR && aal !== 'aal2')) return;
    const key = 'fursday_admin_login_logged_' + session.user.id;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* storage unavailable */ }
    supabase.from('admin_audit_logs').insert({ admin_id: session.user.id, action: 'admin_sign_in', resource_type: 'auth', resource_id: session.user.id, status: 'success', reason: navigator.userAgent.slice(0, 200) }).then(() => {});
  }, [aal, session]);

  if (session === undefined) return <Loading />;
  if (!session) return <AdminLogin />;
  if (aal === null) return <Loading />;
  if (REQUIRE_TWO_FACTOR && aal !== 'aal2') return <AdminTwoFactor key={session.user.id} onDone={refreshAal} />;
  // key: remount on account switch so the is_admin check reruns for the new user.
  return <AdminPanel key={session.user.id} onSignOut={() => supabase.auth.signOut()} />;
}
