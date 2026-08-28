const fs = require('fs');
let changes = 0;

// ═══ FIX 1: App.js — map performance (don't re-init on sitter change) ═══
let a = fs.readFileSync('src/App.js', 'utf8');

// Split map effect: init once on location/city, update markers separately
const OLD_MAP_EFFECT_DEPS = `  }, [userLocation, realSitters, city]);`;
const NEW_MAP_EFFECT_DEPS = `  }, [userLocation, city]);

  // Update sitter markers separately (no full map re-init)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;
    if (map._sitterMarkers) map._sitterMarkers.forEach(m => map.removeLayer(m));
    map._sitterMarkers = [];
    realSitters.filter(s => s.lat && s.lng).forEach(s => {
      const pin = L.divIcon({ html:'<div style="background:#FF6B35;color:white;border-radius:20px;padding:4px 9px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid white">' + s.name.split(' ')[0] + ' \uD83D\uDC3E</div>', className:'', iconAnchor:[0,20] });
      const marker = L.marker([s.lat, s.lng], { icon: pin }).addTo(map).on('click', () => setSelectedSitter(s));
      map._sitterMarkers.push(marker);
    });
  }, [realSitters]);`;

if (a.includes(OLD_MAP_EFFECT_DEPS)) {
  a = a.replace(OLD_MAP_EFFECT_DEPS, NEW_MAP_EFFECT_DEPS);
  // Also remove the sitter marker loop from the init effect to avoid duplication
  a = a.replace(
    `      realSitters.filter(s => s.lat && s.lng).forEach(s => {
        const pin = L.divIcon({ html:'<div style="background:#FF6B35;color:white;border-radius:20px;padding:4px 9px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid white">' + s.name.split(' ')[0] + ' \uD83D\uDC3E</div>', className:'', iconAnchor:[0,20] });
        L.marker([s.lat, s.lng], { icon: pin }).addTo(map).on('click', () => setSelectedSitter(s));
      });
      mapInstanceRef.current = map;`,
    `      mapInstanceRef.current = map;`
  );
  changes++; console.log('Fix 1: Map init split — no more re-init on sitter change');
} else {
  console.log('Fix 1 SKIPPED — deps pattern not found');
}

fs.writeFileSync('src/App.js', a, 'utf8');

// ═══ FIX 2: ExploreScreen — remove stale services, fix nav, wire all tabs ═══
let e = fs.readFileSync('src/ExploreScreen.js', 'utf8');

// Remove dropin and housesit from filter chips
e = e.replace(
  `const SERVICES = [
  { id: 'all', label: 'All', emoji: 'ðŸ¾' },
  { id: 'walk30', label: 'Walking', emoji: 'ðŸ¦®' },
  { id: 'boarding', label: 'Boarding', emoji: 'ðŸ ' },
  { id: 'daycare', label: 'Daycare', emoji: 'â˜€ï¸' },
  { id: 'dropin', label: 'Drop-in', emoji: 'ðŸ””' },
  { id: 'housesit', label: 'House sit', emoji: 'ðŸ¡' },
];`,
  `const SERVICES = [
  { id: 'all', label: 'All', emoji: '\uD83D\uDC3E' },
  { id: 'walk30', label: 'Walker', emoji: '\uD83E\uDDAE' },
  { id: 'boarding', label: 'Boarding', emoji: '\uD83C\uDFE0' },
  { id: 'daycare', label: 'Daycare', emoji: '\u2600\uFE0F' },
];`
);
changes++; console.log('Fix 2a: Explore filter chips cleaned');

// Fix the bottom nav to actually work — needs onNav prop
e = e.replace(
  `export default function ExploreScreen({ onBack, city, userLocation, onBook }) {`,
  `export default function ExploreScreen({ onBack, city, userLocation, onBook, onNav }) {`
);

e = e.replace(
  `        {[
          { id:'home', label:'Home', emoji:'ðŸ ' },
          { id:'book', label:'Bookings', emoji:'ðŸ“‹' },
          { id:'explore', label:'Explore', emoji:'ðŸ”' },
          { id:'profile', label:'Profile', emoji:'ðŸ‘¤' },
        ].map(n => (
          <div key={n.id} onClick={() => { if(n.id==='home') onBack(); }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}>
            <span style={{ fontSize:20 }}>{n.emoji}</span>
            <span style={{ fontSize:10, fontWeight:n.id==='explore'?700:400, color:n.id==='explore'?t.primary:'#BBB' }}>{n.label}</span>
            {n.id==='explore' && <div style={{ width:4, height:4, borderRadius:2, background:t.primary }} />}
          </div>
        ))}`,
  `        {[
          { id:'home', label:'Home', emoji:'\uD83C\uDFE0' },
          { id:'book', label:'Bookings', emoji:'\uD83D\uDCCB' },
          { id:'explore', label:'Explore', emoji:'\uD83D\uDD0D' },
          { id:'profile', label:'My Pets', emoji:'\uD83D\uDC15' },
        ].map(n => (
          <div key={n.id} onClick={() => { if(n.id==='explore') return; if(onNav) onNav(n.id); else onBack(); }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', minWidth:60 }}>
            <span style={{ fontSize:20 }}>{n.emoji}</span>
            <span style={{ fontSize:10, fontWeight:n.id==='explore'?700:400, color:n.id==='explore'?t.primary:'#BBB' }}>{n.label}</span>
            {n.id==='explore' && <div style={{ width:4, height:4, borderRadius:2, background:t.primary }} />}
          </div>
        ))}`
);
changes++; console.log('Fix 2b: Explore bottom nav wired');

fs.writeFileSync('src/ExploreScreen.js', e, 'utf8');

// ═══ FIX 3: App.js — pass onNav to ExploreScreen ═══
let a2 = fs.readFileSync('src/App.js', 'utf8');
a2 = a2.replace(
  `  if (showExplore) return <ExploreScreen onBack={() => { setShowExplore(false); goHome(); }} city={city} userLocation={userLocation} onBook={sitter => { setSelectedSitter(sitter); setShowExplore(false); setShowBooking(true); }} />;`,
  `  if (showExplore) return <ExploreScreen onBack={() => { setShowExplore(false); goHome(); }} city={city} userLocation={userLocation} onBook={sitter => { setSelectedSitter(sitter); setShowExplore(false); setShowBooking(true); }} onNav={id => { setShowExplore(false); if(id==='home'){ goHome(); } else if(id==='book'){ setActiveNav('book'); setShowBookings(true); } else if(id==='profile'){ setActiveNav('profile'); setShowUserProfile(true); } }} />;`
);
changes++; console.log('Fix 3: onNav passed to Explore');
fs.writeFileSync('src/App.js', a2, 'utf8');

console.log('Total changes:', changes);
