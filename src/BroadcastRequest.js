import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useLanguage } from './i18n';
import { color, font, radius, ui } from './theme';
import Icon from './ui/Icon';
import { AreaSearch, loadSavedAddresses, addressLabelText, addressIcon, addressLine } from './AddressBook';
import { toISODate } from './AvailabilityCalendar';
import { formatKm, pointFor, sitterCovers } from './geo';
import { createNotification } from './notificationService';
import { writeWithFallback } from './schemaFallback';
import {
  matchCarers, nextWave, waveRadius, lastWave, petSummary, expiryFor, startsAt, isExpired,
  requestPoint, dateRangeLabel, formatLeft, TIME_SLOTS, NIGHT_SERVICES,
} from './broadcastMatching';

const SERVICES = [
  { id:'walk30', nameKey:'broadcast_svcWalkName', icon:'walk', subKey:'broadcast_svcWalkSub' },
  { id:'boarding', nameKey:'broadcast_svcBoardingName', icon:'boarding', subKey:'broadcast_svcBoardingSub' },
  { id:'daycare', nameKey:'broadcast_svcDaycareName', icon:'sun', subKey:'broadcast_svcDaycareSub' },
  { id:'dropin', nameKey:'broadcast_svcDropinName', icon:'bell', subKey:'broadcast_svcDropinSub' },
  { id:'housesit', nameKey:'broadcast_svcHousesitName', icon:'home', subKey:'broadcast_svcHousesitSub' },
];
const SERVICE_NAME_KEYS = Object.fromEntries(SERVICES.map(s => [s.id, s.nameKey]));
// Notifications are stored in English (see CLAUDE.md), so their service names are fixed here.
const SERVICE_EN = { walk30: 'Dog walk', boarding: 'Boarding', daycare: 'Daycare', dropin: 'Drop-in visit', housesit: 'House sitting' };

const REQUEST_037_COLUMNS = ['end_date', 'pet_id', 'pet_summary', 'address_pincode', 'address_lat', 'address_lng', 'mode', 'budget_max_paise', 'wave', 'radius_km', 'last_wave_at', 'expires_at'];
const RECENT_MS = 24 * 60 * 60 * 1000;
const money = { fontVariantNumeric: 'tabular-nums' };

const daysFrom = (start, n) => Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return d; });
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const rupees = (paise) => (paise == null ? null : Math.round(paise / 100));
// Invited sitters can read the request row, so only a ~1 km point is stored, never the exact pin.
const coarse = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);

async function loadCandidates(cityId) {
  let q = supabase.from('sitter_profiles').select('*, users(name), sitter_services(service_type, price_paise, is_active)').eq('status', 'active');
  if (cityId) q = q.eq('city_id', cityId);
  const { data } = await q;
  const sitters = data || [];
  let availability = [];
  if (sitters.length) {
    const { data: rows, error } = await supabase.from('sitter_availability').select('*').in('sitter_id', sitters.map(s => s.id));
    if (!error && Array.isArray(rows)) availability = rows;
  }
  return { sitters, availability };
}

function inviteTitle(req, km) {
  return 'New request near you: ' + [SERVICE_EN[req.service_type] || req.service_type, km != null ? formatKm(km) : null, req.pet_summary?.breed, dateRangeLabel(req.scheduled_date, req.end_date, 'en-IN')].filter(Boolean).join(', ');
}
function inviteBody(req) {
  const where = [req.area, req.scheduled_time].filter(Boolean).join(' · ');
  return (where ? where + '. ' : '') + (req.mode === 'urgent' ? 'Urgent: the first carer to accept gets it.' : 'Open the Jobs tab to send your price.');
}

// Invites the next batch of carers. If a wave finds nobody new it moves
// straight on to the wider one, so a quiet area doesn't wait 15 minutes for nothing.
async function dispatchWave(request, fromWave, alreadyInvited = []) {
  const { sitters, availability } = await loadCandidates(request.city_id);
  let wave = Math.min(fromWave, lastWave);
  let picks = matchCarers({ sitters, availability, request, radiusKm: waveRadius(wave), exclude: alreadyInvited });
  while (!picks.length && wave < lastWave) {
    wave += 1;
    picks = matchCarers({ sitters, availability, request, radiusKm: waveRadius(wave), exclude: alreadyInvited });
  }
  if (picks.length) {
    const { error } = await supabase.from('broadcast_recipients').insert(picks.map(p => ({
      request_id: request.id, sitter_id: p.sitter.id, wave, distance_km: p.km == null ? null : Math.round(p.km * 10) / 10,
    })));
    if (error) return { invited: 0, wave, recipientsMissing: true };
    await Promise.all(picks.filter(p => p.sitter.user_id).map(p => createNotification(p.sitter.user_id, 'broadcast_request', inviteTitle(request, p.km), inviteBody(request))));
  }
  await supabase.from('broadcast_requests').update({ wave, radius_km: waveRadius(wave), last_wave_at: new Date().toISOString() }).eq('id', request.id);
  return { invited: picks.length, wave, recipientsMissing: false };
}

