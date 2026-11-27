import React, { useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

export const DOG_BEHAVIOURS = ['calm', 'playful', 'anxious', 'reactive'];
export const NOTE_MAX = 500;

// Host reviews of a parent (and their dogs), keyed by pet_parent_id. Empty before migration 038.
export async function loadParentReviews(parentIds) {
  const ids = [...new Set((parentIds || []).filter(Boolean))];
  if (!ids.length) return {};
  try {
    const { data, error } = await supabase.from('parent_reviews').select('*').in('pet_parent_id', ids);
    if (error) return {};
    return (data || []).reduce((m, r) => { (m[r.pet_parent_id] = m[r.pet_parent_id] || []).push(r); return m; }, {});
  } catch (e) { return {}; }
}

// { rating: 4.8, hosts: 3, behaviour: 'calm' } or null. Behaviour comes from this pet's reviews when there are any.
export function dogHistory(reviews, petId) {
  const list = reviews || [];
  if (!list.length) return null;
  const rating = Math.round((list.reduce((a, r) => a + (r.rating || 0), 0) / list.length) * 10) / 10;
  const hosts = new Set(list.map(r => r.sitter_id)).size;
  const forPet = petId ? list.filter(r => r.pet_id === petId) : [];
  const pool = (forPet.length ? forPet : list).filter(r => DOG_BEHAVIOURS.includes(r.dog_behaviour));
  const counts = DOG_BEHAVIOURS.map(b => pool.filter(r => r.dog_behaviour === b).length);
  const best = Math.max(...counts);
  return { rating, hosts, behaviour: best > 0 ? DOG_BEHAVIOURS[counts.indexOf(best)] : null };
}

export function DogHistoryLine({ reviews, petId, style }) {
  const { t: tr } = useLanguage();
  const h = dogHistory(reviews, petId);
  if (!h) return null;
  const text = tr(h.hosts === 1 ? 'prev_historyOne' : 'prev_historyMany', { rating: h.rating.toFixed(1), n: h.hosts })
    + (h.behaviour ? ' · ' + tr('prev_usually_' + h.behaviour) : '');
  return (
    <div aria-label={tr('prev_historyLabel') + ': ' + text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: font.sm, color: color.text, fontWeight: 600, ...style }}>
      <Icon name="starFilled" size={14} color={color.saffron} />
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</span>
    </div>
  );
}

// "Rate this booking": the host rates the parent and the dog after a completed booking.
export function RateBookingCard({ booking, sitterId, existing, onSaved }) {
  const { t: tr } = useLanguage();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [behaviour, setBehaviour] = useState(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  if (existing) return (
    <div role="status" style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: font.sm, color: color.success, fontWeight: 600 }}>
      <Icon name="check" size={15} />{tr('prev_saved', { n: existing.rating })}
    </div>
  );
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} style={{ ...ui.secondaryButton, width: '100%', marginTop: 10, minHeight: 44 }}>
      <Icon name="star" size={16} color={color.saffron} />{tr('prev_rateTitle')}
    </button>
  );

  const save = async () => {
    if (!rating) { setMsg({ tone: 'danger', text: tr('prev_needStars') }); return; }
    setSaving(true);
    const row = { booking_id: booking.id, sitter_id: sitterId, pet_parent_id: booking.pet_parent_id, pet_id: booking.pet_id || null, rating, dog_behaviour: behaviour, note: note.trim() || null };
    const { data, error } = await supabase.from('parent_reviews').insert(row).select().single();
    setSaving(false);
    if (error) {
      setMsg({ tone: 'danger', text: /relation|does not exist|schema cache/i.test(error.message || '') ? tr('prev_unavailable') : tr('prev_failed', { error: error.message }) });
      return;
    }
    onSaved && onSaved(data || row);
  };

  const noteId = 'prev-note-' + booking.id;
  return (
    <section aria-label={tr('prev_rateTitle')} style={{ marginTop: 12, background: color.bg, border: `1px solid ${color.line}`, borderRadius: radius.md, padding: 14 }}>
      <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink }}>{tr('prev_rateTitle')}</div>
      <div style={{ fontSize: font.sm, color: color.muted, margin: '2px 0 10px', lineHeight: 1.5 }}>{tr('prev_rateHint')}</div>
      <div role="group" aria-label={tr('prev_starsLabel')} style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" aria-pressed={rating === n} aria-label={n === 1 ? tr('prev_star') : tr('prev_stars', { n })} onClick={() => setRating(n)}
            style={{ width: 44, height: 44, padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: n <= rating ? color.saffron : color.faint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={n <= rating ? 'starFilled' : 'star'} size={28} />
          </button>
        ))}
      </div>
      <div id={'prev-beh-' + booking.id} style={ui.label}>{tr('prev_behaviourLabel')}</div>
      <div role="group" aria-labelledby={'prev-beh-' + booking.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {DOG_BEHAVIOURS.map(b => (
          <button key={b} type="button" aria-pressed={behaviour === b} onClick={() => setBehaviour(behaviour === b ? null : b)} style={{ ...ui.chip(behaviour === b), minHeight: 44 }}>
            {tr('prev_behaviour_' + b)}
          </button>
        ))}
      </div>
      <label htmlFor={noteId} style={ui.label}>{tr('prev_noteLabel')}</label>
      <textarea id={noteId} value={note} maxLength={NOTE_MAX} onChange={e => setNote(e.target.value.slice(0, NOTE_MAX))} placeholder={tr('prev_notePlaceholder')}
        style={{ ...ui.input, fontSize: font.md, minHeight: 64, resize: 'vertical' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: font.xs, color: color.muted, margin: '4px 0 10px' }}>
        <span>{tr('prev_noteVisibility')}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{note.length}/{NOTE_MAX}</span>
      </div>
      {msg && <div role="alert" style={{ fontSize: font.sm, color: color[msg.tone], fontWeight: 600, marginBottom: 10 }}>{msg.text}</div>}
      <button type="button" onClick={save} disabled={saving} style={{ ...ui.primaryButton, width: '100%', minHeight: 44 }}>{tr('prev_submit')}</button>
    </section>
  );
}
