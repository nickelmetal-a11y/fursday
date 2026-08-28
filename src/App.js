import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import LoginScreen from './LoginScreen';
import SitterProfile from './SitterProfile';
import SitterOnboarding from './SitterOnboarding';
import BookingFlow from './BookingFlow';
import PetProfile from './PetProfile';
import WalkReportCard from './WalkReportCard';
import BookingsDashboard from './BookingsDashboard';
import AdminPanel from './AdminPanel';
import SitterDashboard from './SitterDashboard';
import PaymentScreen from './PaymentScreen';
import UserProfile from './UserProfile';
import TermsAndConditions from './TermsAndConditions';
import PrivacyPolicy from './PrivacyPolicy';
import ExploreScreen from './ExploreScreen';
import FirstLoginPrompt from './FirstLoginPrompt';
import SitterEditProfile from './SitterEditProfile';
import ChatScreen from './ChatScreen';
import BookingReceipt from './BookingReceipt';
import ParentOnboarding from './ParentOnboarding';
import BroadcastRequest from './BroadcastRequest';
import { MapPin, Search, Star, ChevronRight } from 'lucide-react';

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
  const [showWalkReport, setShowWalkReport] = useState(false);
  const [showBookings, setShowBookings]   = useState(false);
  const [realSitters, setRealSitters]     = useState([]);
  const [userLocation, setUserLocation]   = useState(null);
  const [sittersLoading, setSittersLoading] = useState(true);
  const [showAdmin, setShowAdmin]         = useState(window.location.hash === '#admin');
  const [isSitterMode, setIsSitterMode]   = useState(false);
  const [isSitter, setIsSitter]           = useState(false);
  const [showPayment, setShowPayment]     = useState(false);
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [requestSentFor, setRequestSentFor] = useState(null);
  const [chatBooking, setChatBooking]     = useState(null);
  const [showChat, setShowChat]           = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showExplore, setShowExplore]     = useState(false);
  const [showSitterEdit, setShowSitterEdit] = useState(false);
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
  const [logoTaps, setLogoTaps]           = useState(0);
  const [search, setSearch]               = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const theme = THEMES[city] || THEMES.Gurgaon;

  const goHome = () => { setActiveNav('home'); };

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
        if (data) setIsSitter(true);
      }
    };
    checkIfSitter();
  }, [user]);

  // GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setUserLocation({ lat, lng });
      setNeighbourhood(getNeighbourhood(lat, lng));
      const isInCity = Object.values(CITY_CONFIG).some(cfg => {
        const [latMin, latMax] = cfg.bounds.lat;
        const [lngMin, lngMax] = cfg.bounds.lng;
        return lat > latMin && lat < latMax && lng > lngMin && lng < lngMax;
      });
      if (!isInCity) setOutsideCity(true);
    }, () => {}, { timeout: 8000 });
  }, []);

  // Map init
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const tryInit = () => {
      if (!window.L) { setTimeout(tryInit, 500); return; }
      const L = window.L;
      const center = userLocation
        ? [userLocation.lat, userLocation.lng]
        : CITY_CONFIG[city]?.center || CITY_CONFIG.Gurgaon.center;
      const map = L.map(mapRef.current, { zoomControl:false, attributionControl:false, dragging:true, scrollWheelZoom:false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { maxZoom:19, subdomains:'abcd' }).addTo(map);
      map.setView(center, 14);
      if (userLocation) {
        const userIcon = L.divIcon({ html:'<div style="width:14px;height:14px;border-radius:50%;background:#4285F4;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>', iconSize:[14,14], iconAnchor:[7,7], className:'' });
        L.marker(center, { icon: userIcon }).addTo(map);
      }
      mapInstanceRef.current = map;
    };
    tryInit();
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [userLocation, city]);

  // Update sitter markers separately (no full map re-init)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;
    if (map._sitterMarkers) map._sitterMarkers.forEach(m => map.removeLayer(m));
    map._sitterMarkers = [];
    realSitters.filter(s => s.lat && s.lng).forEach(s => {
      const pin = L.divIcon({ html:'<div style="background:#FF6B35;color:white;border-radius:20px;padding:4px 9px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid white">' + s.name.split(' ')[0] + ' 🐾</div>', className:'', iconAnchor:[0,20] });
      const marker = L.marker([s.lat, s.lng], { icon: pin }).addTo(map).on('click', () => setSelectedSitter(s));
      map._sitterMarkers.push(marker);
    });
  }, [realSitters]);

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
  const handleLogoTap = () => { const t = logoTaps+1; setLogoTaps(t); if(t>=5){ setShowAdmin(true); setLogoTaps(0); window.location.hash='admin'; } };


  const sendBookingEmail = async (booking) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: parentRow } = await supabase.from('users').select('name,email').eq('id', user?.id).single();
      let sitterName = '', sitterEmail = '';
      if (booking.sitter_id) {
        const { data: sp } = await supabase.from('sitter_profiles').select('user_id').eq('id', booking.sitter_id).single();
        if (sp?.user_id) {
          const { data: su } = await supabase.from('users').select('name,email').eq('id', sp.user_id).single();
          sitterName = su?.name || ''; sitterEmail = su?.email || '';
        }
      }
      const { data: full } = await supabase.from('bookings').select('*').eq('id', booking.id).single();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('https://vucboyiklqdxpqbpfplt.supabase.co/functions/v1/send-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
        body: JSON.stringify({
          booking_ref: full?.booking_ref, service_type: full?.service_type,
          scheduled_date: full?.scheduled_date, scheduled_time: full?.scheduled_time,
          end_date: full?.end_date, gross_amount_paise: full?.gross_amount_paise, start_otp: full?.start_otp,
          parent_name: parentRow?.name, parent_email: parentRow?.email,
          sitter_name: sitterName, sitter_email: sitterEmail,
        }),
      });
    } catch(e) { console.log('Email error:', e); }
  };

  const requestBooking = async (sitter) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: cityRow } = await supabase.from('cities').select('id').eq('name', city).single();
      await supabase.from('bookings').insert({ pet_parent_id:user?.id, sitter_id:sitter.id, city_id:cityRow?.id, service_type:'walk30', scheduled_date:new Date().toISOString().split('T')[0], scheduled_time:'07:00', gross_amount_paise:29900, status:'pending', payment_status:'unpaid' });
      setRequestSentFor(sitter.name);
      setTimeout(() => setRequestSentFor(null), 3000);
    } catch(e) { console.log('Request error:', e); }
  };

  // ── Screens ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:56 }}>🐾</div>
      <div style={{ color:'white', fontSize:22, fontWeight:700 }}>Fursday</div>
      <div style={{ color:'rgba(255,255,255,0.4)', fontSize:13 }}>Loading...</div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={async u => {
    setUser(u);
    await supabase.from('users').upsert({ id:u.id, email:u.email }, { onConflict:'id', ignoreDuplicates:true });
    const { data } = await supabase.from('users').select('name').eq('id', u.id).single();
    setUserName(data?.name || null);
  }} />;

  if (user && !userName) return <FirstLoginPrompt user={user} onDone={name => { setUserName(name); setShowParentOnboarding(true); }} />;
  if (showParentOnboarding) return <ParentOnboarding onDone={() => setShowParentOnboarding(false)} city={city} userName={userName} />;

  const activeCities = Object.keys(CITY_CONFIG).map(c => CITY_CONFIG[c].displayName).join(' and ');

  if (outsideCity) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 24px', textAlign:'center' }}>
      <div style={{ fontSize:64, marginBottom:20 }}>🗺️</div>
      <div style={{ fontSize:24, fontWeight:700, color:'white', marginBottom:8 }}>Coming to your city soon!</div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:32, lineHeight:1.6 }}>Fursday is in {activeCities}. Expanding fast!</div>
      {!waitlistSent ? (
        <div style={{ width:'100%' }}>
          <input value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="your@email.com" type="email"
            style={{ width:'100%', padding:'16px', borderRadius:14, border:'1.5px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.08)', fontSize:15, color:'white', outline:'none', boxSizing:'border-box', marginBottom:12 }} />
          <button onClick={async () => { if(waitlistEmail.includes('@')){ await supabase.from('waitlist').insert({ email:waitlistEmail }); setWaitlistSent(true); } }}
            style={{ width:'100%', padding:'16px 0', borderRadius:14, border:'none', background:'#FF6B35', color:'white', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:12 }}>
            Join the waitlist
          </button>
          <button onClick={() => setOutsideCity(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer' }}>I am in {activeCities}</button>
        </div>
      ) : (
        <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:16, padding:20, width:'100%' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
          <div style={{ color:'white', fontSize:16, fontWeight:600, marginBottom:8 }}>You are on the list!</div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13 }}>We will email you when Fursday launches in your city.</div>
          <button onClick={() => setOutsideCity(false)} style={{ marginTop:16, background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer' }}>Continue anyway</button>
        </div>
      )}
    </div>
  );

  if (showAdmin) return <AdminPanel />;
  if (showReceipt) return <BookingReceipt onBack={() => { setShowReceipt(false); goHome(); }} onViewBookings={() => { setShowReceipt(false); setShowBookings(true); }} city={city} booking={receiptData} />;
  if (showBroadcast) return <BroadcastRequest onBack={() => { setShowBroadcast(false); goHome(); }} city={city} onSitterAccepted={sitter => { setShowBroadcast(false); setSelectedSitter(sitter); setShowBooking(true); }} />;
  if (showOnboarding) return <SitterOnboarding onDone={dest => { setShowOnboarding(false); if(dest==='sitter'){ setIsSitter(true); setIsSitterMode(true); } }} city={city} />;
  if (isSitterMode) return <SitterDashboard onBack={() => { setIsSitterMode(false); goHome(); }} onEditProfile={() => { setIsSitterMode(false); setShowSitterEdit(true); }} city={city} onMessage={b => { setChatBooking({ id:b.id, service:b.service_type, parentName:b.users?.name||'Pet parent', otherPhone:b.users?.phone||'', fromSitter:true }); setIsSitterMode(false); setShowChat(true); }} />;
  if (showSitterEdit) return <SitterEditProfile onBack={() => { setShowSitterEdit(false); goHome(); }} city={city} />;
  if (showUserProfile) return <UserProfile onBack={() => { setShowUserProfile(false); goHome(); }} city={city} onAddPet={() => { setShowUserProfile(false); setShowPetProfile(true); }} onEditPet={() => { setShowUserProfile(false); setShowPetProfile(true); }} onSignOut={async () => { await supabase.auth.signOut(); setUser(null); setShowUserProfile(false); }} onNav={id => { setShowUserProfile(false); if(id==='home'){ goHome(); } else if(id==='explore'){ setActiveNav('explore'); setShowExplore(true); } else if(id==='book'){ setActiveNav('book'); setShowBookings(true); } }} />;
  if (showExplore) return <ExploreScreen onBack={() => { setShowExplore(false); goHome(); }} city={city} userLocation={userLocation} onBook={sitter => { setSelectedSitter(sitter); setShowExplore(false); setShowBooking(true); }} onNav={id => { setShowExplore(false); if(id==='home'){ goHome(); } else if(id==='book'){ setActiveNav('book'); setShowBookings(true); } else if(id==='profile'){ setActiveNav('profile'); setShowUserProfile(true); } }} />;
  if (showChat) return <ChatScreen onBack={() => { setShowChat(false); if(chatBooking?.fromSitter) setIsSitterMode(true); else { setShowBookings(true); } }} city={city} booking={chatBooking} userType={chatBooking?.fromSitter?'sitter':'parent'} />;
  if (showPayment) return <PaymentScreen onBack={() => setShowPayment(false)} onSuccess={paymentId => { setShowPayment(false); if(paymentBooking?.id) sendBookingEmail(paymentBooking); setReceiptData({ ...paymentBooking, paymentId }); setShowReceipt(true); }} city={city} booking={paymentBooking} />;
  if (showWalkReport) return <WalkReportCard onBack={() => { setShowWalkReport(false); setShowBookings(true); }} city={city} mode='parent' />;
  if (showBookings) return <BookingsDashboard onBack={() => { setShowBookings(false); goHome(); }} city={city} onViewReport={() => setShowWalkReport(true)} onReview={() => {}} onPayNow={b => { setPaymentBooking({ service:b.service_type, amount:b.gross_amount_paise, ref:b.booking_ref, id:b.id }); setShowBookings(false); setShowPayment(true); }} onMessage={(b, sitterName, sitterPhone) => { setChatBooking({ id:b.id, service:b.service_type, sitterName, otherPhone:sitterPhone }); setShowBookings(false); setShowChat(true); }} onNav={id => { setShowBookings(false); if(id==='home'){ goHome(); } else if(id==='explore'){ setActiveNav('explore'); setShowExplore(true); } else if(id==='profile'){ setActiveNav('profile'); setShowUserProfile(true); } }} />;
  if (showPetProfile) return <PetProfile onBack={() => { setShowPetProfile(false); goHome(); }} city={city} onSave={() => { setShowPetProfile(false); goHome(); }} />;
  if (showBooking) return <BookingFlow onBack={() => { setShowBooking(false); setSelectedServiceType(null); goHome(); }} sitter={selectedSitter} city={city} initialService={selectedServiceType} />;
  if (selectedSitter && !showBooking) return <SitterProfile onBack={() => { setSelectedSitter(null); goHome(); }} onBook={() => setShowBooking(true)} sitter={selectedSitter} />;

  const filteredSitters = realSitters.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  // ── Home ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#F5F5F5', fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', paddingBottom:80 }}>

      {requestSentFor && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', width:340, background:'#2E7D32', borderRadius:14, padding:'12px 16px', zIndex:2000, display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ color:'white', fontSize:13, fontWeight:600 }}>✓ Request sent to {requestSentFor}!</span>
        </div>
      )}

      {/* HOME LAYOUT */}
      <div style={{ position:'relative' }}>

        {/* Gradient header with map inside */}
        <div style={{ background:theme.grad, paddingTop:48, paddingBottom:0 }}>

          {/* Top bar */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 16px 12px' }}>
            <div onClick={handleLogoTap} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:22, fontWeight:800, color:'white', letterSpacing:-0.5 }}>fursday</span>
              <span style={{ fontSize:18 }}>🐾</span>
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              {Object.keys(CITY_CONFIG).map(c => (
                <button key={c} onClick={() => handleCityChange(c)}
                  style={{ padding:'5px 12px', borderRadius:16, border:'none', background:city===c?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.15)', color:'white', fontSize:12, fontWeight:city===c?700:400, cursor:'pointer' }}>
                  {CITY_CONFIG[c].emoji} {CITY_CONFIG[c].displayName}
                </button>
              ))}
            </div>
          </div>

          {/* Greeting */}
          <div style={{ padding:'0 16px 14px' }}>
            <div style={{ fontSize:22, fontWeight:700, color:'white', marginBottom:2 }}>
              {userName ? 'Hi, ' + userName.split(' ')[0] + '!' : 'Happy Fursday!'}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:13, color:'rgba(255,255,255,0.85)' }}>📍 {neighbourhood || theme.label}</span>
              {realSitters.length > 0 && (
                <span style={{ background:'rgba(255,255,255,0.25)', borderRadius:20, padding:'2px 9px', fontSize:11, color:'white', fontWeight:600 }}>
                  {realSitters.length} care pro{realSitters.length!==1?'s':''} nearby
                </span>
              )}
            </div>
          </div>

          {/* Map strip */}
          <div style={{ position:'relative', height:160, overflow:'hidden' }}>
            <div ref={mapRef} style={{ position:'absolute', inset:0 }} />
            {/* Fade overlay at bottom */}
            <div style={{ position:'absolute', bottom:0, left:0, right:0, height:50, background:'linear-gradient(transparent, white)', zIndex:5, pointerEvents:'none' }} />
            {/* Custom map controls */}
            <div style={{ position:'absolute', bottom:16, right:12, zIndex:400, display:'flex', flexDirection:'column', gap:5 }}>
              <button onClick={() => mapInstanceRef.current?.zoomIn()} style={{ width:30, height:30, borderRadius:8, border:'none', background:'white', boxShadow:'0 2px 6px rgba(0,0,0,0.2)', fontSize:17, fontWeight:700, cursor:'pointer', color:'#333', lineHeight:'28px', textAlign:'center' }}>+</button>
              <button onClick={() => mapInstanceRef.current?.zoomOut()} style={{ width:30, height:30, borderRadius:8, border:'none', background:'white', boxShadow:'0 2px 6px rgba(0,0,0,0.2)', fontSize:17, fontWeight:700, cursor:'pointer', color:'#333', lineHeight:'28px', textAlign:'center' }}>−</button>
              <button onClick={() => { if(userLocation&&mapInstanceRef.current) mapInstanceRef.current.setView([userLocation.lat,userLocation.lng],15); }} style={{ width:30, height:30, borderRadius:8, border:'none', background:'white', boxShadow:'0 2px 6px rgba(0,0,0,0.2)', fontSize:14, cursor:'pointer', lineHeight:'30px', textAlign:'center' }}>📍</button>
            </div>
            {realSitters.filter(s=>s.lat&&s.lng).length===0 && userLocation && (
              <div style={{ position:'absolute', bottom:56, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,0.55)', borderRadius:20, padding:'4px 12px', zIndex:400, fontSize:11, color:'white', whiteSpace:'nowrap' }}>
                🐾 {realSitters.length>0?realSitters.length+' care pros in your area':'Onboarding care pros nearby'}
              </div>
            )}
          </div>
        </div>

        {/* White content area */}
        <div style={{ background:'white' }}>

          {/* Search */}
          <div style={{ padding:'14px 16px 0' }}>
            <div style={{ background:'#F5F5F5', borderRadius:14, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
              <Search size={15} color="#AAA" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search care pros..."
                style={{ border:'none', outline:'none', flex:1, fontSize:13, color:'#333', background:'transparent' }} />
            </div>
          </div>

          {/* Sitter mode button */}
          {isSitter && (
            <div style={{ padding:'12px 16px 0' }}>
              <div onClick={() => setIsSitterMode(true)}
                style={{ background:'#E8F5E9', borderRadius:14, padding:'11px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', border:'1px solid #C8E6C9' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:32, height:32, borderRadius:10, background:'#2E7D32', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>💰</div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1B5E20' }}>Switch to sitter mode</div>
                    <div style={{ fontSize:11, color:'#4CAF50', fontWeight:500 }}>● You are live · Manage your jobs</div>
                  </div>
                </div>
                <span style={{ color:'#2E7D32', fontSize:18 }}>›</span>
              </div>
            </div>
          )}

          {/* Service grid */}
          <div style={{ padding:'14px 16px 0' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#888', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.04em' }}>What do you need?</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {SERVICES.map(svc => (
                <div key={svc.id} onClick={() => {
                  if(svc.id==='broadcast'){ setShowBroadcast(true); return; }
                  setSelectedServiceType(svc.id); setShowBooking(true);
                }} style={{ background:svc.color, borderRadius:16, padding:'14px 12px', cursor:'pointer', transition:'transform 0.1s', border:'0.5px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>{svc.icon}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:3, lineHeight:1.3 }}>{svc.name}</div>
                  <div style={{ fontSize:11, color:svc.tc, fontWeight:600 }}>{svc.price}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Become a pro banner */}
          {!isSitter && (
            <div style={{ padding:'14px 16px 0' }}>
              <div onClick={() => setShowOnboarding(true)}
                style={{ background:'#0f0f1a', borderRadius:16, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🐾</div>
                  <div>
                    <div style={{ color:'white', fontSize:13, fontWeight:700 }}>Become a Fursday Pro</div>
                    <div style={{ color:theme.primary, fontSize:11 }}>Earn Rs.12,000–45,000/month</div>
                  </div>
                </div>
                <div style={{ background:theme.primary, borderRadius:10, padding:'6px 12px', fontSize:12, color:'white', fontWeight:700 }}>Join</div>
              </div>
            </div>
          )}

          {/* Care pros list */}
          <div style={{ padding:'18px 16px 0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>Care pros near you</div>
              <div onClick={() => { setActiveNav('explore'); setShowExplore(true); }} style={{ fontSize:12, color:theme.primary, fontWeight:500, cursor:'pointer' }}>See all ›</div>
            </div>

            {sittersLoading && (
              <div style={{ textAlign:'center', padding:'30px 0' }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🐾</div>
                <div style={{ fontSize:13, color:'#888' }}>Finding care pros near you...</div>
              </div>
            )}

            {!sittersLoading && filteredSitters.length===0 && (
              <div style={{ textAlign:'center', padding:'30px 0' }}>
                <div style={{ fontSize:40, marginBottom:10 }}>🐾</div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>{search?'No results':'No pros in '+city+' yet'}</div>
                <div style={{ fontSize:12, color:'#888' }}>{search?'Try a different name':'We are onboarding pros in your area!'}</div>
                {!search && <button onClick={() => setShowOnboarding(true)} style={{ marginTop:12, padding:'10px 20px', borderRadius:12, border:'none', background:theme.primary, color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>Become a pro</button>}
              </div>
            )}

            {!sittersLoading && filteredSitters.map(s => (
              <div key={s.id} onClick={() => setSelectedSitter(s)}
                style={{ background:'#FAFAFA', borderRadius:16, padding:12, display:'flex', gap:12, marginBottom:10, cursor:'pointer', alignItems:'center', border:'0.5px solid #F0F0F0' }}>
                <div style={{ width:52, height:52, borderRadius:14, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, flexShrink:0, overflow:'hidden' }}>
                  {s.profilePhoto?<img src={s.profilePhoto} alt={s.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />:s.emoji}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{s.name}</div>
                      {s.isTopSitter && <span style={{ fontSize:9, background:'#FFF9C4', color:'#E65100', borderRadius:8, padding:'1px 5px', fontWeight:700 }}>⭐ Top</span>}
                    </div>
                    <div style={{ fontSize:13, fontWeight:700, color:theme.primary }}>{s.price}</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:5 }}>
                    <Star size={10} fill="#FFC107" color="#FFC107" />
                    <span style={{ fontSize:11, fontWeight:600, color:'#1a1a1a' }}>{s.rating}</span>
                    <span style={{ fontSize:11, color:'#AAA' }}>({s.reviews} walks)</span>
                    {s.verified && <span style={{ fontSize:10, background:'#E8F5E9', color:'#2E7D32', borderRadius:8, padding:'1px 5px' }}>✓ Verified</span>}
                  </div>
                  <div style={{ display:'flex', gap:4 }}>
                    {s.tags.slice(0,2).map(t => <span key={t} style={{ fontSize:10, padding:'2px 7px', borderRadius:8, background:theme.light, color:theme.primary, fontWeight:500 }}>{t==='walk30'?'Walker':t==='boarding'?'Boarding':t==='daycare'?'Daycare':t}</span>)}
                  </div>
                </div>
                <div onClick={e => { e.stopPropagation(); requestBooking(s); }}
                  style={{ background:theme.primary, borderRadius:10, padding:'8px 12px', fontSize:11, fontWeight:700, color:'white', cursor:'pointer', flexShrink:0 }}>Book</div>
              </div>
            ))}
            <div style={{ height:20 }} />
          </div>
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'0.5px solid #E8E8E8', display:'flex', justifyContent:'space-around', padding:'10px 0 20px', zIndex:500 }}>
        {[
          { id:'home',    label:'Home',     icon:'🏠', action: () => goHome() },
          { id:'book',    label:'Bookings', icon:'📋', action: () => { setShowBookings(true); setActiveNav('book'); } },
          { id:'explore', label:'Explore',  icon:'🔍', action: () => { setActiveNav('explore'); setShowExplore(true); } },
          { id:'profile', label:'My Pets',  icon:'🐕', action: () => { setShowUserProfile(true); setActiveNav('profile'); } },
        ].map(n => (
          <div key={n.id} onClick={n.action} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', minWidth:60, paddingTop:2 }}>
            <span style={{ fontSize:22 }}>{n.icon}</span>
            <div style={{ fontSize:10, fontWeight:activeNav===n.id?700:400, color:activeNav===n.id?theme.primary:'#BBBBBB' }}>{n.label}</div>
            {activeNav===n.id && <div style={{ width:4, height:4, borderRadius:2, background:theme.primary }} />}
          </div>
        ))}
      </div>
    </div>
  );
}