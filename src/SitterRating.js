import React from 'react';
import { useLanguage } from './i18n';
import { color, ui } from './theme';
import Icon from './ui/Icon';

// Star + score for reviewed sitters, a "New" badge for everyone else.
export default function SitterRating({ rating, count, size = 13 }) {
  const { t: tr } = useLanguage();
  if (rating == null) {
    return <span style={{ ...ui.badge('info'), padding: '1px 7px' }} aria-label={tr('rating_newAria')}>{tr('rating_new')}</span>;
  }
  const value = Number(rating).toFixed(1);
  return (
    <span role="img" aria-label={count ? tr('rating_countAria', { rating: value, n: count }) : tr('rating_aria', { rating: value })}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <Icon name="starFilled" size={size} color={color.saffron} />
      <span style={{ fontWeight: 600, color: color.ink }}>{value}</span>
      {count ? <span>({count})</span> : null}
    </span>
  );
}
