import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, ui } from './theme';
import Icon from './ui/Icon';
import { searchLocalities, nearestLocality, localityByPincode, pointFor } from './geo';

// Labels are stored in English and shown translated.
export const ADDRESS_LABELS = ['Home', 'Work', 'Other'];
const LABEL_KEYS = { Home: 'addr_labelHome', Work: 'addr_labelWork', Other: 'addr_labelOther' };
const LABEL_ICONS = { Home: 'home', Work: 'briefcase', Other: 'pin' };

export const addressIcon = (label) => LABEL_ICONS[label] || 'pin';
export const addressLabelText = (tr, label) => (LABEL_KEYS[label] ? tr(LABEL_KEYS[label]) : label || tr('addr_labelOther'));
export const addressLine = (a) => [a?.flat, a?.building, a?.society, a?.area, a?.pincode].filter(Boolean).join(', ');

// The signed-in parent's addresses, default first. Returns [] when signed out
// or before migration 035 has created the table.
export async function loadSavedAddresses() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase.from('user_addresses').select('*').eq('user_id', user.id);
    if (error || !Array.isArray(data)) return [];
    return [...data].sort((a, b) => (!!b.is_default - !!a.is_default) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  } catch (e) {
    return [];
  }
}

export async function makeDefaultAddress(id) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error: clearErr } = await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', user.id);
    if (clearErr) return false;
    const { error } = await supabase.from('user_addresses').update({ is_default: true }).eq('id', id);
    return !error;
  } catch (e) {
    return false;
  }
}

const textButton = { minHeight: 44, padding: '0 10px', background: 'none', border: 'none', color: color.navy, fontSize: font.sm, fontWeight: 600, cursor: 'pointer', fontFamily: font.family };

