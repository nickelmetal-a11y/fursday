import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import LoginScreen from './LoginScreen';
import SitterProfile from './SitterProfile';
import SitterOnboarding from './SitterOnboarding';
import BookingFlow from './BookingFlow';
import PetProfile from './PetProfile';
import WalkReportCard from './WalkReportCard';
import BookingsDashboard from './BookingsDashboard';
import PromoBanner from './PromoBanner';
import SitterDashboard from './SitterDashboard';
import PaymentScreen from './PaymentScreen';
import UserProfile from './UserProfile';
import ExploreScreen from './ExploreScreen';
import FirstLoginPrompt from './FirstLoginPrompt';
import SitterEditProfile from './SitterEditProfile';
import ChatScreen from './ChatScreen';
import BookingReceipt from './BookingReceipt';
import ParentOnboarding from './ParentOnboarding';
import BroadcastRequest from './BroadcastRequest';
import SettingsScreen from './SettingsScreen';
import LanguageToggle from './LanguageToggle';
import { useLanguage, translate } from './i18n';
import { checkLocationRestriction } from './geolocationService';
import BottomNav, { PARENT_TABS, SITTER_TABS } from './ui/BottomNav';
import Icon from './ui/Icon';
import { color, font, radius, ui, navPadding } from './theme';
import InboxScreen from './InboxScreen';
import SitterEarningsDashboard from './SitterEarningsDashboard';
import NotificationCenter from './NotificationCenter';
import WalkingPaws from './ui/WalkingPaws';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)', label: 'Delhi NCR' },
  Pune:    { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)', label: 'Pune' },
};

const CITY_CONFIG = {
  Gurgaon: { displayName: 'Delhi NCR', emoji: '🏙', bounds: { lat: [28.2, 29.0], lng: [76.7, 77.7] }, center: [28.4595, 77.0266] },
  Pune:    { displayName: 'Pune', emoji: '🌴', bounds: { lat: [18.35, 18.8], lng: [73.6, 74.2] }, center: [18.5204, 73.8567] },
};

const SERVICES = [
  { id:'walk30',   icon:'🦮', name:'Request a walker',  price:'from Rs.299',       color:'#FFF3E0', tc:'#E65100' },
  { id:'boarding', icon:'🏠', name:'Home boarding',     price:'from Rs.849/night', color:'#E8F5E9', tc:'#2E7D32' },
  { id:'daycare',  icon:'☀️', name:'Doggy daycare',     price:'from Rs.649/day',   color:'#E3F2FD', tc:'#1565C0' },
  { id:'broadcast',icon:'📢', name:'Broadcast request', price:'all pros respond',  color:'#FFF0EB', tc:'#FF6B35' },
];

// Which service city a coordinate falls in, or null if outside all of them.
export const cityForCoords = (lat, lng) => Object.keys(CITY_CONFIG).find(key => {
  const { lat: [latMin, latMax], lng: [lngMin, lngMax] } = CITY_CONFIG[key].bounds;
  return lat > latMin && lat < latMax && lng > lngMin && lng < lngMax;
}) || null;

const getNeighbourhood = (lat, lng) => {
  if (!lat || !lng) return '';
  if (lat > 28.48 && lat < 28.52 && lng > 77.08 && lng < 77.12) return 'DLF Phase 1-3';
  if (lat > 28.44 && lat < 28.48 && lng > 77.09 && lng < 77.13) return 'DLF Phase 4-5';
  if (lat > 28.45 && lat < 28.50 && lng > 77.03 && lng < 77.08) return 'Sushant Lok';
  if (lat > 28.40 && lat < 28.45 && lng > 77.03 && lng < 77.09) return 'Nirvana Country';
  if (lat > 18.52 && lat < 18.56 && lng > 73.88 && lng < 73.92) return 'Koregaon Park';
  if (lat > 18.55 && lat < 18.60 && lng > 73.77 && lng < 73.82) return 'Baner';
  if (lat > 18.55 && lat < 18.58 && lng > 73.91 && lng < 73.95) return 'Viman Nagar';
  if (lat > 28.3 && lat < 28.9) return 'Delhi NCR';
  if (lat > 18.4 && lat < 18.7) return 'Pune';
  return '';
};

