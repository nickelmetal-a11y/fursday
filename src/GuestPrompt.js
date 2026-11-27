import React from 'react';
import { useLanguage } from './i18n';
import { color, font, ui, navPadding } from './theme';
import Icon from './ui/Icon';

const TABS = {
  bookings: { icon: 'calendar', nav: 'nav_bookings', title: 'guest_bookingsTitle', body: 'guest_bookingsBody' },
  pets: { icon: 'paw', nav: 'nav_myPets', title: 'guest_petsTitle', body: 'guest_petsBody' },
  account: { icon: 'user', nav: 'nav_account', title: 'guest_accountTitle', body: 'guest_accountBody' },
};

// What a visitor sees on the tabs that need an account.
export default function GuestPrompt({ tab, onSignIn }) {
  const { t: tr } = useLanguage();
  const cfg = TABS[tab] || TABS.account;
  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      <div style={ui.header}>
        <h1 style={ui.headerTitle}>{tr(cfg.nav)}</h1>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ ...ui.card, textAlign: 'center', padding: '28px 20px' }}>
          <div style={{ ...ui.iconTile, margin: '0 auto 14px', background: color.navySoft }}><Icon name={cfg.icon} /></div>
          <h2 style={{ fontSize: font.lg, fontWeight: 700, color: color.ink, margin: '0 0 6px' }}>{tr(cfg.title)}</h2>
          <div style={{ fontSize: font.md, color: color.muted, lineHeight: 1.5, marginBottom: 18 }}>{tr(cfg.body)}</div>
          <button type="button" onClick={onSignIn} style={{ ...ui.primaryButton, width: '100%' }}>{tr('guest_signInOrCreate')}</button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, fontSize: font.xs, color: color.muted }}>
            <Icon name="lock" size={13} color={color.faint} />{tr('guest_emailNote')}
          </div>
        </div>
      </div>
    </div>
  );
}
