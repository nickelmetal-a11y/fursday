import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { createNotification } from './notificationService';
import { writeWithFallback } from './schemaFallback';
import { formatKm, sitterCovers } from './geo';
import { isExpired, requestPoint, dateRangeLabel, formatLeft, TIME_SLOTS } from './broadcastMatching';
import { DogHistoryLine, loadParentReviews } from './ParentReviews';

const SERVICE_NAME_KEYS = { walk30: 'service_walk', boarding: 'service_boarding', daycare: 'service_daycare', dropin: 'service_dropin', housesit: 'service_housesit' };
const SERVICE_ICONS = { walk30: 'walk', boarding: 'boarding', daycare: 'sun', dropin: 'bell', housesit: 'home' };
const PET_TRAIT_KEYS = {
  energy: { lazy: 'pet_energyLazy', moderate: 'pet_energyModerate', hyper: 'pet_energyHyper' },
  strangers: { friendly: 'pet_strangersFriendly', shy: 'pet_strangersShy', cautious: 'pet_strangersCautious' },
  leash: { good: 'pet_leashGood', pulls: 'pet_leashPulls', reactive: 'pet_leashReactive' },
};
// Stored in English; shown translated.
const DECLINE_REASONS = { busy: 'nearby_feed_reason_busy', far: 'nearby_feed_reason_far', size: 'nearby_feed_reason_size', price: 'nearby_feed_reason_price', other: 'nearby_feed_reason_other' };
const RESPONSE_037_COLUMNS = ['message', 'proposed_time'];
const KEEP_ANSWERED_MS = 3 * 24 * 60 * 60 * 1000;
const money = { fontVariantNumeric: 'tabular-nums' };
const rupees = (paise) => Math.round((paise || 0) / 100);

// Requests this sitter was invited to (through broadcast_recipients). Before
// migration 037 that table doesn't exist, so an approved sitter sees every open
// request in their city instead, as before.
export async function loadInvitedRequests(profile) {
  if (!profile?.id) return { items: [], legacy: false };
  try {
    const { data: invites, error } = await supabase.from('broadcast_recipients').select('*').eq('sitter_id', profile.id);
    if (error) {
      if (profile.status !== 'active') return { items: [], legacy: true };
      const { data: reqs } = await supabase.from('broadcast_requests').select('*').eq('city_id', profile.city_id).eq('status', 'open').order('created_at', { ascending: false });
      const { data: mine } = await supabase.from('broadcast_responses').select('*').eq('sitter_id', profile.id);
      return { items: (reqs || []).map(r => ({ request: r, invite: null, response: (mine || []).find(x => x.request_id === r.id) || null })), legacy: true };
    }
    const ids = (invites || []).map(i => i.request_id);
    if (!ids.length) return { items: [], legacy: false };
    const { data: reqs } = await supabase.from('broadcast_requests').select('*').in('id', ids);
    const { data: resps } = await supabase.from('broadcast_responses').select('*').eq('sitter_id', profile.id).in('request_id', ids);
    const now = Date.now();
    const items = (reqs || [])
      .map(r => ({ request: r, invite: invites.find(i => i.request_id === r.id), response: (resps || []).find(x => x.request_id === r.id) || null }))
      .filter(it => !it.invite?.declined_at && (it.response
        ? !(now - Date.parse(it.request.created_at) > KEEP_ANSWERED_MS)
        : it.request.status === 'open' && !isExpired(it.request, now)))
      .sort((a, b) => String(b.request.created_at).localeCompare(String(a.request.created_at)));
    return { items, legacy: false };
  } catch (e) {
    console.error('Could not load nearby requests:', e);
    return { items: [], legacy: false };
  }
}

export const openInvites = (items, now = Date.now()) => (items || []).filter(it =>
  it.request.status === 'open' && !isExpired(it.request, now) && !it.response && !it.invite?.declined_at);

