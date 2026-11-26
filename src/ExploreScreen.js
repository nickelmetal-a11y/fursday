import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage, translate } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';
import { distanceKm, formatKm, nearestLocality, pointFor, sitterCovers } from './geo';
import { LOCALITIES } from './data/localities';
import { loadSavedAddresses, addressLabelText } from './AddressBook';

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

const srOnly = { position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)', whiteSpace:'nowrap' };

export default function ExploreScreen({ onBack, city, userLocation, onBook, onNav }) {
  const { t: tr } = useLanguage();
  const [sitters, setSitters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeService, setActiveService] = useState('all');
  const [sortBy, setSortBy] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [cityId, setCityId] = useState(null);
  const [onlyMyArea, setOnlyMyArea] = useState(true);

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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('favorites').select('sitter_id').eq('pet_parent_id', user.id);
      setFavorites(data?.map(f => f.sitter_id) || []);
    }
  };

  const toggleFavorite = async (sitterId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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
          .select('*, users(name), sitter_services(service_type, price_paise)')
          .eq('city_id', cityRow.id)
          .eq('status', 'active');
        if (data) {
          const mapped = data.map((s) => ({
            id: s.id,
            name: s.users?.name || translate('explore_sitterFallback'),
            rating: s.rating || 5.0,
            reviews: s.total_bookings || 0,
            services: s.sitter_services || [],
            minPrice: s.sitter_services?.length > 0
              ? Math.min(...s.sitter_services.map(sv => sv.price_paise)) / 100
              : 299,
            bio: s.bio || '',
            lat: s.lat, lng: s.lng,
            base_area: s.base_area || null,
            base_pincode: s.base_pincode || null,
            service_radius_km: s.service_radius_km || null,
            emoji: (s.users?.name || 'S')[0].toUpperCase(),
          }));
          setSitters(mapped);
        }
      }
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  let filtered = sitters.map(s => {
    const reach = sitterCovers(s, refPoint);
    return { ...s, distance: reach.km, covers: reach.covers };
  });
  if (search) filtered = filtered.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  if (activeService === 'favorites') filtered = filtered.filter(s => favorites.includes(s.id));
  else if (activeService !== 'all') filtered = filtered.filter(s => s.services.some(sv => sv.service_type === activeService));
  if (refPoint && onlyMyArea) filtered = filtered.filter(s => s.covers);
  if (effectiveSort === 'distance') filtered.sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
  else if (effectiveSort === 'rating') filtered.sort((a, b) => b.rating - a.rating);
  else if (effectiveSort === 'price') filtered.sort((a, b) => a.minPrice - b.minPrice);

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

        {!loading && filtered.map(s => {
          const fav = favorites.includes(s.id);
          return (
            <div key={s.id} style={{ ...ui.card, marginBottom:12 }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ width:56, height:56, borderRadius:radius.md, background:color.navySoft, color:color.navy, display:'flex', alignItems:'center', justifyContent:'center', fontSize:font.xl, fontWeight:700, flexShrink:0 }}>
                  {s.emoji}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:font.lg, fontWeight:700, color:color.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize:font.md, fontWeight:600, color:color.ink, marginTop:2, fontVariantNumeric:'tabular-nums' }}>{tr('explore_fromPrice', { price: Math.round(s.minPrice) })}</div>
                    </div>
                    <button type="button" onClick={() => toggleFavorite(s.id)}
                      aria-label={tr(fav ? 'explore_removeFavorite' : 'explore_addFavorite')}
                      aria-pressed={fav}
                      style={{ width:44, height:44, margin:'-10px -10px 0 0', background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', justifyContent:'center', color: fav ? color.danger : color.faint, flexShrink:0 }}>
                      <Icon name={fav ? 'heartFilled' : 'heart'} size={22} />
                    </button>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4, fontSize:font.sm, color:color.muted }}>
                    <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <Icon name="starFilled" size={13} color={color.saffron} />
                      <span style={{ fontWeight:600, color:color.ink }}>{s.rating}</span>
                      <span>({s.reviews})</span>
                    </span>
                    {s.distance != null && (
                      <span style={{ display:'flex', alignItems:'center', gap:3, fontVariantNumeric:'tabular-nums' }}>
                        <Icon name="pin" size={13} color={color.muted} />
                        {tr('explore_kmAway', { km: formatKm(s.distance) })}
                      </span>
                    )}
                  </div>
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
    </div>
  );
}
