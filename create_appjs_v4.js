const fs = require('fs');

const APP = `import React, { useState, useEffect, useRef } from 'react';
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

const SERVICES = [
  { id:'walk30',   icon:'\uD83E\uDDAE', name:'Request a walker',  price:'from Rs.299',       color:'#FFF3E0', tc:'#E65100' },
  { id:'boarding', icon:'\uD83C\uDFE0', name:'Home boarding',     price:'from Rs.849/night', color:'#E8F5E9', tc:'#2E7D32' },
  { id:'daycare',  icon:'\u2600\uFE0F', name:'Doggy daycare',     price:'from Rs.649/day',   color:'#E3F2FD', tc:'#1565C0' },
  { id:'broadcast',icon:'\uD83D\uDCE2', name:'Broadcast request', price:'all pros respond',  color:'#FFF0EB', tc:'#FF6B35' },
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
      const inGurgaon = lat > 28.3 && lat < 28.9 && lng > 76.8 && lng < 77.5;
      const inPune    = lat > 18.4 && lat < 18.7 && lng > 73.7 && lng < 74.1;
      if (!inGurgaon && !inPune) setOutsideCity(true);
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
        : city === 'Pune' ? [18.5204, 73.8567] : [28.4595, 77.0266];
      const map = L.map(mapRef.current, { zoomControl:false, attributionControl:false, dragging:true, scrollWheelZoom:false });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:18 }).addTo(map);
      map.setView(center, 14);
      if (userLocation) {
        const userIcon = L.divIcon({ html:'<div style="width:14px;height:14px;border-radius:50%;background:#4285F4;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>', iconSize:[14,14], iconAnchor:[7,7], className:'' });
        L.marker(center, { icon: userIcon }).addTo(map);
      }
      realSitters.filter(s => s.lat && s.lng).forEach(s => {
        const pin = L.divIcon({ html:'<div style="background:#FF6B35;color:white;border-radius:20px;padding:4px 9px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid white">' + s.name.split(' ')[0] + ' \uD83D\uDC3E</div>', className:'', iconAnchor:[0,20] });
        L.marker([s.lat, s.lng], { icon: pin }).addTo(map).on('click', () => setSelectedSitter(s));
      });
      mapInstanceRef.current = map;
    };
    tryInit();
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [userLocation, realSitters, city]);

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
      <div style={{ fontSize:56 }}>\uD83D\uDC3E</div>
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

  if (outsideCity) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 24px', textAlign:'center' }}>
      <div style={{ fontSize:64, marginBottom:20 }}>\uD83D\uDDFA\uFE0F</div>
      <div style={{ fontSize:24, fontWeight:700, color:'white', marginBottom:8 }}>Coming to your city soon!</div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:32, lineHeight:1.6 }}>Fursday is in Delhi NCR and Pune. Expanding fast!</div>
      {!waitlistSent ? (
        <div style={{ width:'100%' }}>
          <input value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="your@email.com" type="email"
            style={{ width:'100%', padding:'16px', borderRadius:14, border:'1.5px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.08)', fontSize:15, color:'white', outline:'none', boxSizing:'border-box', marginBottom:12 }} />
          <button onClick={async () => { if(waitlistEmail.includes('@')){ await supabase.from('waitlist').insert({ email:waitlistEmail }); setWaitlistSent(true); } }}
            style={{ width:'100%', padding:'16px 0', borderRadius:14, border:'none', background:'#FF6B35', color:'white', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:12 }}>
            Join the waitlist
          </button>
          <button onClick={() => setOutsideCity(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer' }}>I am in Delhi NCR or Pune</button>
        </div>
      ) : (
        <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:16, padding:20, width:'100%' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>\u2705</div>
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
  if (showUserProfile) return <UserProfile onBack={() => { setShowUserProfile(false); goHome(); }} city={city} onAddPet={() => { setShowUserProfile(false); setShowPetProfile(true); }} onEditPet={() => { setShowUserProfile(false); setShowPetProfile(true); }} onSignOut={async () => { await supabase.auth.signOut(); setUser(null); setShowUserProfile(false); }} />;
  if (showExplore) return <ExploreScreen onBack={() => { setShowExplore(false); goHome(); }} city={city} userLocation={userLocation} onBook={sitter => { setSelectedSitter(sitter); setShowExplore(false); setShowBooking(true); }} />;
  if (showChat) return <ChatScreen onBack={() => { setShowChat(false); if(chatBooking?.fromSitter) setIsSitterMode(true); else { setShowBookings(true); } }} city={city} booking={chatBooking} userType={chatBooking?.fromSitter?'sitter':'parent'} />;
  if (showPayment) return <PaymentScreen onBack={() => setShowPayment(false)} onSuccess={paymentId => { setShowPayment(false); setReceiptData({ ...paymentBooking, paymentId }); setShowReceipt(true); }} city={city} booking={paymentBooking} />;
  if (showWalkReport) return <WalkReportCard onBack={() => { setShowWalkReport(false); setShowBookings(true); }} city={city} mode='parent' />;
  if (showBookings) return <BookingsDashboard onBack={() => { setShowBookings(false); goHome(); }} city={city} onViewReport={() => setShowWalkReport(true)} onReview={() => {}} onPayNow={b => { setPaymentBooking({ service:b.service_type, amount:b.gross_amount_paise, ref:b.booking_ref, id:b.id }); setShowBookings(false); setShowPayment(true); }} onMessage={(b, sitterName, sitterPhone) => { setChatBooking({ id:b.id, service:b.service_type, sitterName, otherPhone:sitterPhone }); setShowBookings(false); setShowChat(true); }} />;
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
          <span style={{ color:'white', fontSize:13, fontWeight:600 }}>\u2713 Request sent to {requestSentFor}!</span>
        </div>
      )}

      {/* MAP */}
      <div style={{ position:'relative', height:240 }}>
        <div ref={mapRef} style={{ position:'absolute', inset:0, background:'#E8EFE0' }} />

        {/* Dark gradient overlay at top for readability */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:80, background:'linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)', zIndex:2, pointerEvents:'none' }} />

        {/* Top bar */}
        <div style={{ position:'absolute', top:0, left:0, right:0, padding:'44px 14px 0', zIndex:3, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div onClick={handleLogoTap} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
            <div style={{ background:'rgba(0,0,0,0.35)', backdropFilter:'blur(4px)', borderRadius:20, padding:'5px 10px', display:'flex', alignItems:'center', gap:5 }}>
              <MapPin size={12} color="white" />
              <span style={{ fontSize:12, fontWeight:600, color:'white' }}>{neighbourhood || theme.label}</span>
              {realSitters.length > 0 && <span style={{ background:theme.primary, color:'white', borderRadius:10, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{realSitters.length}</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:5, alignItems:'center' }}>
            {['Gurgaon','Pune'].map(c => (
              <button key={c} onClick={() => handleCityChange(c)}
                style={{ padding:'4px 10px', borderRadius:14, border:'none', background:city===c?theme.primary:'rgba(255,255,255,0.9)', color:city===c?'white':'#333', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                {c==='Gurgaon'?'NCR':'Pune'}
              </button>
            ))}
            <button onClick={() => supabase.auth.signOut()} style={{ padding:'4px 8px', borderRadius:14, border:'none', background:'rgba(255,255,255,0.9)', color:'#888', fontSize:10, cursor:'pointer' }}>Out</button>
          </div>
        </div>

        {/* No sitters GPS message */}
        {realSitters.filter(s=>s.lat&&s.lng).length === 0 && userLocation && (
          <div style={{ position:'absolute', bottom:30, left:'50%', transform:'translateX(-50%)', background:'rgba(255,255,255,0.95)', borderRadius:12, padding:'6px 14px', zIndex:3, fontSize:11, color:'#555', whiteSpace:'nowrap' }}>
            \uD83D\uDC3E {realSitters.length > 0 ? realSitters.length + ' care pros in your area' : 'Onboarding care pros near you'}
          </div>
        )}
      </div>

      {/* FLOATING BOTTOM SHEET */}
      <div style={{ background:'white', borderRadius:'24px 24px 0 0', marginTop:-24, position:'relative', zIndex:10, boxShadow:'0 -2px 20px rgba(0,0,0,0.08)' }}>

        {/* Greeting row */}
        <div style={{ padding:'18px 18px 0', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:'#1a1a1a', lineHeight:1.2 }}>
              {userName ? 'Hi, ' + userName.split(' ')[0] + ' \uD83D\uDC3E' : 'Happy Fursday \uD83D\uDC3E'}
            </div>
            <div style={{ fontSize:12, color:'#888', marginTop:3 }}>What does your dog need today?</div>
          </div>
          {isSitter && (
            <div onClick={() => setIsSitterMode(true)} style={{ background:'#0f0f1a', borderRadius:12, padding:'8px 12px', cursor:'pointer', textAlign:'center' }}>
              <div style={{ fontSize:14 }}>\uD83D\uDCB0</div>
              <div style={{ fontSize:9, color:'#4CAF50', fontWeight:600, marginTop:2 }}>Pro Hub</div>
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ margin:'14px 18px 0', background:'#F5F5F5', borderRadius:14, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
          <Search size={16} color="#AAA" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search care pros by name..."
            style={{ border:'none', outline:'none', flex:1, fontSize:13, color:'#333', background:'transparent' }} />
        </div>

        {/* Service grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'14px 18px 0' }}>
          {SERVICES.map(svc => (
            <div key={svc.id} onClick={() => {
              if (svc.id === 'broadcast') { setShowBroadcast(true); return; }
              setSelectedServiceType(svc.id); setShowBooking(true);
            }} style={{ background:svc.color, borderRadius:16, padding:'14px 12px', cursor:'pointer' }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{svc.icon}</div>
              <div style={{ fontSize:12, fontWeight:700, color:'#1a1a1a', marginBottom:3, lineHeight:1.3 }}>{svc.name}</div>
              <div style={{ fontSize:10, color:svc.tc, fontWeight:500 }}>{svc.price}</div>
            </div>
          ))}
        </div>

        {/* Become a pro banner (non-sitters) */}
        {!isSitter && (
          <div onClick={() => setShowOnboarding(true)}
            style={{ margin:'14px 18px 0', background:'#0f0f1a', borderRadius:16, padding:'12px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>\uD83D\uDC3E</div>
              <div>
                <div style={{ color:'white', fontSize:13, fontWeight:700 }}>Become a Fursday Pro</div>
                <div style={{ color:theme.primary, fontSize:11, marginTop:1 }}>Earn Rs.12,000-45,000/month</div>
              </div>
            </div>
            <div style={{ background:theme.primary, borderRadius:10, padding:'6px 12px', fontSize:12, color:'white', fontWeight:700 }}>Join</div>
          </div>
        )}

        {/* Sitter list */}
        <div style={{ padding:'18px 18px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>Care pros near you</div>
            <div onClick={() => { setShowExplore(true); setActiveNav('explore'); }} style={{ fontSize:12, color:theme.primary, fontWeight:500, cursor:'pointer' }}>See all \u203A</div>
          </div>

          {sittersLoading && (
            <div style={{ textAlign:'center', padding:'30px 0' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>\uD83D\uDC3E</div>
              <div style={{ fontSize:13, color:'#888' }}>Finding care pros near you...</div>
            </div>
          )}

          {!sittersLoading && filteredSitters.length === 0 && (
            <div style={{ textAlign:'center', padding:'30px 0' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>\uD83D\uDC3E</div>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>{search ? 'No results' : 'No pros in ' + city + ' yet'}</div>
              <div style={{ fontSize:12, color:'#888', lineHeight:1.6 }}>{search ? 'Try a different name' : 'We are onboarding pros in your area!'}</div>
              {!search && <button onClick={() => setShowOnboarding(true)} style={{ marginTop:12, padding:'10px 20px', borderRadius:12, border:'none', background:theme.primary, color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>Become a pro</button>}
            </div>
          )}

          {!sittersLoading && filteredSitters.map(s => (
            <div key={s.id} onClick={() => setSelectedSitter(s)}
              style={{ background:'#FAFAFA', borderRadius:16, padding:12, display:'flex', gap:12, marginBottom:10, cursor:'pointer', alignItems:'center', border:'0.5px solid #F0F0F0' }}>
              <div style={{ width:52, height:52, borderRadius:14, background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:700, flexShrink:0, overflow:'hidden' }}>
                {s.profilePhoto ? <img src={s.profilePhoto} alt={s.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : s.emoji}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1a1a1a' }}>{s.name}</div>
                    {s.isTopSitter && <span style={{ fontSize:9, background:'#FFF9C4', color:'#E65100', borderRadius:8, padding:'1px 5px', fontWeight:700 }}>\u2B50 Top</span>}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:theme.primary }}>{s.price}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:5 }}>
                  <Star size={10} fill="#FFC107" color="#FFC107" />
                  <span style={{ fontSize:11, fontWeight:600, color:'#1a1a1a' }}>{s.rating}</span>
                  <span style={{ fontSize:11, color:'#AAA' }}>({s.reviews} walks)</span>
                  {s.verified && <span style={{ fontSize:10, background:'#E8F5E9', color:'#2E7D32', borderRadius:8, padding:'1px 5px', fontWeight:500 }}>\u2713 Verified</span>}
                </div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {s.tags.slice(0,2).map(t => <span key={t} style={{ fontSize:10, padding:'2px 7px', borderRadius:8, background:theme.light, color:theme.primary, fontWeight:500 }}>{t}</span>)}
                </div>
              </div>
              <div onClick={e => { e.stopPropagation(); requestBooking(s); }}
                style={{ background:theme.primary, borderRadius:10, padding:'8px 12px', fontSize:11, fontWeight:700, color:'white', cursor:'pointer', flexShrink:0 }}>
                Book
              </div>
            </div>
          ))}
        </div>

        <div style={{ height:20 }} />
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'0.5px solid #E8E8E8', display:'flex', justifyContent:'space-around', padding:'10px 0 20px', zIndex:100 }}>
        {[
          { id:'home',    label:'Home',     icon:'\uD83C\uDFE0', action: () => goHome() },
          { id:'book',    label:'Bookings', icon:'\uD83D\uDCCB', action: () => { setShowBookings(true); setActiveNav('book'); } },
          { id:'explore', label:'Explore',  icon:'\uD83D\uDD0D', action: () => { setShowExplore(true); setActiveNav('explore'); } },
          { id:'profile', label:'My Pets',  icon:'\uD83D\uDC15', action: () => { setShowUserProfile(true); setActiveNav('profile'); } },
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
}`;

fs.writeFileSync('src/App.js', APP, 'utf8');
console.log('App.js written, bytes:', APP.length);
