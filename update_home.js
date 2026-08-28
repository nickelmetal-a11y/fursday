const fs = require('fs');
let a = fs.readFileSync('src/App.js', 'utf8');

// 1. Add neighbourhood detection + selectedServiceType state
a = a.replace(
  `  const [search, setSearch] = useState('');`,
  `  const [search, setSearch] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState(null);
  const [neighbourhood, setNeighbourhood] = useState('');

  const getNeighbourhood = (lat, lng) => {
    if (lat > 28.48 && lat < 28.52 && lng > 77.08 && lng < 77.12) return 'DLF Phase 1-3';
    if (lat > 28.44 && lat < 28.48 && lng > 77.09 && lng < 77.13) return 'DLF Phase 4-5';
    if (lat > 28.45 && lat < 28.50 && lng > 77.03 && lng < 77.08) return 'Sushant Lok';
    if (lat > 28.40 && lat < 28.45 && lng > 77.03 && lng < 77.09) return 'Nirvana Country';
    if (lat > 18.52 && lat < 18.56 && lng > 73.88 && lng < 73.92) return 'Koregaon Park';
    if (lat > 18.55 && lat < 18.60 && lng > 73.77 && lng < 73.82) return 'Baner';
    if (lat > 18.55 && lat < 18.58 && lng > 73.91 && lng < 73.95) return 'Viman Nagar';
    if (lat > 18.54 && lat < 18.57 && lng > 73.93 && lng < 73.97) return 'Kharadi';
    if (lat > 28.3 && lat < 28.9) return 'Delhi NCR';
    if (lat > 18.4 && lat < 18.7) return 'Pune';
    return '';
  };`
);

// 2. Update GPS to set neighbourhood
a = a.replace(
  `          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });`,
  `          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setNeighbourhood(getNeighbourhood(pos.coords.latitude, pos.coords.longitude));`
);

// 3. Pass initialService to BookingFlow
a = a.replace(
  `  if (showBooking) return <BookingFlow onBack={() => setShowBooking(false)} sitter={selectedSitter} city={city} />;`,
  `  if (showBooking) return <BookingFlow onBack={() => { setShowBooking(false); setSelectedServiceType(null); }} sitter={selectedSitter} city={city} initialService={selectedServiceType} />;`
);

// 4. Replace the two action buttons + trust signals with service grid + search
const OLD_BODY = `        {/* Action buttons */}
        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          <div onClick={() => setShowBroadcast(true)}
            style={{ flex:1, background:theme.primary, borderRadius:16, padding:'12px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:20 }}>ðŸ"¢</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'white' }}>Request a sitter</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.8)' }}>All sitters respond</div>
            </div>
          </div>
          <div onClick={() => setShowBooking(true)}
            style={{ flex:1, background:theme.light, borderRadius:16, padding:'12px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:8, border:'1.5px solid '+theme.primary }}>
            <span style={{ fontSize:20 }}>âš¡</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:theme.primary }}>First walk Rs.99</div>
              <div style={{ fontSize:11, color:'#888' }}>New users only</div>
            </div>
          </div>
        </div>

        {/* Trust signals */}
        <div style={{ background:'white', borderRadius:16, padding:'14px 16px', display:'flex', justifyContent:'space-around', marginBottom:24, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          {[
            { icon:'ðŸ›¡ï¸', val:'Aadhaar', sub:'Verified' },
            { icon:'ðŸ"', val:'Live GPS', sub:'Every walk' },
            { icon:'ðŸ•', val:'24/7', sub:'Support' },
          ].map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <div style={{ width:1, background:'#F0F0F0' }} />}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <span style={{ fontSize:20 }}>{item.icon}</span>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a' }}>{item.val}</div>
                <div style={{ fontSize:11, color:'#888' }}>{item.sub}</div>
              </div>
            </React.Fragment>
          ))}
        </div>`;

const NEW_BODY = `        {/* Service grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
          {[
            { id:'walk30', icon:'🦮', name:'Request a walker', price:'from Rs.299', color:'#FFF3E0', tc:'#E65100' },
            { id:'boarding', icon:'🏠', name:'Home boarding', price:'from Rs.849/night', color:'#E8F5E9', tc:'#2E7D32' },
            { id:'daycare', icon:'☀️', name:'Doggy daycare', price:'from Rs.649/day', color:'#E3F2FD', tc:'#1565C0' },
            { id:'broadcast', icon:'📢', name:'Broadcast request', price:'all sitters respond', color:theme.light, tc:theme.primary },
          ].map(svc => (
            <div key={svc.id} onClick={() => {
              if (svc.id === 'broadcast') { setShowBroadcast(true); return; }
              setSelectedServiceType(svc.id);
              setShowBooking(true);
            }} style={{ background:svc.color, borderRadius:16, padding:'14px 12px', cursor:'pointer', border:'0.5px solid rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:26, marginBottom:6 }}>{svc.icon}</div>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a1a', marginBottom:2, lineHeight:1.3 }}>{svc.name}</div>
              <div style={{ fontSize:11, color:svc.tc, fontWeight:500 }}>{svc.price}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ background:'white', borderRadius:14, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, marginBottom:20, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <Search size={16} color="#CCC" />
          <input style={{ border:'none', outline:'none', flex:1, fontSize:14, color:'#333', background:'transparent' }}
            placeholder="Search sitters by name..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>`;

if (a.includes(OLD_BODY)) {
  a = a.replace(OLD_BODY, NEW_BODY);
  console.log('Service grid + search added');
} else {
  console.log('WARNING: Could not find action buttons block — check manually');
}

// 5. Update header — replace greeting + city pills area to show neighbourhood
a = a.replace(
  `        <div style={{ color:'white', fontSize:22, fontWeight:700, marginBottom:4 }}>Happy Fursday! ðŸ¾</div>
        <div style={{ color:'rgba(255,255,255,0.85)', fontSize:13, marginBottom:16 }}>Trusted pet care in {theme.label}</div>

        {/* Search */}
        <div style={{ background:'white', borderRadius:16, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, boxShadow:'0 4px 20px rgba(0,0,0,0.12)', marginBottom:12 }}>
          <Search size={18} color="#CCC" />
          <input style={{ border:'none', outline:'none', flex:1, fontSize:14, color:'#333', background:'transparent' }}
            placeholder="Search sitters, areas..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>`,
  `        <div style={{ color:'white', fontSize:22, fontWeight:700, marginBottom:2 }}>
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
        </div>`
);

// 6. Update sitter list header
a = a.replace(
  `          <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a' }}>Top sitters in {city}</div>`,
  `          <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a' }}>Top sitters near you</div>`
);

fs.writeFileSync('src/App.js', a, 'utf8');
console.log('App.js home page redesigned');
