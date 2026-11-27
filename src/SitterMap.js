import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from './i18n';
import { pointFor } from './geo';
import SitterRating from './SitterRating';
import { color, font, radius, shadow, ui } from './theme';
import Icon from './ui/Icon';

// The sitter's area centre, never an address. Sitters in the same area are
// fanned out a little so every pin can be tapped.
export function mapPins(sitters) {
  const seen = {};
  return sitters.flatMap(s => {
    const p = pointFor({ area: s.base_area, pincode: s.base_pincode }) || (s.lat != null && s.lng != null ? { lat: s.lat, lng: s.lng } : null);
    if (!p) return [];
    const key = p.lat.toFixed(4) + ',' + p.lng.toFixed(4);
    const n = seen[key] = (seen[key] || 0) + 1;
    const angle = n * 2.4, r = n === 1 ? 0 : 0.0018 * Math.sqrt(n);
    return [{ sitter: s, lat: p.lat + r * Math.sin(angle), lng: p.lng + r * Math.cos(angle) }];
  });
}

const pinHtml = (label) => `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:${color.navy};color:#fff;font:700 13px/1 ${font.family};border:2px solid #fff;box-shadow:0 2px 6px rgba(20,37,74,0.35)">${label}</span>`;
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function SitterMap({ sitters, center, onOpen }) {
  const { t: tr } = useLanguage();
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const leafletRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(null);
  const pins = mapPins(sitters);

  useEffect(() => {
    let cancelled = false, observer = null;
    (async () => {
      try {
        const mod = await import('leaflet');
        await import('leaflet/dist/leaflet.css');
        const L = mod.default || mod;
        if (cancelled || !boxRef.current) return;
        const map = L.map(boxRef.current, { zoomControl: true }).setView([center.lat, center.lng], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
        leafletRef.current = L;
        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
        // Explore stays mounted (hidden) under an opened profile; redraw when it shows again.
        if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(boxRef.current); }
        setReady(true);
      } catch (e) {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (observer) observer.disconnect();
      if (mapRef.current) { try { mapRef.current.remove(); } catch (e) { /* already gone */ } }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pinKey = pins.map(p => p.sitter.id).join(',');
  useEffect(() => {
    const L = leafletRef.current, layer = layerRef.current, map = mapRef.current;
    if (!ready || !L || !layer || !map) return;
    layer.clearLayers();
    pins.forEach(p => {
      const icon = L.divIcon({ className: 'fursday-pin', html: pinHtml(escapeHtml(p.sitter.emoji || '·')), iconSize: [34, 34], iconAnchor: [17, 17] });
      L.marker([p.lat, p.lng], { icon, title: p.sitter.name, alt: p.sitter.name, keyboard: true })
        .on('click', () => setSelected(p.sitter))
        .addTo(layer);
    });
    if (pins.length > 1) map.fitBounds(pins.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 14 });
    else if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 13);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pinKey]);

  useEffect(() => {
    if (selected && !sitters.some(s => s.id === selected.id)) setSelected(null);
  }, [sitters, selected]);

  const unplaced = sitters.length - pins.length;
  return (
    <div>
      <div style={{ position: 'relative', borderRadius: radius.lg, overflow: 'hidden', border: `1px solid ${color.line}`, background: color.tile }}>
        <div ref={boxRef} role="region" aria-label={tr('explore_mapLabel')} data-testid="sitter-map" style={{ height: '58vh', minHeight: 320, width: '100%' }} />
        {failed && (
          <div role="alert" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontSize: font.md, color: color.muted }}>
            {tr('explore_mapFailed')}
          </div>
        )}
        {selected && (
          <div role="dialog" aria-label={selected.name}
            style={{ position: 'absolute', left: 10, right: 10, bottom: 10, zIndex: 1000, background: color.surface, borderRadius: radius.lg, boxShadow: shadow.raised, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 48, height: 48, borderRadius: radius.md, background: color.navySoft, color: color.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, overflow: 'hidden', flexShrink: 0 }}>
              {selected.profilePhoto ? <img src={selected.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : selected.emoji}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: font.sm, color: color.muted, marginTop: 2 }}>
                <SitterRating rating={selected.rating} count={selected.reviewCount} />
                <span>{tr('explore_fromPrice', { price: Math.round(selected.minPrice) })}</span>
              </div>
              <div style={{ fontSize: font.xs, color: color.muted, marginTop: 2 }}>{selected.base_area || ''}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
              <button type="button" onClick={() => onOpen(selected)} style={{ ...ui.primaryButton, minHeight: 44, padding: '0 12px', fontSize: 13 }}>{tr('explore_viewProfile')}</button>
            </div>
            <button type="button" onClick={() => setSelected(null)} aria-label={tr('common_close')}
              style={{ position: 'absolute', top: -14, right: -6, width: 44, height: 44, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
              <span style={{ width: 26, height: 26, borderRadius: radius.pill, background: color.surface, boxShadow: shadow.card, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color.text }}><Icon name="close" size={14} /></span>
            </button>
          </div>
        )}
      </div>
      <div style={{ fontSize: font.xs, color: color.muted, marginTop: 8, lineHeight: 1.5 }}>
        {tr('explore_mapApprox')}{unplaced > 0 ? ' ' + tr('explore_mapUnplaced', { n: unplaced }) : ''}
      </div>
    </div>
  );
}
