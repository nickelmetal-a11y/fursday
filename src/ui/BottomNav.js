import React from 'react';
import Icon from './Icon';
import { color, font, NAV_HEIGHT } from '../theme';
import { useLanguage } from '../i18n';

// The app's only bottom navigation bar. App.js renders it once, outside the
// screens, so it never remounts or shifts when the screen changes (each screen
// used to draw its own slightly different copy, which is why it jumped).
export const PARENT_TABS = [
  { id: 'home', icon: 'home', labelKey: 'nav_home' },
  { id: 'bookings', icon: 'calendar', labelKey: 'nav_bookings' },
  { id: 'explore', icon: 'search', labelKey: 'nav_explore' },
  { id: 'pets', icon: 'paw', labelKey: 'nav_myPets' },
  { id: 'account', icon: 'user', labelKey: 'nav_account' },
];
export const SITTER_TABS = [
  { id: 'jobs', icon: 'briefcase', labelKey: 'nav_jobs' },
  { id: 'earnings', icon: 'wallet', labelKey: 'nav_earnings' },
  { id: 'messages', icon: 'message', labelKey: 'nav_messages' },
  { id: 'profile', icon: 'user', labelKey: 'nav_sitterProfile' },
  { id: 'account', icon: 'settings', labelKey: 'nav_account' },
];

export default function BottomNav({ tabs, active, onSelect }) {
  const { t } = useLanguage();
  return (
    <nav aria-label="Main"
      style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 900, background: color.surface, borderTop: `1px solid ${color.line}`,
        paddingBottom: 'env(safe-area-inset-bottom)', transform: 'translateZ(0)', willChange: 'transform' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', height: NAV_HEIGHT, display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map(tab => {
          const on = tab.id === active;
          return (
            <button key={tab.id} type="button" onClick={() => onSelect(tab.id)} aria-current={on ? 'page' : undefined}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                color: on ? color.navy : color.faint, fontFamily: font.family, WebkitTapHighlightColor: 'transparent' }}>
              <Icon name={tab.icon} size={22} strokeWidth={on ? 2.1 : 1.75} />
              <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, letterSpacing: 0.1 }}>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
