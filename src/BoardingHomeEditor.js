import React, { useRef, useState } from 'react';
import { supabase } from './supabase';
import { choosePhoto } from './photoPicker';
import { compressImage } from './compressImage';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

export const PROVIDER_TYPES = ['sitter', 'boarding', 'both'];
export const isBoardingHost = (type) => type === 'boarding' || type === 'both';

// Stored as English codes in sitter_profiles.home_details, shown translated.
export const HOME_OPTIONS = {
  home_type: ['apartment', 'independent_house', 'villa', 'farmhouse'],
  outdoor: ['balcony', 'terrace', 'garden', 'park_nearby'],
  someone_home: ['all_day', 'most_of_day', 'part_time'],
  kids: ['none', 'under_10', 'older'],
  other_pets: ['none', 'dogs', 'cats', 'both'],
  sleeping: ['indoors_free', 'bed_shared', 'own_bed', 'crate'],
  sizes: ['small', 'medium', 'large', 'giant'],
  updates: ['photos_daily', 'photos_twice', 'video_call'],
};
export const homeOptionKey = (field, code) => 'bhome_' + field + '_' + code;
export const MAX_HOME_PHOTOS = 6;
export const RULES_MAX = 300;
export const RULES_MIN = 20;
export const MAX_GUEST_DOGS = 6;

const filled = (v) => v != null && v !== '';
const HOME_CHECKS = [
  { id: 'photos1', points: 15, ok: (d, p) => p.length >= 1 },
  { id: 'photos3', points: 10, ok: (d, p) => p.length >= 3 },
  { id: 'home_type', points: 10, ok: d => filled(d.home_type) },
  { id: 'outdoor', points: 10, ok: d => (d.outdoor || []).length > 0 },
  { id: 'someone_home', points: 10, ok: d => filled(d.someone_home) },
  { id: 'household', points: 10, ok: d => filled(d.kids) && filled(d.other_pets) },
  { id: 'sleeping', points: 10, ok: d => filled(d.sleeping) && typeof d.ac === 'boolean' },
  { id: 'dogs', points: 10, ok: d => (d.sizes || []).length > 0 && filled(d.max_dogs) },
  { id: 'rules', points: 10, ok: d => (d.rules || '').trim().length >= RULES_MIN },
  { id: 'care', points: 5, ok: d => filled(d.updates) && filled(d.vet_km) },
];

// How complete a boarding home profile is, and what to add next (biggest win first).
export function homeStrength(details, photos) {
  const d = details || {}, p = photos || [];
  const missing = HOME_CHECKS.filter(c => !c.ok(d, p))
    .map(c => ({ id: c.id, points: c.points, labelKey: 'bhome_check_' + c.id, tipKey: 'bhome_tip_' + c.id }))
    .sort((a, b) => b.points - a.points);
  const pct = 100 - missing.reduce((sum, m) => sum + m.points, 0);
  return { pct, missing };
}

// "Independent house · Garden · Park nearby", or '' when nothing is filled in.
export function homeSummary(tr, details) {
  const d = details || {};
  return [d.home_type && tr(homeOptionKey('home_type', d.home_type)), ...(d.outdoor || []).map(o => tr(homeOptionKey('outdoor', o)))]
    .filter(Boolean).join(' · ');
}