export function AreaSearch({ city, value, onChange, onPick }) {
  const { t: tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const results = open ? searchLocalities(value, city) : [];
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <Icon name="search" size={16} color={color.muted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} aria-label={tr('addr_area')} placeholder={tr('addr_areaPh')}
          autoComplete="off" aria-autocomplete="list" style={{ ...ui.input, paddingLeft: 36 }} />
      </div>
      {open && value.trim() && (
        <div role="listbox" style={{ ...ui.card, padding: 0, marginTop: 6, overflow: 'hidden' }}>
          {results.length === 0 && <div style={{ padding: '12px 14px', fontSize: font.sm, color: color.muted }}>{tr('addr_noMatches')}</div>}
          {results.map((l, i) => (
            <button key={l.name} type="button" role="option" aria-selected={false} onClick={() => { onPick(l); setOpen(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '8px 14px', border: 'none', borderTop: i ? `1px solid ${color.line}` : 'none', background: color.surface, cursor: 'pointer', textAlign: 'left', fontFamily: font.family }}>
              <Icon name="pin" size={16} color={color.muted} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: font.md, fontWeight: 600, color: color.ink }}>{l.name}</span>
                <span style={{ display: 'block', fontSize: font.sm, color: color.muted, fontVariantNumeric: 'tabular-nums' }}>{l.district} · {l.pincode}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Add/edit form, shared by the address book and the booking flow.
export function AddressForm({ city, address, isFirst, onSaved, onCancel }) {
  const { t: tr } = useLanguage();
  const [label, setLabel] = useState(address?.label || 'Home');
  const [flat, setFlat] = useState(address?.flat || '');
  const [building, setBuilding] = useState(address?.building || '');
  const [society, setSociety] = useState(address?.society || '');
  const [area, setArea] = useState(address?.area || '');
  const [pincode, setPincode] = useState(address?.pincode || '');
  const [point, setPoint] = useState(address?.lat != null && address?.lng != null ? { lat: address.lat, lng: address.lng } : null);
  const [makeDefault, setMakeDefault] = useState(!!isFirst);
  const [locating, setLocating] = useState(false);
  const [gpsMessage, setGpsMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const pick = (l) => { setArea(l.name); setPincode(l.pincode); setPoint({ lat: l.lat, lng: l.lng }); setError(''); };

  const changePincode = (v) => {
    const digits = v.replace(/\D/g, '').slice(0, 6);
    setPincode(digits);
    const l = digits.length === 6 && !area.trim() ? localityByPincode(digits, city) : null;
    if (l) pick(l);
  };

  const useGps = () => {
    setGpsMessage('');
    if (!navigator.geolocation) { setGpsMessage(tr('addr_locationFailed')); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const l = nearestLocality(lat, lng, city);
      setLocating(false);
      if (!l) { setGpsMessage(tr('addr_noNearbyArea')); return; }
      setArea(l.name); setPincode(l.pincode); setPoint({ lat, lng }); setError('');
    }, () => { setLocating(false); setGpsMessage(tr('addr_locationFailed')); }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
  };

  const save = async () => {
    if (!area.trim()) { setError(tr('addr_needArea')); return; }
    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not signed in');
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      const where = point || pointFor({ area: area.trim(), pincode: pincode.trim() });
      const row = {
        user_id: user.id, label,
        flat: flat.trim() || null, building: building.trim() || null, society: society.trim() || null,
        area: area.trim(), pincode: pincode.trim() || null, city_id: cityRow?.id || null,
        lat: where?.lat ?? null, lng: where?.lng ?? null,
      };
      const query = address?.id
        ? supabase.from('user_addresses').update(row).eq('id', address.id)
        : supabase.from('user_addresses').insert({ ...row, is_default: false });
      const { data, error: saveErr } = await query.select().single();
      if (saveErr || !data) throw saveErr || new Error('not saved');
      let saved = data;
      if (makeDefault && !saved.is_default && await makeDefaultAddress(saved.id)) saved = { ...saved, is_default: true };
      setSaving(false);
      onSaved(saved);
    } catch (e) {
      console.error('Address save failed:', e);
      setError(tr('addr_saveFailed'));
      setSaving(false);
    }
  };

  const field = (labelKey, value, set, phKey) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <span style={ui.label}>{tr(labelKey)}</span>
      <input value={value} onChange={e => set(e.target.value)} aria-label={tr(labelKey)} placeholder={tr(phKey)} style={ui.input} />
    </div>
  );

  return (
    <div style={{ ...ui.card, border: `1px solid ${color.navy}` }}>
      <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink, marginBottom: 12 }}>{tr(address?.id ? 'addr_editTitle' : 'addr_newTitle')}</div>

      <span style={ui.label}>{tr('addr_saveAs')}</span>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {ADDRESS_LABELS.map(l => (
          <button key={l} type="button" onClick={() => setLabel(l)} aria-pressed={label === l} style={{ ...ui.chip(label === l), minHeight: 44, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name={addressIcon(l)} size={16} />{addressLabelText(tr, l)}
          </button>
        ))}
      </div>

      <button type="button" onClick={useGps} disabled={locating}
        style={{ ...ui.secondaryButton, width: '100%', marginBottom: 6, color: color.navy, justifyContent: 'flex-start' }}>
        <Icon name="pin" size={18} />{locating ? tr('addr_locating') : tr('addr_useLocation')}
      </button>
      {gpsMessage && <div role="status" style={{ fontSize: font.sm, color: color.warning, marginBottom: 6 }}>{gpsMessage}</div>}

      <div style={{ marginTop: 8, marginBottom: 10 }}>
        <span style={ui.label}>{tr('addr_area')}</span>
        <AreaSearch city={city} value={area} onChange={v => { setArea(v); setPoint(null); setError(''); }} onPick={pick} />
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {field('addr_flat', flat, setFlat, 'addr_flatPh')}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={ui.label}>{tr('addr_pincode')}</span>
          <input value={pincode} onChange={e => changePincode(e.target.value)} aria-label={tr('addr_pincode')} inputMode="numeric" placeholder="122011" style={{ ...ui.input, fontVariantNumeric: 'tabular-nums' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {field('addr_building', building, setBuilding, 'addr_buildingPh')}
        {field('addr_society', society, setSociety, 'addr_societyPh')}
      </div>

      {!address?.is_default && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, fontSize: font.md, color: color.text, cursor: 'pointer', marginBottom: 8 }}>
          <input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} style={{ width: 20, height: 20, accentColor: color.navy }} />
          {tr('addr_makeDefault')}
        </label>
      )}
      {error && <div role="alert" style={{ fontSize: font.sm, color: color.danger, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={save} disabled={saving} style={{ ...ui.primaryButton, flex: 2 }}>{saving ? tr('common_saving') : tr('addr_save')}</button>
        {onCancel && <button type="button" onClick={onCancel} style={{ ...ui.secondaryButton, flex: 1 }}>{tr('common_cancel')}</button>}
      </div>
    </div>
  );
}

export default function AddressBook({ city, onBack, onChanged }) {
  const { t: tr } = useLanguage();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const refresh = async () => {
    const next = await loadSavedAddresses();
    setList(next);
    setLoading(false);
    if (onChanged) onChanged(next);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, []);

  const setDefault = async (a) => { await makeDefaultAddress(a.id); refresh(); };
  const remove = async (a) => {
    if (!window.confirm(tr('addr_deleteConfirm'))) return;
    const { error } = await supabase.from('user_addresses').delete().eq('id', a.id);
    if (error) { alert(tr('common_error')); return; }
    const rest = list.filter(x => x.id !== a.id);
    if (a.is_default && rest.length) await makeDefaultAddress(rest[0].id);
    refresh();
  };

  return (
    <div style={{ ...ui.page, paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
      <div style={ui.header}>
        <button type="button" onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}><Icon name="arrowLeft" size={20} /></button>
        <h1 style={ui.headerTitle}>{tr('addr_title')}</h1>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {editing ? (
          <AddressForm city={city} address={editing === 'new' ? null : editing} isFirst={list.length === 0}
            onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
        ) : (
          <>
            {loading && [0, 1].map(i => <div key={i} aria-hidden="true" style={{ height: 72, borderRadius: 12, background: color.tile, marginBottom: 10 }} />)}
            {!loading && list.length === 0 && (
              <div style={{ ...ui.card, textAlign: 'center', marginBottom: 12 }}>
                <div style={{ ...ui.iconTile, margin: '0 auto 12px' }}><Icon name="pin" /></div>
                <div style={{ fontSize: font.md, color: color.muted }}>{tr('addr_empty')}</div>
              </div>
            )}
            {!loading && list.length > 0 && (
              <div style={{ ...ui.card, padding: '0 16px', marginBottom: 12 }}>
                {list.map((a, i) => {
                  const name = addressLabelText(tr, a.label);
                  return (
                    <div key={a.id} style={{ display: 'flex', gap: 12, padding: '14px 0 6px', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
                      <span style={ui.iconTile}><Icon name={addressIcon(a.label)} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{name}</span>
                          {a.is_default && <span style={ui.badge('success')}>{tr('addr_default')}</span>}
                        </div>
                        <div style={{ fontSize: font.sm, color: color.muted, marginTop: 2, lineHeight: 1.5 }}>{addressLine(a)}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', marginLeft: -10 }}>
                          {!a.is_default && <button type="button" onClick={() => setDefault(a)} aria-label={tr('addr_setDefaultAria', { label: name })} style={textButton}>{tr('addr_setDefault')}</button>}
                          <button type="button" onClick={() => setEditing(a)} aria-label={tr('addr_editAria', { label: name })} style={textButton}>{tr('common_edit')}</button>
                          <button type="button" onClick={() => remove(a)} aria-label={tr('addr_deleteAria', { label: name })} style={{ ...textButton, color: color.danger }}>{tr('common_delete')}</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!loading && (
              <button type="button" onClick={() => setEditing('new')} style={{ ...ui.secondaryButton, width: '100%', color: color.navy }}>
                <Icon name="plus" size={18} />{tr('addr_addNew')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