const sitterFrom = (sp, fallbackName) => ({ ...sp, id: sp.id, name: sp.users?.name || fallbackName, services: sp.sitter_services || [] });

function Header({ title, sub, onBack, tr }) {
  return (
    <div style={ui.header}>
      <button type="button" onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}>
        <Icon name="arrowLeft" size={20} />
      </button>
      <div style={{ minWidth:0 }}>
        <h1 style={ui.headerTitle}>{title}</h1>
        {sub && <div style={{ color:color.muted, fontSize:font.sm }}>{sub}</div>}
      </div>
    </div>
  );
}

function Avatar({ sp, size = 48 }) {
  const name = sp?.users?.name || 'S';
  return sp?.profile_photo_url
    ? <img src={sp.profile_photo_url} alt="" style={{ width:size, height:size, borderRadius:radius.md, objectFit:'cover', flexShrink:0 }} />
    : <div aria-hidden="true" style={{ width:size, height:size, borderRadius:radius.md, background:color.navySoft, display:'flex', alignItems:'center', justifyContent:'center', fontSize:font.xl, fontWeight:700, color:color.navy, flexShrink:0 }}>{name[0].toUpperCase()}</div>;
}

function RequestStatus({ requestId, notice, onBack, onSitterAccepted, onViewSitter }) {
  const { t: tr, lang } = useLanguage();
  const [request, setRequest] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [smart, setSmart] = useState(true);
  const [responses, setResponses] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [sortBy, setSortBy] = useState('price');
  const [fallback, setFallback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const working = useRef(false);

  const markChosen = async (req, offer, offers) => {
    const { error: e1 } = await supabase.from('broadcast_responses').update({ status: 'chosen' }).eq('id', offer.id);
    if (e1) throw e1;
    const { error: e2 } = await supabase.from('broadcast_requests').update({ status: 'filled', chosen_sitter_id: offer.sitter_id }).eq('id', req.id);
    if (e2) throw e2;
    const label = SERVICE_EN[req.service_type] || 'request';
    const chosenUser = offer.sitter_profiles?.user_id;
    if (chosenUser) await createNotification(chosenUser, 'broadcast_chosen', 'You got it: ' + label + ' ' + dateRangeLabel(req.scheduled_date, req.end_date, 'en-IN'), 'The pet parent chose your offer. Watch for the booking.');
    await Promise.all(offers.filter(o => o.id !== offer.id && o.sitter_profiles?.user_id).map(o =>
      createNotification(o.sitter_profiles.user_id, 'broadcast_closed', 'Booked by someone else', 'The pet parent chose another carer for this ' + label.toLowerCase() + '. Thanks for replying.')));
  };

  const load = async (allowWork = true) => {
    const { data: req } = await supabase.from('broadcast_requests').select('*').eq('id', requestId).single();
    if (!req) return;
    const { data: recs, error: recErr } = await supabase.from('broadcast_recipients').select('*').eq('request_id', requestId);
    const { data: resps } = await supabase.from('broadcast_responses').select('*, sitter_profiles(*, users(name), sitter_services(service_type, price_paise))').eq('request_id', requestId);
    const offers = resps || [];
    const isSmart = !recErr && req.mode != null;
    setRequest(req); setRecipients(isSmart ? recs || [] : []); setResponses(offers); setSmart(isSmart);
    if (!allowWork || working.current || !isSmart) return;
    if (req.mode === 'urgent' && req.status === 'open') {
      const first = offers.filter(o => o.status === 'accepted').sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))[0];
      if (first) {
        working.current = true;
        try { await markChosen(req, first, offers); } catch (e) { console.error('Auto-choose failed:', e); }
        working.current = false;
        return load(false);
      }
    }
    if (nextWave(req, Date.now(), { offerCount: offers.length })) {
      working.current = true;
      try { await dispatchWave(req, Number(req.wave || 1) + 1, (recs || []).map(r => r.sitter_id)); } catch (e) { console.error('Next wave failed:', e); }
      working.current = false;
      return load(false);
    }
  };

  useEffect(() => {
    load();
    const poll = setInterval(() => load(), 10000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const expired = request ? isExpired(request, now) : false;
  const nobodyMatched = smart && request?.status === 'open' && Number(request?.wave || 1) >= lastWave && recipients.length === 0;
  const showFallback = !!request && responses.length === 0 && request.status !== 'cancelled' && (expired || nobodyMatched);

  useEffect(() => {
    if (!showFallback || fallback) return;
    let off = false;
    loadCandidates(request.city_id).then(({ sitters }) => {
      if (!off) setFallback(matchCarers({ sitters, request, radiusKm: Infinity, ignoreAvailability: true, limit: 3 }));
    });
    return () => { off = true; };
  }, [showFallback, fallback, request]);

  const point = request ? requestPoint(request) : null;
  const kmFor = (r) => {
    const rec = recipients.find(x => x.sitter_id === r.sitter_id);
    if (rec?.distance_km != null) return Number(rec.distance_km);
    return r.sitter_profiles && point ? sitterCovers(r.sitter_profiles, point).km : null;
  };
  const prefill = (priceRupees, time) => ({
    service: request.service_type, dateISO: request.scheduled_date, endDateISO: request.end_date || null,
    time: time || request.scheduled_time, petId: request.pet_id || null, priceRupees,
  });
  const handOff = (offer) => {
    const sitter = sitterFrom({ ...(offer.sitter_profiles || {}), id: offer.sitter_profiles?.id || offer.sitter_id }, tr('broadcast_sitterFallback'));
    if (onSitterAccepted) onSitterAccepted(sitter, { ...prefill(rupees(offer.offered_price), offer.proposed_time), requestId: request.id });
    else onBack();
  };
  const choose = async (offer) => {
    setBusy(true); setError('');
    try {
      await markChosen(request, offer, responses);
      handOff(offer);
    } catch (e) {
      console.error('Choose offer failed:', e);
      setError(tr('nearby_chooseFailed'));
    }
    setBusy(false);
  };
  const cancel = async () => {
    if (!window.confirm(tr('nearby_cancelConfirm'))) return;
    const { error: e } = await supabase.from('broadcast_requests').update({ status: 'cancelled' }).eq('id', request.id);
    if (e) { setError(tr('common_error')); return; }
    onBack();
  };

  if (!request) return (
    <div style={ui.page}>
      <Header title={tr('nearby_statusTitle')} onBack={onBack} tr={tr} />
      <div role="status" style={{ padding:16 }}>
        {[0, 1].map(i => <div key={i} style={{ height:96, borderRadius:radius.md, background:color.tile, marginBottom:12 }} />)}
      </div>
    </div>
  );

  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const svcKey = SERVICE_NAME_KEYS[request.service_type];
  const viewed = recipients.filter(r => r.viewed_at).length;
  const wave = Number(request.wave || 1);
  const radiusKm = Number(request.radius_km || waveRadius(wave));
  const chosen = responses.find(r => r.status === 'chosen');
  const sorted = [...responses].sort((a, b) => {
    if (sortBy === 'price') return (a.offered_price || 0) - (b.offered_price || 0);
    if (sortBy === 'rating') return Number(b.sitter_profiles?.avg_rating ?? b.sitter_profiles?.rating ?? 0) - Number(a.sitter_profiles?.avg_rating ?? a.sitter_profiles?.rating ?? 0);
    const ka = kmFor(a), kb = kmFor(b);
    return (ka == null ? Infinity : ka) - (kb == null ? Infinity : kb);
  });
  const ringSize = 48 + wave * 14;
  const summary = [
    svcKey ? tr(svcKey) : request.service_type,
    dateRangeLabel(request.scheduled_date, request.end_date, locale),
    request.scheduled_time, request.area, request.pet_summary?.name,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{ ...ui.page, paddingBottom:'calc(32px + env(safe-area-inset-bottom))' }}>
      <style>{'@keyframes fwNearbyPulse{0%{transform:scale(.55);opacity:.6}100%{transform:scale(1.3);opacity:0}}@media (prefers-reduced-motion: reduce){.fw-nearby-ring{animation:none!important}}'}</style>
      <Header title={tr('nearby_statusTitle')} onBack={onBack} tr={tr} />
      <div style={{ padding:16 }}>
        {(notice || !smart) && (
          <div role="status" style={{ background:color.infoSoft, color:color.info, borderRadius:radius.md, padding:'10px 12px', fontSize:font.sm, lineHeight:1.5, marginBottom:12, display:'flex', gap:8 }}>
            <Icon name="info" size={16} style={{ marginTop:1 }} /><span>{tr('nearby_legacyNotice')}</span>
          </div>
        )}

        <div style={{ ...ui.card, marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
            <span style={ui.badge(request.mode === 'urgent' ? 'warning' : 'info')}>{tr(request.mode === 'urgent' ? 'nearby_modeUrgentBadge' : 'nearby_modeCompareBadge')}</span>
          </div>
          <div style={{ fontSize:font.md, color:color.ink, fontWeight:600, lineHeight:1.5 }}>{summary}</div>
        </div>

        {request.status === 'cancelled' && (
          <div style={{ ...ui.card, textAlign:'center', marginBottom:12, color:color.muted, fontSize:font.md }}>{tr('nearby_cancelled')}</div>
        )}

        {request.status === 'open' && (
          <div style={{ ...ui.card, display:'flex', gap:14, alignItems:'center', marginBottom:12 }}>
            <div aria-hidden="true" style={{ width:88, height:88, position:'relative', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
              {smart && !expired && <span className="fw-nearby-ring" style={{ position:'absolute', width:ringSize, height:ringSize, borderRadius:radius.pill, border:`2px solid ${color.navy}`, animation:'fwNearbyPulse 2.4s ease-out infinite', transition:'width .8s ease, height .8s ease' }} />}
              <span style={{ position:'absolute', width:ringSize, height:ringSize, borderRadius:radius.pill, background:color.navySoft, transition:'width .8s ease, height .8s ease' }} />
              <span style={{ position:'relative', color:color.navy }}><Icon name="pin" size={24} /></span>
            </div>
            <div style={{ minWidth:0 }}>
              {smart && <div style={{ fontSize:font.lg, fontWeight:700, color:color.ink }}>{tr('nearby_lookingWithin', { km: radiusKm })}</div>}
              {smart && (
                <div style={{ fontSize:font.sm, color:color.text, marginTop:4, ...money }}>
                  {[tr('nearby_sentTo', { n: recipients.length }), tr('nearby_viewed', { n: viewed }), tr(responses.length === 1 ? 'nearby_offersOne' : 'nearby_offersMany', { n: responses.length })].join(' · ')}
                </div>
              )}
              {request.expires_at && (
                <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:font.sm, color:expired ? color.muted : color.warning, marginTop:6, fontWeight:600, ...money }}>
                  <Icon name="clock" size={14} />{expired ? tr('nearby_closed') : tr('nearby_closesIn', { t: formatLeft(Date.parse(request.expires_at) - now, tr) })}
                </div>
              )}
              {smart && !expired && wave < lastWave && responses.length === 0 && <div style={{ fontSize:font.xs, color:color.muted, marginTop:4 }}>{tr('nearby_widening')}</div>}
            </div>
          </div>
        )}

        {request.status === 'filled' && chosen && (
          <div style={{ ...ui.card, border:`1px solid ${color.success}`, marginBottom:12 }}>
            <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:12 }}>
              <Avatar sp={chosen.sitter_profiles} />
              <div style={{ minWidth:0, flex:1 }}>
                <div style={{ fontSize:font.lg, fontWeight:700, color:color.ink }}>{tr(request.mode === 'urgent' ? 'nearby_wonTitle' : 'nearby_chosenTitle', { name: chosen.sitter_profiles?.users?.name || tr('broadcast_sitterFallback') })}</div>
                <div style={{ fontSize:font.md, color:color.text, ...money }}>Rs.{rupees(chosen.offered_price)}</div>
              </div>
            </div>
            <button type="button" onClick={() => handOff(chosen)} style={{ ...ui.primaryButton, width:'100%' }}>{tr('nearby_continueBooking')}</button>
          </div>
        )}

        {request.status === 'open' && responses.length > 0 && (
          <>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:10, flexWrap:'wrap' }}>
              <h2 style={{ ...ui.sectionTitle, margin:0 }}>{tr('nearby_offersTitle')} ({responses.length})</h2>
              <div role="group" aria-label={tr('nearby_sortBy')} style={{ display:'flex', gap:6 }}>
                {['price', 'distance', 'rating'].map(k => (
                  <button key={k} type="button" onClick={() => setSortBy(k)} aria-pressed={sortBy === k} style={{ ...ui.chip(sortBy === k), minHeight:44 }}>
                    {tr('nearby_sort' + k[0].toUpperCase() + k.slice(1))}
                  </button>
                ))}
              </div>
            </div>
            {sorted.map(r => {
              const sp = r.sitter_profiles || {};
              const km = kmFor(r);
              const rating = Number(sp.avg_rating ?? sp.rating ?? 0);
              return (
                <article key={r.id} aria-label={sp.users?.name || tr('broadcast_sitterFallback')} style={{ ...ui.card, marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <Avatar sp={sp} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:700, color:color.ink }}>{sp.users?.name || tr('broadcast_sitterFallback')}</div>
                      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'2px 10px', fontSize:font.sm, color:color.muted, marginTop:2 }}>
                        {rating > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Icon name="starFilled" size={13} color={color.saffron} />{rating.toFixed(1)} · {tr('nearby_reviews', { n: sp.review_count || 0 })}</span>}
                        {km != null && <span>{tr('nearby_away', { d: formatKm(km) })}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize:15, fontWeight:700, color:color.ink, ...money }}>Rs.{rupees(r.offered_price) ?? '—'}</div>
                  </div>
                  {r.proposed_time && <div style={{ ...ui.badge('warning'), marginBottom:8 }}><Icon name="clock" size={12} />{tr('nearby_suggestsTime', { time: r.proposed_time })}</div>}
                  {r.message && <div style={{ fontSize:font.sm, color:color.text, background:color.bg, borderRadius:radius.md, padding:'10px 12px', marginBottom:10, lineHeight:1.5 }}>{r.message}</div>}
                  {request.mode !== 'urgent' && (
                    <button type="button" disabled={busy} onClick={() => choose(r)} style={{ ...ui.primaryButton, width:'100%' }}>{tr('broadcast_bookThisSitter')}</button>
                  )}
                </article>
              );
            })}
          </>
        )}

        {request.status === 'open' && responses.length === 0 && !showFallback && (
          <div style={{ ...ui.card, textAlign:'center', padding:24, marginBottom:12 }}>
            <div style={{ ...ui.iconTile, margin:'0 auto 12px' }}><Icon name="clock" /></div>
            <div style={{ fontSize:font.md, fontWeight:600, color:color.ink, marginBottom:4 }}>{tr('broadcast_waitingTitle')}</div>
            <div style={{ fontSize:13, color:color.muted }}>{request.mode === 'urgent' ? tr('nearby_urgentWaiting') : tr('broadcast_waitingHint')}</div>
          </div>
        )}

        {showFallback && (
          <div style={{ marginBottom:12 }}>
            <h2 style={ui.sectionTitle}>{tr('nearby_fallbackTitle')}</h2>
            <div style={{ fontSize:font.sm, color:color.muted, marginBottom:10, lineHeight:1.5 }}>{tr('nearby_fallbackSub')}</div>
            {(fallback || []).map(m => {
              const sitter = sitterFrom(m.sitter, tr('broadcast_sitterFallback'));
              return (
                <div key={m.sitter.id} style={{ ...ui.card, marginBottom:10 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <Avatar sp={m.sitter} size={44} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:font.md, fontWeight:700, color:color.ink }}>{sitter.name}</div>
                      <div style={{ display:'flex', flexWrap:'wrap', alignItems:'center', gap:'2px 10px', fontSize:font.sm, color:color.muted }}>
                        {m.rating > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}><Icon name="starFilled" size={13} color={color.saffron} />{m.rating.toFixed(1)}</span>}
                        {m.km != null && <span>{tr('nearby_away', { d: formatKm(m.km) })}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize:font.md, fontWeight:700, color:color.ink, ...money }}>Rs.{rupees(m.pricePaise)}</div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    {onViewSitter && <button type="button" onClick={() => onViewSitter(sitter)} style={{ ...ui.secondaryButton, flex:1 }}>{tr('nearby_viewProfile')}</button>}
                    <button type="button" aria-label={tr('nearby_book') + ' ' + sitter.name}
                      onClick={() => (onSitterAccepted ? onSitterAccepted(sitter, { ...prefill(rupees(m.pricePaise)), requestId: null }) : onBack())}
                      style={{ ...ui.primaryButton, flex:1 }}>{tr('nearby_book')}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && <div role="alert" style={{ fontSize:font.sm, color:color.danger, marginBottom:10 }}>{error}</div>}

        {request.status === 'open' && (
          <button type="button" onClick={cancel} style={{ ...ui.dangerButton, width:'100%', marginTop:4 }}>{tr('nearby_cancelRequest')}</button>
        )}

        <div style={{ background:color.successSoft, borderRadius:radius.md, padding:'12px 14px', marginTop:12, fontSize:13, color:color.success, lineHeight:1.5, display:'flex', gap:10 }}>
          <Icon name="shield" size={18} style={{ marginTop:1 }} />
          <span>{tr('nearby_chargeNotice')}</span>
        </div>
      </div>
    </div>
  );
}

export default function BroadcastRequest({ onBack, city, onSitterAccepted, onViewSitter, requestId: openRequestId }) {
  const { t: tr, lang } = useLanguage();
  const [step, setStep] = useState(0);
  const [service, setService] = useState('');
  const [startIdx, setStartIdx] = useState(0);
  const [nights, setNights] = useState(1);
  const [time, setTime] = useState('');
  const [pets, setPets] = useState([]);
  const [petId, setPetId] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [areaQuery, setAreaQuery] = useState('');
  const [locality, setLocality] = useState(null);
  const [mode, setMode] = useState('compare');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [existing, setExisting] = useState(null);
  const [requestId, setRequestId] = useState(openRequestId || null);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: petRows }, saved, { data: open }] = await Promise.all([
        supabase.from('pet_profiles').select('*').eq('user_id', user.id),
        loadSavedAddresses(),
        supabase.from('broadcast_requests').select('*').eq('pet_parent_id', user.id).eq('status', 'open').order('created_at', { ascending: false }).limit(1),
      ]);
      if (off) return;
      const list = petRows || [];
      setPets(list);
      if (list.length === 1) setPetId(list[0].id);
      setAddresses(saved);
      if (saved.length) setAddressId(saved[0].id);
      const latest = (open || [])[0];
      if (latest && Date.now() - Date.parse(latest.created_at) < RECENT_MS) setExisting(latest);
    })().catch(e => console.error('Request builder load failed:', e));
    return () => { off = true; };
  }, []);

  if (requestId) return <RequestStatus requestId={requestId} notice={notice} onBack={onBack} onSitterAccepted={onSitterAccepted} onViewSitter={onViewSitter} />;

  const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const isNight = NIGHT_SERVICES.includes(service);
  const days = daysFrom(today(), 14);
  const startDate = days[startIdx];
  const endDate = (() => { const d = new Date(startDate); d.setDate(d.getDate() + nights); return d; })();
  const nightOptions = daysFrom(startDate, 15).slice(1);
  const savedAddress = addresses.find(a => a.id === addressId);
  const place = savedAddress
    ? { area: savedAddress.area, pincode: savedAddress.pincode, ...(pointFor(savedAddress) || {}) }
    : locality ? { area: locality.name, pincode: locality.pincode, lat: locality.lat, lng: locality.lng } : null;

  const ready = (step === 0 && !!service) || (step === 1 && !!time) || (step === 2 && !!place && (pets.length === 0 || !!petId)) || step === 3;

  const submit = async () => {
    setSaving(true); setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not signed in');
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      const pet = pets.find(p => p.id === petId);
      const dateISO = toISODate(startDate);
      const nowDate = new Date();
      const budgetRs = Number(String(budget).replace(/\D/g, ''));
      const row = {
        pet_parent_id: user.id, city_id: cityRow?.id || null, service_type: service,
        scheduled_date: dateISO, scheduled_time: time, area: place.area, notes: notes.trim() || null, status: 'open',
        end_date: isNight ? toISODate(endDate) : null, pet_id: pet?.id || null, pet_summary: petSummary(pet),
        address_pincode: place.pincode || null, address_lat: coarse(place.lat), address_lng: coarse(place.lng),
        mode, budget_max_paise: budgetRs > 0 ? budgetRs * 100 : null, wave: 1, radius_km: waveRadius(1),
        last_wave_at: nowDate.toISOString(), expires_at: expiryFor(mode, startsAt(dateISO, time), nowDate).toISOString(),
      };
      const { data, error: insertErr } = await writeWithFallback(r => supabase.from('broadcast_requests').insert(r).select().single(), row, REQUEST_037_COLUMNS);
      if (insertErr || !data) throw insertErr || new Error('not saved');
      let legacy = data.mode == null;
      if (!legacy) {
        const res = await dispatchWave({ ...row, ...data }, 1, []);
        legacy = res.recipientsMissing;
      }
      setNotice(legacy);
      setRequestId(data.id);
    } catch (e) {
      console.error('Broadcast error:', e);
      setError(tr('nearby_sendFailed'));
    }
    setSaving(false);
  };

  const stepTitle = { fontSize:font.xl, fontWeight:700, color:color.ink, margin:'0 0 4px', letterSpacing:-0.2 };
  const stepHint = { fontSize:font.md, color:color.muted, marginBottom:16 };
  const dayStrip = (list, selected, onPick, labelKey) => (
    <div role="group" aria-label={tr(labelKey)} style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:8, marginBottom:16, scrollbarWidth:'none' }}>
      {list.map((d, i) => {
        const on = selected === i;
        return (
          <button type="button" key={i} onClick={() => onPick(i)} aria-pressed={on} aria-label={d.toLocaleDateString(locale, { weekday:'long', day:'numeric', month:'long' })}
            style={{ flexShrink:0, width:54, minHeight:44, borderRadius:radius.md, padding:'10px 6px', textAlign:'center', cursor:'pointer', font:'inherit', color:'inherit', background:on ? color.navy : color.surface, border:`1px solid ${on ? color.navy : color.line}` }}>
            <div style={{ fontSize:font.xs, color:on ? color.navySoft : color.muted, marginBottom:4 }}>{d.toLocaleDateString(locale, { weekday:'short' })}</div>
            <div style={{ fontSize:17, fontWeight:700, color:on ? color.surface : color.ink, ...money }}>{d.getDate()}</div>
            <div style={{ fontSize:font.xs, color:on ? color.navySoft : color.faint, marginTop:2 }}>{d.toLocaleDateString(locale, { month:'short' })}</div>
          </button>
        );
      })}
    </div>
  );
  const radioCard = (on, onClick, icon, title, sub, key) => (
    <button type="button" key={key} onClick={onClick} aria-pressed={on}
      style={{ width:'100%', textAlign:'left', font:'inherit', color:'inherit', background:color.surface, borderRadius:radius.lg, padding:'12px 14px', marginBottom:8, display:'flex', gap:12, alignItems:'center', cursor:'pointer', border:`1px solid ${on ? color.navy : color.line}`, boxShadow:on ? `inset 0 0 0 1px ${color.navy}` : 'none', minHeight:56 }}>
      {icon}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:15, fontWeight:600, color:color.ink }}>{title}</div>
        {sub && <div style={{ fontSize:font.sm, color:color.muted, lineHeight:1.4 }}>{sub}</div>}
      </div>
      <span style={{ width:20, height:20, borderRadius:radius.pill, border:`1.5px solid ${on ? color.navy : color.line}`, background:on ? color.navy : 'transparent', color:color.surface, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {on && <Icon name="check" size={13} strokeWidth={2.6} />}
      </span>
    </button>
  );

  return (
    <div style={{ ...ui.page, paddingBottom:'calc(96px + env(safe-area-inset-bottom))' }}>
      <Header title={tr('broadcast_headerTitle')} sub={tr('nearby_headerSub')} onBack={onBack} tr={tr} />
      <div style={{ display:'flex', gap:6, padding:'12px 16px 14px', background:color.surface, borderBottom:`1px solid ${color.line}` }}>
        {[0, 1, 2, 3].map(i => <div key={i} style={{ flex:1, height:4, borderRadius:radius.pill, background:i <= step ? color.navy : color.line }} />)}
      </div>

      <div style={{ padding:'20px 16px 0' }}>
        {step === 0 && existing && (
          <button type="button" onClick={() => setRequestId(existing.id)}
            style={{ width:'100%', textAlign:'left', fontFamily:'inherit', background:color.saffronSoft, border:`1px solid ${color.line}`, borderRadius:radius.lg, padding:12, marginBottom:16, display:'flex', gap:12, alignItems:'center', cursor:'pointer' }}>
            <span style={{ ...ui.iconTile, width:40, height:40, background:color.surface, color:color.warning }}><Icon name="megaphone" size={20} /></span>
            <span style={{ flex:1, minWidth:0 }}>
              <span style={{ display:'block', fontSize:font.md, fontWeight:600, color:color.ink }}>{tr('nearby_openRequestTitle')}</span>
              <span style={{ display:'block', fontSize:font.sm, color:color.navy, fontWeight:600, marginTop:2 }}>{tr('nearby_openRequestCta')}</span>
            </span>
            <Icon name="chevronRight" size={18} color={color.muted} />
          </button>
        )}

        {step === 0 && (
          <>
            <h2 style={stepTitle}>{tr('broadcast_step0Title')}</h2>
            <div style={stepHint}>{tr('broadcast_step0Sub')}</div>
            {SERVICES.map(s => radioCard(service === s.id, () => setService(s.id),
              <span style={{ ...ui.iconTile, background:service === s.id ? color.navySoft : color.tile }}><Icon name={s.icon} size={24} /></span>,
              tr(s.nameKey), tr(s.subKey), s.id))}
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={stepTitle}>{tr('broadcast_step1Title')}</h2>
            <div style={stepHint}>{tr('broadcast_step1Sub')}</div>
            <div style={ui.label}>{tr(isNight ? 'nearby_step1StartLabel' : 'nearby_step1DayLabel')}</div>
            {dayStrip(days, startIdx, setStartIdx, isNight ? 'nearby_step1StartLabel' : 'nearby_step1DayLabel')}
            {isNight && (
              <>
                <div style={ui.label}>{tr('nearby_step1EndLabel')}</div>
                {dayStrip(nightOptions, nights - 1, i => setNights(i + 1), 'nearby_step1EndLabel')}
              </>
            )}
            <div style={ui.label}>{tr('nearby_timeLabel')}</div>
            <div role="group" aria-label={tr('nearby_timeLabel')} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
              {TIME_SLOTS.map(ts => {
                const on = time === ts;
                return (
                  <button type="button" key={ts} onClick={() => setTime(ts)} aria-pressed={on}
                    style={{ minHeight:44, padding:'0 8px', borderRadius:radius.md, textAlign:'center', cursor:'pointer', fontFamily:'inherit', background:on ? color.navy : color.surface, border:`1px solid ${on ? color.navy : color.line}`, fontSize:13, fontWeight:600, color:on ? color.surface : color.text, ...money }}>
                    {ts}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={stepTitle}>{tr('nearby_step2Title')}</h2>
            <div style={stepHint}>{tr('nearby_step2Sub')}</div>
            <div style={ui.label}>{tr('nearby_petLabel')}</div>
            {pets.length === 0 && <div style={{ ...ui.card, fontSize:font.sm, color:color.muted, marginBottom:16 }}>{tr('nearby_noPets')}</div>}
            {pets.length > 0 && <div style={{ marginBottom:16 }}>
              {pets.map(p => radioCard(petId === p.id, () => setPetId(p.id),
                p.photo_url
                  ? <img src={p.photo_url} alt="" style={{ width:40, height:40, borderRadius:radius.md, objectFit:'cover', flexShrink:0 }} />
                  : <span style={{ ...ui.iconTile, width:40, height:40 }}><Icon name="paw" size={20} /></span>,
                p.name, [p.breed, petSummary(p).size ? tr('nearby_size_' + petSummary(p).size) : null].filter(Boolean).join(' · '), p.id))}
            </div>}

            <div style={ui.label}>{tr('nearby_placeLabel')}</div>
            {addresses.map(a => radioCard(addressId === a.id, () => setAddressId(a.id),
              <span style={{ ...ui.iconTile, width:40, height:40 }}><Icon name={addressIcon(a.label)} size={20} /></span>,
              addressLabelText(tr, a.label), addressLine(a), a.id))}
            {addresses.length > 0 && radioCard(addressId === null, () => setAddressId(null),
              <span style={{ ...ui.iconTile, width:40, height:40 }}><Icon name="search" size={20} /></span>,
              tr('nearby_anotherArea'), locality ? locality.name + ' · ' + locality.pincode : null, 'another')}
            {addressId === null && (
              <div style={{ marginBottom:16 }}>
                <AreaSearch city={city} value={areaQuery} onChange={v => { setAreaQuery(v); setLocality(null); }} onPick={l => { setLocality(l); setAreaQuery(l.name); }} />
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={stepTitle}>{tr('nearby_step3Title')}</h2>
            <div style={stepHint}>{tr('nearby_step3Sub')}</div>
            {radioCard(mode === 'urgent', () => setMode('urgent'),
              <span style={{ ...ui.iconTile, width:40, height:40, background:color.saffronSoft, color:color.warning }}><Icon name="clock" size={20} /></span>,
              tr('nearby_modeUrgent'), tr('nearby_modeUrgentSub'), 'urgent')}
            {radioCard(mode === 'compare', () => setMode('compare'),
              <span style={{ ...ui.iconTile, width:40, height:40 }}><Icon name="scale" size={20} /></span>,
              tr('nearby_modeCompare'), tr('nearby_modeCompareSub'), 'compare')}
            <div style={{ ...ui.card, margin:'8px 0 12px' }}>
              <label htmlFor="nearby-budget" style={ui.label}>{tr('nearby_budgetLabel')}</label>
              <div style={{ position:'relative', marginBottom:14 }}>
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', color:color.muted, fontSize:15 }}>Rs.</span>
                <input id="nearby-budget" value={budget} onChange={e => setBudget(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric"
                  placeholder={tr('nearby_budgetPh')} style={{ ...ui.input, paddingLeft:44, ...money }} />
              </div>
              <label htmlFor="nearby-notes" style={ui.label}>{tr('broadcast_notesLabel')}</label>
              <textarea id="nearby-notes" value={notes} onChange={e => setNotes(e.target.value.slice(0, 500))}
                placeholder={tr('nearby_notesPh')}
                style={{ ...ui.input, fontSize:14, resize:'none', minHeight:88, lineHeight:1.6 }} />
            </div>
            <div style={{ background:color.tile, borderRadius:radius.md, padding:'12px 14px', fontSize:13, color:color.text, lineHeight:1.6, display:'flex', gap:10 }}>
              <Icon name="lock" size={18} color={color.navy} style={{ marginTop:1 }} />
              <span>{tr('nearby_privacy')}</span>
            </div>
            {error && <div role="alert" style={{ fontSize:font.sm, color:color.danger, marginTop:10 }}>{error}</div>}
          </>
        )}
      </div>

      <div style={{ position:'fixed', bottom:0, left:0, right:0, background:color.surface, borderTop:`1px solid ${color.line}`, zIndex:100 }}>
        <div style={{ maxWidth:480, margin:'0 auto', padding:'12px 16px calc(12px + env(safe-area-inset-bottom))', display:'flex', gap:10, boxSizing:'border-box' }}>
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)} style={{ ...ui.secondaryButton, flex:1 }}>
              {tr('broadcast_backButton')}
            </button>
          )}
          <button type="button"
            onClick={() => { if (step < 3) setStep(s => s + 1); else submit(); }}
            disabled={saving || !ready}
            style={{ ...ui.primaryButton, flex:2, background:ready ? color.navy : color.line, color:ready ? color.surface : color.faint, cursor:ready ? 'pointer' : 'not-allowed' }}>
            {saving ? tr('common_sending') : step === 3 ? tr('nearby_send') : tr('broadcast_continueButton')}
          </button>
        </div>
      </div>
    </div>
  );
}