export default function SitterRequestsFeed({ profile, onChange }) {
  const { t: tr, lang } = useLanguage();
  const [items, setItems] = useState(null);
  const [legacy, setLegacy] = useState(false);
  const [services, setServices] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [panel, setPanel] = useState({});
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});
  const [histories, setHistories] = useState({});

  const publish = (list, isLegacy) => { setItems(list); setLegacy(isLegacy); if (onChange) onChange(list); };
  const refresh = async () => { const res = await loadInvitedRequests(profile); publish(res.items, res.legacy); return res; };

  useEffect(() => {
    if (!profile?.id) return undefined;
    let off = false;
    (async () => {
      const [res, { data: svc }] = await Promise.all([
        loadInvitedRequests(profile),
        supabase.from('sitter_services').select('service_type, price_paise, is_active').eq('sitter_id', profile.id),
      ]);
      if (off) return;
      publish(res.items, res.legacy);
      setServices(svc || []);
      loadParentReviews(res.items.map(it => it.request.pet_parent_id)).then(h => { if (!off) setHistories(h); });
      const stamp = new Date().toISOString();
      await Promise.all(res.items.filter(it => it.invite && !it.invite.viewed_at).map(it =>
        supabase.from('broadcast_recipients').update({ viewed_at: stamp }).eq('request_id', it.request.id).eq('sitter_id', profile.id)));
    })();
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { off = true; clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const isActive = profile?.status === 'active';
  const ownPrice = (type) => services.find(s => s.service_type === type && s.is_active !== false)?.price_paise ?? null;
  const draft = (id) => drafts[id] || {};
  const setDraft = (id, patch) => setDrafts(d => ({ ...d, [id]: { ...d[id], ...patch } }));
  const note = (id, tone, text) => setNotes(n => ({ ...n, [id]: text ? { tone, text } : null }));
  const togglePanel = (id, name) => setPanel(p => ({ ...p, [id]: p[id] === name ? null : name }));

  const respond = async (it, kind) => {
    const req = it.request;
    const d = draft(req.id);
    const own = ownPrice(req.service_type);
    let row;
    if (kind === 'accept') row = { status: 'accepted', offered_price: own };
    if (kind === 'quote') {
      const rs = Number(d.price);
      if (!rs) { note(req.id, 'danger', tr('nearby_feed_needPrice')); return; }
      row = { status: 'offered', offered_price: rs * 100, message: (d.message || '').trim() || null };
    }
    if (kind === 'time') {
      if (!d.time) { note(req.id, 'danger', tr('nearby_feed_needTime')); return; }
      row = { status: 'offered', offered_price: own, proposed_time: d.time, message: (d.message || '').trim() || null };
    }
    setBusy(req.id);
    const { error } = await writeWithFallback(r => supabase.from('broadcast_responses').insert(r), { request_id: req.id, sitter_id: profile.id, ...row }, RESPONSE_037_COLUMNS);
    if (error) {
      setBusy(null);
      note(req.id, 'danger', /duplicate|unique/i.test(error.message || '') ? tr('nearby_feed_already') : tr('sitter_errRespond') + error.message);
      return;
    }
    if (req.pet_parent_id) {
      const who = profile.users?.name || 'A carer';
      const body = kind === 'accept' ? 'Can do it for Rs.' + rupees(row.offered_price) + '.'
        : kind === 'time' ? 'Suggests ' + row.proposed_time + ' for Rs.' + rupees(row.offered_price) + '.'
        : 'Offers Rs.' + rupees(row.offered_price) + (row.message ? ': "' + row.message + '"' : '.');
      await createNotification(req.pet_parent_id, 'broadcast_offer', who + ' replied to your request', body);
    }
    setPanel(p => ({ ...p, [req.id]: null }));
    note(req.id, 'success', tr('nearby_feed_replySent'));
    await refresh();
    setBusy(null);
  };

  const decline = async (it) => {
    const req = it.request;
    const reason = draft(req.id).reason || null;
    if (it.invite) {
      const { error } = await supabase.from('broadcast_recipients').update({ declined_at: new Date().toISOString(), decline_reason: reason }).eq('request_id', req.id).eq('sitter_id', profile.id);
      if (error) { note(req.id, 'danger', tr('common_error')); return; }
      await refresh();
    } else {
      publish((items || []).filter(x => x !== it), legacy);
    }
  };

  if (items === null) return (
    <div role="status" aria-label={tr('nearby_feed_hint')}>
      {[0, 1].map(i => <div key={i} style={{ height:140, borderRadius:radius.lg, background:color.tile, marginBottom:12 }} />)}
    </div>
  );

  const metaRow = { display:'flex', alignItems:'center', gap:6, fontSize:font.sm, color:color.text };
  const linkButton = { minHeight:44, padding:'0 4px', background:'none', border:'none', color:color.muted, fontSize:font.sm, fontWeight:600, cursor:'pointer', fontFamily:'inherit' };

  return (
    <div>
      <div style={{ fontSize:font.sm, color:color.muted, marginBottom:12, lineHeight:1.5 }}>{tr(legacy ? 'nearby_feed_legacy' : 'nearby_feed_hint')}</div>
      {!isActive && <div role="status" style={{ background:color.warningSoft, color:color.warning, borderRadius:radius.md, padding:'10px 12px', fontSize:font.sm, fontWeight:600, marginBottom:12, lineHeight:1.5 }}>{tr('nearby_feed_pendingWhy')}</div>}
      {items.length === 0 && (
        <div style={{ ...ui.card, textAlign:'center', padding:'28px 20px' }}>
          <div style={{ ...ui.iconTile, margin:'0 auto 12px' }}><Icon name="megaphone" /></div>
          <div style={{ fontSize:font.md, fontWeight:600, color:color.ink, marginBottom:4 }}>{tr('nearby_feed_emptyTitle')}</div>
          <div style={{ fontSize:font.sm, color:color.muted, lineHeight:1.6 }}>{tr('nearby_feed_emptyHint')}</div>
        </div>
      )}
      {items.map(it => {
        const req = it.request, res = it.response;
        const pet = req.pet_summary || {};
        const point = requestPoint(req);
        const cover = point ? sitterCovers(profile, point) : { covers: false, km: null };
        const km = it.invite?.distance_km != null ? Number(it.invite.distance_km) : cover.km;
        const expired = isExpired(req, now);
        const mine = req.chosen_sitter_id === profile.id || res?.status === 'chosen';
        const actionable = req.status === 'open' && !expired && !res;
        const urgent = req.mode === 'urgent';
        const own = ownPrice(req.service_type);
        const d = draft(req.id);
        const msg = notes[req.id];
        const svcKey = SERVICE_NAME_KEYS[req.service_type];
        const reasons = [
          km != null ? formatKm(km) : null,
          [pet.breed, pet.size ? tr('nearby_size_' + pet.size) : null].filter(Boolean).join(', ') || null,
          dateRangeLabel(req.scheduled_date, req.end_date, locale) || null,
          cover.covers && cover.km != null ? tr('nearby_feed_withinRadius') : null,
        ].filter(Boolean);
        const traits = ['energy', 'strangers', 'leash'].map(k => PET_TRAIT_KEYS[k][pet[k]]).filter(Boolean).map(k => tr(k));
        const badge = req.status === 'filled' ? (mine ? ['success', tr('nearby_feed_youGotIt')] : ['danger', tr('nearby_feed_someoneElse')])
          : req.status === 'cancelled' ? ['danger', tr('nearby_feed_cancelled')]
          : res ? ['warning', tr('nearby_feed_waiting')]
          : expired ? ['info', tr('nearby_closed')]
          : [urgent ? 'warning' : 'info', tr(urgent ? 'nearby_modeUrgentBadge' : 'nearby_modeCompareBadge')];
        return (
          <article key={req.id} aria-label={(svcKey ? tr(svcKey) : req.service_type) + (req.area ? ', ' + req.area : '')} style={{ ...ui.card, marginBottom:12 }}>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:10 }}>
              <div style={{ ...ui.iconTile, width:44, height:44 }}><Icon name={SERVICE_ICONS[req.service_type] || 'paw'} /></div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:font.md, fontWeight:700, color:color.ink }}>{svcKey ? tr(svcKey) : req.service_type}</div>
                <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:font.sm, color:color.muted, marginTop:2 }}>
                  <Icon name="pin" size={14} />{req.area || tr('sitter_nearbyArea')}
                </div>
              </div>
              <span style={ui.badge(badge[0])}>{badge[1]}</span>
            </div>

            {reasons.length > 0 && <div style={{ fontSize:font.sm, color:color.navy, fontWeight:600, marginBottom:10, lineHeight:1.5 }}>{reasons.join(' · ')}</div>}

            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 16px', marginBottom:10 }}>
              {req.scheduled_date && <div style={metaRow}><Icon name="calendar" size={15} color={color.muted} /><span>{dateRangeLabel(req.scheduled_date, req.end_date, locale)}</span></div>}
              {req.scheduled_time && <div style={metaRow}><Icon name="clock" size={15} color={color.muted} /><span>{req.scheduled_time}</span></div>}
              {actionable && req.expires_at && <div style={{ ...metaRow, color:color.warning, fontWeight:600, ...money }}><Icon name="history" size={15} /><span>{tr('nearby_closesIn', { t: formatLeft(Date.parse(req.expires_at) - now, tr) })}</span></div>}
            </div>

            {(pet.name || traits.length > 0) && (
              <div style={{ background:color.bg, borderRadius:radius.md, padding:'10px 12px', marginBottom:10, display:'flex', gap:10 }}>
                <Icon name="paw" size={18} color={color.navy} style={{ marginTop:1 }} />
                <div style={{ minWidth:0, fontSize:font.sm, color:color.text, lineHeight:1.5 }}>
                  <div style={{ fontWeight:600, color:color.ink }}>{[pet.name, pet.breed, pet.age_years ? tr('nearby_feed_age', { n: pet.age_years }) : null].filter(Boolean).join(' · ')}</div>
                  {traits.length > 0 && <div>{traits.join(' · ')}</div>}
                  {pet.notes && <div>{pet.notes}</div>}
                </div>
              </div>
            )}
            <DogHistoryLine reviews={histories[req.pet_parent_id]} petId={pet.id || req.pet_id} style={{ marginBottom: 10 }} />
            {req.budget_max_paise ? <div style={{ ...ui.badge('success'), marginBottom:10, ...money }}>{tr('nearby_feed_budget', { n: rupees(req.budget_max_paise) })}</div> : null}
            {req.notes && <div style={{ fontSize:font.sm, color:color.text, background:color.bg, borderRadius:radius.md, padding:'10px 12px', marginBottom:10, lineHeight:1.5 }}>{req.notes}</div>}

            {res && (
              <div style={{ fontSize:font.sm, color:color.text, marginBottom:6, ...money }}>
                {tr('nearby_feed_youOffered', { n: rupees(res.offered_price) })}{res.proposed_time ? ' · ' + tr('nearby_feed_youSuggested', { time: res.proposed_time }) : ''}
              </div>
            )}
            {req.status === 'filled' && mine && <div style={{ fontSize:font.sm, color:color.success, fontWeight:600 }}>{tr('nearby_feed_youGotItHint')}</div>}

            {actionable && isActive && (
              <div>
                {urgent && <div style={{ fontSize:font.sm, color:color.warning, fontWeight:600, marginBottom:8 }}>{tr('nearby_feed_urgentNote')}</div>}
                {own != null && (
                  <button type="button" disabled={busy === req.id} onClick={() => respond(it, 'accept')} style={{ ...ui.primaryButton, width:'100%', ...money }}>
                    <Icon name="check" size={16} />{tr('nearby_feed_accept', { n: rupees(own) })}
                  </button>
                )}
                {!urgent && (
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <button type="button" onClick={() => togglePanel(req.id, 'quote')} aria-expanded={panel[req.id] === 'quote'} style={{ ...ui.secondaryButton, flex:1, minHeight:44, fontSize:font.md, padding:'0 8px' }}>{tr('nearby_feed_quote')}</button>
                    <button type="button" onClick={() => togglePanel(req.id, 'time')} aria-expanded={panel[req.id] === 'time'} style={{ ...ui.secondaryButton, flex:1, minHeight:44, fontSize:font.md, padding:'0 8px' }}>{tr('nearby_feed_otherTime')}</button>
                  </div>
                )}

                {panel[req.id] === 'quote' && (
                  <div style={{ marginTop:10, borderTop:`1px solid ${color.line}`, paddingTop:10 }}>
                    <label htmlFor={'quote-price-' + req.id} style={ui.label}>{tr('nearby_feed_priceLabel')}</label>
                    <input id={'quote-price-' + req.id} value={d.price || ''} inputMode="numeric" onChange={e => setDraft(req.id, { price: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder={own != null ? String(rupees(own)) : ''} style={{ ...ui.input, marginBottom:10, ...money }} />
                    <label htmlFor={'quote-msg-' + req.id} style={ui.label}>{tr('nearby_feed_messageLabel')}</label>
                    <textarea id={'quote-msg-' + req.id} value={d.message || ''} onChange={e => setDraft(req.id, { message: e.target.value.slice(0, 140) })}
                      placeholder={tr('nearby_feed_messagePh')} style={{ ...ui.input, resize:'none', minHeight:64, marginBottom:10, fontSize:font.md }} />
                    <button type="button" disabled={busy === req.id} onClick={() => respond(it, 'quote')} style={{ ...ui.primaryButton, width:'100%' }}>{tr('nearby_feed_sendQuote')}</button>
                  </div>
                )}

                {panel[req.id] === 'time' && (
                  <div style={{ marginTop:10, borderTop:`1px solid ${color.line}`, paddingTop:10 }}>
                    <div style={ui.label}>{tr('nearby_feed_timeLabel')}</div>
                    <div role="group" aria-label={tr('nearby_feed_timeLabel')} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                      {TIME_SLOTS.filter(ts => ts !== req.scheduled_time).map(ts => (
                        <button key={ts} type="button" onClick={() => setDraft(req.id, { time: ts })} aria-pressed={d.time === ts} style={{ ...ui.chip(d.time === ts), minHeight:44, ...money }}>{ts}</button>
                      ))}
                    </div>
                    <label htmlFor={'time-msg-' + req.id} style={ui.label}>{tr('nearby_feed_messageLabel')}</label>
                    <textarea id={'time-msg-' + req.id} value={d.message || ''} onChange={e => setDraft(req.id, { message: e.target.value.slice(0, 140) })}
                      placeholder={tr('nearby_feed_messagePh')} style={{ ...ui.input, resize:'none', minHeight:64, marginBottom:10, fontSize:font.md }} />
                    <button type="button" disabled={busy === req.id} onClick={() => respond(it, 'time')} style={{ ...ui.primaryButton, width:'100%' }}>{tr('nearby_feed_sendTime')}</button>
                  </div>
                )}

                {panel[req.id] === 'decline' ? (
                  <div style={{ marginTop:10, borderTop:`1px solid ${color.line}`, paddingTop:10 }}>
                    <div style={ui.label}>{tr('nearby_feed_reasonLabel')}</div>
                    <div role="group" aria-label={tr('nearby_feed_reasonLabel')} style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:10 }}>
                      {Object.entries(DECLINE_REASONS).map(([code, key]) => (
                        <button key={code} type="button" onClick={() => setDraft(req.id, { reason: d.reason === code ? null : code })} aria-pressed={d.reason === code} style={{ ...ui.chip(d.reason === code), minHeight:44 }}>{tr(key)}</button>
                      ))}
                    </div>
                    <button type="button" onClick={() => decline(it)} style={{ ...ui.dangerButton, width:'100%' }}>{tr('nearby_feed_confirmDecline')}</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => togglePanel(req.id, 'decline')} style={{ ...linkButton, width:'100%', marginTop:4 }}>{tr('nearby_feed_decline')}</button>
                )}
              </div>
            )}
            {msg && <div role={msg.tone === 'danger' ? 'alert' : 'status'} style={{ marginTop:8, fontSize:font.sm, color:color[msg.tone], fontWeight:600 }}>{msg.text}</div>}
          </article>
        );
      })}
    </div>
  );
}
