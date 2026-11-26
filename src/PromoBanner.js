import React, { useState } from 'react';
import { useLanguage } from './i18n';
import { color, font, radius } from './theme';
import Icon from './ui/Icon';

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
    <div style={{ borderRadius: radius.lg, background: color.navy, padding: 16, color: '#fff', fontFamily: font.family }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#F3B77A', textTransform: 'uppercase' }}>
        <Icon name="gift" size={14} color="#F3B77A" />{tr('home_promoBadge')}
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6, letterSpacing: -0.2 }}>{title}</div>
      {promo.description && <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>{promo.description}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
        <button onClick={copy} aria-label={tr('home_promoCopyButton') + ' ' + promo.code}
          style={{ flex: 1, textAlign: 'left', background: 'rgba(255,255,255,0.08)', border: '1px dashed rgba(255,255,255,0.45)', borderRadius: radius.sm, padding: '0 12px', minHeight: 40, color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 1, cursor: 'pointer', fontFamily: font.family }}>
          {promo.code || '—'} <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.75, letterSpacing: 0 }}>· {copied ? tr('home_promoCopied') : tr('home_promoCopyButton')}</span>
        </button>
        <button onClick={onUse}
          style={{ background: color.saffron, border: 'none', borderRadius: radius.sm, padding: '0 16px', minHeight: 40, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0, fontFamily: font.family }}>
          {tr('home_promoUseNow')}
        </button>
      </div>
    </div>
  );
}
