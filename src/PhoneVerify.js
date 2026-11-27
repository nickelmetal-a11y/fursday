import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

const RESEND_SECONDS = 30;
export const tenDigits = (p) => String(p || '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');
export const validIndianMobile = (p) => /^[6-9]\d{9}$/.test(tenDigits(p));
export const toE164 = (p) => '+91' + tenDigits(p);
export const prettyPhone = (p) => { const d = tenDigits(p); return d.length === 10 ? '+91 ' + d.slice(0, 5) + ' ' + d.slice(5) : p; };

// Supabase answers without an SMS provider with errors like "Unsupported phone provider".
const sendProblem = (error) => {
  const text = String(error?.message || '') + ' ' + String(error?.code || '');
  if (/rate|too many|seconds|429/i.test(text) || error?.status === 429) return 'phone_wait';
  if (/provider|sms|twilio|messagebird|vonage|textlocal|not enabled|disabled|unsupported|hook/i.test(text) || (error?.status || 0) >= 500) return 'phone_setup';
  return 'phone_sendFailed';
};

// Verified when public.users.phone_verified_at is set (migration 038's
// trigger copies it from Supabase Auth), or Auth itself has confirmed the phone.
export async function loadPhoneStatus() {
  const { data: { user } = {} } = await supabase.auth.getUser();
  if (!user) return { verified: false, phone: '', verifiedAt: null };
  let verifiedAt = null;
  try {
    const { data, error } = await supabase.from('users').select('phone_verified_at').eq('id', user.id).maybeSingle();
    if (!error) verifiedAt = data?.phone_verified_at || null;
  } catch { /* before migration 038 */ }
  verifiedAt = verifiedAt || user.phone_confirmed_at || null;
  return { verified: !!verifiedAt, phone: user.phone ? '+' + String(user.phone).replace(/^\+/, '') : '', verifiedAt };
}

function usePhoneStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let live = true;
    loadPhoneStatus().then(s => { if (live) setStatus(s); }).catch(() => { if (live) setStatus({ verified: false, phone: '', verifiedAt: null }); });
    return () => { live = false; };
  }, []);
  return [status, setStatus];
}

export const VerifiedBadge = ({ verified }) => {
  const { t: tr } = useLanguage();
  return verified
    ? <span style={{ ...ui.badge('success'), whiteSpace: 'nowrap' }}><Icon name="check" size={12} strokeWidth={2.6} />{tr('phone_verified')}</span>
    : <span style={{ ...ui.badge('warning'), whiteSpace: 'nowrap' }}>{tr('phone_notVerified')}</span>;
};

// The send-code / enter-code form. onVerified(phoneE164) when the code checks out.
function OtpForm({ initialPhone, onVerified, onCancel, idPrefix }) {
  const { t: tr } = useLanguage();
  const [phone, setPhone] = useState(tenDigits(initialPhone));
  const [sentTo, setSentTo] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    if (!validIndianMobile(phone)) { setProblem('phone_badNumber'); return; }
    setBusy(true);
    setProblem(null);
    try {
      const { error } = await supabase.auth.updateUser({ phone: toE164(phone) });
      if (error) { setProblem(sendProblem(error)); return; }
      setSentTo(toE164(phone));
      setCode('');
      setWait(RESEND_SECONDS);
    } catch (e) {
      setProblem(sendProblem(e));
    } finally { setBusy(false); }
  };

  const check = async () => {
    if (!/^\d{6}$/.test(code)) { setProblem('phone_badCode'); return; }
    setBusy(true);
    setProblem(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: sentTo, token: code, type: 'phone_change' });
      if (error) { setProblem('phone_badCode'); return; }
      onVerified(sentTo);
    } catch { setProblem('phone_badCode'); } finally { setBusy(false); }
  };

  const note = problem && (
    <div role={problem === 'phone_setup' ? 'status' : 'alert'}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: problem === 'phone_setup' ? color.infoSoft : color.dangerSoft, color: problem === 'phone_setup' ? color.info : color.danger, borderRadius: radius.md, padding: '10px 12px', fontSize: font.sm, lineHeight: 1.5, marginTop: 10 }}>
      <Icon name={problem === 'phone_setup' ? 'info' : 'alert'} size={16} style={{ marginTop: 1, flexShrink: 0 }} />{tr(problem)}
    </div>
  );

  if (!sentTo) return (
    <div>
      <label htmlFor={idPrefix + '-number'} style={ui.label}>{tr('phone_number')}</label>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <span style={{ ...ui.input, width: 'auto', flexShrink: 0, background: color.tile, color: color.text, display: 'flex', alignItems: 'center' }} aria-hidden="true">+91</span>
        <input id={idPrefix + '-number'} type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} placeholder="98765 43210"
          onChange={e => { setPhone(e.target.value.replace(/[^\d\s]/g, '').slice(0, 12)); setProblem(null); }}
          style={{ ...ui.input, borderColor: problem === 'phone_badNumber' ? color.danger : color.line }} />
      </div>
      {note}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={send} disabled={busy} style={{ ...ui.primaryButton, flex: 1, opacity: busy ? 0.7 : 1 }}>{busy ? tr('phone_sending') : tr('phone_send')}</button>
        {onCancel && <button type="button" onClick={onCancel} style={{ ...ui.secondaryButton, flex: 1 }}>{tr('phone_cancel')}</button>}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: font.sm, color: color.text, marginBottom: 10, lineHeight: 1.5 }}>{tr('phone_codeSent', { phone: prettyPhone(sentTo) })}</div>
      <label htmlFor={idPrefix + '-code'} style={ui.label}>{tr('phone_code')}</label>
      <input id={idPrefix + '-code'} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
        onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setProblem(null); }}
        style={{ ...ui.input, letterSpacing: 6, fontSize: font.lg, borderColor: problem === 'phone_badCode' ? color.danger : color.line }} />
      {note}
      <button type="button" onClick={check} disabled={busy} style={{ ...ui.primaryButton, width: '100%', marginTop: 12, opacity: busy ? 0.7 : 1 }}>{busy ? tr('phone_checking') : tr('phone_check')}</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6 }}>
        <button type="button" onClick={() => { setSentTo(null); setProblem(null); }} style={linkButton}>{tr('phone_change')}</button>
        <button type="button" onClick={send} disabled={wait > 0 || busy} style={{ ...linkButton, color: wait > 0 ? color.faint : color.navy }}>
          {wait > 0 ? tr('phone_resendIn', { s: wait }) : tr('phone_resend')}
        </button>
      </div>
    </div>
  );
}

