// Fursday design system ("Direction A — clean utility"), approved by the owner
// 2026-11-26. One brand colour (navy, from the app icon), saffron only for
// small highlights, line icons (src/ui/Icon.js), no emoji as UI icons.
// Every screen should take its colours, type and spacing from here.

export const color = {
  navy: '#14254A',        // brand: primary buttons, active nav, links
  navyHover: '#1E3566',
  navySoft: '#EEF1F7',    // selected chips, icon tiles
  ink: '#15192A',         // main text
  text: '#2A3146',        // secondary headings
  muted: '#6A7085',       // captions, labels
  faint: '#9AA0B1',       // placeholders, disabled
  line: '#ECE5DA',        // borders, dividers (warm, to sit on cream)
  bg: '#FBF8F3',          // page background: soft cream (owner pick, 2026-11-26)
  surface: '#FFFFFF',     // cards, sheets, nav bar
  tile: '#F3EEE5',        // icon tiles, input fills
  saffron: '#E8892B',     // highlight only: offers, badges, progress
  saffronSoft: '#FDF1E4',
  success: '#1F7A4D', successSoft: '#EAF3EA',
  warning: '#9A5B00', warningSoft: '#FFF4E0',
  danger: '#B3261E', dangerSoft: '#FCEDEC',
  info: '#1D4ED8', infoSoft: '#EAF0FE',
};

export const font = {
  family: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Devanagari", sans-serif',
  // Type scale (px). Keep to these.
  xs: 11, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24,
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const shadow = {
  card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
  raised: '0 8px 24px rgba(20,37,74,0.12)',
};

// Height reserved at the bottom of scrolling screens for the fixed nav bar.
export const NAV_HEIGHT = 64;
export const navPadding = `calc(${NAV_HEIGHT + 16}px + env(safe-area-inset-bottom))`;

// Shared building blocks as plain style objects, so screens stay consistent
// without a component library.
export const ui = {
  page: { maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: color.bg, fontFamily: font.family, color: color.ink },
  // paddingRight leaves room for the floating EN/हिं toggle (LanguageToggle).
  header: { background: color.bg, padding: 'calc(12px + env(safe-area-inset-top)) 108px 12px 16px', borderBottom: `1px solid ${color.line}`, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 },
  headerTitle: { fontSize: font.lg, fontWeight: 700, color: color.ink, margin: 0 },
  backButton: { width: 40, height: 40, borderRadius: radius.md, border: 'none', background: color.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: color.ink, flexShrink: 0 },
  card: { background: color.surface, borderRadius: radius.lg, border: `1px solid ${color.line}`, padding: 16 },
  sectionTitle: { fontSize: font.md, fontWeight: 700, color: color.ink, margin: '0 0 10px' },
  label: { fontSize: font.sm, fontWeight: 600, color: color.text, marginBottom: 6, display: 'block' },
  input: { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: radius.md, border: `1px solid ${color.line}`, background: color.surface, fontSize: 15, color: color.ink, outline: 'none', fontFamily: 'inherit' },
  primaryButton: { minHeight: 48, padding: '0 18px', borderRadius: radius.md, border: 'none', background: color.navy, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryButton: { minHeight: 48, padding: '0 18px', borderRadius: radius.md, border: `1px solid ${color.line}`, background: color.surface, color: color.ink, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  dangerButton: { minHeight: 44, padding: '0 16px', borderRadius: radius.md, border: `1px solid ${color.dangerSoft}`, background: color.surface, color: color.danger, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  chip: (active) => ({ minHeight: 36, padding: '0 14px', borderRadius: radius.pill, border: `1px solid ${active ? color.navy : color.line}`, background: active ? color.navy : color.surface, color: active ? '#fff' : color.text, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }),
  badge: (tone = 'info') => ({ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: radius.pill, background: color[tone + 'Soft'], color: color[tone] }),
  iconTile: { width: 48, height: 48, borderRadius: radius.md, background: color.tile, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.navy, flexShrink: 0 },
};

// Booking status → badge tone, used by every list that shows a status.
export const statusTone = { pending: 'warning', confirmed: 'info', active: 'success', completed: 'success', cancelled: 'danger' };