export default function BoardingHomeEditor({ details, photos, onChange, onPhotosChange }) {
  const { t: tr } = useLanguage();
  const d = details || {};
  const list = photos || [];
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const strength = homeStrength(d, list);
  const set = (field, value) => onChange({ ...d, [field]: value });
  const toggle = (field, code) => {
    const cur = d[field] || [];
    set(field, cur.includes(code) ? cur.filter(x => x !== code) : [...cur, code]);
  };

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_HOME_PHOTOS - list.length);
    if (!files.length) return;
    setUploading(true);
    const added = [];
    try {
      const { data: { user } } = await supabase.auth.getUser();
      for (const file of files) {
        const compressed = await compressImage(file);
        const path = user.id + '/home/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        const { error } = await supabase.storage.from('sitter-photos').upload(path, compressed);
        if (error) throw error;
        added.push(supabase.storage.from('sitter-photos').getPublicUrl(path).data.publicUrl);
      }
    } catch (err) { alert(tr('bhome_uploadFailed', { error: err.message || err })); }
    if (added.length) onPhotosChange([...list, ...added]);
    setUploading(false);
    if (e.target && 'value' in e.target) e.target.value = '';
  };

  const card = { ...ui.card, marginBottom: 12 };
  const cardTitle = { fontSize: font.md, fontWeight: 700, color: color.ink, margin: '0 0 12px' };
  const chip = (on) => ({ ...ui.chip(on), minHeight: 44 });

  const group = (field, { multi = false } = {}) => {
    const labelId = 'bhome-' + field;
    return (
      <div style={{ marginBottom: 14 }}>
        <div id={labelId} style={ui.label}>{tr('bhome_field_' + field)}</div>
        {multi && <div style={{ fontSize: font.xs, color: color.muted, margin: '-2px 0 8px' }}>{tr('bhome_multiHint')}</div>}
        <div role="group" aria-labelledby={labelId} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {HOME_OPTIONS[field].map(code => {
            const on = multi ? (d[field] || []).includes(code) : d[field] === code;
            return (
              <button key={code} type="button" aria-pressed={on} style={chip(on)}
                onClick={() => (multi ? toggle(field, code) : set(field, code))}>
                {tr(homeOptionKey(field, code))}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const meterColor = strength.pct === 100 ? color.success : strength.pct >= 70 ? color.navy : color.saffron;

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: font.sm, fontWeight: 600, color: color.text }}>{tr('bhome_strengthTitle')}</span>
          <span style={{ fontSize: font.sm, fontWeight: 700, color: strength.pct === 100 ? color.success : color.navy, fontVariantNumeric: 'tabular-nums' }}>{strength.pct}%</span>
        </div>
        <div role="meter" aria-label={tr('bhome_strengthTitle')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={strength.pct} style={{ background: color.tile, borderRadius: radius.pill, height: 6 }}>
          <div style={{ background: meterColor, borderRadius: radius.pill, height: 6, width: strength.pct + '%', transition: 'width 0.3s' }} />
        </div>
        {strength.missing.length ? (
          <ul aria-label={tr('bhome_nextSteps')} style={{ listStyle: 'none', margin: '12px 0 0', padding: 0 }}>
            {strength.missing.slice(0, 3).map(m => (
              <li key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: font.sm, color: color.text, lineHeight: 1.5, padding: '4px 0' }}>
                <Icon name="plus" size={14} color={color.navy} style={{ marginTop: 3 }} />{tr(m.tipKey, { n: m.points })}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: color.success, fontSize: font.sm, marginTop: 10 }}><Icon name="check" size={15} />{tr('bhome_strengthAllDone')}</div>
        )}
      </div>

      <div style={card}>
        <h2 style={cardTitle}>{tr('bhome_photosTitle')}</h2>
        <div style={{ background: color.navySoft, borderRadius: radius.md, padding: '10px 12px', marginBottom: 12, display: 'flex', gap: 8 }}>
          <Icon name="camera" size={16} color={color.navy} style={{ marginTop: 2 }} />
          <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.5 }}>{tr('bhome_photosHint')}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {list.map((url, i) => (
            <div key={url + i} style={{ position: 'relative', aspectRatio: '1' }}>
              <img src={url} alt={tr('bhome_photoAlt', { n: i + 1 })} style={{ width: '100%', height: '100%', borderRadius: radius.md, objectFit: 'cover', display: 'block' }} />
              <button type="button" onClick={() => onPhotosChange(list.filter((_, j) => j !== i))} aria-label={tr('bhome_removePhotoLabel', { n: i + 1 })}
                style={{ position: 'absolute', top: 4, right: 4, width: 32, height: 32, padding: 0, border: 'none', borderRadius: radius.pill, background: color.surface, color: color.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 4px rgba(16,24,40,0.2)' }}>
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          {list.length < MAX_HOME_PHOTOS && (
            <button type="button" onClick={() => choosePhoto(inputRef, handleFiles)} aria-label={tr('bhome_addHomePhotoLabel')} disabled={uploading}
              style={{ aspectRatio: '1', padding: 0, fontFamily: 'inherit', borderRadius: radius.md, background: color.tile, border: `1.5px dashed ${color.faint}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 4, color: color.navy }}>
              {uploading ? <span style={{ fontSize: font.sm }}>...</span> : <><Icon name="camera" size={20} /><span style={{ fontSize: font.xs, fontWeight: 600 }}>{tr('bhome_addPhoto')}</span></>}
            </button>
          )}
        </div>
        <div style={{ fontSize: font.xs, color: color.muted, marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>{tr('bhome_photoCount', { n: list.length, max: MAX_HOME_PHOTOS })}</div>
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} data-testid="home-photo-input" />
      </div>

      <div style={card}>
        <h2 style={cardTitle}>{tr('bhome_sectionHome')}</h2>
        {group('home_type')}
        {group('outdoor', { multi: true })}
        {group('someone_home')}
      </div>

      <div style={card}>
        <h2 style={cardTitle}>{tr('bhome_sectionHousehold')}</h2>
        {group('kids')}
        {group('other_pets')}
      </div>

      <div style={card}>
        <h2 style={cardTitle}>{tr('bhome_sectionStay')}</h2>
        {group('sleeping')}
        <div style={{ marginBottom: 14 }}>
          <div id="bhome-ac" style={ui.label}>{tr('bhome_field_ac')}</div>
          <div role="group" aria-labelledby="bhome-ac" style={{ display: 'flex', gap: 8 }}>
            {[true, false].map(v => (
              <button key={String(v)} type="button" aria-pressed={d.ac === v} onClick={() => set('ac', v)} style={{ ...chip(d.ac === v), flex: 1 }}>
                {tr(v ? 'bhome_ac_yes' : 'bhome_ac_no')}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div id="bhome-max-dogs" style={ui.label}>{tr('bhome_field_max_dogs')}</div>
          <div role="group" aria-labelledby="bhome-max-dogs" style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: MAX_GUEST_DOGS }, (_, i) => i + 1).map(n => (
              <button key={n} type="button" aria-pressed={d.max_dogs === n} onClick={() => set('max_dogs', n)}
                style={{ ...chip(d.max_dogs === n), flex: 1, minWidth: 0, padding: 0, borderRadius: radius.md, fontSize: font.lg }}>
                {n}
              </button>
            ))}
          </div>
        </div>
        {group('sizes', { multi: true })}
      </div>

      <div style={card}>
        <h2 style={cardTitle}>{tr('bhome_sectionCare')}</h2>
        <div style={{ marginBottom: 14 }}>
          <label htmlFor="bhome-vet" style={ui.label}>{tr('bhome_field_vet_km')}</label>
          <input id="bhome-vet" type="number" inputMode="decimal" min={0} max={50} step={0.5} value={d.vet_km ?? ''} placeholder={tr('bhome_vetPlaceholder')}
            onChange={e => set('vet_km', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
            style={{ ...ui.input, maxWidth: 160 }} />
        </div>
        {group('updates')}
      </div>

      <div style={card}>
        <label htmlFor="bhome-rules" style={{ ...cardTitle, display: 'block', marginBottom: 4 }}>{tr('bhome_field_rules')}</label>
        <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 8 }}>{tr('bhome_rulesHint')}</div>
        <textarea id="bhome-rules" value={d.rules || ''} maxLength={RULES_MAX} placeholder={tr('bhome_rulesPlaceholder')}
          onChange={e => set('rules', e.target.value.slice(0, RULES_MAX))}
          style={{ ...ui.input, fontSize: font.md, resize: 'vertical', minHeight: 96, lineHeight: 1.6 }} />
        <div style={{ fontSize: font.xs, color: color.faint, textAlign: 'right', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{(d.rules || '').length}/{RULES_MAX}</div>
      </div>
    </div>
  );
}
