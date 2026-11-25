import React, { useState } from 'react';
import { useLanguage } from './i18n';

export default function PromoBanner({ promo, onUse }) {
  const { t: tr } = useLanguage();
  const [copied, setCopied] = useState(false);

  const title = promo.discount_amount
    ? tr('home_promoTitleAmount', { amount: promo.discount_amount })
    : tr('home_promoTitlePercent', { percent: promo.discount_percent || 0 });

  const copy = () => {
    navigator.clipboard?.writeText(promo.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 16, background: 'linear-gradient(135deg, #6A3DE8, #FF6B35)', padding: 16, boxShadow: '0 6px 20px rgba(106,61,232,0.25)' }}>
      <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
      <div style={{ position: 'absolute', bottom: -30, right: 30, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 800, color: 'white', letterSpacing: 0.5, marginBottom: 8 }}>{tr('home_promoBadge')}</div>
        <div style={{ color: 'white', fontSize: 17, fontWeight: 800, marginBottom: 2 }}>{title}</div>
        {promo.description && <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{promo.description}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <button onClick={copy} aria-label={tr('home_promoCopyButton') + ' ' + promo.code}
            style={{ flex: 1, textAlign: 'left', background: 'rgba(255,255,255,0.15)', border: '1px dashed rgba(255,255,255,0.6)', borderRadius: 8, padding: '8px 12px', color: 'white', fontSize: 13, fontWeight: 800, letterSpacing: 1, cursor: 'pointer' }}>
            {promo.code || '—'} <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.8, letterSpacing: 0 }}>· {copied ? tr('home_promoCopied') : tr('home_promoCopyButton')}</span>
          </button>
          <button onClick={onUse}
            style={{ background: 'white', border: 'none', borderRadius: 8, padding: '9px 16px', color: '#FF6B35', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
            {tr('home_promoUseNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
