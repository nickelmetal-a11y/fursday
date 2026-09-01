import React, { useState } from 'react';
import { supabase } from './supabase';
import { Shield } from 'lucide-react';

const ORANGE = '#FF6B35';
const DARK = '#0f0f1a';

const CITY_CONFIG = {
  Gurgaon: { displayName: 'Delhi NCR' },
  Pune:    { displayName: 'Pune' },
};

export default function LoginScreen({ onLogin, onShowTerms, onShowPrivacy }) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsError, setShowTermsError] = useState(false);
  const [showTermsLocal, setShowTermsLocal] = useState(false);
  const [showPrivacyLocal, setShowPrivacyLocal] = useState(false);

  const sendOtp = async () => {
    if (!email.includes('@')) { setError('Enter a valid email address'); return; }
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
    if (otp.length < 6) { setError('Enter the 6-digit code from your email'); return; }
    setLoading(true);
    setError('');
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });
    if (error) { setError('Invalid or expired code. Try again.'); setLoading(false); return; }
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

  const inp = {
    width: '100%', padding: '16px', borderRadius: 14,
    border: '1.5px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)',
    fontSize: 15, color: 'white', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };

  const defaultCity = 'Gurgaon';

  if (showTermsLocal) {
    const TermsAndConditions = require('./TermsAndConditions').default;
    return <TermsAndConditions onBack={() => setShowTermsLocal(false)} city={defaultCity} />;
  }
  if (showPrivacyLocal) {
    const PrivacyPolicy = require('./PrivacyPolicy').default;
    return <PrivacyPolicy onBack={() => setShowPrivacyLocal(false)} city={defaultCity} />;
  }

  return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: DARK, fontFamily: '-apple-system, sans-serif', display: 'flex', flexDirection: 'column', padding: '0 24px' }}>
      <div style={{ paddingTop: 80, marginBottom: 48 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 24 }}>
          🐾
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 8, letterSpacing: -0.5 }}>
          Welcome to Fursday
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
          {step === 'email' ? 'Trusted pet care, right at your doorstep.' : 'Enter the 6-digit code we sent to your email.'}
        </div>
      </div>

      {step === 'email' && (
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '14px 16px', marginBottom: 24, display: 'flex', gap: 12 }}>
          {[
            { emoji: '🛡️', text: 'Aadhaar-verified sitters' },
            { emoji: '📍', text: 'Live GPS every walk' },
            { emoji: '💰', text: '₹25K vet insurance' },
          ].map((item, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', opacity: i === 2 ? 0.5 : 1 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{item.emoji}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{item.text}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: '#FCEBEB', borderRadius: 12, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#A32D2D', lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      {step === 'email' && (
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Your email</div>
          <input value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendOtp()}
            placeholder="your@email.com" type="email" style={{ ...inp, marginBottom: 16 }} />

          <div onClick={() => { setTermsAccepted(!termsAccepted); setShowTermsError(false); }}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 16, cursor: 'pointer' }}>
            <div style={{ width: 22, height: 22, borderRadius: 7, border: termsAccepted ? 'none' : '1.5px solid rgba(255,255,255,0.2)', background: termsAccepted ? ORANGE : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              {termsAccepted && <span style={{ color: 'white', fontSize: 13 }}>✓</span>}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              I agree to Fursday's{' '}
              <span onClick={e => { e.stopPropagation(); setShowTermsLocal(true); }} style={{ color: ORANGE, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>Terms of Service</span>
              {' '}and{' '}
              <span onClick={e => { e.stopPropagation(); setShowPrivacyLocal(true); }} style={{ color: ORANGE, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>Privacy Policy</span>
            </div>
          </div>
          {showTermsError && (
            <div style={{ background: 'rgba(255,107,53,0.15)', borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontSize: 12, color: ORANGE }}>
              Please accept the Terms of Service to continue
            </div>
          )}

          <button onClick={sendOtp} disabled={loading}
            style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: email.includes('@') && termsAccepted ? ORANGE : 'rgba(255,255,255,0.1)', color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 12 }}>
            {loading ? 'Sending...' : 'Continue with email →'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Shield size={12} color="rgba(255,255,255,0.2)" />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>No password needed · Secure OTP login</span>
          </div>
        </div>
      )}

      {step === 'otp' && (
        <div>
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>📧</span>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              Code sent to <span style={{ color: ORANGE, fontWeight: 600 }}>{email}</span>.<br/>Check your inbox and enter the 6-digit code.
            </div>
          </div>
          <input value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
            onKeyDown={e => e.key === 'Enter' && verifyOtp()}
            placeholder="000000" type="tel" maxLength={6}
            style={{ ...inp, fontSize: 32, letterSpacing: 12, textAlign: 'center', marginBottom: 12 }} />
          <button onClick={verifyOtp} disabled={loading || otp.length < 6}
            style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: otp.length === 6 ? ORANGE : 'rgba(255,255,255,0.1)', color: 'white', fontSize: 15, fontWeight: 600, cursor: otp.length === 6 ? 'pointer' : 'not-allowed', marginBottom: 12 }}>
            {loading ? 'Verifying...' : 'Sign in'}
          </button>
          <button onClick={() => { setStep('email'); setOtp(''); setError(''); }}
            style={{ width: '100%', padding: 12, borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            Use a different email
          </button>
          <div style={{ textAlign: 'center' }}>
            <span onClick={sendOtp} style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', textDecoration: 'underline' }}>
              Resend code
            </span>
          </div>
        </div>
      )}

      <div style={{ marginTop: 'auto', paddingBottom: 40, fontSize: 11, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 1.6 }}>
        Expanding to your city soon.
      </div>
    </div>
  );
}