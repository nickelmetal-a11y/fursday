import React from 'react';
import Icon from './Icon';
import { color, font } from '../theme';
import { useLanguage } from '../i18n';

// The app's only bottom navigation bar. App.js renders it once, outside the
// screens, so it never remounts or shifts when the screen changes (each screen
// used to draw its own slightly different copy, which is why it jumped).
// Style: owner-picked "embossed bar, navy key" — a soft cream bar pressed out of
// the page, with the active tab as a raised navy key (2026-11-26).
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

const EMBOSS = '8px 8px 18px rgba(170,150,120,0.32), -8px -8px 18px rgba(255,255,255,0.95), inset 0 1px 0 rgba(255,255,255,0.9)';
const KEY = '0 6px 12px rgba(20,37,74,0.35), inset 0 1px 0 rgba(255,255,255,0.25), 3px 3px 6px rgba(170,150,120,0.25)';

export default function BottomNav({ tabs, active, onSelect }) {
  const { t } = useLanguage();
  return (
    <nav aria-label="Main"
      style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 900, padding: '0 12px', pointerEvents: 'none', transform: 'translateZ(0)' }}>
      <div style={{ pointerEvents: 'auto', maxWidth: 456, margin: '0 auto', height: 62, borderRadius: 24, background: color.bg, boxShadow: EMBOSS,
        display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, padding: '0 6px' }}>
        {tabs.map(tab => {
          const on = tab.id === active;
          return (
            <button key={tab.id} type="button" onClick={() => onSelect(tab.id)} aria-current={on ? 'page' : undefined}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                color: on ? color.navy : color.faint, fontFamily: font.family, WebkitTapHighlightColor: 'transparent' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 44, height: 32, borderRadius: 12, transition: 'transform 0.2s, background 0.2s, box-shadow 0.2s',
                background: on ? color.navy : 'transparent', color: on ? '#fff' : 'inherit', boxShadow: on ? KEY : 'none', transform: on ? 'translateY(-2px)' : 'none' }}>
                <Icon name={tab.icon} size={20} strokeWidth={on ? 2 : 1.75} />
              </span>
              <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 500, letterSpacing: 0.1 }}>{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
