const fs = require('fs');
let changes = 0;

// Fix 1: BookingsDashboard - add emergency contact button during active walk + report sitter
let bd = fs.readFileSync('src/BookingsDashboard.js', 'utf8');

// Add report sitter function
bd = bd.replace(
  `  const cancelBooking = async (bookingId) => {`,
  `  const [reportModal, setReportModal] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSent, setReportSent] = useState(false);

  const submitReport = async (bookingId, sitterName) => {
    if (!reportReason) return;
    await supabase.from('sitter_reports').insert({
      booking_id: bookingId,
      reason: reportReason,
      reported_at: new Date().toISOString(),
    }).select();
    setReportModal(null);
    setReportReason('');
    setReportSent(true);
    setTimeout(() => setReportSent(false), 3000);
  };

  const cancelBooking = async (bookingId) => {`
);

// Add report modal and emergency button to expanded booking view
bd = bd.replace(
  `                  {b.status === 'completed' && (
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button onClick={() => onViewReport && onViewReport(b)}
                        style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none', background:t.light, color:t.primary, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                        View walk report
                      </button>
                      <button onClick={() => onReview && onReview(b)}
                        style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                        Leave review
                      </button>
                    </div>
                  )}`,
  `                  {b.status === 'active' && (
                    <a href="tel:+911800000000"
                      style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:8, width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:'#FCEBEB', color:'#A32D2D', fontSize:13, fontWeight:700, cursor:'pointer', textDecoration:'none' }}>
                      🚨 Emergency — Call Fursday Support
                    </a>
                  )}
                  {(b.status === 'completed' || b.status === 'active') && (
                    <button onClick={() => setReportModal({ id: b.id, name: sitterName })}
                      style={{ marginTop:8, width:'100%', padding:'8px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#888', fontSize:12, cursor:'pointer' }}>
                      ⚑ Report a problem with this sitter
                    </button>
                  )}
                  {b.status === 'completed' && (
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <button onClick={() => onViewReport && onViewReport(b)}
                        style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none', background:t.light, color:t.primary, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                        View walk report
                      </button>
                      <button onClick={() => onReview && onReview(b)}
                        style={{ flex:1, padding:'10px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                        Leave review
                      </button>
                    </div>
                  )}`
);

// Add report modal and success toast before final return div
bd = bd.replace(
  `      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', display:'flex', justifyContent:'space-around', padding:'10px 0 16px', zIndex:100 }}>`,
  `      {reportSent && (
        <div style={{ position:'fixed', top:16, left:'50%', transform:'translateX(-50%)', background:'#2E7D32', color:'white', borderRadius:12, padding:'10px 20px', fontSize:13, fontWeight:600, zIndex:2000 }}>
          Report submitted. We will review within 24 hours.
        </div>
      )}
      {reportModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'white', borderRadius:'24px 24px 0 0', padding:'24px 20px 40px', width:'100%', maxWidth:390 }}>
            <div style={{ fontSize:16, fontWeight:700, color:'#1a1a1a', marginBottom:6 }}>Report {reportModal.name}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:16 }}>What went wrong? We take all reports seriously.</div>
            {['Sitter was late or no-show', 'Pet was not cared for properly', 'Sitter was rude or unprofessional', 'Safety concern during walk', 'Other issue'].map(reason => (
              <div key={reason} onClick={() => setReportReason(reason)}
                style={{ padding:'12px 14px', borderRadius:12, border:reportReason===reason?'2px solid #FF6B35':'1.5px solid #E0E0E0', background:reportReason===reason?'#FFF0EB':'white', marginBottom:8, fontSize:13, cursor:'pointer', fontWeight:reportReason===reason?600:400, color:reportReason===reason?'#FF6B35':'#1a1a1a' }}>
                {reason}
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={() => { setReportModal(null); setReportReason(''); }}
                style={{ flex:1, padding:'12px 0', borderRadius:12, border:'1.5px solid #E0E0E0', background:'white', color:'#888', fontSize:14, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={() => submitReport(reportModal.id, reportModal.name)} disabled={!reportReason}
                style={{ flex:2, padding:'12px 0', borderRadius:12, border:'none', background:reportReason?'#A32D2D':'#E0E0E0', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                Submit report
              </button>
            </div>
          </div>
        </div>
      )}
      <div style={{ position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)', width:390, background:'white', borderTop:'1px solid #F0F0F0', display:'flex', justifyContent:'space-around', padding:'10px 0 16px', zIndex:100 }}>`
);

fs.writeFileSync('src/BookingsDashboard.js', bd, 'utf8');
changes++; console.log('Fix 1 done: emergency contact + report sitter added');

// Fix 2: Add flat/tower/floor to BookingFlow
let bf = fs.readFileSync('src/BookingFlow.js', 'utf8');
// Add state
bf = bf.replace(
  `  const [notes, setNotes] = useState('');`,
  `  const [notes, setNotes] = useState('');
  const [flat, setFlat] = useState('');
  const [tower, setTower] = useState('');
  const [floor, setFloor] = useState('');`
);

