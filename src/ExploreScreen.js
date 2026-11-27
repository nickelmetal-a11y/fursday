import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage, translate } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';
import { distanceKm, formatKm, nearestLocality, pointFor, sitterCovers } from './geo';
import { LOCALITIES } from './data/localities';
import { loadSavedAddresses, addressLabelText } from './AddressBook';
import { HOME_OPTIONS, homeOptionKey, homeSummary, isBoardingHost } from './BoardingHomeEditor';
import { isSitterAvailable, toISODate } from './AvailabilityCalendar';
import { SITTER_CARD_SELECT, toSitterCard } from './sitterCard';
import SitterRating from './SitterRating';
import SitterMap from './SitterMap';

const BOARDING_REACH_KM = 15;
const MAX_RANGE_DAYS = 31;

const SERVICES = [
  { id: 'all', key: 'explore_filterAll', icon: 'paw' },
  { id: 'walk30', key: 'explore_filterWalking', icon: 'walk' },
  { id: 'boarding', key: 'explore_filterBoarding', icon: 'boarding' },
  { id: 'daycare', key: 'explore_filterDaycare', icon: 'sun' },
  { id: 'favorites', key: 'explore_filterFavorites', icon: 'heart' },
];

const SERVICE_NAME_KEYS = {
  walk30: 'service_walk', boarding: 'service_boarding',
  daycare: 'service_daycare', dropin: 'service_dropin', housesit: 'service_housesit',
};

const NO_FILTERS = { dateFrom: '', dateTo: '', priceMin: '', priceMax: '', sizes: [], homeTypes: [], outdoor: [], languages: [] };

const srOnly = { position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)', whiteSpace:'nowrap' };

const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
function datesBetween(from, to) {
  if (!from) return [];
  const start = parseISO(from), end = to && to > from ? parseISO(to) : start;
  const out = [];
  for (const d = new Date(start); d <= end && out.length < MAX_RANGE_DAYS; d.setDate(d.getDate() + 1)) out.push(toISODate(d));
  return out;
}

function cityCentre(city) {
  const list = LOCALITIES.filter(l => l.city === city);
  if (!list.length) return { lat: 28.4595, lng: 77.0266 };
  return { lat: list.reduce((a, l) => a + l.lat, 0) / list.length, lng: list.reduce((a, l) => a + l.lng, 0) / list.length };
}

const toggleIn = (list, v) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

