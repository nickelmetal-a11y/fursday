import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';

export const SLOTS = ['morning', 'afternoon', 'evening'];
const SLOT_KEYS = { morning: 'sitterEdit_morning', afternoon: 'sitterEdit_afternoon', evening: 'sitterEdit_evening' };
const SLOT_HOURS = { morning: 'sitterEdit_morningHours', afternoon: 'sitterEdit_afternoonHours', evening: 'sitterEdit_eveningHours' };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_KEYS = {
  Mon: 'sitterEdit_dayMon', Tue: 'sitterEdit_dayTue', Wed: 'sitterEdit_dayWed', Thu: 'sitterEdit_dayThu',
  Fri: 'sitterEdit_dayFri', Sat: 'sitterEdit_daySat', Sun: 'sitterEdit_daySun',
};
export const CALENDAR_DAYS = 60;

export const toISODate = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parseISODate = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

// '07:00 AM', '5:30 PM', '14:00' or a slot name -> 'morning' | 'afternoon' | 'evening'.
export function slotForTime(time) {
  if (!time) return null;
  const s = String(time).trim().toLowerCase();
  if (SLOTS.includes(s)) return s;
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return null;
  let h = Number(m[1]);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

// The slots a sitter's weekly default gives, from the sitter_profiles flags.
export const weeklySlots = (profile) => SLOTS.filter(s =>
  s === 'afternoon' ? profile?.afternoon_slot === true : profile?.[s + '_slot'] !== false);

// What a sitter offers on one date: a sitter_availability row for that date
// wins; otherwise the weekly default (availability_days + slot flags) applies.
export function dayAvailability(profile, availabilityRows, dateISO) {
  const iso = String(dateISO).slice(0, 10);
  const row = (availabilityRows || []).find(r => String(r.date).slice(0, 10) === iso);
  if (row) {
    if (row.is_available === false) return { available: false, slots: [], source: 'override' };
    const slots = Array.isArray(row.time_slots) && row.time_slots.length ? row.time_slots.filter(s => SLOTS.includes(s)) : row.time_slots == null ? weeklySlots(profile) : [];
    return { available: slots.length > 0, slots, source: 'override' };
  }
  const days = profile?.availability_days;
  const weekday = WEEKDAYS[parseISODate(iso).getDay()];
  if (Array.isArray(days) && !days.includes(weekday)) return { available: false, slots: [], source: 'weekly' };
  const slots = weeklySlots(profile);
  return { available: slots.length > 0, slots, source: 'weekly' };
}

// Can this sitter take a booking on dateISO in timeSlot? timeSlot may be a
// slot name or a time like '07:00 AM'; leave it out to ask about the whole day.
export function isSitterAvailable(profile, availabilityRows, dateISO, timeSlot) {
  if (!dateISO) return false;
  const day = dayAvailability(profile, availabilityRows, dateISO);
  if (!day.available) return false;
  if (!timeSlot) return true;
  const slot = slotForTime(timeSlot);
  return slot ? day.slots.includes(slot) : true;
}

export default function AvailabilityCalendar({ sitterId, weekly, onBack }) {
  const { t, lang } = useLanguage();
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const lastDay = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + CALENDAR_DAYS - 1); return d; }, [today]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const [draftSlots, setDraftSlots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('sitter_availability').select('*').eq('sitter_id', sitterId)
          .gte('date', toISODate(today)).lte('date', toISODate(lastDay));
        if (error) throw error;
        if (!off) setRows(data || []);
      } catch (e) { if (!off) setLoadError(true); }
      if (!off) setLoading(false);
    })();
    return () => { off = true; };
  }, [sitterId, today, lastDay]);

  const rowFor = (iso) => rows.find(r => String(r.date).slice(0, 10) === iso);
  const monthCount = (lastDay.getFullYear() - today.getFullYear()) * 12 + lastDay.getMonth() - today.getMonth() + 1;
  const monthStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const lead = (monthStart.getDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1))];

  const openDay = (iso) => {
    const day = dayAvailability(weekly, rows, iso);
    setSelected(iso);
    setDraftSlots(day.available ? day.slots : weeklySlots(weekly));
    setMessage(null);
  };

  const writeDay = async (isAvailable, slots) => {
    setBusy(true);
    setMessage(null);
    try {
      const existing = rowFor(selected);
      const fields = { is_available: isAvailable, time_slots: isAvailable ? slots : [] };
      let saved;
      if (existing) {
        const { error } = await supabase.from('sitter_availability').update({ ...fields, updated_at: new Date().toISOString() }).eq('id', existing.id);
        if (error) throw error;
        saved = { ...existing, ...fields };
      } else {
        const { data, error } = await supabase.from('sitter_availability').insert({ sitter_id: sitterId, date: selected, ...fields }).select().single();
        if (error) throw error;
        saved = data || { sitter_id: sitterId, date: selected, ...fields };
      }
      setRows(prev => [...prev.filter(r => String(r.date).slice(0, 10) !== selected), saved]);
      setMessage({ tone: 'success', text: isAvailable ? t('calendar_savedSlots') : t('calendar_savedBlocked') });
    } catch (e) { setMessage({ tone: 'danger', text: t('calendar_saveFailed') }); }
    setBusy(false);
  };

  const resetDay = async () => {
    const existing = rowFor(selected);
    if (!existing) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('sitter_availability').delete().eq('id', existing.id);
      if (error) throw error;
      setRows(prev => prev.filter(r => r.id !== existing.id));
      const w = dayAvailability(weekly, [], selected);
      setDraftSlots(w.available ? w.slots : weeklySlots(weekly));
      setMessage({ tone: 'success', text: t('calendar_savedReset') });
    } catch (e) { setMessage({ tone: 'danger', text: t('calendar_saveFailed') }); }
    setBusy(false);
  };

  const slotNames = (slots) => slots.map(s => t(SLOT_KEYS[s])).join(', ');
  const fmtLong = (iso) => parseISODate(iso).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtShort = (iso) => parseISODate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const stateLabel = (day) => !day.available ? (day.source === 'override' ? t('calendar_stateBlocked') : t('calendar_stateDayOff'))
    : day.source === 'override' ? t('calendar_stateCustom', { slots: slotNames(day.slots) }) : t('calendar_stateOpen', { slots: slotNames(day.slots) });

  const selectedDay = selected ? dayAvailability(weekly, rows, selected) : null;
  const weeklyDay = selected ? dayAvailability(weekly, [], selected) : null;
  const blockedCount = rows.filter(r => r.is_available === false).length;
  const customCount = rows.length - blockedCount;

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      <div style={ui.header}>
        <button onClick={onBack} aria-label={t('common_back')} style={ui.backButton}><Icon name="arrowLeft" size={20} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={ui.headerTitle}>{t('calendar_title')}</h1>
          <div style={{ fontSize: font.sm, color: color.muted }}>{t('calendar_subtitle', { n: CALENDAR_DAYS })}</div>
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ ...ui.card, marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start', background: color.navySoft, border: `1px solid ${color.navySoft}` }}>
          <Icon name="info" size={18} color={color.navy} style={{ marginTop: 1 }} />
          <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.5 }}>{t('calendar_intro')}</div>
        </div>

        {loading ? (
          <div role="status" style={{ height: 320, borderRadius: radius.lg, background: color.tile }} aria-label={t('common_loading')} />
        ) : loadError ? (
          <div role="alert" style={{ ...ui.card, color: color.danger, fontSize: font.md }}>{t('calendar_loadFailed')}</div>
        ) : (
          <div style={{ ...ui.card, marginBottom: 12, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button type="button" onClick={() => setMonthOffset(m => m - 1)} disabled={monthOffset === 0} aria-label={t('calendar_prevMonth')}
                style={{ ...ui.backButton, opacity: monthOffset === 0 ? 0.35 : 1 }}><Icon name="chevronRight" size={18} style={{ transform: 'rotate(180deg)' }} /></button>
              <div style={{ fontSize: font.md, fontWeight: 700, color: color.ink }}>{monthStart.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</div>
              <button type="button" onClick={() => setMonthOffset(m => m + 1)} disabled={monthOffset >= monthCount - 1} aria-label={t('calendar_nextMonth')}
                style={{ ...ui.backButton, opacity: monthOffset >= monthCount - 1 ? 0.35 : 1 }}><Icon name="chevronRight" size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: font.xs, fontWeight: 600, color: color.muted, padding: '2px 0 6px' }}>{t(DAY_KEYS[d])}</div>
              ))}
              {cells.map((d, i) => {
                if (!d) return <div key={'x' + i} />;
                const iso = toISODate(d);
                const inRange = d >= today && d <= lastDay;
                const day = dayAvailability(weekly, rows, iso);
                const isSel = selected === iso;
                const blocked = day.source === 'override' && !day.available;
                const custom = day.source === 'override' && day.available;
                const bg = !inRange ? 'transparent' : blocked ? color.dangerSoft : custom ? color.navySoft : day.available ? color.surface : color.tile;
                const fg = !inRange ? color.faint : blocked ? color.danger : day.available ? color.ink : color.muted;
                return (
                  <button key={iso} type="button" disabled={!inRange} onClick={() => openDay(iso)} aria-pressed={isSel}
                    aria-label={fmtShort(iso) + ': ' + stateLabel(day)}
                    style={{ minHeight: 44, padding: 0, borderRadius: radius.md, fontFamily: 'inherit', fontSize: font.md, fontWeight: 600, cursor: inRange ? 'pointer' : 'default',
                      border: isSel ? `2px solid ${color.navy}` : `1px solid ${inRange ? color.line : 'transparent'}`, background: bg, color: fg,
                      textDecoration: blocked ? 'line-through' : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{d.getDate()}</span>
                    {inRange && custom && <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: radius.pill, background: color.navy }} />}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, fontSize: font.xs, color: color.muted }}>
              {[
                { bg: color.surface, label: t('calendar_legendOpen') },
                { bg: color.tile, label: t('calendar_legendDayOff') },
                { bg: color.navySoft, label: t('calendar_legendCustom') },
                { bg: color.dangerSoft, label: t('calendar_legendBlocked') },
              ].map(l => (
                <span key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: l.bg, border: `1px solid ${color.line}` }} />{l.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {selected && selectedDay && (
          <div style={{ ...ui.card, marginBottom: 12 }} aria-label={t('calendar_dayPanel', { date: fmtLong(selected) })} role="region">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
              <div style={{ fontSize: font.lg, fontWeight: 700, color: color.ink }}>{fmtLong(selected)}</div>
              <button type="button" onClick={() => setSelected(null)} aria-label={t('common_close')} style={{ ...ui.backButton, width: 36, height: 36 }}><Icon name="close" size={16} /></button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={ui.badge(selectedDay.available ? (selectedDay.source === 'override' ? 'info' : 'success') : 'danger')}>{stateLabel(selectedDay)}</span>
            </div>
            <div style={{ fontSize: font.sm, color: color.muted, marginBottom: 12 }}>
              {weeklyDay.available ? t('calendar_weeklyDefaultOpen', { slots: slotNames(weeklyDay.slots) }) : t('calendar_weeklyDefaultOff')}
            </div>
            <div style={ui.label}>{t('calendar_slotsThatDay')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {SLOTS.map(s => {
                const on = draftSlots.includes(s);
                return (
                  <button key={s} type="button" aria-pressed={on} onClick={() => setDraftSlots(prev => on ? prev.filter(x => x !== s) : SLOTS.filter(x => x === s || prev.includes(x)))}
                    style={{ ...ui.chip(on), minHeight: 44, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
                    <span>{t(SLOT_KEYS[s])}</span>
                    <span style={{ fontWeight: 400, fontSize: font.sm, opacity: 0.85 }}>{t(SLOT_HOURS[s])}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" disabled={busy} onClick={() => writeDay(draftSlots.length > 0, draftSlots)} style={{ ...ui.primaryButton, flex: '1 1 140px' }}>
                {t('calendar_saveSlots')}
              </button>
              <button type="button" disabled={busy} onClick={() => writeDay(false, [])} style={{ ...ui.dangerButton, minHeight: 48, flex: '1 1 140px' }}>
                {t('calendar_markUnavailable')}
              </button>
            </div>
            {rowFor(selected) && (
              <button type="button" disabled={busy} onClick={resetDay}
                style={{ ...ui.secondaryButton, width: '100%', marginTop: 8, minHeight: 44, fontSize: font.md }}>
                {t('calendar_useWeekly')}
              </button>
            )}
            {message && <div role={message.tone === 'danger' ? 'alert' : 'status'} style={{ marginTop: 10, fontSize: font.sm, fontWeight: 600, color: color[message.tone] }}>{message.text}</div>}
          </div>
        )}

        {!loading && !loadError && (
          <div style={{ fontSize: font.sm, color: color.muted, textAlign: 'center' }}>
            {t('calendar_summary', { blocked: blockedCount, custom: customCount })}
          </div>
        )}
      </div>
    </div>
  );
}