// Add flat/tower/floor fields in step 2 (pet step) before notes
bf = bf.replace(
  `            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>Notes for sitter</div>`,
  `            <div style={{ background:'white', borderRadius:18, padding:16, marginBottom:14, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Your address details</div>
              <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>Needed for society/apartment access</div>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>Flat / Unit</div>
                  <input value={flat} onChange={e => setFlat(e.target.value)} placeholder="e.g. A-401"
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>Tower / Block</div>
                  <input value={tower} onChange={e => setTower(e.target.value)} placeholder="e.g. Tower B"
                    style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>Society / Building name</div>
                <input value={floor} onChange={e => setFloor(e.target.value)} placeholder="e.g. DLF The Crest"
                  style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
              </div>
            </div>
            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>Notes for sitter</div>`
);

// Add flat/tower to booking save
bf = bf.replace(
  `        notes: notes,`,
  `        notes: notes,
        address_flat: flat || null,
        address_tower: tower || null,
        address_society: floor || null,`
);

fs.writeFileSync('src/BookingFlow.js', bf, 'utf8');
changes++; console.log('Fix 2 done: flat/tower/floor added to booking');

// Fix 3: GPS city detection in App.js
let app = fs.readFileSync('src/App.js', 'utf8');
app = app.replace(
  `  const [showSitterEdit, setShowSitterEdit] = useState(false);`,
  `  const [showSitterEdit, setShowSitterEdit] = useState(false);
  const [outsideCity, setOutsideCity] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistSent, setWaitlistSent] = useState(false);`
);

// Add GPS city check in location useEffect
app = app.replace(
  `        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),`,
  `        pos => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          // Check if user is in Pune or Gurgaon bounds
          const lat = pos.coords.latitude, lng = pos.coords.longitude;
          const inGurgaon = lat > 28.4 && lat < 28.6 && lng > 76.9 && lng < 77.2;
          const inPune = lat > 18.4 && lat < 18.7 && lng > 73.7 && lng < 74.1;
          if (!inGurgaon && !inPune) setOutsideCity(true);
        },`
);

fs.writeFileSync('src/App.js', app, 'utf8');
changes++; console.log('Fix 3 done: GPS city detection added');

// Fix 4: Add outside city screen to App.js routes
app = fs.readFileSync('src/App.js', 'utf8');
app = app.replace(
  `  if (user && !userName) return <FirstLoginPrompt user={user} onDone={(name) => setUserName(name)} />;`,
  `  if (user && !userName) return <FirstLoginPrompt user={user} onDone={(name) => setUserName(name)} />;
  if (outsideCity) return (
    <div style={{ maxWidth:390, margin:'0 auto', minHeight:'100vh', background:'#0f0f1a', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'0 24px', fontFamily:'sans-serif', textAlign:'center' }}>
      <div style={{ fontSize:64, marginBottom:20 }}>🗺️</div>
      <div style={{ fontSize:24, fontWeight:700, color:'white', marginBottom:8 }}>Coming to your city soon!</div>
      <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', marginBottom:32, lineHeight:1.6 }}>Fursday is currently available in Pune and Gurgaon. We are expanding fast!</div>
      {!waitlistSent ? (
        <div style={{ width:'100%' }}>
          <input value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} placeholder="your@email.com" type="email"
            style={{ width:'100%', padding:'16px', borderRadius:14, border:'1.5px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.08)', fontSize:15, color:'white', outline:'none', boxSizing:'border-box', marginBottom:12, fontFamily:'inherit' }} />
          <button onClick={async () => {
            if (waitlistEmail.includes('@')) {
              await supabase.from('waitlist').insert({ email: waitlistEmail, created_at: new Date().toISOString() });
              setWaitlistSent(true);
            }
          }} style={{ width:'100%', padding:'16px 0', borderRadius:14, border:'none', background:'#FF6B35', color:'white', fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:12 }}>
            Join the waitlist
          </button>
          <button onClick={() => setOutsideCity(false)}
            style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer' }}>
            I am actually in Pune or Gurgaon
          </button>
        </div>
      ) : (
        <div style={{ background:'rgba(255,255,255,0.08)', borderRadius:16, padding:'20px', width:'100%' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>✅</div>
          <div style={{ color:'white', fontSize:16, fontWeight:600, marginBottom:8 }}>You are on the list!</div>
          <div style={{ color:'rgba(255,255,255,0.5)', fontSize:13 }}>We will email you when Fursday launches in your city.</div>
          <button onClick={() => setOutsideCity(false)} style={{ marginTop:16, background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:13, cursor:'pointer' }}>Continue anyway</button>
        </div>
      )}
    </div>
  );`
);

fs.writeFileSync('src/App.js', app, 'utf8');
changes++; console.log('Fix 4 done: outside city screen added');

console.log('Total changes:', changes);