export default function ExploreScreen({ onBack, city, userLocation, onBook, onViewProfile, isGuest, onRequireSignIn }) {
  const { t: tr, lang } = useLanguage();
  const [sitters, setSitters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeService, setActiveService] = useState('all');
  const [sortBy, setSortBy] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [cityId, setCityId] = useState(null);
  const [onlyMyArea, setOnlyMyArea] = useState(true);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [availability, setAvailability] = useState([]);
  const [view, setView] = useState('list');

  useEffect(() => {
    let cancelled = false;
    loadSavedAddresses().then(list => { if (!cancelled) setAddresses(list); });
    return () => { cancelled = true; };
  }, []);

  // Reference point: the default saved address in this city, else GPS when it
  // is inside this city, else none.
  const refAddress = addresses.find(a => (!a.city_id || !cityId || a.city_id === cityId) && pointFor(a)) || null;
  const gpsInCity = !!userLocation && LOCALITIES.some(l => l.city === city && distanceKm(userLocation, l) < 50);
  const refPoint = refAddress ? pointFor(refAddress) : gpsInCity ? userLocation : null;
  const refLabel = refAddress
    ? [addressLabelText(tr, refAddress.label), refAddress.area].filter(Boolean).join(' · ')
    : refPoint ? (nearestLocality(refPoint.lat, refPoint.lng, city)?.name || tr('explore_yourLocation')) : '';
  const effectiveSort = sortBy || (refPoint ? 'distance' : 'rating');

  const loadFavorites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('favorites').select('sitter_id').eq('pet_parent_id', user.id);
        setFavorites(data?.map(f => f.sitter_id) || []);
      }
    } catch (e) { /* no favourites */ }
  };

  const toggleFavorite = async (sitter) => {
    if (isGuest) { onRequireSignIn && onRequireSignIn({ type: 'favorite', sitter, from: 'explore' }); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const sitterId = sitter.id;
    if (favorites.includes(sitterId)) {
      await supabase.from('favorites').delete().eq('sitter_id', sitterId).eq('pet_parent_id', user.id);
      setFavorites(favorites.filter(id => id !== sitterId));
    } else {
      await supabase.from('favorites').insert({ sitter_id: sitterId, pet_parent_id: user.id });
      setFavorites([...favorites, sitterId]);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadFavorites();
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      setCityId(cityRow?.id || null);
      if (cityRow) {
        const { data } = await supabase
          .from('sitter_profiles')
          .select(SITTER_CARD_SELECT)
          .eq('city_id', cityRow.id)
          .eq('status', 'active');
        if (data) {
          setSitters(data.map((s) => ({
            ...toSitterCard(s, city),
            name: s.users?.name || translate('explore_sitterFallback'),
            minPrice: s.sitter_services?.length > 0
              ? Math.min(...s.sitter_services.map(sv => sv.price_paise)) / 100
              : 299,
            bio: s.bio || '',
            lat: s.lat, lng: s.lng,
            base_pincode: s.base_pincode || null,
            service_radius_km: s.service_radius_km || null,
            languages: Array.isArray(s.languages) ? s.languages : [],
            profile: s,
          })));
        }
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const days = datesBetween(filters.dateFrom, filters.dateTo);
  const dayKey = days.join(',');
  useEffect(() => {
    if (!days.length || !sitters.length) { setAvailability([]); return undefined; }
    let off = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('sitter_availability').select('*')
          .in('sitter_id', sitters.map(s => s.id)).gte('date', days[0]).lte('date', days[days.length - 1]);
        if (!off) setAvailability(!error && Array.isArray(data) ? data : []);
      } catch (e) { if (!off) setAvailability([]); }
    })();
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, sitters]);

  const priceFor = (s) => {
    const svc = activeService !== 'all' && activeService !== 'favorites' ? s.services.find(sv => sv.service_type === activeService) : null;
    return svc ? svc.price_paise / 100 : s.minPrice;
  };
  const min = Number(filters.priceMin) || 0, max = Number(filters.priceMax) || 0;
  const passesFilters = (s) => {
    if (days.length) {
      const rows = availability.filter(r => r.sitter_id === s.id);
      if (!days.every(d => isSitterAvailable(s.profile, rows, d))) return false;
    }
    const p = priceFor(s);
    if (min && p < min) return false;
    if (max && p > max) return false;
    const home = s.home_details || {};
    // Matches broadcastMatching: a host who hasn't listed sizes takes any size.
    if (filters.sizes.length && Array.isArray(home.sizes) && home.sizes.length && !filters.sizes.some(z => home.sizes.includes(z))) return false;
    if (filters.homeTypes.length && !(isBoardingHost(s.provider_type) && filters.homeTypes.includes(home.home_type))) return false;
    if (filters.outdoor.length && !(isBoardingHost(s.provider_type) && Array.isArray(home.outdoor) && filters.outdoor.some(o => home.outdoor.includes(o)))) return false;
    if (filters.languages.length && !filters.languages.some(l => s.languages.includes(l))) return false;
    return true;
  };

  let filtered = sitters.map(s => {
    const reach = sitterCovers(s, refPoint);
    // Parents take the dog to a boarding home, so the host's travel radius doesn't apply.
    const boardingOnly = s.provider_type === 'boarding';
    return { ...s, distance: reach.km, covers: boardingOnly ? (reach.km == null || reach.km <= BOARDING_REACH_KM) : reach.covers };
  });
  if (search) filtered = filtered.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  if (activeService === 'favorites') filtered = filtered.filter(s => favorites.includes(s.id));
  else if (activeService !== 'all') filtered = filtered.filter(s => s.services.some(sv => sv.service_type === activeService));
  if (refPoint && onlyMyArea) filtered = filtered.filter(s => s.covers);
  filtered = filtered.filter(passesFilters);
  if (effectiveSort === 'distance') filtered.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
  else if (effectiveSort === 'rating') filtered.sort((a, b) => ((b.rating ?? 0) - (a.rating ?? 0)) || (b.reviewCount - a.reviewCount));
  else if (effectiveSort === 'price') filtered.sort((a, b) => a.minPrice - b.minPrice);

  const languageLabel = (l) => { const key = 'sitterEdit_lang' + l; const v = tr(key); return v === key ? l : v; };
  const allLanguages = [...new Set(sitters.flatMap(s => s.languages))].sort();
  const dateLocale = lang === 'hi' ? 'hi-IN' : 'en-IN';
  const shortDate = (iso) => parseISO(iso).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
  const setF = (patch) => setFilters(f => ({ ...f, ...patch }));

  const chips = [];
  if (filters.dateFrom) chips.push({ id: 'dates', label: filters.dateTo && filters.dateTo > filters.dateFrom ? tr('explore_chipFreeRange', { from: shortDate(filters.dateFrom), to: shortDate(filters.dateTo) }) : tr('explore_chipFreeOn', { date: shortDate(filters.dateFrom) }), clear: { dateFrom: '', dateTo: '' } });
  if (min || max) chips.push({ id: 'price', label: min && max ? tr('explore_chipPrice', { min, max }) : min ? tr('explore_chipPriceMin', { n: min }) : tr('explore_chipPriceMax', { n: max }), clear: { priceMin: '', priceMax: '' } });
  filters.sizes.forEach(z => chips.push({ id: 'size-' + z, label: tr(homeOptionKey('sizes', z)), clear: { sizes: filters.sizes.filter(x => x !== z) } }));
  filters.homeTypes.forEach(h => chips.push({ id: 'home-' + h, label: tr(homeOptionKey('home_type', h)), clear: { homeTypes: filters.homeTypes.filter(x => x !== h) } }));
  filters.outdoor.forEach(o => chips.push({ id: 'out-' + o, label: tr(homeOptionKey('outdoor', o)), clear: { outdoor: filters.outdoor.filter(x => x !== o) } }));
  filters.languages.forEach(l => chips.push({ id: 'lang-' + l, label: languageLabel(l), clear: { languages: filters.languages.filter(x => x !== l) } }));

  const optionGroup = (title, field, options, labelFor) => options.length > 0 && (
    <fieldset style={{ border: 'none', margin: '0 0 18px', padding: 0 }}>
      <legend style={{ ...ui.label, padding: 0 }}>{title}</legend>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => {
          const on = filters[field].includes(o);
          return (
            <button key={o} type="button" aria-pressed={on} onClick={() => setF({ [field]: toggleIn(filters[field], o) })}
              style={{ ...ui.chip(on), minHeight: 44 }}>{labelFor(o)}</button>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      <div style={{ ...ui.header, flexDirection:'column', alignItems:'stretch', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button type="button" onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}>
            <Icon name="arrowLeft" size={20} />
          </button>
          <div style={{ minWidth:0 }}>
            <h1 style={ui.headerTitle}>{tr('explore_title', { city })}</h1>
            {refLabel && (
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:font.sm, color:color.muted, marginTop:2, overflow:'hidden', whiteSpace:'nowrap' }}>
                <Icon name="pin" size={13} color={color.navy} />
                <span style={{ overflow:'hidden', textOverflow:'ellipsis' }}>{refLabel}</span>
              </div>
            )}
          </div>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:10, padding:'0 14px', height:46, borderRadius:radius.md, border:`1px solid ${color.line}`, background:color.bg }}>
          <Icon name="search" size={18} color={color.muted} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tr('explore_searchPlaceholder')}
            style={{ border:'none', outline:'none', flex:1, minWidth:0, fontSize:15, color:color.ink, background:'transparent', fontFamily:'inherit' }} />
        </label>
      </div>

      <div style={{ padding:'12px 16px 0' }}>
        <div style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:12, paddingBottom:4 }}>
          {SERVICES.map(s => {
            const on = activeService === s.id;
            return (
              <button key={s.id} type="button" onClick={() => setActiveService(s.id)} aria-pressed={on}
                style={{ ...ui.chip(on), flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
                <Icon name={s.icon} size={16} />{tr(s.key)}
              </button>
            );
          })}
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center', justifyContent:'space-between' }}>
          <button type="button" onClick={() => setShowFilters(true)} aria-haspopup="dialog"
            style={{ ...ui.secondaryButton, minHeight:44, padding:'0 14px', fontSize:14, borderColor: chips.length ? color.navy : color.line, color: chips.length ? color.navy : color.ink }}>
            <Icon name="filter" size={16} />{chips.length ? tr('explore_filtersCount', { n: chips.length }) : tr('explore_filters')}
          </button>
          <div role="group" aria-label={tr('explore_viewLabel')} style={{ display:'flex', border:`1px solid ${color.line}`, borderRadius:radius.md, overflow:'hidden', background:color.surface }}>
            {[['list', 'explore_viewList', 'fileText'], ['map', 'explore_viewMap', 'map']].map(([id, key, icon]) => {
              const on = view === id;
              return (
                <button key={id} type="button" onClick={() => setView(id)} aria-pressed={on}
                  style={{ minHeight:44, padding:'0 14px', border:'none', background:on ? color.navy : color.surface, color:on ? '#fff' : color.text, fontSize:font.md, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6 }}>
                  <Icon name={icon} size={16} />{tr(key)}
                </button>
              );
            })}
          </div>
        </div>

        {chips.length > 0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            {chips.map(c => (
              <button key={c.id} type="button" onClick={() => setF(c.clear)} aria-label={tr('explore_removeFilter', { label: c.label })}
                style={{ minHeight:36, padding:'0 10px 0 12px', borderRadius:radius.pill, border:`1px solid ${color.navy}`, background:color.navySoft, color:color.navy, fontSize:font.sm, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'inline-flex', alignItems:'center', gap:4 }}>
                {c.label}<Icon name="close" size={14} />
              </button>
            ))}
            <button type="button" onClick={() => setFilters(NO_FILTERS)}
              style={{ minHeight:36, padding:'0 10px', border:'none', background:'none', color:color.navy, fontSize:font.sm, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>
              {tr('explore_clearAll')}
            </button>
          </div>
        )}

        <div style={{ display:'flex', gap:6, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:font.sm, color:color.muted, marginRight:2 }}>{tr('explore_sortLabel')}</span>
          {[['distance','explore_sortNearest'],['rating','explore_sortTopRated'],['price','explore_sortLowestPrice']].map(([val,labelKey]) => {
            const on = effectiveSort === val;
            const off = val === 'distance' && !refPoint;
            return (
              <button key={val} type="button" onClick={() => setSortBy(val)} aria-pressed={on} disabled={off}
                style={{ minHeight:36, padding:'0 12px', borderRadius:radius.pill, border:`1px solid ${on ? color.navy : color.line}`, background:on ? color.navySoft : color.surface, color:on ? color.navy : off ? color.faint : color.text, fontSize:font.sm, fontWeight:600, cursor:off ? 'default' : 'pointer', fontFamily:'inherit' }}>
                {tr(labelKey)}
              </button>
            );
          })}
        </div>

        {refPoint && (
          <button type="button" role="switch" aria-checked={onlyMyArea} onClick={() => setOnlyMyArea(v => !v)}
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, minHeight:44, padding:'0 2px', marginBottom:14, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
            <span style={{ fontSize:font.md, color:color.text, fontWeight:600 }}>{tr('explore_onlyMyArea')}</span>
            <span aria-hidden="true" style={{ width:40, height:24, borderRadius:radius.pill, background:onlyMyArea ? color.navy : color.line, position:'relative', flexShrink:0, transition:'background 0.15s' }}>
              <span style={{ position:'absolute', top:3, left:onlyMyArea ? 19 : 3, width:18, height:18, borderRadius:radius.pill, background:color.surface, transition:'left 0.15s' }} />
            </span>
          </button>
        )}

        {loading && (
          <div aria-busy="true">
            <span style={srOnly}>{tr('explore_finding')}</span>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ ...ui.card, marginBottom:12, display:'flex', gap:12 }}>
                <div style={{ width:56, height:56, borderRadius:radius.md, background:color.tile }} />
                <div style={{ flex:1 }}>
                  <div style={{ height:14, width:'55%', borderRadius:6, background:color.tile, marginBottom:8 }} />
                  <div style={{ height:12, width:'35%', borderRadius:6, background:color.tile }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ ...ui.card, textAlign:'center', padding:28 }}>
            <div style={{ ...ui.iconTile, margin:'0 auto 12px' }}><Icon name="search" /></div>
            <div style={{ fontSize:font.lg, fontWeight:600, color:color.ink, marginBottom:4 }}>{tr('explore_noResultsTitle')}</div>
            <div style={{ fontSize:font.md, color:color.muted }}>{tr('explore_noResultsBody')}</div>
          </div>
        )}

        {!loading && view === 'map' && filtered.length > 0 && (
          <SitterMap sitters={filtered} center={refPoint || cityCentre(city)} onOpen={s => (onViewProfile ? onViewProfile(s) : onBook && onBook(s))} />
        )}

        {!loading && view === 'list' && filtered.map(s => {
          const fav = favorites.includes(s.id);
          const home = isBoardingHost(s.provider_type) && (activeService === 'boarding' || s.provider_type === 'boarding') ? homeSummary(tr, s.home_details) : '';
          return (
            <div key={s.id} style={{ ...ui.card, marginBottom:12 }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ width:56, height:56, borderRadius:radius.md, background:color.navySoft, color:color.navy, display:'flex', alignItems:'center', justifyContent:'center', fontSize:font.xl, fontWeight:700, flexShrink:0, overflow:'hidden' }}>
                  {s.profilePhoto ? <img src={s.profilePhoto} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : s.emoji}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      {onViewProfile ? (
                        <button type="button" onClick={() => onViewProfile(s)}
                          style={{ display:'block', maxWidth:'100%', background:'none', border:'none', padding:0, margin:0, cursor:'pointer', fontFamily:'inherit', textAlign:'left', fontSize:font.lg, fontWeight:700, color:color.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</button>
                      ) : (
                        <div style={{ fontSize:font.lg, fontWeight:700, color:color.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                      )}
                      <div style={{ fontSize:font.md, fontWeight:600, color:color.ink, marginTop:2, fontVariantNumeric:'tabular-nums' }}>{tr('explore_fromPrice', { price: Math.round(s.minPrice) })}</div>
                    </div>
                    <button type="button" onClick={() => toggleFavorite(s)}
                      aria-label={tr(fav ? 'explore_removeFavorite' : 'explore_addFavorite')}
                      aria-pressed={fav}
                      style={{ width:44, height:44, margin:'-10px -10px 0 0', background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', color: fav ? color.danger : color.faint, flexShrink:0 }}>
                      <Icon name={fav ? 'heartFilled' : 'heart'} size={22} />
                    </button>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4, fontSize:font.sm, color:color.muted }}>
                    <SitterRating rating={s.rating} count={s.reviewCount} />
                    {s.distance != null && (
                      <span style={{ display:'flex', alignItems:'center', gap:3, fontVariantNumeric:'tabular-nums' }}>
                        <Icon name="pin" size={13} color={color.muted} />
                        {tr('explore_kmAway', { km: formatKm(s.distance) })}
                      </span>
                    )}
                  </div>
                  {home && (
                    <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4, fontSize:font.sm, color:color.text, minWidth:0 }}>
                      <Icon name="home" size={13} color={color.navy} />
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tr('bhome_summary', { facts: home })}</span>
                    </div>
                  )}
                </div>
              </div>
              {s.bio ? (
                <div style={{ fontSize:13, color:color.muted, lineHeight:1.5, marginBottom:12 }}>{s.bio.slice(0,100)}{s.bio.length>100?'...':''}</div>
              ) : null}
              {s.services.length > 0 && (
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
                  {s.services.map((sv, i) => (
                    <span key={i} style={{ fontSize:font.xs, padding:'4px 10px', borderRadius:radius.pill, background:color.tile, color:color.text, fontWeight:600, fontVariantNumeric:'tabular-nums' }}>
                      {tr('explore_serviceBadge', {
                        name: SERVICE_NAME_KEYS[sv.service_type] ? tr(SERVICE_NAME_KEYS[sv.service_type]) : sv.service_type,
                        price: Math.round(sv.price_paise/100),
                      })}
                    </span>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => onBook && onBook(s)} style={{ ...ui.primaryButton, width:'100%' }}>
                {tr('explore_requestBooking')}
              </button>
            </div>
          );
        })}
      </div>

      {showFilters && (
        <div onClick={() => setShowFilters(false)} style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(21,25,42,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div role="dialog" aria-modal="true" aria-label={tr('explore_filtersTitle')} onClick={e => e.stopPropagation()}
            style={{ width:'100%', maxWidth:480, maxHeight:'88vh', overflowY:'auto', boxSizing:'border-box', background:color.surface, borderRadius:'20px 20px 0 0', padding:'20px 20px calc(20px + env(safe-area-inset-bottom))', fontFamily:font.family }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom:16 }}>
              <h2 style={{ fontSize:font.lg, fontWeight:700, color:color.ink, margin:0 }}>{tr('explore_filtersTitle')}</h2>
              <button type="button" onClick={() => setShowFilters(false)} aria-label={tr('common_close')}
                style={{ width:44, height:44, borderRadius:radius.pill, border:'none', background:color.tile, color:color.text, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', padding:0 }}>
                <Icon name="close" size={20} />
              </button>
            </div>

            <fieldset style={{ border:'none', margin:'0 0 18px', padding:0 }}>
              <legend style={{ ...ui.label, padding:0 }}>{tr('explore_freeOn')}</legend>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <label style={{ fontSize:font.sm, color:color.muted }}>{tr('explore_dateFrom')}
                  <input type="date" value={filters.dateFrom} min={toISODate(new Date())} onChange={e => setF({ dateFrom: e.target.value, dateTo: filters.dateTo && filters.dateTo < e.target.value ? '' : filters.dateTo })}
                    style={{ ...ui.input, marginTop:4, minHeight:44 }} />
                </label>
                <label style={{ fontSize:font.sm, color:color.muted }}>{tr('explore_dateTo')}
                  <input type="date" value={filters.dateTo} min={filters.dateFrom || toISODate(new Date())} disabled={!filters.dateFrom} onChange={e => setF({ dateTo: e.target.value })}
                    style={{ ...ui.input, marginTop:4, minHeight:44 }} />
                </label>
              </div>
            </fieldset>

            <fieldset style={{ border:'none', margin:'0 0 18px', padding:0 }}>
              <legend style={{ ...ui.label, padding:0 }}>{tr('explore_priceRange')}</legend>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <label style={{ fontSize:font.sm, color:color.muted }}>{tr('explore_priceMin')}
                  <input type="number" inputMode="numeric" min="0" value={filters.priceMin} onChange={e => setF({ priceMin: e.target.value.replace(/\D/g, '') })}
                    style={{ ...ui.input, marginTop:4, minHeight:44 }} />
                </label>
                <label style={{ fontSize:font.sm, color:color.muted }}>{tr('explore_priceMax')}
                  <input type="number" inputMode="numeric" min="0" value={filters.priceMax} onChange={e => setF({ priceMax: e.target.value.replace(/\D/g, '') })}
                    style={{ ...ui.input, marginTop:4, minHeight:44 }} />
                </label>
              </div>
            </fieldset>

            {optionGroup(tr('explore_dogSize'), 'sizes', HOME_OPTIONS.sizes, z => tr(homeOptionKey('sizes', z)))}
            {optionGroup(tr('explore_homeType'), 'homeTypes', HOME_OPTIONS.home_type, h => tr(homeOptionKey('home_type', h)))}
            {optionGroup(tr('explore_outdoor'), 'outdoor', HOME_OPTIONS.outdoor, o => tr(homeOptionKey('outdoor', o)))}
            {optionGroup(tr('explore_languages'), 'languages', allLanguages, languageLabel)}

            <div style={{ display:'flex', gap:10, marginTop:4 }}>
              <button type="button" onClick={() => setFilters(NO_FILTERS)} style={{ ...ui.secondaryButton, flex:1 }}>{tr('explore_clearAll')}</button>
              <button type="button" onClick={() => setShowFilters(false)} style={{ ...ui.primaryButton, flex:2 }}>
                {filtered.length === 1 ? tr('explore_showResultsOne') : tr('explore_showResults', { n: filtered.length })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
