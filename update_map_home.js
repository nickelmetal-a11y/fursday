const fs = require('fs');
let a = fs.readFileSync('src/App.js', 'utf8');

// 1. Add map state variables
const STATE_FIND = `  const [search, setSearch] = useState('');`;
const STATE_REPLACE = `  const [search, setSearch] = useState('');
  const [mapInstance, setMapInstance] = useState(null);`;
if (a.includes(STATE_FIND)) {
  a = a.replace(STATE_FIND, STATE_REPLACE);
  console.log('Step 1 done: map state added');
} else console.log('Step 1 MISSED');

// 2. Add map init useEffect before the return statement — find a good anchor
const MAP_EFFECT = `
  useEffect(() => {
    if (!userLocation || typeof window === 'undefined' || !window.L) return;
    const existingMap = document.getElementById('fursday-map');
    if (!existingMap || existingMap._leaflet_id) return;
    const L = window.L;
    const map = L.map('fursday-map', {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);
    map.setView([userLocation.lat, userLocation.lng], 15);
    const userIcon = L.divIcon({ html: '<div style="width:14px;height:14px;border-radius:50%;background:#4285F4;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>', iconSize:[14,14], iconAnchor:[7,7], className:'' });
    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(map);
    realSitters.filter(s => s.lat && s.lng).forEach(s => {
      const sIcon = L.divIcon({ html: '<div style="background:#FF6B35;color:white;border-radius:20px;padding:3px 7px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">' + s.name.split(' ')[0] + '</div>', className:'', iconAnchor:[0,0] });
      L.marker([s.lat, s.lng], { icon: sIcon }).addTo(map).on('click', () => setSelectedSitter(s));
    });
    setMapInstance(map);
    return () => { try { map.remove(); } catch(e){} };
  }, [userLocation, realSitters]);

`;

// Insert before the loading screen check
const INSERT_BEFORE = `  // ── Loading ──`;
if (a.includes(INSERT_BEFORE)) {
  a = a.replace(INSERT_BEFORE, MAP_EFFECT + INSERT_BEFORE);
  console.log('Step 2 done: map useEffect added');
} else console.log('Step 2 MISSED');

// 3. Replace the entire header gradient section with map + floating card
const OLD_HEADER = `      {/* Header */}
      <div style={{ background:theme.gradient, padding:'48px 20px 24px', borderBottomLeftRadius:28, borderBottomRightRadius:28 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div onClick={handleLogoTap}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Your city</div>
            <div style={{ display:'flex', gap:8 }}>
              {['Gurgaon','Pune'].map(c => (
                <button key={c} onClick={() => handleCityChange(c)}
                  style={{ padding:'6px 14px', borderRadius:20, border:city===c?'2px solid white':'1.5px solid rgba(255,255,255,0.3)', background:city===c?'white':'transparent', color:city===c?theme.primary:'white', fontSize:13, fontWeight:city===c?700:400, cursor:'pointer' }}>
                  {c === 'Gurgaon' ? '🏙️ Delhi NCR' : '🌴 Pune'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()}
            style={{ background:'transparent', border:'none', color:'rgba(255,255,255,0.4)', fontSize:12, cursor:'pointer', marginTop:4 }}>
            Sign out
          </button>
        </div>

        <div style={{ color:'white', fontSize:22, fontWeight:700, marginBottom:2 }}>
          {userName ? 'Hi, ' + userName + ' 🐾' : 'Happy Fursday! 🐾'}
        </div>
        <div style={{ color:'rgba(255,255,255,0.75)', fontSize:13, marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
          <MapPin size={13} color="rgba(255,255,255,0.75)" />
          {neighbourhood || theme.label}
          {realSitters.length > 0 && (
            <span style={{ background:'rgba(255,255,255,0.2)', borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:600 }}>
              {realSitters.length} sitter{realSitters.length !== 1 ? 's' : ''} nearby
            </span>
          )}
        </div>

        {/* Sitter banner */}`;

