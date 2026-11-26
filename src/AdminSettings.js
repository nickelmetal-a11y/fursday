import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { ui } from './theme';
import { A, Field, Notice, SectionHeader, Skeleton } from './AdminUI';

const FIELDS = [
  { key: 'support_phone', label: 'Support phone', help: 'Called from the SOS button and Help in the app.' },
  { key: 'support_whatsapp', label: 'Support WhatsApp', help: 'Opened by WhatsApp help and the sitter SOS.' },
];

// Read by apply_referral_code (migration 035) when someone redeems a code.
const REFERRAL_FIELDS = [
  { key: 'referral_reward_rs', label: 'Referrer reward (Rs.)', help: 'Credit for the person who shared the code, once the new person completes a booking.', fallback: '100' },
  { key: 'referral_signup_rs', label: 'New person credit (Rs.)', help: 'Credit for the person who used the code.', fallback: '50' },
];
export const MAX_REFERRAL_RS = 2000;

// The app dials 'tel:+' + value and opens wa.me/value, so values are stored as
// country code + number with no symbols, e.g. 919876543210.
export function normalizeIndianNumber(input) {
  const digits = (input || '').replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

// Whole rupees from 0 to MAX_REFERRAL_RS, else null.
export function normalizeRupees(input) {
  const s = String(input ?? '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return n <= MAX_REFERRAL_RS ? String(n) : null;
}

export default function AdminSettings() {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [savingRef, setSavingRef] = useState(false);
  const [refMessage, setRefMessage] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('key, value');
      const v = Object.fromEntries((data || []).map(r => [r.key, r.value || '']));
      REFERRAL_FIELDS.forEach(f => { if (v[f.key] == null || v[f.key] === '') v[f.key] = f.fallback; });
      setValues(v);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const rows = [];
    for (const f of FIELDS) {
      const normalized = normalizeIndianNumber(values[f.key]);
      if (!normalized) { setMessage({ error: true, text: f.label + ' must be a 10-digit Indian mobile number.' }); return; }
      rows.push({ key: f.key, value: normalized, updated_at: new Date().toISOString() });
    }
    setSaving(true); setMessage(null);
    const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
    setSaving(false);
    if (error) { setMessage({ error: true, text: 'Could not save: ' + error.message }); return; }
    setValues(v => ({ ...v, ...Object.fromEntries(rows.map(r => [r.key, r.value])) }));
    setMessage({ error: false, text: 'Saved. The app uses the new numbers from the next time it opens.' });
  };

  const saveReferral = async () => {
    const rows = [];
    for (const f of REFERRAL_FIELDS) {
      const n = normalizeRupees(values[f.key]);
      if (n == null) { setRefMessage({ error: true, text: f.label + ' must be a whole number from 0 to ' + MAX_REFERRAL_RS + '.' }); return; }
      rows.push({ key: f.key, value: n, updated_at: new Date().toISOString() });
    }
    setSavingRef(true); setRefMessage(null);
    const { error } = await supabase.from('app_settings').upsert(rows, { onConflict: 'key' });
    setSavingRef(false);
    if (error) { setRefMessage({ error: true, text: 'Could not save: ' + error.message }); return; }
    setValues(v => ({ ...v, ...Object.fromEntries(rows.map(r => [r.key, r.value])) }));
    setRefMessage({ error: false, text: 'Referral amounts saved. They apply to codes redeemed from now on; existing credits keep their amount.' });
  };

  if (loading) return <Skeleton rows={4} label="Loading settings..." />;

  const input = (f, mode) => (
    <Field key={f.key} label={f.label} htmlFor={'setting-' + f.key} help={f.help}>
      <input id={'setting-' + f.key} inputMode={mode} value={values[f.key] || ''} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
        placeholder={mode === 'tel' ? '98765 43210' : f.fallback} style={A.input} />
    </Field>
  );

  return (
    <div style={{ maxWidth: 560, ...A.stack(16) }}>
      <section style={{ ...ui.card, ...A.stack(16) }}>
        <SectionHeader title="Support contact" subtitle="Shown to parents and sitters wherever the app offers help." />
        {FIELDS.map(f => input(f, 'tel'))}
        {message && <Notice tone={message.error ? 'danger' : 'success'} icon={message.error ? 'alert' : 'check'}>{message.text}</Notice>}
        <button onClick={save} disabled={saving} style={{ ...A.primary, alignSelf: 'flex-start', ...(saving ? { opacity: 0.6 } : null) }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </section>

      <section style={{ ...ui.card, ...A.stack(16) }}>
        <SectionHeader title="Referral amounts" subtitle="Credits are created as pending when someone uses a code. Apply them from the Referrals tab." />
        {REFERRAL_FIELDS.map(f => input(f, 'numeric'))}
        {refMessage && <Notice tone={refMessage.error ? 'danger' : 'success'} icon={refMessage.error ? 'alert' : 'check'}>{refMessage.text}</Notice>}
        <button onClick={saveReferral} disabled={savingRef} style={{ ...A.primary, alignSelf: 'flex-start', ...(savingRef ? { opacity: 0.6 } : null) }}>
          {savingRef ? 'Saving...' : 'Save referral amounts'}
        </button>
      </section>
    </div>
  );
}
