import React from 'react';

// Line icon set for the whole app (24px grid, 1.75 stroke). Use these instead
// of emoji for anything that acts as a UI icon.
const P = {
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  message: <><path d="M4 5h16v11H8l-4 4z" /></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /><circle cx="16.5" cy="15" r="1.2" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5h6v2M3 13h18" /></>,
  walk: <><circle cx="13" cy="4" r="2" /><path d="M11 21l2-6-3-3 1-5 3 3h3" /><path d="M8 13l-2 8" /></>,
  boarding: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M9 15h6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  megaphone: <><path d="M3 11v2a1 1 0 001 1h3l6 4V6L7 10H4a1 1 0 00-1 1z" /><path d="M17 9a4 4 0 010 6" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11a7 7 0 1114 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  bell: <><path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 20a2 2 0 004 0" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
  paw: <><ellipse cx="7" cy="8" rx="1.8" ry="2.4" /><ellipse cx="12" cy="5.6" rx="1.8" ry="2.4" /><ellipse cx="17" cy="8" rx="1.8" ry="2.4" /><path d="M12 11c3 0 6 3.6 6 6 0 1.8-1.6 2.6-3.1 2.2-1.1-.3-1.8-.8-2.9-.8s-1.8.5-2.9.8C7.6 19.6 6 18.8 6 17c0-2.4 3-6 6-6z" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5L16 9.5" /></>,
  sos: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 16.5v.5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>,
  star: <><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></>,
  chevronRight: <><path d="M9 6l6 6-6 6" /></>,
  chevronDown: <><path d="M6 9l6 6 6-6" /></>,
  arrowLeft: <><path d="M19 12H5M12 19l-7-7 7-7" /></>,
  check: <><path d="M5 12l5 5L20 7" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  phone: <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></>,
  camera: <><path d="M4 7h3l2-3h6l2 3h3a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1z" /><circle cx="12" cy="13" r="4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  gift: <><rect x="3" y="8" width="18" height="13" rx="1" /><path d="M3 12h18M12 8v13M12 8c-1.5-3-5-3-5 0M12 8c1.5-3 5-3 5 0" /></>,
  logout: <><path d="M15 4h4a1 1 0 011 1v14a1 1 0 01-1 1h-4M10 17l5-5-5-5M15 12H3" /></>,
  heart: <><path d="M12 20s-7-4.4-8.6-9A4.8 4.8 0 0112 6.2 4.8 4.8 0 0120.6 11C19 15.6 12 20 12 20z" /></>,
  heartFilled: <><path d="M12 20s-7-4.4-8.6-9A4.8 4.8 0 0112 6.2 4.8 4.8 0 0120.6 11C19 15.6 12 20 12 20z" fill="currentColor" /></>,
  starFilled: <><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill="currentColor" /></>,
  receipt: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  alert: <><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4M12 17v.5" /></>,
  repeat: <><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 01-4 4H4" /></>,
  close: <><path d="M6 6l12 12M18 6L6 18" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  printer: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></>,
  edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
  thermometer: <><path d="M14 14.8V5a2 2 0 00-4 0v9.8a4 4 0 104 0z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></>,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></>,  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-9 9" /></>,
  send: <><path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  droplet: <><path d="M12 3s6 6.6 6 11a6 6 0 01-12 0c0-4.4 6-11 6-11z" /></>,
  pill: <><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M8.5 8.5l7 7" /></>,
  smartphone: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>,
  fileText: <><path d="M14 3H6a1 1 0 00-1 1v16a1 1 0 001 1h12a1 1 0 001-1V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  stethoscope: <><path d="M5 3v6a5 5 0 0010 0V3" /><path d="M10 14v2a5 5 0 0010 0v-2" /><circle cx="20" cy="12" r="2" /></>,
  tag: <><path d="M3 12V4a1 1 0 011-1h8l9 9-9 9z" /><circle cx="8" cy="8" r="1.5" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1.2-3.4 3.6-5 6.5-5s5.3 1.6 6.5 5" /><path d="M16 4.6a3.5 3.5 0 010 6.8M18 15.4c1.6.7 2.8 2.2 3.5 4.6" /></>,
  scale: <><path d="M12 3v18M7 21h10M5 7h14" /><path d="M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0z" /></>,
  refresh: <><path d="M20 11a8 8 0 00-14.6-4.5L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0014.6 4.5L20 16" /><path d="M20 21v-5h-5" /></>,
  pause: <><circle cx="12" cy="12" r="9" /><path d="M10 9v6M14 9v6" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5l5 3.5-5 3.5z" /></>,
  map: <><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>,
  history: <><path d="M3 12a9 9 0 103-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  filter: <><path d="M3 5h18l-7 8v6l-4 2v-8z" /></>,
  trendUp: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  trendDown: <><path d="M3 7l6 6 4-4 8 8" /><path d="M15 17h6v-6" /></>,
  award: <><circle cx="12" cy="9" r="6" /><path d="M8.5 13.9L7 22l5-3 5 3-1.5-8.1" /></>,
  inbox: <><path d="M3 13h5l2 3h4l2-3h5" /><path d="M5 5h14l2 8v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6z" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 00-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0012 3z" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z" /></>,
  tree: <><path d="M12 3l6 8h-3l4 6H5l4-6H6z" /><path d="M12 17v4" /></>,
  bed: <><path d="M3 18V7M3 13h18v5M21 18v-5a3 3 0 00-3-3h-7v3" /><circle cx="7" cy="10.5" r="1.5" /></>,
  snowflake: <><path d="M12 2v20M4 7l16 10M4 17L20 7" /><path d="M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2" /></>,
};

export default function Icon({ name, size = 22, color = 'currentColor', strokeWidth = 1.75, style, title }) {
  const paths = P[name];
  if (!paths) return null;
  return (
    // 'lucide-arrow-left' keeps the Android hardware back button working: App.js
    // presses the visible back arrow by looking for that class.
    <svg className={name === 'arrowLeft' ? 'lucide-arrow-left' : undefined} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {paths}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(P);
