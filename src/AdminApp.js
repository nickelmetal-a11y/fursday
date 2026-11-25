import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import AdminPanel from './AdminPanel';

const ORANGE = '#FF6B35';
const page = { maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#0f0f1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', fontFamily: '-apple-system, sans-serif', boxSizing: 'border-box' };
const input = { width: '100%', padding: '14px 16px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', fontSize: 15, color: 'white', outline: 'none', marginBottom: 12, boxSizing: 'border-box' };
const button = { width: '100%', padding: 16, borderRadius: 14, border: 'none', background: ORANGE, color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' };

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
    <div style={page}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🐾</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 8 }}>Fursday Admin</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 28, textAlign: 'center' }}>
        {step === 'email' ? 'Sign in with your admin email' : 'We emailed a 6-digit code to ' + email}
      </div>
      {error && <div role="alert" style={{ background: '#FCEBEB', borderRadius: 10, padding: '8px 14px', marginBottom: 12, fontSize: 13, color: '#A32D2D', width: '100%', boxSizing: 'border-box' }}>{error}</div>}
      {step === 'email' ? (
        <>
          <input aria-label="Admin email" type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendCode()} placeholder="you@example.com" style={input} />
          <button onClick={sendCode} disabled={busy} style={{ ...button, opacity: busy ? 0.6 : 1 }}>{busy ? 'Sending...' : 'Send code'}</button>
        </>
      ) : (
        <>
          <input aria-label="Code" inputMode="numeric" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} onKeyDown={e => e.key === 'Enter' && verify()} placeholder="123456" style={{ ...input, letterSpacing: 6, textAlign: 'center' }} />
          <button onClick={verify} disabled={busy} style={{ ...button, opacity: busy ? 0.6 : 1 }}>{busy ? 'Checking...' : 'Sign in'}</button>
          <button onClick={() => { setStep('email'); setCode(''); setError(''); }} style={{ marginTop: 12, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 13, cursor: 'pointer' }}>Use a different email</button>
        </>
      )}
    </div>
  );
}

export default function AdminApp() {
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div style={{ ...page, color: 'rgba(255,255,255,0.5)' }}>Loading...</div>;
  if (!session) return <AdminLogin />;
  // key: remount on account switch so the is_admin check reruns for the new user.
  return <AdminPanel key={session.user.id} onSignOut={() => supabase.auth.signOut()} />;
}
