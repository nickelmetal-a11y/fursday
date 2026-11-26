import React, { useState, useEffect } from 'react';
import { ArrowLeft, Search, MapPin, Star, Filter, Heart } from 'lucide-react';
import { supabase } from './supabase';
import { useLanguage, translate } from './i18n';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)' },
  Pune: { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)' },
};

const SERVICES = [
  { id: 'all', key: 'explore_filterAll', emoji: '🐾' },
  { id: 'walk30', key: 'explore_filterWalking', emoji: '🦮' },
  { id: 'boarding', key: 'explore_filterBoarding', emoji: '🏠' },
  { id: 'daycare', key: 'explore_filterDaycare', emoji: '☀️' },
  { id: 'favorites', key: 'explore_filterFavorites', emoji: '❤️' },
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

export default function ExploreScreen({ onBack, city, userLocation, onBook, onNav }) {
  const t = THEMES[city] || THEMES.Gurgaon;
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
          const BG = ['#FFE0B2','#E1F5FE','#F8BBD9','#E8F5E9','#FFF9C4'];
          const mapped = data.map((s, i) => ({
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
            bg: BG[i % 5],
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
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F8F8F8', fontFamily:'-apple-system,sans-serif', paddingBottom:100 }}>
      <div style={{ background:t.grad, padding:'48px 20px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
          <button type="button" onClick={onBack} aria-label={tr('common_back')} style={{ width:36, height:36, borderRadius:12, border:'none', padding:0, background:'rgba(255,255,255,0.2)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <ArrowLeft size={18} color="white" />
          </button>
          <div style={{ color:'white', fontSize:17, fontWeight:700 }}>{tr('explore_title', { city })}</div>
        </div>
        <div style={{ background:'white', borderRadius:14, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
          <Search size={16} color="#CCC" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tr('explore_searchPlaceholder')}
            style={{ border:'none', outline:'none', flex:1, fontSize:14, color:'#333', background:'transparent' }} />
        </div>
      </div>

      <div style={{ padding:'12px 16px 0' }}>
        <div style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:14, paddingBottom:4 }}>
          {SERVICES.map(s => (
            <button key={s.id} onClick={() => setActiveService(s.id)}
              style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:20, border:activeService===s.id?'2px solid '+t.primary:'1.5px solid #E0E0E0', background:activeService===s.id?t.light:'white', color:activeService===s.id?t.primary:'#555', fontSize:13, fontWeight:activeService===s.id?600:400, cursor:'pointer' }}>
              <span>{s.emoji}</span>{tr(s.key)}
            </button>
          ))}
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
          <span style={{ fontSize:13, color:'#888' }}>{tr('explore_sortLabel')}</span>
          {[['distance','explore_sortNearest'],['rating','explore_sortTopRated'],['price','explore_sortLowestPrice']].map(([val,labelKey]) => (
            <button key={val} onClick={() => setSortBy(val)}
              style={{ padding:'5px 12px', borderRadius:20, border:sortBy===val?'2px solid '+t.primary:'1.5px solid #E0E0E0', background:sortBy===val?t.light:'white', color:sortBy===val?t.primary:'#555', fontSize:12, fontWeight:sortBy===val?600:400, cursor:'pointer' }}>
              {tr(labelKey)}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign:'center', padding:'40px 0' }}>
            <div style={{ fontSize:32, marginBottom:8 }}>🐾</div>
            <div style={{ fontSize:14, color:'#888' }}>{tr('explore_finding')}</div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 0' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔍</div>
            <div style={{ fontSize:15, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>{tr('explore_noResultsTitle')}</div>
            <div style={{ fontSize:13, color:'#888' }}>{tr('explore_noResultsBody')}</div>
          </div>
        )}

        {!loading && filtered.map(s => (
          <div key={s.id} style={{ background:'white', borderRadius:20, padding:16, marginBottom:12, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
              <div style={{ width:56, height:56, borderRadius:16, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, flexShrink:0 }}>
                {s.emoji}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a' }}>{s.name}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:t.primary, marginTop:2 }}>{tr('explore_fromPrice', { price: Math.round(s.minPrice) })}</div>
                  </div>
                  <button onClick={() => toggleFavorite(s.id)}
                    aria-label={tr(favorites.includes(s.id) ? 'explore_removeFavorite' : 'explore_addFavorite')}
                    aria-pressed={favorites.includes(s.id)}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center' }}>
                    <Heart size={20} fill={favorites.includes(s.id) ? t.primary : 'none'} color={favorites.includes(s.id) ? t.primary : '#DDD'} />
                  </button>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <Star size={12} fill="#FFC107" color="#FFC107" />
                    <span style={{ fontSize:13, fontWeight:600 }}>{s.rating}</span>
                    <span style={{ fontSize:12, color:'#888' }}>({s.reviews})</span>
                  </div>
                  {s.distance !== null && s.distance !== undefined && (
                    <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                      <MapPin size={12} color={t.primary} />
                      <span style={{ fontSize:12, color:t.primary, fontWeight:600 }}>{tr('explore_distanceKm', { km: s.distance.toFixed(1) })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {s.bio ? (
              <div style={{ fontSize:13, color:'#666', lineHeight:1.5, marginBottom:12 }}>{s.bio.slice(0,100)}{s.bio.length>100?'...':''}</div>
            ) : null}
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              {s.services.map((sv, i) => (
                <span key={i} style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:t.light, color:t.primary, fontWeight:500 }}>
                  {tr('explore_serviceBadge', {
                    name: SERVICE_NAME_KEYS[sv.service_type] ? tr(SERVICE_NAME_KEYS[sv.service_type]) : sv.service_type,
                    price: Math.round(sv.price_paise/100),
                  })}
                </span>
              ))}
            </div>
            <button onClick={() => onBook && onBook(s)}
              style={{ width:'100%', minHeight:44, padding:'12px 0', borderRadius:14, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              {tr('explore_requestBooking')}
            </button>
          </div>
        ))}
      </div>

      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', display:'flex', justifyContent:'space-around', padding:'10px 0 calc(16px + env(safe-area-inset-bottom))', zIndex:100 }}>
        {[
          { id:'home', key:'nav_home', emoji:'🏠' },
          { id:'book', key:'nav_bookings', emoji:'📋' },
          { id:'explore', key:'nav_explore', emoji:'🔍' },
          { id:'profile', key:'nav_myPets', emoji:'\uD83D\uDC15' },
          { id:'settings', key:'nav_settings', emoji:'\u2699\uFE0F' },
        ].map(n => (
          <button type="button" key={n.id} onClick={() => { if(n.id==='explore') return; if(onNav) onNav(n.id); else onBack(); }}
            aria-current={n.id==='explore' ? 'page' : undefined}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', border:'none', background:'none', padding:0, font:'inherit', color:'inherit' }}>
            <span style={{ fontSize:20 }}>{n.emoji}</span>
            <span style={{ fontSize:10, fontWeight:n.id==='explore'?700:400, color:n.id==='explore'?t.primary:'#BBB' }}>{tr(n.key)}</span>
            {n.id==='explore' && <div style={{ width:4, height:4, borderRadius:2, background:t.primary }} />}
          </button>
        ))}
      </div>
    </div>
  );
}