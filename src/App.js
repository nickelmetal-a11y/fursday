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
import BroadcastRequest from './BroadcastRequest';
import SettingsScreen from './SettingsScreen';
import LanguageToggle from './LanguageToggle';
import FeedbackTab from './FeedbackTab';
import GuestPrompt from './GuestPrompt';
import ConversationScreen from './ConversationScreen';
import SitterRating from './SitterRating';
import { SITTER_CARD_SELECT, toSitterCard } from './sitterCard';
import { findSitterBySlug, slugFromPath } from './ShareProfileCard';
import { useLanguage } from './i18n';
import { checkLocationRestriction } from './geolocationService';
import BottomNav, { PARENT_TABS, SITTER_TABS } from './ui/BottomNav';
import Icon from './ui/Icon';
import { color, font, radius, shadow, ui, navPadding } from './theme';
import InboxScreen from './InboxScreen';
import SitterEarningsDashboard from './SitterEarningsDashboard';
import NotificationCenter from './NotificationCenter';
import WalkingPaws from './ui/WalkingPaws';
import AddressBook, { loadSavedAddresses, makeDefaultAddress, addressIcon, addressLabelText, addressLine } from './AddressBook';
import { nearestLocality } from './geo';

const CITY_CONFIG = {
  Gurgaon: { displayName: 'Delhi NCR', bounds: { lat: [28.2, 29.0], lng: [76.7, 77.7] }, center: [28.4595, 77.0266] },
  Pune:    { displayName: 'Pune', bounds: { lat: [18.35, 18.8], lng: [73.6, 74.2] }, center: [18.5204, 73.8567] },
};

