const fs = require('fs');
let a = fs.readFileSync('src/App.js', 'utf8');

// Replace the entire MAP + FLOATING SHEET section
const MAP_START = '      {/* MAP */}';
const MAP_END = '        <div style={{ height:20 }} />\n      </div>';

const startIdx = a.indexOf(MAP_START);
const endIdx = a.indexOf(MAP_END) + MAP_END.length;

if (startIdx === -1 || endIdx === -1) {
  console.log('ERROR: Could not find map section');
  process.exit(1);
}

const newSection = `      {/* HOME LAYOUT */}
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
              {['Gurgaon','Pune'].map(c => (
                <button key={c} onClick={() => handleCityChange(c)}
                  style={{ padding:'5px 12px', borderRadius:16, border:'none', background:city===c?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.15)', color:'white', fontSize:12, fontWeight:city===c?700:400, cursor:'pointer' }}>
                  {c==='Gurgaon'?'🏙 NCR':'🌴 Pune'}
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
      </div>`;

const before = a.slice(0, startIdx);
const after = a.slice(endIdx);
const result = before + newSection + after;
fs.writeFileSync('src/App.js', result, 'utf8');
console.log('Done: home v5 written, bytes:', result.length);
