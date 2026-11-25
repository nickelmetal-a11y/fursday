import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const ORANGE = '#FF6B35';

const FIELDS = [
  { key: 'support_phone', label: 'Support phone', help: 'Called from the SOS button and Help in the app.' },
  { key: 'support_whatsapp', label: 'Support WhatsApp', help: 'Opened by WhatsApp help and the sitter SOS.' },
];

// The app dials 'tel:+' + value and opens wa.me/value, so values are stored as
// country code + number with no symbols, e.g. 919876543210.
export function normalizeIndianNumber(input) {
  const digits = (input || '').replace(/\D/g, '');
  if (digits.length === 10) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
}

export default function AdminSettings() {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('app_settings').select('key, value');
      setValues(Object.fromEntries((data || []).map(r => [r.key, r.value || ''])));
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
    setValues(Object.fromEntries(rows.map(r => [r.key, r.value])));
    setMessage({ error: false, text: 'Saved. The app uses the new numbers from the next time it opens.' });
  };

  if (loading) return <div style={{ color: '#888', fontSize: 14 }}>Loading settings...</div>;

  return (
    <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 20, border: '1px solid #EEE', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>Support contact</div>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label htmlFor={'setting-' + f.key} style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>{f.label}</label>
            <input id={'setting-' + f.key} inputMode="tel" value={values[f.key] || ''} onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              placeholder="98765 43210" style={{ width: '100%', padding: '11px 12px', borderRadius: 10, border: '1.5px solid #E0E0E0', fontSize: 15, boxSizing: 'border-box' }} />
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{f.help}</div>
          </div>
        ))}
        {message && <div role="status" style={{ fontSize: 13, borderRadius: 10, padding: '8px 12px', background: message.error ? '#FCEBEB' : '#E8F5E9', color: message.error ? '#A32D2D' : '#2E7D32' }}>{message.text}</div>}
        <button onClick={save} disabled={saving}
          style={{ alignSelf: 'flex-start', padding: '11px 22px', borderRadius: 10, border: 'none', background: ORANGE, color: 'white', fontSize: 14, fontWeight: 600, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