// Which service city a coordinate falls in, or null if outside all of them.
export const cityForCoords = (lat, lng) => Object.keys(CITY_CONFIG).find(key => {
  const { lat: [latMin, latMax], lng: [lngMin, lngMax] } = CITY_CONFIG[key].bounds;
  return lat > latMin && lat < latMax && lng > lngMin && lng < lngMax;
}) || null;

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
  const [broadcastPrefill, setBroadcastPrefill] = useState(null);
  const [sitterConversation, setSitterConversation] = useState(null);
  const [certFromBooking, setCertFromBooking] = useState(false);
  const [openRequest, setOpenRequest] = useState(null);
  const [broadcastRequestId, setBroadcastRequestId] = useState(null);
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
  const [chatBooking, setChatBooking]     = useState(null);
  const [showChat, setShowChat]           = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showExplore, setShowExplore]     = useState(false);
  const [exploreService, setExploreService] = useState(null);
  const [showSitterEdit, setShowSitterEdit] = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const [outsideCity, setOutsideCity]     = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSent, setWaitlistSent]   = useState(false);
  const [userName, setUserName]           = useState(null);
  const [showReceipt, setShowReceipt]     = useState(false);
  const [receiptData, setReceiptData]     = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [neighbourhood, setNeighbourhood] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [featuredPromo, setFeaturedPromo] = useState(null);
  const [promoForBooking, setPromoForBooking] = useState(null);
  const [regionRestricted, setRegionRestricted] = useState(false);
  const [userIP, setUserIP] = useState(null);
  const [sitterTab, setSitterTab] = useState('jobs');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [showAddressBook, setShowAddressBook] = useState(false);
  const [cityNames, setCityNames] = useState({});
  // Visitors browse Home, Explore and profiles; anything that needs an account
  // stores what they were doing here, shows the login screen, then resumes it.
  const [showLogin, setShowLogin] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [askSitter, setAskSitter] = useState(null);
  const [profileFromExplore, setProfileFromExplore] = useState(false);
  const [sharedSlug, setSharedSlug] = useState(() => slugFromPath(window.location.pathname));
  // Keep the loading screen up for at least one walk cycle so everyone sees it (owner: at least 2 seconds).
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSplashDone(true), process.env.NODE_ENV === 'test' ? 0 : 2000); return () => clearTimeout(t); }, []);
  const { t: tr } = useLanguage();

  const goHome = () => { setActiveNav('home'); };
  const closeTabScreens = () => { setShowBookings(false); setShowExplore(false); setShowUserProfile(false); setShowSettings(false); };
  // Screens still call onNav with their old ids ('book', 'profile', 'settings').
  const TAB_ALIASES = { book: 'bookings', profile: 'pets', settings: 'account' };
  const goParentTab = (raw) => {
    const id = TAB_ALIASES[raw] || raw;
    closeTabScreens();
    setExploreService(null);
    if (id !== 'explore') setPromoForBooking(null);
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

      if (!navigator.geolocation) {
        setLocationLoading(false);
        return;
      }

      const successCallback = (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserLocation({ lat, lng });
        setNeighbourhood(nearestLocality(lat, lng)?.name || '');
        setLocationLoading(false);

        const detected = cityForCoords(lat, lng);
        // A city the person picked by hand wins over GPS.
        if (detected && !localStorage.getItem('fursday_city_manual')) { setCity(detected); localStorage.setItem('fursday_city', detected); }
        if (!detected) setOutsideCity(true);
      };

      const errorCallback = (error) => {
        console.log('GPS error:', error.code, error.message);
        setLocationLoading(false);
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
          .select(SITTER_CARD_SELECT)
          .eq('city_id', cityRow.id)
          .eq('status', 'active');
        if (data) setRealSitters(data.map(s => toSitterCard(s, city)));
      }
      setSittersLoading(false);
    };
    fetchSitters();
  }, [city]);

  useEffect(() => {
    if (!sharedSlug) return undefined;
    let cancelled = false;
    (async () => {
      const row = await findSitterBySlug(sharedSlug);
      if (cancelled) return;
      setSharedSlug(null);
      if (!row) { window.history.replaceState(null, '', '/'); return; }
      let sitterCity = city;
      try {
        const { data } = await supabase.from('cities').select('name').eq('id', row.city_id).maybeSingle();
        if (data?.name && CITY_CONFIG[data.name]) { sitterCity = data.name; setCity(data.name); }
      } catch (e) { /* keep the current city */ }
      if (!cancelled) setSelectedSitter(toSitterCard(row, sitterCity));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedSlug]);

  useEffect(() => {
    if (user) { setShowLogin(false); return; }
    setIsSitterMode(false); setIsSitter(false); setSitterStatus(null); setUserName(null); setAskSitter(null);
  }, [user]);

  useEffect(() => {
    if (!user || !pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    (async () => {
      if (action.type === 'favorite' && action.sitter?.id) {
        try { await supabase.from('favorites').insert({ sitter_id: action.sitter.id, pet_parent_id: user.id }); } catch (e) { /* favourites are optional */ }
      }
      if (action.type === 'book') { setSelectedSitter(action.sitter || null); setSelectedServiceType(action.service || null); setShowExplore(false); setShowBooking(true); }
      else if (action.type === 'broadcast') setShowBroadcast(true);
      else if (action.type === 'ask') { setSelectedSitter(action.sitter); setAskSitter(action.sitter); }
      else if (action.type === 'tab') goParentTab(action.tab);
      else if (action.type === 'becomeSitter') setShowOnboarding(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pendingAction]);

  useEffect(() => {
    if (!user || isSitterMode || showBroadcast) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('broadcast_requests').select('*').eq('pet_parent_id', user.id).eq('status', 'open').order('created_at', { ascending: false }).limit(1);
      const req = data?.[0];
      if (!req || (req.expires_at && new Date(req.expires_at) < new Date())) { if (!cancelled) setOpenRequest(null); return; }
      const { data: offers } = await supabase.from('broadcast_responses').select('id, status').eq('request_id', req.id);
      if (!cancelled) setOpenRequest({ ...req, offers: (offers || []).filter(o => o.status !== 'declined' && o.status !== 'withdrawn').length });
    })();
    return () => { cancelled = true; };
  }, [user, isSitterMode, showBroadcast]);

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

  useEffect(() => {
    if (!user) { setSavedAddresses([]); return; }
    let cancelled = false;
    loadSavedAddresses().then(list => { if (!cancelled) setSavedAddresses(list); });
    (async () => {
      try {
        const { data } = await supabase.from('cities').select('id, name');
        if (!cancelled && Array.isArray(data)) setCityNames(Object.fromEntries(data.map(c => [c.id, c.name])));
      } catch (e) { /* addresses then count as being in the current city */ }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (_e === 'SIGNED_OUT') setUser(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const isGuest = !user;
  const requireSignIn = (action) => { setPendingAction(action); setShowLogin(true); };
  const bookSitter = (sitter, service) => {
    // Checkout needs a chosen sitter; without one, pick from Explore first.
    if (!sitter?.id) { goParentTab('explore'); setExploreService(service || null); return; }
    if (isGuest) { requireSignIn({ type: 'book', sitter, service }); return; }
    setSelectedSitter(sitter); setSelectedServiceType(service || null); setShowExplore(false); setShowBooking(true);
  };
  const askQuestion = (sitter) => { if (isGuest) requireSignIn({ type: 'ask', sitter }); else setAskSitter(sitter); };
  const closeProfile = () => {
    setSelectedSitter(null);
    if (window.location.pathname.startsWith('/s/')) window.history.replaceState(null, '', '/');
    if (profileFromExplore) setProfileFromExplore(false); else goHome();
  };

  // The name decides whether FirstLoginPrompt shows, so nothing renders for a
  // signed-in user until it has been looked up (else returning users would
  // see the signup prompt flash on every sign-in).
  const [nameFor, setNameFor] = useState(null);
  useEffect(() => {
    if (!user) { setNameFor(null); return undefined; }
    let off = false;
    const done = (name) => { if (!off) { setUserName(name); setNameFor(user.id); } };
    supabase.from('users').select('name').eq('id', user.id).single().then(({ data }) => done(data?.name || null), () => done(null));
    return () => { off = true; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCityChange = c => { setCity(c); setNeighbourhood(''); localStorage.setItem('fursday_city', c); localStorage.setItem('fursday_city_manual', '1'); setShowCityPicker(false); };
  const useMyLocation = () => {
    localStorage.removeItem('fursday_city_manual');
    setShowCityPicker(false);
    setLocationLoading(true);
    navigator.geolocation?.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setUserLocation({ lat, lng }); setNeighbourhood(nearestLocality(lat, lng)?.name || ''); setLocationLoading(false);
      const detected = cityForCoords(lat, lng);
      if (detected) { setCity(detected); localStorage.setItem('fursday_city', detected); }
    }, () => { setLocationLoading(false); }, { timeout: 10000 });
  };
  const addressCity = (a) => cityNames[a?.city_id] || null;
  const pickSavedAddress = async (a) => {
    setSavedAddresses(list => list.map(x => ({ ...x, is_default: x.id === a.id })));
    const other = addressCity(a);
    if (other && other !== city) handleCityChange(other); else setShowCityPicker(false);
    if (!(await makeDefaultAddress(a.id))) setSavedAddresses(await loadSavedAddresses());
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

  // ── Screens ──────────────────────────────────────────────────────────────
  // Wrapped in an IIFE (rather than converting every branch below to
  // else-if) so a single <LanguageToggle/> can render on top of whichever
  // screen comes out, instead of each screen needing its own copy.
  let navMode = null;
  let floatingToggle = true;
  const screen = (function renderScreen() {
  if (regionRestricted) return (
    <div style={{ ...ui.page, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', padding:'0 24px', textAlign:'center', gap:12 }}>
      <div style={{ ...ui.iconTile, width:64, height:64, background:color.navySoft, color:color.navy }}><Icon name="pin" size={30} /></div>
      <div style={{ fontSize:font.xl, fontWeight:700, color:color.ink }}>{tr('comingSoon_title')}</div>
      <div style={{ fontSize:font.md, color:color.muted, lineHeight:1.6, maxWidth:320 }}>
        {tr('comingSoon_body')}<br/><br/>
        {tr('comingSoon_expanding')}
      </div>
      {userIP && (
        <div style={{ fontSize:font.xs, color:color.faint, padding:'6px 12px', background:color.tile, borderRadius:radius.sm }}>
        {tr('comingSoon_yourIp')} {userIP}
        </div>
      )}
      <button onClick={() => window.location.reload()} style={{ ...ui.primaryButton, width:'auto', padding:'0 24px', marginTop:8 }}>
        {tr('comingSoon_checkAgain')}
      </button>
    </div>
  );

  const nameLoading = !!user && nameFor !== user.id;
  if (loading || !splashDone || nameLoading) floatingToggle = false;
  if (loading || !splashDone || nameLoading) return (
    <div role="status" aria-label={tr('common_loading')} style={{ minHeight:'100vh', background:color.navy, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', fontFamily:font.family, textAlign:'center', padding:24 }}>
      <WalkingPaws color="#F3B77A" />
      <div style={{ color:'white', fontSize:28, fontWeight:700, letterSpacing:-0.3, marginTop:28 }}>Fursday</div>
      <div style={{ color:'#B9C3DA', fontSize:13, marginTop:6 }}>{tr('splash_tagline')}</div>
    </div>
  );

  if (!user && showLogin) return <LoginScreen reason={!!pendingAction} onBrowse={() => { setShowLogin(false); setPendingAction(null); }} onLogin={async u => {
    await supabase.from('users').upsert({ id:u.id, email:u.email }, { onConflict:'id', ignoreDuplicates:true });
    setUser(u);
  }} />;

  // A DB-side default/trigger backfills users.name to the login email when
  // it's otherwise null (likely to satisfy a NOT NULL constraint written
  // for the old phone-first signup flow). That makes this check think
  // onboarding is already done, so FirstLoginPrompt — and the real-name /
  // city / pet-or-sitter-role setup that follows it — gets silently
  // skipped for every brand-new email signup. Treat "name equals the
  // login email" as "no real name set yet" too.
  const needsFirstLogin = user && (!userName || userName.trim().toLowerCase() === user.email?.toLowerCase());
  if (needsFirstLogin) return <FirstLoginPrompt user={user} onDone={(name, intent) => { setUserName(name); if (intent === 'offer') setShowOnboarding(true); }} />;

  const activeCities = Object.keys(CITY_CONFIG).map(c => CITY_CONFIG[c].displayName).join(tr('home_citiesJoiner'));

  if (outsideCity) return (
    <div style={{ ...ui.page, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 24px', textAlign:'center' }}>
      <div style={{ ...ui.iconTile, width:64, height:64, background:color.navySoft, color:color.navy, marginBottom:16 }}><Icon name="pin" size={30} /></div>
      <div style={{ fontSize:font.xl, fontWeight:700, color:color.ink, marginBottom:8 }}>{tr('outside_title')}</div>
      <div style={{ fontSize:font.md, color:color.muted, marginBottom:28, lineHeight:1.6, maxWidth:340 }}>{tr('outside_body', { cities: activeCities })}</div>
      {!waitlistSent ? (
        <div style={{ width:'100%', maxWidth:360 }}>
          <input value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="your@email.com" type="email" aria-label={tr('home_waitlistEmailLabel')}
            style={{ ...ui.input, marginBottom:12 }} />
          <button onClick={async () => { if(waitlistEmail.includes('@')){ await supabase.from('waitlist').insert({ email:waitlistEmail }); setWaitlistSent(true); } }}
            style={{ ...ui.primaryButton, marginBottom:12 }}>
            {tr('outside_joinWaitlist')}
          </button>
          <button onClick={() => setOutsideCity(false)} style={{ background:'none', border:'none', color:color.muted, fontSize:font.sm, cursor:'pointer', minHeight:44, fontFamily:font.family }}>{tr('outside_iAmIn', { cities: activeCities })}</button>
        </div>
      ) : (
        <div style={{ ...ui.card, width:'100%', maxWidth:360 }}>
          <div style={{ color:color.success, display:'flex', justifyContent:'center', marginBottom:10 }}><Icon name="check" size={28} /></div>
          <div style={{ color:color.ink, fontSize:font.lg, fontWeight:600, marginBottom:6 }}>{tr('outside_onList')}</div>
          <div style={{ color:color.muted, fontSize:font.sm }}>{tr('outside_willEmail')}</div>
          <button onClick={() => setOutsideCity(false)} style={{ marginTop:12, background:'none', border:'none', color:color.navy, fontWeight:600, fontSize:font.sm, cursor:'pointer', minHeight:44, fontFamily:font.family }}>{tr('common_continueAnyway')}</button>
        </div>
      )}
    </div>
  );


  if (isGuest && (showSettings || showUserProfile || showBookings)) {
    navMode = 'parent';
    const tab = showSettings ? 'account' : showUserProfile ? 'pets' : 'bookings';
    return <GuestPrompt tab={tab} onSignIn={() => requireSignIn({ type: 'tab', tab })} />;
  }
  if (askSitter && user) return <ConversationScreen sitter={askSitter} city={city} onBack={() => setAskSitter(null)} onBookNow={s => { setAskSitter(null); bookSitter(s || askSitter); }} />;

  if (isSitterMode) {
    navMode = 'sitter';
    if (sitterTab === 'jobs') floatingToggle = false;
    if (sitterTab === 'earnings') return <SitterEarningsDashboard city={city} onBack={() => setSitterTab('jobs')} />;
    if (sitterConversation) return <ConversationScreen role="sitter" conversation={sitterConversation} city={city} onBack={() => setSitterConversation(null)} />;
    if (sitterTab === 'messages') return <InboxScreen role="sitter" onOpenConversation={(conv, name) => setSitterConversation({ ...conv, parentName: name })} onOpenChat={b => { setChatBooking({ id:b.id, service:b.service_type, parentName:b.users?.name||tr('chat_defaultParentName'), otherPhone:'', fromSitter:true, date:b.booking_date, time:b.time_slot, price:b.gross_amount_paise, recipientUserId:b.pet_parent_id }); setIsSitterMode(false); setShowChat(true); }} />;
    if (sitterTab === 'profile') return <SitterEditProfile onBack={() => setSitterTab('jobs')} city={city} />;
    if (sitterTab === 'account') return <SettingsScreen onBack={() => setSitterTab('jobs')} city={city} userName={userName} onNav={() => {}} onSwitchRole={() => { setIsSitterMode(false); setSitterTab('jobs'); goHome(); }} switchRoleLabel={tr('sitterMode_backToParent')} />;
    return <SitterDashboard onBack={() => { setIsSitterMode(false); goHome(); }} onEditProfile={() => setSitterTab('profile')} onOpenNotifications={() => setShowNotifications(true)} city={city} onMessage={b => { setChatBooking({ id:b.id, service:b.service_type, parentName:b.users?.name||tr('chat_defaultParentName'), otherPhone:b.users?.phone||'', fromSitter:true, date:b.booking_date, time:b.time_slot, price:b.gross_amount_paise, recipientUserId:b.pet_parent_id }); setIsSitterMode(false); setShowChat(true); }} />;
  }
  if (showAddressBook) return <AddressBook city={city} onBack={() => setShowAddressBook(false)} onChanged={setSavedAddresses} />;
  if (showSettings) { navMode = 'parent'; return <SettingsScreen onBack={() => goParentTab('home')} city={city} userName={userName} activeNav={activeNav} onNav={goParentTab} onSwitchRole={isSitter ? () => { closeTabScreens(); setSitterTab('jobs'); setIsSitterMode(true); } : null} switchRoleLabel={tr('home_switchToSitter')} />; }
  if (showReceipt) return <BookingReceipt onBack={() => { setShowReceipt(false); goHome(); }} onViewBookings={() => { setShowReceipt(false); setShowBookings(true); }} city={city} booking={receiptData} />;
  if (showBroadcast) return <BroadcastRequest onBack={() => { setShowBroadcast(false); setBroadcastRequestId(null); goHome(); }} city={city} requestId={broadcastRequestId}
    onViewSitter={s => { setShowBroadcast(false); setBroadcastRequestId(null); setSelectedSitter(s); }}
    onSitterAccepted={(sitter, pre) => { setShowBroadcast(false); setBroadcastRequestId(null); setSelectedSitter(sitter); setSelectedServiceType(pre?.service || null); setRepeatBookingData(pre ? { service_type: pre.service, pet_id: pre.petId } : null); setBroadcastPrefill(pre || null); setShowBooking(true); }} />;
  if (showOnboarding) return <SitterOnboarding onDone={dest => { setShowOnboarding(false); if(dest==='sitter'){ setIsSitter(true); setIsSitterMode(true); } }} city={city} />;
  if (showSitterEdit) return <SitterEditProfile onBack={() => { setShowSitterEdit(false); goHome(); }} city={city} />;
  if (showUserProfile) navMode = 'parent';
  if (showUserProfile) return <UserProfile onBack={() => goParentTab('home')} city={city} activeNav={activeNav} onAddPet={() => { setShowUserProfile(false); setEditingPetId(null); setShowPetProfile(true); }} onEditPet={(pet) => { setShowUserProfile(false); setEditingPetId(pet?.id || null); setShowPetProfile(true); }} onSignOut={async () => { await supabase.auth.signOut(); setUser(null); setShowUserProfile(false); }} onNav={goParentTab} />;
  // The profile opens over Explore, which stays mounted (hidden) so its
  // filters, view and scroll survive the round trip.
  if (showExplore && !showBooking) {
    const overProfile = !!selectedSitter && profileFromExplore;
    if (!overProfile) navMode = 'parent';
    return (
      <>
        <div hidden={overProfile}>
          <ExploreScreen onBack={() => goParentTab('home')} city={city} userLocation={userLocation} isGuest={isGuest} onRequireSignIn={requireSignIn}
            initialService={exploreService} onServiceChange={id => setExploreService(['walk30', 'boarding', 'daycare'].includes(id) ? id : null)}
            onBook={sitter => bookSitter(sitter, exploreService)} onViewProfile={sitter => { setProfileFromExplore(true); setSelectedSitter(sitter); }} />
        </div>
        {overProfile && <SitterProfile onBack={closeProfile} onBook={() => bookSitter(selectedSitter, exploreService)} sitter={selectedSitter} city={city}
          isGuest={isGuest} onRequireSignIn={requireSignIn} onAskQuestion={askQuestion} />}
      </>
    );
  }
  if (showChat) return <ChatScreen onBack={() => { setShowChat(false); if(chatBooking?.fromSitter) setIsSitterMode(true); else { setShowBookings(true); } }} city={city} booking={chatBooking} userType={chatBooking?.fromSitter?'sitter':'parent'} />;
  if (showPayment) return <PaymentScreen onBack={() => setShowPayment(false)} onSuccess={(paymentId, result) => { setShowPayment(false); if(paymentBooking?.id) sendBookingEmail(paymentBooking); setReceiptData({ ...paymentBooking, paymentId, payment_status: result?.payment_status }); setShowReceipt(true); }} city={city} booking={paymentBooking} />;
  if (showWalkReport) return <WalkReportCard onBack={() => { setShowWalkReport(false); setShowBookings(true); }} city={city} mode='parent' />;
  if (showBookings) navMode = 'parent';
  if (showBookings) return <BookingsDashboard onBack={() => goParentTab('home')} city={city} activeNav={activeNav} onViewReport={() => setShowWalkReport(true)} onReview={() => {}} onPayNow={b => { setPaymentBooking({ service:b.service_type, amount:b.gross_amount_paise, ref:b.booking_ref, id:b.id, sitterName:b.sitter_profiles?.users?.name }); setShowBookings(false); setShowPayment(true); }} onMessage={(b, sitterName, sitterPhone, sitterUserId) => { setChatBooking({ id:b.id, service:b.service_type, sitterName, otherPhone:sitterPhone, date:b.booking_date, time:b.time_slot, price:b.gross_amount_paise, recipientUserId:sitterUserId }); setShowBookings(false); setShowChat(true); }} onNav={(id, payload) => { if (!(id==='book' && payload?.repeatBooking)) { goParentTab(id); return; } setShowBookings(false); if(id==='book' && payload?.repeatBooking){ const b = payload.repeatBooking; setSelectedSitter({ id: b.sitter_profiles?.id, name: b.sitter_profiles?.users?.name || tr('bookings_sitterFallback'), area: city }); setRepeatBookingData(b); setShowBooking(true); } }} />;
  if (showPetProfile) {
    const closePet = () => { setShowPetProfile(false); setEditingPetId(null); if (certFromBooking) setCertFromBooking(false); else goHome(); };
    return <PetProfile onBack={closePet} city={city} petId={editingPetId} onSave={closePet} />;
  }
  if (showBooking) return <BookingFlow onAddCertificate={pet => { setEditingPetId(pet?.id || null); setCertFromBooking(true); setShowPetProfile(true); }} onBack={() => { setShowBooking(false); setSelectedServiceType(null); setRepeatBookingData(null); setPromoForBooking(null); setBroadcastPrefill(null); setSelectedSitter(null); setProfileFromExplore(false); goHome(); }}
    initialDate={broadcastPrefill?.dateISO} initialEndDate={broadcastPrefill?.endDateISO} initialTime={broadcastPrefill?.time} agreedPriceRupees={broadcastPrefill?.priceRupees} broadcastRequestId={broadcastPrefill?.requestId} sitter={selectedSitter} city={city} initialService={selectedServiceType} repeatBooking={repeatBookingData} initialPromoCode={promoForBooking} onChooseSitter={() => { setShowBooking(false); setSelectedServiceType(null); setRepeatBookingData(null); setPromoForBooking(null); setSelectedSitter(null); goParentTab('explore'); }} />;
  if (selectedSitter && !showBooking) return <SitterProfile onBack={closeProfile} onBook={() => bookSitter(selectedSitter)} sitter={selectedSitter} city={city}
    isGuest={isGuest} onRequireSignIn={requireSignIn} onAskQuestion={askQuestion} />;

  navMode = 'parent';
  floatingToggle = false;
  const firstName = (userName || '').trim().split(/\s+/)[0] || '';
  const initials = (userName || user?.email || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const homeAddress = savedAddresses.find(a => a.is_default && a.area && (!addressCity(a) || addressCity(a) === city));
  const place = homeAddress ? homeAddress.area
    : neighbourhood && cityForCoords(userLocation?.lat, userLocation?.lng) === city ? neighbourhood : tr(city === 'Pune' ? 'city_pune' : 'city_ncr');
  const services = [
    { id: 'walk30', icon: 'walk', label: tr('home_svcWalk') },
    { id: 'boarding', icon: 'boarding', label: tr('home_svcBoarding') },
    { id: 'daycare', icon: 'sun', label: tr('home_svcDaycare') },
    { id: 'broadcast', icon: 'megaphone', label: tr('home_svcAnyone') },
  ];
  const openService = (id) => {
    if (id === 'broadcast') { if (isGuest) requireSignIn({ type: 'broadcast' }); else setShowBroadcast(true); return; }
    bookSitter(null, id);
  };
  const topSitters = [...realSitters].sort((x, y) => (y.isTopSitter - x.isTopSitter) || ((y.rating ?? 0) - (x.rating ?? 0)) || (y.reviewCount - x.reviewCount)).slice(0, 3);

  // ── Home ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...ui.page, paddingBottom: navPadding }}>
      {showNotifications && <NotificationCenter onClose={() => setShowNotifications(false)} />}
      {showCityPicker && (
        <div role="dialog" aria-modal="true" aria-label={tr('city_pickTitle')} onClick={() => setShowCityPicker(false)}
          style={{ position:'fixed', inset:0, zIndex:3000, background:'rgba(21,25,42,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:480, maxHeight:'88vh', overflowY:'auto', boxSizing:'border-box', background:color.surface, borderRadius:'20px 20px 0 0', padding:'20px 16px calc(20px + env(safe-area-inset-bottom))', fontFamily:font.family }}>
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
            {!isGuest && savedAddresses.length > 0 && <div style={{ fontSize:14, fontWeight:700, color:color.ink, margin:'16px 0 8px' }}>{tr('addr_yourSaved')}</div>}
            {!isGuest && savedAddresses.length > 0 && (
              <div style={{ border:`1px solid ${color.line}`, borderRadius:radius.md, marginBottom:8, overflow:'hidden' }}>
                {savedAddresses.map((a, i) => (
                  <button key={a.id} type="button" onClick={() => pickSavedAddress(a)} aria-pressed={!!a.is_default}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:12, minHeight:56, padding:'8px 14px', border:'none', borderTop:i ? `1px solid ${color.line}` : 'none', background:color.surface, cursor:'pointer', fontFamily:font.family, textAlign:'left' }}>
                    <Icon name={addressIcon(a.label)} size={18} color={color.navy} />
                    <span style={{ flex:1, minWidth:0 }}>
                      <span style={{ display:'block', fontSize:14, fontWeight:600, color:color.ink }}>{addressLabelText(tr, a.label)}</span>
                      <span style={{ display:'block', fontSize:12, color:color.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{addressLine(a)}</span>
                    </span>
                    {a.is_default && <Icon name="check" size={20} color={color.navy} />}
                  </button>
                ))}
              </div>
            )}
            {!isGuest && (
              <button type="button" onClick={() => { setShowCityPicker(false); setShowAddressBook(true); }}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:12, minHeight:48, padding:'0 14px', marginTop:savedAddresses.length ? 0 : 8, borderRadius:radius.md, border:`1px solid ${color.line}`, background:color.bg, cursor:'pointer', fontFamily:font.family, fontSize:14, fontWeight:600, color:color.navy, textAlign:'left' }}>
                <Icon name={savedAddresses.length ? 'edit' : 'plus'} size={18} />{tr(savedAddresses.length ? 'addr_manage' : 'addr_addNew')}
              </button>
            )}
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
              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{locationLoading && !homeAddress ? tr('home_findingLocation') + '…' : place}</span>
              <Icon name="chevronDown" size={16} color={color.muted} />
            </span>
          </button>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <LanguageToggle inline />
            {isGuest ? (
              <button type="button" onClick={() => requireSignIn(null)}
                style={{ minHeight:44, padding:'0 14px', borderRadius:radius.pill, border:'none', background:color.navy, color:'white', fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:font.family }}>
                {tr('guest_signIn')}
              </button>
            ) : (
              <>
                <button type="button" aria-label={tr('nav_notifications')} onClick={() => setShowNotifications(true)}
                  style={{ width:40, height:40, borderRadius:radius.pill, border:`1px solid ${color.line}`, background:color.surface, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:color.text }}>
                  <Icon name="bell" size={19} />
                </button>
                <button type="button" aria-label={tr('nav_account')} onClick={() => goParentTab('account')}
                  style={{ width:40, height:40, borderRadius:radius.pill, border:'none', background:color.navy, color:'white', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:font.family }}>
                  {initials}
                </button>
              </>
            )}
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

      {!isGuest && <div style={{ padding:'16px 16px 0' }}>
        <button type="button" onClick={() => { setBroadcastRequestId(openRequest?.id || null); setShowBroadcast(true); }}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:radius.lg, border:`1px solid ${color.line}`, background:color.surface, cursor:'pointer', fontFamily:font.family, textAlign:'left', boxShadow:shadow.card }}>
          <span style={{ ...ui.iconTile, background:color.saffronSoft, color:color.saffron, flexShrink:0 }}><Icon name="megaphone" size={22} /></span>
          <span style={{ flex:1, minWidth:0 }}>
            <span style={{ display:'block', fontSize:15, fontWeight:700, color:color.ink }}>{openRequest ? tr('home_requestOpenTitle') : tr('home_requestTitle')}</span>
            <span style={{ display:'block', fontSize:12.5, color:color.muted, marginTop:2, lineHeight:1.4 }}>
              {openRequest ? tr(openRequest.offers === 1 ? 'home_requestOffersOne' : 'home_requestOffersMany', { n: openRequest.offers }) : tr('home_requestSub')}
            </span>
          </span>
          <span style={{ ...ui.badge(openRequest?.offers ? 'success' : 'info'), flexShrink:0 }}>{openRequest ? tr('home_requestView') : tr('home_requestSend')}</span>
        </button>
      </div>}

      {featuredPromo && (
        <div style={{ padding:'16px 16px 0' }}>
          <PromoBanner promo={featuredPromo} onUse={() => { setPromoForBooking(featuredPromo.code); bookSitter(null); }} />
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
          <div key={s.id} role="group" aria-label={s.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderTop: i ? `1px solid ${color.line}` : 'none' }}>
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
                  <SitterRating rating={s.rating} count={s.reviewCount} /> · {tr('home_sitterWalks', { n: s.walks })} · {s.price}
                </span>
              </span>
            </button>
            <button type="button" onClick={() => bookSitter(s)}
              style={{ minHeight:36, padding:'0 14px', borderRadius:radius.sm, border:`1px solid ${color.navy}`, background:color.surface, color:color.navy, fontWeight:600, fontSize:13, cursor:'pointer', fontFamily:font.family, flexShrink:0 }}>
              {tr('common_book')}
            </button>
          </div>
        ))}
      </section>

      <div style={{ padding:'20px 16px 8px' }}>
        <button type="button" onClick={() => { if (isGuest) requireSignIn({ type: 'becomeSitter' }); else if (isSitter) { closeTabScreens(); setSitterTab('jobs'); setIsSitterMode(true); } else setShowOnboarding(true); }}
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

  const feedbackScreen = isSitterMode ? 'sitter_' + sitterTab : showAddressBook ? 'addresses' : showSettings ? 'settings' : showReceipt ? 'receipt'
    : showBroadcast ? 'nearby_request' : showOnboarding ? 'sitter_signup' : showSitterEdit ? 'sitter_edit' : showUserProfile ? 'pets' : showExplore ? 'explore'
    : askSitter ? 'ask_sitter' : showChat ? 'chat' : showWalkReport ? 'walk_report' : showBookings ? 'bookings' : showPetProfile ? 'pet_profile' : showBooking ? 'booking'
    : selectedSitter ? 'sitter_profile' : 'home';
  const showFeedback = user && splashDone && !loading && !regionRestricted && !outsideCity && !showPayment
    && userName && userName.trim().toLowerCase() !== user.email?.toLowerCase();
  const parentTab = showSettings ? 'account' : showUserProfile ? 'pets' : showExplore ? 'explore' : showBookings ? 'bookings' : 'home';
  return (
    <>
      {screen}
      {navMode === 'parent' && <BottomNav tabs={PARENT_TABS} active={parentTab} onSelect={goParentTab} />}
      {navMode === 'sitter' && <BottomNav tabs={SITTER_TABS} active={sitterTab} onSelect={setSitterTab} />}
      {navMode === 'sitter' && showNotifications && <NotificationCenter onClose={() => setShowNotifications(false)} />}
      {floatingToggle && <LanguageToggle />}
      {showFeedback && <FeedbackTab screen={feedbackScreen} role={isSitterMode ? 'sitter' : 'parent'} userId={user.id} userName={userName} />}
    </>
  );
}