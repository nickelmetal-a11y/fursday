import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { useLanguage, translate } from './i18n';
import { color, font, radius, ui, navPadding } from './theme';
import Icon from './ui/Icon';

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

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const srOnly = { position:'absolute', width:1, height:1, overflow:'hidden', clip:'rect(0 0 0 0)', whiteSpace:'nowrap' };

export default function ExploreScreen({ onBack, city, userLocation, onBook, onNav }) {
  const { t: tr } = useLanguage();
  const [sitters, setSitters] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeService, setActiveService] = useState('all');
  const [sortBy, setSortBy] = useState('distance');
  const [favorites, setFavorites] = useState([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

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
            distance: userLocation && s.lat && s.lng
              ? getDistanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng)
              : null,
            emoji: (s.users?.name || 'S')[0].toUpperCase(),
          }));
          setSitters(mapped);
          setFiltered(mapped);
        }
      }
      setLoading(false);
    };
    load();
  }, [city]);

  useEffect(() => {
    let result = [...sitters];
    if (search) result = result.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
    if (activeService === 'favorites') result = result.filter(s => favorites.includes(s.id));
    else if (activeService !== 'all') result = result.filter(s => s.services.some(sv => sv.service_type === activeService));
    if (sortBy === 'distance') result.sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999));
    else if (sortBy === 'rating') result.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'price') result.sort((a, b) => a.minPrice - b.minPrice);
    setFiltered(result);
  }, [search, activeService, sortBy, sitters, favorites]);

  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      <div style={{ ...ui.header, flexDirection:'column', alignItems:'stretch', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button type="button" onClick={onBack} aria-label={tr('common_back')} style={ui.backButton}>
            <Icon name="arrowLeft" size={20} />
          </button>
          <h1 style={ui.headerTitle}>{tr('explore_title', { city })}</h1>
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
            const on = sortBy === val;
            return (
              <button key={val} type="button" onClick={() => setSortBy(val)} aria-pressed={on}
                style={{ minHeight:32, padding:'0 12px', borderRadius:radius.pill, border:`1px solid ${on ? color.navy : color.line}`, background:on ? color.navySoft : color.surface, color:on ? color.navy : color.text, fontSize:font.sm, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                {tr(labelKey)}
              </button>
            );
          })}
        </div>

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
                    {s.distance !== null && s.distance !== undefined && (
                      <span style={{ display:'flex', alignItems:'center', gap:3 }}>
                        <Icon name="pin" size={13} color={color.muted} />
                        {tr('explore_distanceKm', { km: s.distance.toFixed(1) })}
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