const NEW_HEADER = `      {/* Map header */}
      <div style={{ position:'relative' }}>
        <div id="fursday-map" style={{ height:200, width:'100%', background:'#E8F0E8', zIndex:1 }} />
        <div style={{ position:'absolute', top:12, left:12, zIndex:10, background:'white', borderRadius:20, padding:'5px 12px', display:'flex', alignItems:'center', gap:6, boxShadow:'0 2px 8px rgba(0,0,0,0.15)' }} onClick={handleLogoTap}>
          <MapPin size={13} color={theme.primary} />
          <span style={{ fontSize:12, fontWeight:600, color:'#1a1a1a' }}>{neighbourhood || theme.label}</span>
          {realSitters.length > 0 && <span style={{ background:theme.primary, color:'white', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:600 }}>{realSitters.length} nearby</span>}
        </div>
        <div style={{ position:'absolute', top:12, right:12, zIndex:10, display:'flex', gap:6 }}>
          {['Gurgaon','Pune'].map(c => (
            <button key={c} onClick={() => handleCityChange(c)}
              style={{ padding:'4px 10px', borderRadius:16, border:city===c?'2px solid '+theme.primary:'1.5px solid #E0E0E0', background:city===c?theme.primary:'white', color:city===c?'white':'#555', fontSize:11, fontWeight:city===c?700:400, cursor:'pointer', boxShadow:'0 1px 4px rgba(0,0,0,0.1)' }}>
              {c === 'Gurgaon' ? 'NCR' : 'Pune'}
            </button>
          ))}
        </div>

        {/* Floating card overlapping map */}
        <div style={{ background:'white', borderRadius:'20px 20px 0 0', marginTop:-20, position:'relative', zIndex:5, padding:'16px 16px 0', boxShadow:'0 -4px 20px rgba(0,0,0,0.08)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:700, color:'#1a1a1a' }}>{userName ? 'Hi, ' + userName + ' \uD83D\uDC3E' : 'Happy Fursday! \uD83D\uDC3E'}</div>
              <div style={{ fontSize:12, color:'#888', marginTop:1 }}>What does {userName ? userName.split(' ')[0] + "'s" : 'your'} dog need today?</div>
            </div>
            <button onClick={() => supabase.auth.signOut()} style={{ background:'none', border:'none', color:'#CCC', fontSize:11, cursor:'pointer' }}>Sign out</button>
          </div>

        {/* Sitter banner */}`;

if (a.includes(OLD_HEADER)) {
  a = a.replace(OLD_HEADER, NEW_HEADER);
  console.log('Step 3 done: map header inserted');
} else {
  // Try finding just the header div
  console.log('Step 3 MISSED — trying alternative');
}

// 4. Close the floating card div after sitter banner — find the closing of the header section
// The header ends before the body div
a = a.replace(
  `        </div>\n      </div>\n\n      {/* Body */}\n      <div style={{ padding:'20px 20px 0' }}>`,
  `        </div>\n        </div>\n      </div>\n\n      {/* Body */}\n      <div style={{ padding:'16px 16px 0' }}>`
);

// 5. Fix nav bugs — reset activeNav to 'home' on back handlers
a = a.replace(
  `  if (showUserProfile) return <UserProfile onBack={() => setShowUserProfile(false)}`,
  `  if (showUserProfile) return <UserProfile onBack={() => { setShowUserProfile(false); setActiveNav('home'); }}`
);
a = a.replace(
  `  if (showExplore) return <ExploreScreen onBack={() => setShowExplore(false)}`,
  `  if (showExplore) return <ExploreScreen onBack={() => { setShowExplore(false); setActiveNav('home'); }}`
);
a = a.replace(
  `  if (showBookings) return <BookingsDashboard onBack={() => setShowBookings(false)}`,
  `  if (showBookings) return <BookingsDashboard onBack={() => { setShowBookings(false); setActiveNav('home'); }}`
);
a = a.replace(
  `  if (showPetProfile) return <PetProfile onBack={() => setShowPetProfile(false)}`,
  `  if (showPetProfile) return <PetProfile onBack={() => { setShowPetProfile(false); setActiveNav('home'); }}`
);

// 6. Fix My Pets nav label — ensure it shows dog emoji properly
a = a.replace(
  `{ id:'profile', icon:'🐕', label:'My Pets', action:'profile' },`,
  `{ id:'profile', icon:'\uD83D\uDC15', label:'My Pets', action:'profile' },`
);

fs.writeFileSync('src/App.js', a, 'utf8');
console.log('App.js map home update complete');
