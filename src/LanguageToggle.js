import React from 'react';
import { useLanguage } from './i18n';
import { color, font, radius, shadow } from './theme';

const OPTIONS = [['en', 'EN'], ['hi', 'हिं']];

// Rendered once by App.js. By default it floats in the top-right of the
// standard header row; ui.header (theme.js) reserves that space so it never
// covers a title or action. Screens with their own top bar (Home) render it
// inline instead and App.js hides the floating copy.
export default function LanguageToggle({ inline = false }) {
  const { lang, setLang, t: tr } = useLanguage();
  const control = (
      <div role="group" aria-label={tr('settings_language')}
        style={{ pointerEvents: 'auto', display: 'flex', gap: 2, padding: 2, background: color.surface, border: `1px solid ${color.line}`, borderRadius: radius.pill, boxShadow: shadow.card }}>
        {OPTIONS.map(([code, label]) => {
          const on = lang === code;
          return (
            <button key={code} type="button" onClick={() => setLang(code)} aria-pressed={on}
              style={{ minWidth: 36, height: 28, padding: '0 10px', border: 'none', borderRadius: radius.pill, fontSize: font.xs, fontWeight: 600, fontFamily: font.family, letterSpacing: 0.2, cursor: 'pointer',
                background: on ? color.navy : 'transparent', color: on ? color.surface : color.muted, transition: 'background 0.15s, color 0.15s' }}>
              {label}
            </button>
          );
        })}
      </div>
  );
  if (inline) return control;
  return (
    <div style={{ position: 'fixed', top: 'calc(18px + env(safe-area-inset-top))', left: 0, right: 0, maxWidth: 480, margin: '0 auto', zIndex: 4000, pointerEvents: 'none', display: 'flex', justifyContent: 'flex-end', padding: '0 12px', boxSizing: 'border-box' }}>
      {control}
    </div>
  );
}
