import React, { useState } from 'react';
import { useLanguage } from './i18n';
import { searchLocalities, nearestLocality } from './geo';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

export const RADIUS_MIN = 1;
export const RADIUS_MAX = 15;
const RADIUS_CHIPS = [2, 5, 8, 12];

// Where a sitter works from and how far they travel. The saved point is the
// locality's approximate centre, never the sitter's exact GPS fix, because
// sitter_profiles is readable by every parent.
// value: { base_area, base_pincode, lat, lng, service_radius_km }
export default function ServiceAreaPicker({ city, value, onChange }) {
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const searching = editing || !value?.base_area;
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState(null);
  const radiusKm = Number(value?.service_radius_km) || 5;
  const results = searchLocalities(query, city);

  const pick = (loc) => {
    onChange({ base_area: loc.name, base_pincode: loc.pincode, lat: loc.lat, lng: loc.lng });
    setQuery('');
    setEditing(false);
    setNotice(null);
  };

  const useMyLocation = () => {
    setNotice(null);
    if (!navigator.geolocation) { setNotice(t('area_gpsUnavailable')); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const loc = nearestLocality(pos.coords.latitude, pos.coords.longitude, city);
        if (loc) pick(loc);
        else setNotice(t('area_gpsNoMatch'));
      },
      () => { setLocating(false); setNotice(t('area_gpsDenied')); },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div>
      <div style={ui.label}>{t('area_baseLabel')}</div>
      {value?.base_area && !searching ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: radius.md, background: color.navySoft, marginBottom: 8 }}>
          <Icon name="pin" size={18} color={color.navy} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{value.base_area}</div>
            {value.base_pincode && <div style={{ fontSize: font.sm, color: color.muted, fontVariantNumeric: 'tabular-nums' }}>{value.base_pincode}</div>}
          </div>
          <button type="button" onClick={() => setEditing(true)} style={{ ...ui.secondaryButton, minHeight: 36, padding: '0 12px', fontSize: font.sm }}>{t('area_change')}</button>
        </div>
      ) : (
        <div style={{ marginBottom: 8 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 13, color: color.muted, pointerEvents: 'none' }}><Icon name="search" size={18} /></span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('area_searchPlaceholder')} aria-label={t('area_searchPlaceholder')}
              style={{ ...ui.input, paddingLeft: 38 }} />
          </div>
          {query.trim() && (
            <div role="listbox" aria-label={t('area_suggestions')} style={{ border: `1px solid ${color.line}`, borderRadius: radius.md, marginTop: 6, overflow: 'hidden', background: color.surface }}>
              {results.length === 0 && <div style={{ padding: '12px 14px', fontSize: font.sm, color: color.muted }}>{t('area_noResults')}</div>}
              {results.map((l, i) => (
                <button key={l.name + l.pincode} type="button" role="option" aria-selected={false} onClick={() => pick(l)}
                  style={{ width: '100%', minHeight: 48, padding: '8px 14px', border: 'none', borderTop: i ? `1px solid ${color.line}` : 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Icon name="pin" size={16} color={color.muted} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: font.md, fontWeight: 600, color: color.ink }}>{l.name}</span>
                    <span style={{ display: 'block', fontSize: font.sm, color: color.muted }}>{l.district} · {l.pincode}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
          {value?.base_area && (
            <button type="button" onClick={() => { setEditing(false); setQuery(''); }} style={{ background: 'none', border: 'none', color: color.muted, fontSize: font.sm, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 36, padding: 0, marginTop: 4 }}>
              {t('common_cancel')}
            </button>
          )}
        </div>
      )}
      <button type="button" onClick={useMyLocation} disabled={locating}
        style={{ ...ui.secondaryButton, width: '100%', minHeight: 44, fontSize: font.md, color: color.navy }}>
        <Icon name="pin" size={18} />{locating ? t('area_locating') : t('area_useLocation')}
      </button>
      {notice && <div role="alert" style={{ fontSize: font.sm, color: color.warning, marginTop: 8, lineHeight: 1.5 }}>{notice}</div>}

      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={ui.label}>{t('area_radiusLabel')}</span>
          <span style={{ fontSize: font.xl, fontWeight: 700, color: color.navy, fontVariantNumeric: 'tabular-nums' }}>{t('area_km', { n: radiusKm })}</span>
        </div>
        <input type="range" min={RADIUS_MIN} max={RADIUS_MAX} step={1} value={radiusKm} aria-label={t('area_radiusLabel')}
          onChange={e => onChange({ service_radius_km: parseInt(e.target.value, 10) })}
          style={{ width: '100%', accentColor: color.navy }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {RADIUS_CHIPS.map(n => (
            <button key={n} type="button" onClick={() => onChange({ service_radius_km: n })} aria-pressed={radiusKm === n}
              style={{ ...ui.chip(radiusKm === n), flex: 1, minHeight: 40, padding: '0 6px' }}>
              {t('area_km', { n })}
            </button>
          ))}
        </div>
        <div style={{ fontSize: font.sm, color: color.muted, marginTop: 10, lineHeight: 1.5 }}>
          {value?.base_area ? t('area_radiusHint', { n: radiusKm, area: value.base_area }) : t('area_radiusHintNoArea')}
        </div>
      </div>
    </div>
  );
}
