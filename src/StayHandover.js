import React, { useRef, useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { choosePhoto } from './photoPicker';
import { compressImage } from './compressImage';
import { createNotification } from './notificationService';
import { writeWithFallback } from './schemaFallback';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';

export const STAY_SERVICES = ['boarding', 'housesit'];
export const isStay = (b) => STAY_SERVICES.includes(b?.service_type);
export const MOODS = ['happy', 'settled', 'missing_you', 'unwell'];
export const BELONGINGS = ['collar', 'leash', 'bed', 'toys', 'bowl', 'food'];
export const MAX_UPDATE_PHOTOS = 4;
const MAX_HANDOVER_PHOTOS = 4;
const STAY_038_COLUMNS = ['checked_in_at', 'checked_out_at', 'handover'];
const MOOD_EN = { happy: 'Happy', settled: 'Settled', missing_you: 'Missing you', unwell: 'Unwell' };

const localDay = (d) => { const x = new Date(d); return x.getFullYear() + '-' + (x.getMonth() + 1) + '-' + x.getDate(); };
export const postedToday = (updates, now = new Date()) => (updates || []).find(u => localDay(u.created_at) === localDay(now)) || null;
const isMissingTable = (error) => /relation|does not exist|schema cache|stay_updates/i.test(error?.message || '');

async function uploadStayPhoto(file) {
  const { data: { user } } = await supabase.auth.getUser();
  const compressed = await compressImage(file);
  const path = 'stay-' + user.id + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
  const { error } = await supabase.storage.from('walk-photos').upload(path, compressed);
  if (error) throw error;
  return supabase.storage.from('walk-photos').getPublicUrl(path).data.publicUrl;
}

function PhotoPicker({ photos, onChange, max, testId, label }) {
  const { t: tr } = useLanguage();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, max - photos.length);
    if (!files.length) return;
    setUploading(true);
    const added = [];
    try { for (const f of files) added.push(await uploadStayPhoto(f)); }
    catch (err) { alert(tr('stay_uploadFailed', { error: err.message || err })); }
    if (added.length) onChange([...photos, ...added]);
    setUploading(false);
    if (e.target && 'value' in e.target) e.target.value = '';
  };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {photos.map((url, i) => (
          <div key={url + i} style={{ position: 'relative', aspectRatio: '1' }}>
            <img src={url} alt={tr('stay_photoAlt', { n: i + 1 })} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: radius.md, display: 'block' }} />
            <button type="button" onClick={() => onChange(photos.filter((_, j) => j !== i))} aria-label={tr('stay_removePhoto', { n: i + 1 })}
              style={{ position: 'absolute', top: 2, right: 2, width: 28, height: 28, padding: 0, border: 'none', borderRadius: radius.pill, background: color.surface, color: color.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" disabled={uploading} onClick={() => choosePhoto(inputRef, handleFiles)} aria-label={label || tr('stay_addPhotoLabel')}
            style={{ aspectRatio: '1', minHeight: 44, padding: 0, fontFamily: 'inherit', borderRadius: radius.md, background: color.tile, border: `1.5px dashed ${color.faint}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer', color: color.navy }}>
            {uploading ? <span style={{ fontSize: font.sm }}>...</span> : <><Icon name="camera" size={18} /><span style={{ fontSize: font.xs, fontWeight: 600 }}>{tr('stay_addPhoto')}</span></>}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} data-testid={testId} />
    </div>
  );
}

const box = { marginTop: 12, background: color.bg, border: `1px solid ${color.line}`, borderRadius: radius.md, padding: 14 };
const fieldGap = { marginBottom: 12 };

// Check-in at drop-off (mode 'checkin') or check-out at pick-up (mode 'checkout') for a boarding or house-sit.
export default function StayHandover({ booking, sitterName, petName, mode, onDone, onCancel }) {
  const { t: tr } = useLanguage();
  const prev = booking.handover || {};
  const [food, setFood] = useState(prev.food || '');
  const [meds, setMeds] = useState(prev.meds || '');
  const [belongings, setBelongings] = useState(prev.belongings || []);
  const [photos, setPhotos] = useState([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pet = petName || tr('stay_yourPet');
  const checkin = mode === 'checkin';

  const save = async () => {
    if (checkin && !food.trim()) { setError(tr('stay_needFood')); return; }
    setSaving(true);
    setError('');
    const now = new Date().toISOString();
    const row = checkin
      ? { status: 'active', start_verified_at: now, checked_in_at: now, handover: { ...prev, food: food.trim(), meds: meds.trim(), belongings, photos, notes: notes.trim() } }
      : { status: 'completed', checked_out_at: now, handover: { ...prev, pickup_photos: photos, pickup_note: notes.trim() } };
    const { error: err } = await writeWithFallback(r => supabase.from('bookings').update(r).eq('id', booking.id), row, STAY_038_COLUMNS);
    if (err) { setSaving(false); setError(tr('stay_saveFailed', { error: err.message })); return; }
    if (booking.pet_parent_id) {
      await createNotification(booking.pet_parent_id, checkin ? 'stay_checked_in' : 'stay_checked_out',
        checkin ? sitterName + ' checked in ' + (petName || 'your dog') : (petName || 'Your dog') + ' is checked out',
        checkin ? 'Food, medicines and belongings are noted. You will get an update every day.' : (notes.trim() || 'Thanks for staying with ' + sitterName + '.'),
        null, booking.id);
    }
    setSaving(false);
    onDone && onDone();
  };

  const label = (htmlFor, key) => <label htmlFor={htmlFor} style={ui.label}>{tr(key)}</label>;
  const id = (f) => 'stay-' + f + '-' + booking.id;

  return (
    <section aria-label={tr(checkin ? 'stay_checkInTitle' : 'stay_checkOutTitle', { pet })} style={box}>
      <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink }}>{tr(checkin ? 'stay_checkInTitle' : 'stay_checkOutTitle', { pet })}</div>
      <div style={{ fontSize: font.sm, color: color.muted, margin: '2px 0 12px', lineHeight: 1.5 }}>{tr(checkin ? 'stay_checkInHint' : 'stay_checkOutHint')}</div>
      {checkin && (
        <>
          <div style={fieldGap}>
            {label(id('food'), 'stay_food')}
            <textarea id={id('food')} value={food} maxLength={300} onChange={e => setFood(e.target.value)} placeholder={tr('stay_foodPlaceholder')}
              style={{ ...ui.input, fontSize: font.md, minHeight: 60, resize: 'vertical' }} />
          </div>
          <div style={fieldGap}>
            {label(id('meds'), 'stay_meds')}
            <textarea id={id('meds')} value={meds} maxLength={300} onChange={e => setMeds(e.target.value)} placeholder={tr('stay_medsPlaceholder')}
              style={{ ...ui.input, fontSize: font.md, minHeight: 60, resize: 'vertical' }} />
          </div>
          <div style={fieldGap}>
            <div id={id('belongings')} style={ui.label}>{tr('stay_belongings')}</div>
            <div role="group" aria-labelledby={id('belongings')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {BELONGINGS.map(code => {
                const on = belongings.includes(code);
                return (
                  <button key={code} type="button" aria-pressed={on} onClick={() => setBelongings(on ? belongings.filter(x => x !== code) : [...belongings, code])}
                    style={{ ...ui.chip(on), minHeight: 44 }}>{tr('stay_belong_' + code)}</button>
                );
              })}
            </div>
          </div>
        </>
      )}
      <div style={fieldGap}>
        <div style={ui.label}>{tr(checkin ? 'stay_handoverPhotos' : 'stay_pickupPhoto')}</div>
        {checkin && <div style={{ fontSize: font.xs, color: color.muted, margin: '-2px 0 8px', lineHeight: 1.4 }}>{tr('stay_handoverPhotosHint')}</div>}
        <PhotoPicker photos={photos} onChange={setPhotos} max={checkin ? MAX_HANDOVER_PHOTOS : 2} testId={checkin ? 'handover-photo-input' : 'pickup-photo-input'} />
      </div>
      <div style={fieldGap}>
        {label(id('notes'), checkin ? 'stay_notes' : 'stay_pickupNote')}
        <textarea id={id('notes')} value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} placeholder={tr(checkin ? 'stay_notesPlaceholder' : 'stay_pickupNotePlaceholder')}
          style={{ ...ui.input, fontSize: font.md, minHeight: 60, resize: 'vertical' }} />
      </div>
      {error && <div role="alert" style={{ fontSize: font.sm, color: color.danger, marginBottom: 10 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onCancel} style={{ ...ui.secondaryButton, flex: 1, minHeight: 44 }}>{tr('stay_cancel')}</button>
        <button type="button" onClick={save} disabled={saving} style={{ ...ui.primaryButton, flex: 2, minHeight: 44 }}>
          {saving ? tr('stay_saving') : tr(checkin ? 'stay_confirmCheckIn' : 'stay_confirmCheckOut')}
        </button>
      </div>
    </section>
  );
}

// "Post today's update" during an active stay, with a nudge until one is sent today.
export function DailyUpdateCard({ booking, sitterProfile, petName, parentName, updates, onPosted }) {
  const { t: tr, lang } = useLanguage();
  const [photos, setPhotos] = useState([]);
  const [mood, setMood] = useState(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const pet = petName || tr('stay_yourPet');
  const today = postedToday(updates);
  const time = (iso) => new Date(iso).toLocaleTimeString(lang === 'hi' ? 'hi-IN' : 'en-IN', { hour: 'numeric', minute: '2-digit' });

  const post = async () => {
    if (!photos.length) { setMsg({ tone: 'danger', text: tr('stay_needPhoto') }); return; }
    setSaving(true);
    const row = { booking_id: booking.id, sitter_id: sitterProfile.id, photo_urls: photos, mood, note: note.trim() || null };
    const { data, error } = await supabase.from('stay_updates').insert(row).select().single();
    if (error && !isMissingTable(error)) { setSaving(false); setMsg({ tone: 'danger', text: tr('stay_saveFailed', { error: error.message }) }); return; }
    const who = sitterProfile.users?.name || 'Your host';
    if (booking.pet_parent_id) await createNotification(booking.pet_parent_id, 'stay_update', (petName || 'Your dog') + ' update from ' + who,
      [mood ? MOOD_EN[mood] : null, note.trim() || null].filter(Boolean).join(' · ') || 'New photos from the stay.', photos[0], booking.id);
    setPhotos([]); setMood(null); setNote('');
    setSaving(false);
    setMsg({ tone: 'success', text: tr('stay_updatePosted', { parent: parentName || tr('sitter_thePetParent') }) });
    onPosted && onPosted(data || { ...row, id: 'local-' + Date.now(), created_at: new Date().toISOString() });
  };

  return (
    <section aria-label={tr('stay_updateTitle')} style={{ ...box, background: color.surface }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: font.md, fontWeight: 700, color: color.ink }}>
        <Icon name="camera" size={18} color={color.navy} />{tr('stay_updateTitle')}
      </div>
      <div style={{ fontSize: font.sm, color: color.muted, margin: '2px 0 10px', lineHeight: 1.5 }}>{tr('stay_updateHint')}</div>
      {today
        ? <div role="status" style={{ ...ui.badge('success'), marginBottom: 10 }}><Icon name="check" size={12} />{tr('stay_postedToday', { time: time(today.created_at) })}</div>
        : <div role="status" style={{ background: color.warningSoft, color: color.warning, borderRadius: radius.md, padding: '8px 12px', fontSize: font.sm, fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>
            {tr('stay_nudge', { parent: parentName || tr('sitter_thePetParent'), pet })}
          </div>}
      <div style={fieldGap}>
        <PhotoPicker photos={photos} onChange={setPhotos} max={MAX_UPDATE_PHOTOS} testId="stay-update-photo-input" />
      </div>
      <div style={fieldGap}>
        <div id={'stay-mood-' + booking.id} style={ui.label}>{tr('stay_moodLabel', { pet })}</div>
        <div role="group" aria-labelledby={'stay-mood-' + booking.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {MOODS.map(m => (
            <button key={m} type="button" aria-pressed={mood === m} onClick={() => setMood(mood === m ? null : m)} style={{ ...ui.chip(mood === m), minHeight: 44 }}>{tr('stay_mood_' + m)}</button>
          ))}
        </div>
      </div>
      <div style={fieldGap}>
        <label htmlFor={'stay-note-' + booking.id} style={ui.label}>{tr('stay_updateNote')}</label>
        <textarea id={'stay-note-' + booking.id} value={note} maxLength={280} onChange={e => setNote(e.target.value)} placeholder={tr('stay_updateNotePlaceholder')}
          style={{ ...ui.input, fontSize: font.md, minHeight: 56, resize: 'vertical' }} />
      </div>
      {msg && <div role={msg.tone === 'danger' ? 'alert' : 'status'} style={{ fontSize: font.sm, color: color[msg.tone], fontWeight: 600, marginBottom: 10 }}>{msg.text}</div>}
      <button type="button" onClick={post} disabled={saving} style={{ ...ui.primaryButton, width: '100%', minHeight: 44 }}>
        {saving ? tr('stay_saving') : tr('stay_postUpdate')}
      </button>
      {(updates || []).length > 0 && <div style={{ fontSize: font.xs, color: color.muted, marginTop: 8, textAlign: 'center' }}>{tr('stay_updatesCount', { n: updates.length })}</div>}
    </section>
  );
}
