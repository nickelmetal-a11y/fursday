import { useState, useEffect } from 'react';
import { supabase } from './supabase';

// Loads support contact numbers from app_settings (never hardcoded in the UI).
export function useSupportContact() {
  const [whatsapp, setWhatsapp] = useState(null);
  const [phone, setPhone] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('app_settings').select('key,value').in('key', ['support_whatsapp','support_phone']);
        if (data) {
          const w = data.find(r => r.key === 'support_whatsapp');
          const p = data.find(r => r.key === 'support_phone');
          if (w && isValidSupportNumber(w.value)) setWhatsapp(w.value);
          if (p && isValidSupportNumber(p.value)) setPhone(p.value);
        }
      } catch(e) { /* silent */ }
    })();
  }, []);
  return { whatsapp, phone };
}

// Stored as country code + number, e.g. 919876543210. Anything else (an empty
// value or a placeholder) would produce a broken call or WhatsApp link.
export const isValidSupportNumber = (n) => /^91[6-9]\d{9}$/.test(String(n || ''));

export function openWhatsAppSupport(number, prefill) {
  if (!isValidSupportNumber(number)) return;
  const text = prefill ? '?text=' + encodeURIComponent(prefill) : '';
  window.open('https://wa.me/' + number + text, '_blank');
}

export function callSupport(number) {
  if (!isValidSupportNumber(number)) return;
  window.location.href = 'tel:+' + number;
}
