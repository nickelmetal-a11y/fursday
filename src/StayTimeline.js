import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { isStay } from './StayHandover';

// Parent-facing story of a boarding or house-sit: handover at check-in, daily updates, check-out.
export default function StayTimeline({ booking }) {
  const { t: tr, lang } = useLanguage();
  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const [updates, setUpdates] = useState([]);
  const bookingId = booking?.id;

  useEffect(() => {
    if (!bookingId) return undefined;
    let off = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('stay_updates').select('*').eq('booking_id', bookingId).order('created_at', { ascending: true });
        if (!off && !error) setUpdates(data || []);
      } catch (e) { /* stay_updates arrives with migration 038 */ }
    })();
    return () => { off = true; };
  }, [bookingId]);

  if (!booking || !isStay(booking)) return null;
  const h = booking.handover || {};
  const when = (iso) => new Date(iso).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  let photoN = 0;
  const photoRow = (urls) => (urls || []).length > 0 && (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 8 }}>
      {urls.map(u => { photoN += 1; return <img key={u + photoN} src={u} alt={tr('stayline_photoAlt', { n: photoN })} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: radius.sm, display: 'block' }} />; })}
    </div>
  );
  const fact = (labelKey, value) => value ? (
    <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.5 }}><span style={{ color: color.muted }}>{tr(labelKey)}: </span>{value}</div>
  ) : null;

  const events = [];
  if (booking.checked_in_at || h.food) events.push({ key: 'in', at: booking.checked_in_at, icon: 'key', title: tr('stayline_checkedIn'), body: (
    <>
      {fact('stayline_food', h.food)}
      {fact('stayline_meds', h.meds)}
      {fact('stayline_belongings', (h.belongings || []).map(b => tr('stay_belong_' + b)).join(', '))}
      {fact('stayline_notes', h.notes)}
      {photoRow(h.photos)}
    </>
  ) });
  updates.forEach(u => events.push({ key: u.id, at: u.created_at, icon: 'camera', title: tr('stayline_update'), body: (
    <>
      {u.mood && <span style={{ ...ui.badge(u.mood === 'unwell' ? 'warning' : 'success'), marginBottom: 4 }}>{tr('stay_mood_' + u.mood)}</span>}
      {u.note && <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.5 }}>{u.note}</div>}
      {photoRow(u.photo_urls)}
    </>
  ) }));
  if (booking.checked_out_at) events.push({ key: 'out', at: booking.checked_out_at, icon: 'check', title: tr('stayline_checkedOut'), body: (
    <>
      {h.pickup_note && <div style={{ fontSize: font.sm, color: color.text, lineHeight: 1.5 }}>{h.pickup_note}</div>}
      {photoRow(h.pickup_photos)}
    </>
  ) });

  return (
    <section aria-label={tr('stayline_title')} style={{ ...ui.card, marginTop: 12 }}>
      <h3 style={{ ...ui.sectionTitle, display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="history" size={17} color={color.navy} />{tr('stayline_title')}</h3>
      {events.length === 0 ? (
        <div style={{ fontSize: font.sm, color: color.muted, lineHeight: 1.5 }}>{tr('stayline_empty')}</div>
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {events.map((e, i) => (
            <li key={e.key} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
              <span style={{ ...ui.iconTile, width: 32, height: 32, borderRadius: radius.pill }}><Icon name={e.icon} size={16} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: font.md, fontWeight: 600, color: color.ink }}>{e.title}</span>
                  {e.at && <span style={{ fontSize: font.xs, color: color.muted, flexShrink: 0 }}>{when(e.at)}</span>}
                </div>
                {e.body}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