export default function App() {
  const [city, setCity]                   = useState(() => localStorage.getItem('fursday_city') || 'Gurgaon');
  const [user, setUser]                   = useState(null);
  const [loading, setLoading]             = useState(true);
  const [activeNav, setActiveNav]         = useState('home');
  const [selectedSitter, setSelectedSitter] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showBooking, setShowBooking]     = useState(false);
  const [showPetProfile, setShowPetProfile] = useState(false);
  const [editingPetId, setEditingPetId] = useState(null);
  const [repeatBookingData, setRepeatBookingData] = useState(null);
  const [showWalkReport, setShowWalkReport] = useState(false);
  const [showBookings, setShowBookings]   = useState(false);
  const [realSitters, setRealSitters]     = useState([]);
  const [userLocation, setUserLocation]   = useState(null);
  const [sittersLoading, setSittersLoading] = useState(true);
  const [isSitterMode, setIsSitterMode]   = useState(false);
  const [isSitter, setIsSitter]           = useState(false);
  const [sitterStatus, setSitterStatus]   = useState(null);
  const [showPayment, setShowPayment]     = useState(false);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [requestSentFor, setRequestSentFor] = useState(null);
  const [chatBooking, setChatBooking]     = useState(null);
  const [showChat, setShowChat]           = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showExplore, setShowExplore]     = useState(false);
  const [showSitterEdit, setShowSitterEdit] = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const [outsideCity, setOutsideCity]     = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSent, setWaitlistSent]   = useState(false);
  const [userName, setUserName]           = useState(null);
  const [showReceipt, setShowReceipt]     = useState(false);
  const [receiptData, setReceiptData]     = useState(null);
  const [showParentOnboarding, setShowParentOnboarding] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [neighbourhood, setNeighbourhood] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState(null);
  const [search, setSearch]               = useState('');
  const [locationLoading, setLocationLoading] = useState(true);
  const [featuredPromo, setFeaturedPromo] = useState(null);
  const [promoForBooking, setPromoForBooking] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [regionRestricted, setRegionRestricted] = useState(false);
  const [userIP, setUserIP] = useState(null);
  const [sitterTab, setSitterTab] = useState('jobs');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  // Keep the loading screen up for at least one walk cycle so everyone sees it (owner: at least 2 seconds).
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSplashDone(true), process.env.NODE_ENV === 'test' ? 0 : 2000); return () => clearTimeout(t); }, []);
  const { t: tr } = useLanguage();

  const theme = THEMES[city] || THEMES.Gurgaon;

  const goHome = () => { setActiveNav('home'); };
  const closeTabScreens = () => { setShowBookings(false); setShowExplore(false); setShowUserProfile(false); setShowSettings(false); };
  // Screens still call onNav with their old ids ('book', 'profile', 'settings').
  const TAB_ALIASES = { book: 'bookings', profile: 'pets', settings: 'account' };
  const goParentTab = (raw) => {
    const id = TAB_ALIASES[raw] || raw;
    closeTabScreens();
    setActiveNav(id === 'bookings' ? 'book' : id === 'pets' ? 'profile' : id === 'account' ? 'settings' : id);
    if (id === 'bookings') setShowBookings(true);
    else if (id === 'explore') setShowExplore(true);
    else if (id === 'pets') setShowUserProfile(true);
    else if (id === 'account') setShowSettings(true);
  };

  // Android's hardware back button closes the whole app by default because
  // screens are React state, not browser history. Instead, press the visible
  // on-screen back arrow (so multi-step screens step back one page), else
  // return home, and only exit from the home screen.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapacitorApp.addListener('backButton', () => {
      const arrow = Array.from(document.querySelectorAll('svg.lucide-arrow-left')).find(el => el.getBoundingClientRect().width > 0);
      const target = arrow?.closest('button, [role="button"], div[style*="cursor"]');
      if (target) { target.click(); return; }
      if (activeNav !== 'home') { goHome(); return; }
      CapacitorApp.exitApp();
    });
    return () => { sub.then(h => h.remove()); };
  }, [activeNav]);

  // Location restriction check (IP-based)
  useEffect(() => {
    const checkAccess = async () => {
      const result = await checkLocationRestriction();
      if (!result.allowed) {
        setRegionRestricted(true);
        setLocationLoading(false);
      }
      if (result.ip) setUserIP(result.ip);
    };
    checkAccess();
  }, []);

  // Improved GPS detection with fallbacks
  useEffect(() => {
    const getLocationWithFallback = async () => {
      setLocationLoading(true);
      setLocationError(null);

      if (!navigator.geolocation) {
        setLocationError('Geolocation not available');
        setLocationLoading(false);
        return;
      }

      const successCallback = (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });
        setNeighbourhood(getNeighbourhood(lat, lng));
        setLocationLoading(false);

        const detected = cityForCoords(lat, lng);
        // A city the person picked by hand wins over GPS.
        if (detected && !localStorage.getItem('fursday_city_manual')) { setCity(detected); localStorage.setItem('fursday_city', detected); }
        if (!detected) setOutsideCity(true);
      };

      const errorCallback = (error) => {
        console.log('GPS error:', error.code, error.message);
        setLocationLoading(false);
        setLocationError('Unable to get location');
        setUserLocation(null);
      };

      try {
        navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        });
      } catch (e) {
        setLocationLoading(false);
        setLocationError('Location access denied');
      }
    };

    getLocationWithFallback();
  }, []);

  // Fetch sitters
  useEffect(() => {
    const fetchSitters = async () => {
      setSittersLoading(true);
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      if (cityRow) {
        const { data } = await supabase
          .from('sitter_profiles')
          .select('*, users(name), sitter_services(service_type, price_paise), lat, lng')
          .eq('city_id', cityRow.id)
          .eq('status', 'active');
        if (data) {
          setRealSitters(data.map((s, i) => ({
            id: s.id,
            name: s.users?.name || translate('sitterProfile_nameFallback'),
            city, area: city,
            rating: s.rating || 5.0,
            reviews: s.total_bookings || 0,
            price: translate('home_pricePerWalk').replace('{n}', s.sitter_services?.[0] ? Math.round(s.sitter_services[0].price_paise/100) : 299),
            tags: s.sitter_services?.map(sv => sv.service_type) || [],
            verified: s.aadhaar_verified || false,
            emoji: (s.users?.name || 'S')[0].toUpperCase(),
            bg: ['#FFE0B2','#E1F5FE','#F8BBD9','#E8F5E9','#FFF9C4'][i % 5],
            isTopSitter: s.is_top_sitter || false,
            profilePhoto: s.profile_photo_url || null,
            lat: s.lat || null,
            lng: s.lng || null,
          })));
        }
      }
      setSittersLoading(false);
    };
    fetchSitters();
  }, [city]);

  // Check if sitter
  useEffect(() => {
    const checkIfSitter = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('sitter_profiles').select('id,status').eq('user_id', user.id).single();
        // A 'draft' row means onboarding was started but never submitted —
        // treat that as "not yet a sitter" so the home screen offers to
        // resume onboarding instead of claiming the sitter is live/pending.
        if (data) { setIsSitter(data.status !== 'draft'); setSitterStatus(data.status); }
      }
    };
    checkIfSitter();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const loadFeaturedPromo = async () => {
      const now = new Date().toISOString();
      const { data } = await supabase.from('promo_codes').select('*')
        .eq('status', 'active').eq('featured_home', true)
        .lte('valid_from', now).gte('valid_until', now)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      setFeaturedPromo(data || null);
    };
    loadFeaturedPromo();
  }, [user]);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const { data } = await supabase.from('users').select('name').eq('id', session.user.id).single();
        setUserName(data?.name || null);
      }
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (_e === 'SIGNED_OUT') setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleCityChange = c => { setCity(c); setNeighbourhood(''); localStorage.setItem('fursday_city', c); localStorage.setItem('fursday_city_manual', '1'); setShowCityPicker(false); };
  const useMyLocation = () => {
    localStorage.removeItem('fursday_city_manual');
    setShowCityPicker(false);
    setLocationError(null); setLocationLoading(true);
    navigator.geolocation?.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setUserLocation({ lat, lng }); setNeighbourhood(getNeighbourhood(lat, lng)); setLocationLoading(false);
      const detected = cityForCoords(lat, lng);
      if (detected) { setCity(detected); localStorage.setItem('fursday_city', detected); }
    }, () => { setLocationError('Failed'); setLocationLoading(false); }, { timeout: 10000 });
  };


  const sendBookingEmail = async (booking) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: parentRow } = await supabase.from('users').select('name').eq('id', user?.id).single();
      const { data: ownContact } = await supabase.rpc('get_user_contact', { target_id: user?.id });
      const parentEmail = ownContact?.[0]?.email;
      let sitterName = '', sitterEmail = '';
      if (booking.sitter_id) {
        const { data: sp } = await supabase.from('sitter_profiles').select('user_id, users(name)').eq('id', booking.sitter_id).single();
        if (sp?.user_id) {
          const { data: sitterContact } = await supabase.rpc('get_user_contact', { target_id: sp.user_id });
          sitterName = sp.users?.name || ''; sitterEmail = sitterContact?.[0]?.email || '';
        }
      }
      const { data: full } = await supabase.from('bookings').select('*').eq('id', booking.id).single();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('https://vucboyiklqdxpqbpfplt.supabase.co/functions/v1/send-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
        body: JSON.stringify({
          booking_ref: full?.booking_ref, service_type: full?.service_type,
          scheduled_date: full?.booking_date, scheduled_time: full?.time_slot,
          end_date: full?.end_date, gross_amount_paise: full?.gross_amount_paise, start_otp: full?.start_otp,
          parent_name: parentRow?.name, parent_email: parentEmail,
          sitter_name: sitterName, sitter_email: sitterEmail,
        }),
      });
    } catch(e) { console.log('Email error:', e); }
  };

  const requestBooking = async (sitter) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      const { data: petRow } = await supabase.from('pet_profiles').select('id').eq('user_id', user?.id).limit(1).single();
      if (!petRow) { alert(tr('home_alertAddPetFirst')); return; }
      const { error } = await supabase.from('bookings').insert({ pet_parent_id:user?.id, sitter_id:sitter.id, city_id:cityRow?.id, pet_id:petRow.id, service_type:'walk30', booking_date:new Date().toISOString().split('T')[0], time_slot:'07:00', gross_amount_paise:29900, sitter_payout_paise:29900, status:'pending', payment_status:'unpaid' });
      if (error) { alert(tr('home_alertRequestFailed') + error.message); return; }
      setRequestSentFor(sitter.name);
      setTimeout(() => setRequestSentFor(null), 3000);
    } catch(e) { console.log('Request error:', e); }
  };

  // ── Screens ──────────────────────────────────────────────────────────────
  // Wrapped in an IIFE (rather than converting every branch below to
  // else-if) so a single <LanguageToggle/> can render on top of whichever
  // screen comes out, instead of each screen needing its own copy.
  let navMode = null;
  let floatingToggle = true;
  const screen = (function renderScreen() {
  if (regionRestricted) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', padding:'0 24px', textAlign:'center', gap:16 }}>
      <div style={{ fontSize:64 }}>🗺️</div>
      <div style={{ fontSize:24, fontWeight:700, color:'white', marginBottom:8 }}>{tr('comingSoon_title')}</div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.7)', marginBottom:16, lineHeight:1.6 }}>
        {tr('comingSoon_body')}<br/><br/>
        {tr('comingSoon_expanding')}
      </div>
      {userIP && (
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:16, padding:'8px 12px', background:'rgba(255,255,255,0.05)', borderRadius:8 }}>
        {tr('comingSoon_yourIp')} {userIP}
        </div>
      )}
      <button onClick={() => window.location.reload()} style={{ marginTop:20, padding:'12px 24px', minHeight:44, background:'#FF6B35', color:'white', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:13 }}>
        {tr('comingSoon_checkAgain')}
      </button>
    </div>
  );

  if (loading || !splashDone) floatingToggle = false;
  if (loading || !splashDone) return (
    <div role="status" aria-label={tr('common_loading')} style={{ minHeight:'100vh', background:color.navy, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', fontFamily:font.family, textAlign:'center', padding:24 }}>
      <WalkingPaws color="#F3B77A" />
      <div style={{ color:'white', fontSize:28, fontWeight:700, letterSpacing:-0.3, marginTop:28 }}>Fursday</div>
      <div style={{ color:'#B9C3DA', fontSize:13, marginTop:6 }}>{tr('splash_tagline')}</div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={async u => {
    setUser(u);
    await supabase.from('users').upsert({ id:u.id, email:u.email }, { onConflict:'id', ignoreDuplicates:true });
    const { data } = await supabase.from('users').select('name').eq('id', u.id).single();
    setUserName(data?.name || null);
  }} />;

  // A DB-side default/trigger backfills users.name to the login email when
  // it's otherwise null (likely to satisfy a NOT NULL constraint written
  // for the old phone-first signup flow). That makes this check think
  // onboarding is already done, so FirstLoginPrompt — and the real-name /
  // city / pet-or-sitter-role setup that follows it — gets silently
  // skipped for every brand-new email signup. Treat "name equals the
  // login email" as "no real name set yet" too.
  const needsFirstLogin = user && (!userName || userName.trim().toLowerCase() === user.email?.toLowerCase());
  if (needsFirstLogin) return <FirstLoginPrompt user={user} onDone={name => { setUserName(name); setShowParentOnboarding(true); }} />;
  if (showParentOnboarding) return <ParentOnboarding onDone={() => setShowParentOnboarding(false)} city={city} userName={userName} />;

  const activeCities = Object.keys(CITY_CONFIG).map(c => CITY_CONFIG[c].displayName).join(tr('home_citiesJoiner'));

  if (outsideCity) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 24px', textAlign:'center' }}>
      <div style={{ fontSize:64, marginBottom:20 }}>🗺️</div>
      <div style={{ fontSize:24, fontWeight:700, color:'white', marginBottom:8 }}>{tr('outside_title')}</div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:32, lineHeight:1.6 }}>{tr('outside_body', { cities: activeCities })}</div>
      {!waitlistSent ? (
        <div style={{ width:'100%' }}>
          <input value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="your@email.com" type="email" aria-label={tr('home_waitlistEmailLabel')}
            style={{ width:'100%', padding:'16px', borderRadius:14, border:'1.5px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.08)', fontSize:15, color:'white', outline:'none', boxSizing:'border-box', marginBottom:12 }} />
          <button onClick={async () => { if(waitlistEmail.includes('@')){ await supabase.from('waitlist').insert({ email:waitlistEmail }); setWaitlistSent(true); } }}
            style={{ width:'100%', padding:'16px 0', borderRadius:14, border:'none', background:'#FF6B35', color:'white', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:12 }}>
            {tr('outside_joinWaitlist')}
          </button>
          <button onClick={() => setOutsideCity(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer' }}>{tr('outside_iAmIn', { cities: activeCities })}</button>
        </div>
      ) : (
        <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:16, padding:20, width:'100%' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
          <div style={{ color:'white', fontSize:16, fontWeight:600, marginBottom:8 }}>{tr('outside_onList')}</div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13 }}>{tr('outside_willEmail')}</div>
          <button onClick={() => setOutsideCity(false)} style={{ marginTop:16, background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer' }}>{tr('common_continueAnyway')}</button>
        </div>
      )}
    </div>
  );

  const goSettings = () => goParentTab('account');

  if (isSitterMode) {
    navMode = 'sitter';
    if (sitterTab === 'jobs') floatingToggle = false;
    if (sitterTab === 'earnings') return <SitterEarningsDashboard city={city} onBack={() => setSitterTab('jobs')} />;
    if (sitterTab === 'messages') return <InboxScreen role="sitter" onOpenChat={b => { setChatBooking({ id:b.id, service:b.service_type, parentName:b.users?.name||tr('chat_defaultParentName'), otherPhone:'', fromSitter:true, date:b.booking_date, time:b.time_slot, price:b.gross_amount_paise, recipientUserId:b.pet_parent_id }); setIsSitterMode(false); setShowChat(true); }} />;
    if (sitterTab === 'profile') return <SitterEditProfile onBack={() => setSitterTab('jobs')} city={city} />;
    if (sitterTab === 'account') return <SettingsScreen onBack={() => setSitterTab('jobs')} city={city} userName={userName} onNav={() => {}} onSwitchRole={() => { setIsSitterMode(false); setSitterTab('jobs'); goHome(); }} switchRoleLabel={tr('sitterMode_backToParent')} />;
    return <SitterDashboard onBack={() => { setIsSitterMode(false); goHome(); }} onEditProfile={() => setSitterTab('profile')} onOpenNotifications={() => setShowNotifications(true)} city={city} onMessage={b => { setChatBooking({ id:b.id, service:b.service_type, parentName:b.users?.name||tr('chat_defaultParentName'), otherPhone:b.users?.phone||'', fromSitter:true, date:b.booking_date, time:b.time_slot, price:b.gross_amount_paise, recipientUserId:b.pet_parent_id }); setIsSitterMode(false); setShowChat(true); }} />;
  }
  if (showSettings) { navMode = 'parent'; return <SettingsScreen onBack={() => goParentTab('home')} city={city} userName={userName} activeNav={activeNav} onNav={goParentTab} onSwitchRole={isSitter ? () => { closeTabScreens(); setSitterTab('jobs'); setIsSitterMode(true); } : null} switchRoleLabel={tr('home_switchToSitter')} />; }
  if (showReceipt) return <BookingReceipt onBack={() => { setShowReceipt(false); goHome(); }} onViewBookings={() => { setShowReceipt(false); setShowBookings(true); }} city={city} booking={receiptData} />;
  if (showBroadcast) return <BroadcastRequest onBack={() => { setShowBroadcast(false); goHome(); }} city={city} onSitterAccepted={sitter => { setShowBroadcast(false); setSelectedSitter(sitter); setShowBooking(true); }} />;
  if (showOnboarding) return <SitterOnboarding onDone={dest => { setShowOnboarding(false); if(dest==='sitter'){ setIsSitter(true); setIsSitterMode(true); } }} city={city} />;
  if (showSitterEdit) return <SitterEditProfile onBack={() => { setShowSitterEdit(false); goHome(); }} city={city} />;
  if (showUserProfile) navMode = 'parent';
  if (showUserProfile) return <UserProfile onBack={() => goParentTab('home')} city={city} activeNav={activeNav} onAddPet={() => { setShowUserProfile(false); setEditingPetId(null); setShowPetProfile(true); }} onEditPet={(pet) => { setShowUserProfile(false); setEditingPetId(pet?.id || null); setShowPetProfile(true); }} onSignOut={async () => { await supabase.auth.signOut(); setUser(null); setShowUserProfile(false); }} onNav={goParentTab} />;
  if (showExplore) navMode = 'parent';
  if (showExplore) return <ExploreScreen onBack={() => goParentTab('home')} city={city} userLocation={userLocation} activeNav={activeNav} onBook={sitter => { setSelectedSitter(sitter); setShowExplore(false); setShowBooking(true); }} onNav={goParentTab} />;
  if (showChat) return <ChatScreen onBack={() => { setShowChat(false); if(chatBooking?.fromSitter) setIsSitterMode(true); else { setShowBookings(true); } }} city={city} booking={chatBooking} userType={chatBooking?.fromSitter?'sitter':'parent'} />;
  if (showPayment) return <PaymentScreen onBack={() => setShowPayment(false)} onSuccess={paymentId => { setShowPayment(false); if(paymentBooking?.id) sendBookingEmail(paymentBooking); setReceiptData({ ...paymentBooking, paymentId }); setShowReceipt(true); }} city={city} booking={paymentBooking} />;
  if (showWalkReport) return <WalkReportCard onBack={() => { setShowWalkReport(false); setShowBookings(true); }} city={city} mode='parent' />;
  if (showBookings) navMode = 'parent';
  if (showBookings) return <BookingsDashboard onBack={() => goParentTab('home')} city={city} activeNav={activeNav} onViewReport={() => setShowWalkReport(true)} onReview={() => {}} onPayNow={b => { setPaymentBooking({ service:b.service_type, amount:b.gross_amount_paise, ref:b.booking_ref, id:b.id }); setShowBookings(false); setShowPayment(true); }} onMessage={(b, sitterName, sitterPhone, sitterUserId) => { setChatBooking({ id:b.id, service:b.service_type, sitterName, otherPhone:sitterPhone, date:b.booking_date, time:b.time_slot, price:b.gross_amount_paise, recipientUserId:sitterUserId }); setShowBookings(false); setShowChat(true); }} onNav={(id, payload) => { if (!(id==='book' && payload?.repeatBooking)) { goParentTab(id); return; } setShowBookings(false); if(id==='book' && payload?.repeatBooking){ const b = payload.repeatBooking; setSelectedSitter({ id: b.sitter_profiles?.id, name: b.sitter_profiles?.users?.name || tr('bookings_sitterFallback'), area: city }); setRepeatBookingData(b); setShowBooking(true); } }} />;
  if (showPetProfile) return <PetProfile onBack={() => { setShowPetProfile(false); setEditingPetId(null); goHome(); }} city={city} petId={editingPetId} onSave={() => { setShowPetProfile(false); setEditingPetId(null); goHome(); }} />;
  if (showBooking) return <BookingFlow onBack={() => { setShowBooking(false); setSelectedServiceType(null); setRepeatBookingData(null); setPromoForBooking(null); goHome(); }} sitter={selectedSitter} city={city} initialService={selectedServiceType} repeatBooking={repeatBookingData} initialPromoCode={promoForBooking} />;
  if (selectedSitter && !showBooking) return <SitterProfile onBack={() => { setSelectedSitter(null); goHome(); }} onBook={() => setShowBooking(true)} sitter={selectedSitter} city={city} />;

  navMode = 'parent';
  floatingToggle = false;
  const firstName = (userName || '').trim().split(/\s+/)[0] || '';
  const initials = (userName || user?.email || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const place = neighbourhood && cityForCoords(userLocation?.lat, userLocation?.lng) === city ? neighbourhood : tr(city === 'Pune' ? 'city_pune' : 'city_ncr');
  const services = [
    { id: 'walk30', icon: 'walk', label: tr('home_svcWalk') },
    { id: 'boarding', icon: 'boarding', label: tr('home_svcBoarding') },
    { id: 'daycare', icon: 'sun', label: tr('home_svcDaycare') },
    { id: 'broadcast', icon: 'megaphone', label: tr('home_svcAnyone') },
  ];
  const openService = (id) => { if (id === 'broadcast') { setShowBroadcast(true); return; } setSelectedServiceType(id); setShowBooking(true); };
  const topSitters = [...realSitters].sort((x, y) => (y.isTopSitter - x.isTopSitter) || (y.rating - x.rating)).slice(0, 3);

  // ── Home ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {requestSentFor && (
        <div role="status" style={{ position:'fixed', top:'calc(12px + env(safe-area-inset-top))', left:16, right:16, maxWidth:448, margin:'0 auto', background:color.success, color:'white', borderRadius:radius.md, padding:'12px 16px', zIndex:2000, fontSize:13, fontWeight:600 }}>
          {tr('home_requestSent', { name: requestSentFor })}
        </div>
      )}
      {showNotifications && <NotificationCenter onClose={() => setShowNotifications(false)} />}
      {showCityPicker && (
        <div role="dialog" aria-modal="true" aria-label={tr('city_pickTitle')} onClick={() => setShowCityPicker(false)}
          style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(21,25,42,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:480, background:color.surface, borderRadius:'20px 20px 0 0', padding:'20px 16px calc(20px + env(safe-area-inset-bottom))', fontFamily:font.family }}>
            <div style={{ fontSize:18, fontWeight:700, color:color.ink, marginBottom:4 }}>{tr('city_pickTitle')}</div>
            <div style={{ fontSize:13, color:color.muted, marginBottom:14 }}>{tr('city_pickSub')}</div>
            <button type="button" onClick={useMyLocation}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:12, minHeight:52, padding:'0 14px', marginBottom:10, borderRadius:radius.md, border:`1px solid ${color.line}`, background:color.bg, cursor:'pointer', fontFamily:font.family, fontSize:14, fontWeight:600, color:color.navy, textAlign:'left' }}>
              <Icon name="pin" size={18} />{tr('city_useLocation')}
            </button>
            {Object.keys(CITY_CONFIG).map(key => {
              const on = key === city;
              return (
                <button key={key} type="button" onClick={() => handleCityChange(key)} aria-pressed={on}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', minHeight:56, padding:'0 14px', marginBottom:8, borderRadius:radius.md, border:`1.5px solid ${on ? color.navy : color.line}`, background:on ? color.navySoft : color.surface, cursor:'pointer', fontFamily:font.family, textAlign:'left' }}>
                  <span>
                    <span style={{ display:'block', fontSize:15, fontWeight:600, color:color.ink }}>{tr(key === 'Pune' ? 'city_pune' : 'city_ncr')}</span>
                    <span style={{ display:'block', fontSize:12, color:color.muted }}>{tr(key === 'Pune' ? 'city_puneAreas' : 'city_ncrAreas')}</span>
                  </span>
                  {on && <Icon name="check" size={20} color={color.navy} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <header style={{ padding:'calc(16px + env(safe-area-inset-top)) 16px 4px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
          <button type="button" onClick={() => setShowCityPicker(true)} aria-haspopup="dialog" aria-label={tr('city_change') + ': ' + (place || '')}
            style={{ background:'none', border:'none', padding:0, textAlign:'left', cursor:'pointer', fontFamily:font.family, minWidth:0 }}>
            <span style={{ display:'block', fontSize:11, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', color:color.muted }}>{tr('home_walksIn')}</span>
            <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:16, fontWeight:700, color:color.ink }}>
              <Icon name="pin" size={16} color={color.navy} />
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{locationLoading ? tr('home_findingLocation') + '…' : place}</span>
              <Icon name="chevronDown" size={16} color={color.muted} />
            </span>
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <LanguageToggle inline />
            <button type="button" aria-label={tr('nav_notifications')} onClick={() => setShowNotifications(true)}
              style={{ width:40, height:40, borderRadius:radius.pill, border:`1px solid ${color.line}`, background:color.surface, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:color.text }}>
              <Icon name="bell" size={19} />
            </button>
            <button type="button" aria-label={tr('nav_account')} onClick={() => goParentTab('account')}
              style={{ width:40, height:40, borderRadius:radius.pill, border:'none', background:color.navy, color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:font.family }}>
              {initials}
            </button>
          </div>
        </div>
        {firstName && <div style={{ fontSize:22, fontWeight:700, color:color.ink, margin:'16px 0 0', letterSpacing:-0.3 }}>{tr('greeting')}, {firstName}</div>}
        <button type="button" onClick={() => goParentTab('explore')}
          style={{ marginTop:14, width:'100%', display:'flex', alignItems:'center', gap:10, padding:'0 14px', height:48, borderRadius:radius.md, border:`1px solid ${color.line}`, background:color.surface, color:color.faint, fontSize:14, cursor:'pointer', fontFamily:font.family, textAlign:'left' }}>
          <Icon name="search" size={18} color={color.muted} />{tr('home_searchPlaceholder')}
        </button>
      </header>

      <section style={{ padding:'20px 16px 4px' }}>
        <h2 style={ui.sectionTitle}>{tr('home_bookService')}</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
          {services.map(svc => (
            <button key={svc.id} type="button" onClick={() => openService(svc.id)}
              style={{ background:'none', border:'none', padding:'4px 0', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:8, fontFamily:font.family }}>
              <span style={{ width:60, height:60, borderRadius:radius.lg, background:color.tile, display:'flex', alignItems:'center', justifyContent:'center', color:color.navy }}>
                <Icon name={svc.icon} size={26} />
              </span>
              <span style={{ fontSize:12, fontWeight:600, color:color.text, textAlign:'center', lineHeight:1.25 }}>{svc.label}</span>
            </button>
          ))}
        </div>
      </section>

      {featuredPromo && (
        <div style={{ padding:'16px 16px 0' }}>
          <PromoBanner promo={featuredPromo} onUse={() => { setPromoForBooking(featuredPromo.code); setShowBooking(true); }} />
        </div>
      )}

      <div style={{ display:'flex', flexWrap:'wrap', gap:8, padding:'14px 16px 0' }}>
        {[['shield', 'home_trustVerified'], ['key', 'home_trustStartCode'], ['sos', 'home_trustSos']].map(([icon, key]) => (
          <span key={key} style={{ ...ui.badge('success'), padding:'5px 10px', fontSize:12 }}><Icon name={icon} size={14} />{tr(key)}</span>
        ))}
      </div>

      <section style={{ padding:'22px 16px 0' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
          <h2 style={ui.sectionTitle}>{tr('home_topSitters')}</h2>
          {realSitters.length > 0 && <button type="button" onClick={() => goParentTab('explore')} style={{ background:'none', border:'none', color:color.navy, fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:font.family, padding:'4px 0' }}>{tr('home_seeAll')}</button>}
        </div>
        {!sittersLoading && realSitters.length === 0 && <div style={{ ...ui.card, color:color.muted, fontSize:13 }}>{tr('home_noSittersYet')}</div>}
        {sittersLoading && [0,1].map(i => <div key={i} style={{ height:64, borderRadius:radius.md, background:color.tile, marginBottom:10 }} />)}
        {topSitters.map((s, i) => (
          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
            <button type="button" onClick={() => setSelectedSitter(s)} aria-label={s.name}
              style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0, background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left', fontFamily:font.family }}>
              <span style={{ width:52, height:52, borderRadius:radius.md, background:color.navySoft, color:color.navy, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:18, overflow:'hidden', flexShrink:0 }}>
                {s.profilePhoto ? <img src={s.profilePhoto} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : s.emoji}
              </span>
              <span style={{ minWidth:0 }}>
                <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:14, fontWeight:600, color:color.ink }}>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
                  {s.verified && <Icon name="shield" size={14} color={color.success} title={tr('home_trustVerified')} />}
                </span>
                <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:color.muted, marginTop:2 }}>
                  <Icon name="star" size={13} color={color.saffron} />{Number(s.rating).toFixed(1)} · {tr('home_sitterWalks', { n: s.reviews })} · {s.price}
                </span>
              </span>
            </button>
            <button type="button" onClick={() => { setSelectedSitter(s); setShowBooking(true); }}
              style={{ minHeight:36, padding:'0 14px', borderRadius:radius.sm, border:`1px solid ${color.navy}`, background:color.surface, color:color.navy, fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:font.family, flexShrink:0 }}>
              {tr('common_book')}
            </button>
          </div>
        ))}
      </section>

      <div style={{ padding:'20px 16px 8px' }}>
        <button type="button" onClick={() => { if (isSitter) { closeTabScreens(); setSitterTab('jobs'); setIsSitterMode(true); } else setShowOnboarding(true); }}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:12, padding:14, borderRadius:radius.lg, border:`1px solid ${color.line}`, background:color.bg, cursor:'pointer', textAlign:'left', fontFamily:font.family }}>
          <span style={ui.iconTile}><Icon name={isSitter ? 'briefcase' : 'wallet'} /></span>
          <span style={{ flex:1, minWidth:0 }}>
            <span style={{ display:'block', fontSize:14, fontWeight:600, color:color.ink }}>
              {isSitter ? tr('home_switchToSitter') : sitterStatus === 'draft' ? tr('home_resumeSignup') : tr('home_becomeSitterTitle')}
            </span>
            <span style={{ display:'block', fontSize:12, color:color.muted, marginTop:2 }}>
              {isSitter ? (sitterStatus === 'active' ? tr('live') : sitterStatus === 'needs_changes' ? tr('sitterEdit_statusNeedsChanges') : tr('pendingApproval')) : tr('home_becomeSitterSub')}
            </span>
          </span>
          <Icon name="chevronRight" size={18} color={color.faint} />
        </button>
      </div>
    </div>
  );
  })();

  const parentTab = showSettings ? 'account' : showUserProfile ? 'pets' : showExplore ? 'explore' : showBookings ? 'bookings' : 'home';
  return (
    <>
      {screen}
      {navMode === 'parent' && <BottomNav tabs={PARENT_TABS} active={parentTab} onSelect={goParentTab} />}
      {navMode === 'sitter' && <BottomNav tabs={SITTER_TABS} active={sitterTab} onSelect={setSitterTab} />}
      {navMode === 'sitter' && showNotifications && <NotificationCenter onClose={() => setShowNotifications(false)} />}
      {floatingToggle && <LanguageToggle />}
    </>
  );
}