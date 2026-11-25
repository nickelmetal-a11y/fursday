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
import { useLanguage } from './i18n';
import { checkLocationRestriction } from './geolocationService';

const THEMES = {
  Gurgaon: { primary: '#FF6B35', light: '#FFF0EB', grad: 'linear-gradient(135deg,#FF6B35,#FF8C5A)', label: 'Delhi NCR' },
  Pune:    { primary: '#6C5CE7', light: '#F0EEFF', grad: 'linear-gradient(135deg,#6C5CE7,#8E7CF3)', label: 'Pune' },
};

const CITY_CONFIG = {
  Gurgaon: { displayName: 'Delhi NCR', emoji: '🏙', bounds: { lat: [28.3, 28.9], lng: [76.8, 77.5] }, center: [28.4595, 77.0266] },
  Pune:    { displayName: 'Pune', emoji: '🌴', bounds: { lat: [18.4, 18.7], lng: [73.7, 74.1] }, center: [18.5204, 73.8567] },
};

const SERVICES = [
  { id:'walk30',   icon:'🦮', name:'Request a walker',  price:'from Rs.299',       color:'#FFF3E0', tc:'#E65100' },
  { id:'boarding', icon:'🏠', name:'Home boarding',     price:'from Rs.849/night', color:'#E8F5E9', tc:'#2E7D32' },
  { id:'daycare',  icon:'☀️', name:'Doggy daycare',     price:'from Rs.649/day',   color:'#E3F2FD', tc:'#1565C0' },
  { id:'broadcast',icon:'📢', name:'Broadcast request', price:'all pros respond',  color:'#FFF0EB', tc:'#FF6B35' },
];

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
  const { t: tr } = useLanguage();

  const theme = THEMES[city] || THEMES.Gurgaon;

  const goHome = () => { setActiveNav('home'); };

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

        const isInCity = Object.values(CITY_CONFIG).some(cfg => {
          const [latMin, latMax] = cfg.bounds.lat;
          const [lngMin, lngMax] = cfg.bounds.lng;
          return lat > latMin && lat < latMax && lng > lngMin && lng < lngMax;
        });
        if (!isInCity) setOutsideCity(true);
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
            name: s.users?.name || 'Care pro',
            city, area: city,
            rating: s.rating || 5.0,
            reviews: s.total_bookings || 0,
            price: s.sitter_services?.[0] ? 'Rs.' + Math.round(s.sitter_services[0].price_paise/100) + '/walk' : 'Rs.299/walk',
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

  const handleCityChange = c => { setCity(c); localStorage.setItem('fursday_city', c); };


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
      if (!petRow) { alert('Please add a pet profile before requesting a sitter.'); return; }
      const { error } = await supabase.from('bookings').insert({ pet_parent_id:user?.id, sitter_id:sitter.id, city_id:cityRow?.id, pet_id:petRow.id, service_type:'walk30', booking_date:new Date().toISOString().split('T')[0], time_slot:'07:00', gross_amount_paise:29900, sitter_payout_paise:29900, status:'pending', payment_status:'unpaid' });
      if (error) { alert('Could not send request: ' + error.message); return; }
      setRequestSentFor(sitter.name);
      setTimeout(() => setRequestSentFor(null), 3000);
    } catch(e) { console.log('Request error:', e); }
  };

  // ── Screens ──────────────────────────────────────────────────────────────
  // Wrapped in an IIFE (rather than converting every branch below to
  // else-if) so a single <LanguageToggle/> can render on top of whichever
  // screen comes out, instead of each screen needing its own copy.
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
      <button onClick={() => window.location.reload()} style={{ marginTop:20, padding:'12px 24px', background:'#FF6B35', color:'white', border:'none', borderRadius:8, fontWeight:700, cursor:'pointer', fontSize:13 }}>
        {tr('comingSoon_checkAgain')}
      </button>
    </div>
  );

  if (loading) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:56 }}>🐾</div>
      <div style={{ color:'white', fontSize:22, fontWeight:700 }}>Fursday</div>
      <div style={{ color:'rgba(255,255,255,0.4)', fontSize:13 }}>{tr('common_loading')}</div>
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

  const activeCities = Object.keys(CITY_CONFIG).map(c => CITY_CONFIG[c].displayName).join(' and ');

  if (outsideCity) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 24px', textAlign:'center' }}>
      <div style={{ fontSize:64, marginBottom:20 }}>🗺️</div>
      <div style={{ fontSize:24, fontWeight:700, color:'white', marginBottom:8 }}>{tr('outside_title')}</div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:32, lineHeight:1.6 }}>{tr('outside_body', { cities: activeCities })}</div>
      {!waitlistSent ? (
        <div style={{ width:'100%' }}>
          <input value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="your@email.com" type="email"
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

  const goSettings = () => { setActiveNav('settings'); setShowSettings(true); };

  if (showSettings) return <SettingsScreen onBack={() => { setShowSettings(false); goHome(); }} city={city} userName={userName} activeNav={activeNav} onNav={id => { setShowSettings(false); if(id==='home'){ goHome(); } else if(id==='explore'){ setActiveNav('explore'); setShowExplore(true); } else if(id==='book'){ setActiveNav('book'); setShowBookings(true); } else if(id==='profile'){ setActiveNav('profile'); setShowUserProfile(true); } }} />;
  if (showReceipt) return <BookingReceipt onBack={() => { setShowReceipt(false); goHome(); }} onViewBookings={() => { setShowReceipt(false); setShowBookings(true); }} city={city} booking={receiptData} />;
  if (showBroadcast) return <BroadcastRequest onBack={() => { setShowBroadcast(false); goHome(); }} city={city} onSitterAccepted={sitter => { setShowBroadcast(false); setSelectedSitter(sitter); setShowBooking(true); }} />;
  if (showOnboarding) return <SitterOnboarding onDone={dest => { setShowOnboarding(false); if(dest==='sitter'){ setIsSitter(true); setIsSitterMode(true); } }} city={city} />;
  if (isSitterMode) return <SitterDashboard onBack={() => { setIsSitterMode(false); goHome(); }} onEditProfile={() => { setIsSitterMode(false); setShowSitterEdit(true); }} city={city} onMessage={b => { setChatBooking({ id:b.id, service:b.service_type, parentName:b.users?.name||'Pet parent', otherPhone:b.users?.phone||'', fromSitter:true, date:b.booking_date, time:b.time_slot, price:b.gross_amount_paise, recipientUserId:b.pet_parent_id }); setIsSitterMode(false); setShowChat(true); }} />;
  if (showSitterEdit) return <SitterEditProfile onBack={() => { setShowSitterEdit(false); goHome(); }} city={city} />;
  if (showUserProfile) return <UserProfile onBack={() => { setShowUserProfile(false); goHome(); }} city={city} activeNav={activeNav} onAddPet={() => { setShowUserProfile(false); setEditingPetId(null); setShowPetProfile(true); }} onEditPet={(pet) => { setShowUserProfile(false); setEditingPetId(pet?.id || null); setShowPetProfile(true); }} onSignOut={async () => { await supabase.auth.signOut(); setUser(null); setShowUserProfile(false); }} onNav={id => { setShowUserProfile(false); if(id==='home'){ goHome(); } else if(id==='explore'){ setActiveNav('explore'); setShowExplore(true); } else if(id==='book'){ setActiveNav('book'); setShowBookings(true); } else if(id==='settings'){ goSettings(); } }} />;
  if (showExplore) return <ExploreScreen onBack={() => { setShowExplore(false); goHome(); }} city={city} userLocation={userLocation} activeNav={activeNav} onBook={sitter => { setSelectedSitter(sitter); setShowExplore(false); setShowBooking(true); }} onNav={id => { setShowExplore(false); if(id==='home'){ goHome(); } else if(id==='book'){ setActiveNav('book'); setShowBookings(true); } else if(id==='profile'){ setActiveNav('profile'); setShowUserProfile(true); } else if(id==='settings'){ goSettings(); } }} />;
  if (showChat) return <ChatScreen onBack={() => { setShowChat(false); if(chatBooking?.fromSitter) setIsSitterMode(true); else { setShowBookings(true); } }} city={city} booking={chatBooking} userType={chatBooking?.fromSitter?'sitter':'parent'} />;
  if (showPayment) return <PaymentScreen onBack={() => setShowPayment(false)} onSuccess={paymentId => { setShowPayment(false); if(paymentBooking?.id) sendBookingEmail(paymentBooking); setReceiptData({ ...paymentBooking, paymentId }); setShowReceipt(true); }} city={city} booking={paymentBooking} />;
  if (showWalkReport) return <WalkReportCard onBack={() => { setShowWalkReport(false); setShowBookings(true); }} city={city} mode='parent' />;
  if (showBookings) return <BookingsDashboard onBack={() => { setShowBookings(false); goHome(); }} city={city} activeNav={activeNav} onViewReport={() => setShowWalkReport(true)} onReview={() => {}} onPayNow={b => { setPaymentBooking({ service:b.service_type, amount:b.gross_amount_paise, ref:b.booking_ref, id:b.id }); setShowBookings(false); setShowPayment(true); }} onMessage={(b, sitterName, sitterPhone, sitterUserId) => { setChatBooking({ id:b.id, service:b.service_type, sitterName, otherPhone:sitterPhone, date:b.booking_date, time:b.time_slot, price:b.gross_amount_paise, recipientUserId:sitterUserId }); setShowBookings(false); setShowChat(true); }} onNav={(id, payload) => { setShowBookings(false); if(id==='home'){ goHome(); } else if(id==='explore'){ setActiveNav('explore'); setShowExplore(true); } else if(id==='profile'){ setActiveNav('profile'); setShowUserProfile(true); } else if(id==='settings'){ goSettings(); } else if(id==='book' && payload?.repeatBooking){ const b = payload.repeatBooking; setSelectedSitter({ id: b.sitter_profiles?.id, name: b.sitter_profiles?.users?.name || 'Sitter', area: city }); setRepeatBookingData(b); setShowBooking(true); } }} />;
  if (showPetProfile) return <PetProfile onBack={() => { setShowPetProfile(false); setEditingPetId(null); goHome(); }} city={city} petId={editingPetId} onSave={() => { setShowPetProfile(false); setEditingPetId(null); goHome(); }} />;
  if (showBooking) return <BookingFlow onBack={() => { setShowBooking(false); setSelectedServiceType(null); setRepeatBookingData(null); setPromoForBooking(null); goHome(); }} sitter={selectedSitter} city={city} initialService={selectedServiceType} repeatBooking={repeatBookingData} initialPromoCode={promoForBooking} />;
  if (selectedSitter && !showBooking) return <SitterProfile onBack={() => { setSelectedSitter(null); goHome(); }} onBook={() => setShowBooking(true)} sitter={selectedSitter} city={city} />;

  const filteredSitters = realSitters.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Home ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F5F5F5', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', paddingBottom:80 }}>

      {requestSentFor && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', width:340, background:'#2E7D32', borderRadius:14, padding:'12px 16px', zIndex:2000, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color:'white', fontSize:13, fontWeight:600 }}>{tr('home_requestSent', { name: requestSentFor })}</span>
        </div>
      )}

      {/* HOME LAYOUT - MAP FIRST DESIGN */}
      <div style={{ position:'relative' }}>

        {/* Top bar with logo and title */}
        <div style={{ background:theme.grad, padding:'16px', display:'flex', justifyContent:'flex-start', alignItems:'center', zIndex:100 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:20, fontWeight:800, color:'white', letterSpacing:-0.5 }}>fursday</span>
            <span style={{ fontSize:16 }}>🐾</span>
          </div>
        </div>

        {/* Compact status bar — replaces a Leaflet map that was blocking the
            home screen behind a spinner whenever GPS was slow or denied.
            Location is now used silently in the background (sitter sorting
            only); nothing here blocks the rest of the page from rendering. */}
        <div style={{ padding:'14px 16px', background:'white' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, marginBottom: realSitters.length>0 ? 12 : 0 }}>
            <div style={{ fontSize:12, color:'#888' }}>
              {locationLoading ? tr('home_findingLocation') + '…' : (neighbourhood || (locationError ? tr('home_enableLocation') : CITY_CONFIG[city]?.displayName))}
            </div>
            {locationError && !userLocation && (
              <button onClick={() => { setLocationError(null); setLocationLoading(true); navigator.geolocation?.getCurrentPosition(pos => { setUserLocation({ lat:pos.coords.latitude, lng:pos.coords.longitude }); setLocationError(null); setLocationLoading(false); }, () => { setLocationError('Failed'); setLocationLoading(false); }, { timeout:10000 }); }}
                style={{ background:'none', border:'none', color:theme.primary, fontWeight:700, cursor:'pointer', fontSize:12 }}>{tr('common_tryAgain')}</button>
            )}
          </div>
          {realSitters.length > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', gap:16, fontSize:12, background:'#FAFAFA', borderRadius:12, padding:12 }}>
              <div>
                <div style={{ color:'#888', marginBottom:2 }}>{tr('home_avgRating')}</div>
                <div style={{ fontWeight:700, fontSize:14 }}>⭐ {(realSitters.reduce((a,b)=>a+b.rating,0)/realSitters.length).toFixed(1)}</div>
              </div>
              <div>
                <div style={{ color:'#888', marginBottom:2 }}>{tr('home_available')}</div>
                <div style={{ fontWeight:700, fontSize:14 }}>{tr('home_prosCount', { n: realSitters.length })}</div>
              </div>
            </div>
          )}
        </div>

        {/* Content area */}
        <div style={{ background:'white', paddingBottom:80 }}>

          {/* Quick action button */}
          <div style={{ padding:'0 16px 0' }}>
            <button onClick={() => { setActiveNav('explore'); setShowExplore(true); }}
              style={{ width:'100%', padding:'14px', background:theme.primary, border:'none', borderRadius:12, color:'white', fontWeight:700, cursor:'pointer', marginBottom:10, fontSize:13 }}>🔍 {tr('common_seeAll')} {tr('nav_explore').toLowerCase()}</button>
          </div>

          {/* Admin-declared promo banner (AdminPanel's Promotions tab) */}
          {featuredPromo && (
            <div style={{ padding:'0 16px 16px' }}>
              <PromoBanner promo={featuredPromo} onUse={() => { setPromoForBooking(featuredPromo.code); setShowBooking(true); }} />
            </div>
          )}

          {/* Service quick access */}
          <div style={{ padding:'16px' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#888', marginBottom:10 }}>{tr('home_whatDoYouNeed')}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {SERVICES.slice(0,2).map(svc => (
                <div key={svc.id} onClick={() => { if(svc.id==='broadcast'){ setShowBroadcast(true); return; } setSelectedServiceType(svc.id); setShowBooking(true); }}
                  style={{ background:svc.color, borderRadius:12, padding:'12px', cursor:'pointer', border:'0.5px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{svc.icon}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:'#1a1a1a', marginBottom:2, lineHeight:1.2 }}>{tr(svc.id==='walk30'?'service_walk':svc.id==='boarding'?'service_boarding':svc.id==='daycare'?'service_daycare':'service_broadcast')}</div>
                  <div style={{ fontSize:10, color:svc.tc, fontWeight:600 }}>{tr(svc.id==='walk30'?'service_walkPrice':svc.id==='boarding'?'service_boardingPrice':svc.id==='daycare'?'service_daycarePrice':'service_broadcastPrice')}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recently booked */}
          {realSitters.length > 0 && (
            <div style={{ padding:'16px' }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:12 }}>{tr('home_availableNow')}</div>
              {filteredSitters.slice(0,2).map(s => (
                <div key={s.id} onClick={() => setSelectedSitter(s)} style={{ background:'#fafafa', borderRadius:12, padding:12, marginBottom:10, cursor:'pointer', border:'0.5px solid #f0f0f0', display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ width:44, height:44, borderRadius:10, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, flexShrink:0, overflow:'hidden' }}>
                    {s.profilePhoto?<img src={s.profilePhoto} alt={s.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />:s.emoji}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:2 }}>{s.name}</div>
                    <div style={{ fontSize:11, color:'#888' }}>⭐ {s.rating} • {tr('home_walksSuffix', { n: s.reviews })}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); requestBooking(s); }} style={{ background:theme.primary, color:'white', border:'none', padding:'6px 12px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700, flexShrink:0 }}>{tr('common_book')}</button>
                </div>
              ))}
              <div onClick={() => { setActiveNav('explore'); setShowExplore(true); }} style={{ textAlign:'center', padding:'12px', color:theme.primary, fontSize:13, fontWeight:600, cursor:'pointer' }}>{tr('home_seeAllSitters', { n: realSitters.length })}</div>
            </div>
          )}

          {/* Sitter mode button */}
          {isSitter && (
            <div style={{ padding:'16px' }}>
              <div onClick={() => setIsSitterMode(true)} style={{ background:'#E8F5E9', borderRadius:12, padding:12, display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', border:'1px solid #C8E6C9' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'#2E7D32', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>💰</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1B5E20' }}>{tr('home_sitterMode')}</div>
                    <div style={{ fontSize:11, color:'#4CAF50', fontWeight:500 }}>
                      {sitterStatus === 'active' ? tr('live') : sitterStatus === 'needs_changes' ? tr('sitterEdit_statusNeedsChanges') : tr('pendingApproval')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Become pro banner */}
          {!isSitter && (
            <div style={{ padding:'16px' }}>
              <div onClick={() => setShowOnboarding(true)} style={{ background:'#0f0f1a', borderRadius:12, padding:12, display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🐾</div>
                  <div>
                    <div style={{ color:'white', fontSize:13, fontWeight:700 }}>{sitterStatus === 'draft' ? tr('home_resumeSignup') : tr('home_becomePro')}</div>
                    <div style={{ color:theme.primary, fontSize:11 }}>{tr('home_earnRange')}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'0.5px solid #E8E8E8', display:'flex', justifyContent:'space-around', padding:'10px 0 calc(20px + env(safe-area-inset-bottom))', zIndex:500 }}>
        {[
          { id:'home',    label:tr('nav_home'),     icon:'🏠', action: () => goHome() },
          { id:'book',    label:tr('nav_bookings'), icon:'📋', action: () => { setShowBookings(true); setActiveNav('book'); } },
          { id:'explore', label:tr('nav_explore'),  icon:'🔍', action: () => { setActiveNav('explore'); setShowExplore(true); } },
          { id:'profile', label:tr('nav_myPets'),  icon:'🐕', action: () => { setShowUserProfile(true); setActiveNav('profile'); } },
          { id:'settings',label:tr('nav_settings'), icon:'⚙️', action: () => goSettings() },
        ].map(n => (
          <div key={n.id} onClick={n.action} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', minWidth:50, paddingTop:2 }}>
            <span style={{ fontSize:20 }}>{n.icon}</span>
            <div style={{ fontSize:9, fontWeight:activeNav===n.id?700:400, color:activeNav===n.id?theme.primary:'#BBBBBB' }}>{n.label}</div>
            {activeNav===n.id && <div style={{ width:4, height:4, borderRadius:2, background:theme.primary }} />}
          </div>
        ))}
      </div>
    </div>
  );
  })();

  return (
    <>
      {screen}
      <LanguageToggle />
    </>
  );
}