const linkButton = { minHeight: 44, background: 'none', border: 'none', padding: '0 4px', color: color.navy, fontSize: font.sm, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' };

// A Settings row: the number with a Verified / Not verified badge and a Verify button.
export default function PhoneVerify({ phone: savedPhone, onVerified }) {
  const { t: tr } = useLanguage();
  const [status, setStatus] = usePhoneStatus();
  const [open, setOpen] = useState(false);

  // A number edited after verifying is a different, unverified number.
  const verified = !!status?.verified && (!savedPhone || !status.phone || tenDigits(savedPhone) === tenDigits(status.phone));
  const shown = (verified && status.phone) || savedPhone;

  const done = (e164) => {
    setStatus({ verified: true, phone: e164, verifiedAt: new Date().toISOString() });
    setOpen(false);
    onVerified && onVerified(e164);
  };

  return (
    <div style={{ padding: '11px 0', borderBottom: `1px solid ${color.line}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 13, color: color.muted, flexShrink: 0 }}>{tr('phone_label')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0 }}>
          <span style={{ fontSize: font.md, color: color.ink, fontWeight: 600 }}>{shown ? prettyPhone(shown) : tr('phone_notAdded')}</span>
          {status && (shown || verified) && <VerifiedBadge verified={verified} />}
          {status && !verified && !open && (
            <button type="button" onClick={() => setOpen(true)} style={{ ...linkButton, minHeight: 36 }}>{tr('phone_verify')}</button>
          )}
        </div>
      </div>
      {open && <div style={{ marginTop: 12 }}><OtpForm initialPhone={savedPhone} onVerified={done} onCancel={() => setOpen(false)} idPrefix="settings-verify" /></div>}
    </div>
  );
}

// A whole signup step (e.g. for SitterOnboarding): onDone(phoneE164) once verified, onSkip optional.
export function PhoneVerifyStep({ initialPhone, onDone, onSkip }) {
  const { t: tr } = useLanguage();
  const [status, setStatus] = usePhoneStatus();
  const verified = !!status?.verified;

  return (
    <div style={{ ...ui.card, padding: 20 }}>
      <div style={{ ...ui.iconTile, marginBottom: 12 }}><Icon name="smartphone" size={22} /></div>
      <h2 style={{ fontSize: font.xl, fontWeight: 700, color: color.ink, margin: '0 0 6px' }}>{tr('phone_stepTitle')}</h2>
      <p style={{ fontSize: font.md, color: color.muted, lineHeight: 1.6, margin: '0 0 16px' }}>{tr('phone_stepSub')}</p>
      {verified ? (
        <>
          <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: color.successSoft, borderRadius: radius.md, padding: '12px 14px', marginBottom: 16 }}>
            <span style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{prettyPhone(status.phone || initialPhone)}</span>
            <VerifiedBadge verified />
          </div>
          <button type="button" onClick={() => onDone && onDone(status.phone || initialPhone)} style={{ ...ui.primaryButton, width: '100%' }}>{tr('phone_continue')}</button>
        </>
      ) : status && (
        <OtpForm initialPhone={initialPhone} idPrefix="step-verify"
          onVerified={(e164) => { setStatus({ verified: true, phone: e164, verifiedAt: new Date().toISOString() }); onDone && onDone(e164); }} />
      )}
      {!verified && onSkip && <button type="button" onClick={onSkip} style={{ ...linkButton, width: '100%', marginTop: 8 }}>{tr('phone_skip')}</button>}
    </div>
  );
}
