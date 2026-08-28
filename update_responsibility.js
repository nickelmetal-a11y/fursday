const fs = require('fs');

// ── ParentOnboarding.js — add responsibility step ──────────────────────────
let po = fs.readFileSync('src/ParentOnboarding.js', 'utf8');

const RESP_STEP = `    {
      emoji: '📋',
      title: 'Your responsibilities',
      sub: 'Quick read — takes 30 seconds.',
      content: (
        <div>
          <div style={{ background:'#FFF0EB', borderRadius:14, padding:'12px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:18, flexShrink:0 }}>ℹ️</span>
            <div style={{ fontSize:12, color:'#FF6B35', lineHeight:1.6 }}>These are the things Fursday expects from you as a pet owner. Your sitter has matching responsibilities.</div>
          </div>
          {[
            { emoji:'🦺', title:'Provide collar and leash', detail:'Your dog must have a properly fitting collar and leash. Sitters cannot walk without these.', must:true },
            { emoji:'💧', title:'Leave water accessible', detail:'Fresh water must be available for your dog. Fursday sitters do not bring food or water.', must:true },
            { emoji:'⚠️', title:'Disclose aggression honestly', detail:'If your dog has ever bitten or snapped, you must disclose this. Hiding it makes you liable for any injury.', must:true },
            { emoji:'💊', title:'Do not expect medication', detail:'Sitters cannot administer medication unless agreed in writing before booking.', must:false },
            { emoji:'🤝', title:'Be respectful', detail:'Treat sitters with courtesy. Abusive behaviour results in account suspension.', must:false },
            { emoji:'📱', title:'Share OTP to start walk', detail:'When your sitter arrives, share the 4-digit OTP from the app. This confirms the right person arrived.', must:true },
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'12px 0', borderBottom:i<5?'1px solid #F5F5F5':'none', alignItems:'flex-start' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:item.must?'#FFF0EB':'#F8F8F8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{item.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{item.title}</div>
                  {item.must && <span style={{ fontSize:10, background:'#FCEBEB', color:'#A32D2D', borderRadius:6, padding:'1px 6px', fontWeight:600 }}>Required</span>}
                </div>
                <div style={{ fontSize:12, color:'#888', lineHeight:1.5 }}>{item.detail}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:14, background:'#E8F5E9', borderRadius:12, padding:'10px 14px', display:'flex', gap:8 }}>
            <span style={{ fontSize:16 }}>✓</span>
            <div style={{ fontSize:12, color:'#2E7D32', lineHeight:1.5 }}>By continuing you confirm you have read and accept these responsibilities.</div>
          </div>
        </div>
      ),
      btnLabel: "I understand and agree",
      canNext: true,
    },`;

// Insert responsibility step between welcome step and pet step
po = po.replace(
  `    {
      emoji: '🐕',
      title: 'Tell us about your dog',`,
  RESP_STEP + `
    {
      emoji: '🐕',
      title: 'Tell us about your dog',`
);

// Fix the steps dots to handle 3 steps
fs.writeFileSync('src/ParentOnboarding.js', po, 'utf8');
console.log('ParentOnboarding updated, bytes:', po.length);

// ── SitterOnboarding.js — add responsibility screen before Go Live ──────────
let so = fs.readFileSync('src/SitterOnboarding.js', 'utf8');

// Add a responsibility confirmation before screen 7 (review & go live)
// Insert new screen 7, push old 7 to 8, old 8 to 9
so = so.replace(
  `  // SCREEN 7 — Review + agree`,
  `  // SCREEN 7 — Sitter responsibilities
  if (screen === 7) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={6} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>Your responsibilities</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>What Fursday expects from every sitter</div>

      <div style={{ background:'#FFF0EB', borderRadius:14, padding:'12px 16px', marginBottom:14, display:'flex', gap:10 }}>
        <span style={{ fontSize:18 }}>ℹ️</span>
        <div style={{ fontSize:12, color:'#FF6B35', lineHeight:1.6 }}>These apply to every booking. Pet owners have matching responsibilities shown to them.</div>
      </div>

      {[
        { emoji:'🦺', label:'Carry your full kit', detail:'Every walk needs fresh biodegradable bags, paw wipes, and hand sanitiser. Provided by Fursday.', required:true },
        { emoji:'⏰', label:'Arrive on time', detail:'Be at the location within 10 minutes of the slot. Late by 20+ min = automatic Rs.50 discount to owner.', required:true },
        { emoji:'📱', label:'Enter OTP before starting', detail:'Owner gives you a 4-digit OTP. Enter it in the app before starting the walk. No OTP = no walk.', required:true },
        { emoji:'🧹', label:'Always pick up potty', detail:'Never leave waste. Use biodegradable bags. Clean Paws Promise applies to every Fursday walk.', required:true },
        { emoji:'🐾', label:'Wipe paws after walk', detail:'Clean the dog\'s paws before re-entering the home. Use the wipe from your kit.', required:true },
        { emoji:'📋', label:'Submit walk report', detail:'Report must be submitted before payment is released. No report = no payment.', required:true },
        { emoji:'🚫', label:'No food, water, or medication', detail:'Do not provide food, water, treats, or medication unless explicitly agreed in writing before booking.', required:false },
        { emoji:'🔒', label:'Keep owner details private', detail:'Never share the owner\'s address or contact details. Phone numbers are hidden until booking is confirmed.', required:true },
        { emoji:'💰', label:'No off-platform deals', detail:'Soliciting direct payment from owners is strictly prohibited. Account suspended immediately.', required:true },
        { emoji:'🆘', label:'Emergency button if anything goes wrong', detail:'Any dog bite, injury, or incident: press emergency button in app within 2 hours. Photos mandatory.', required:true },
      ].map((item, i) => (
        <div key={i} style={{ background:'white', borderRadius:14, padding:'12px 14px', marginBottom:8, display:'flex', gap:12, alignItems:'flex-start', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ width:38, height:38, borderRadius:10, background:item.required?'#FFF0EB':'#F8F8F8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{item.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{item.label}</div>
              {item.required && <span style={{ fontSize:10, background:'#FCEBEB', color:'#A32D2D', borderRadius:6, padding:'1px 6px', fontWeight:600 }}>Required</span>}
            </div>
            <div style={{ fontSize:12, color:'#888', lineHeight:1.5 }}>{item.detail}</div>
          </div>
        </div>
      ))}

      <div style={{ background:'#E8F5E9', borderRadius:14, padding:'12px 16px', marginBottom:16, display:'flex', gap:10 }}>
        <span style={{ fontSize:16 }}>✓</span>
        <div style={{ fontSize:12, color:'#2E7D32', lineHeight:1.6 }}>Violating these responsibilities may result in account suspension. Fursday protects both sitters and owners fairly.</div>
      </div>

      <BottomBtn label="I accept these responsibilities" onClick={() => setScreen(8)} dark={false} />
    </div>
  , false);

  // SCREEN 8 — Review + agree`
);

// Update old screen 7 to screen 8, old screen 8 to screen 9
so = so.replace(
  `  if (screen === 7) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={6} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>Review & go live</div>`,
  `  if (screen === 8) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={7} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>Review & go live</div>`
);

so = so.replace(
  `  // SCREEN 8 — Celebration
  return wrap(`,
  `  // SCREEN 9 — Celebration
  return wrap(`
);

so = so.replace(
  `      <BottomBtn label="Continue" onClick={() => setScreen(7)} dark={false} />`,
  `      <BottomBtn label="Continue" onClick={() => setScreen(7)} dark={false} />`
);

// Fix go live button to go to screen 9 instead of 8
so = so.replace(
  `    setSaving(false);
    setScreen(8);`,
  `    setSaving(false);
    setScreen(9);`
);

// Fix Back on old screen 7 (now 8) to go to 7
so = so.replace(
  `      <BackBtn to={6} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>Review & go live</div>`,
  `      <BackBtn to={7} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>Review & go live</div>`
);

fs.writeFileSync('src/SitterOnboarding.js', so, 'utf8');
console.log('SitterOnboarding updated, bytes:', so.length);

// ── BookingFlow.js — add responsibility reminder before payment ─────────────
let bf = fs.readFileSync('src/BookingFlow.js', 'utf8');

// Add responsibility checklist to the confirmed/summary step
const BOOKING_REMINDER = `
              <div style={{ background:'#FFF0EB', borderRadius:16, padding:'14px 16px', marginBottom:14 }}>
                <div style={{ fontSize:13, fontWeight:600, color:'#FF6B35', marginBottom:10 }}>Before your walk — quick checklist</div>
                {[
                  { label:'Collar and leash ready', key:'collar' },
                  { label:'Fresh water left out for dog', key:'water' },
                  { label:'Aggression disclosed in booking notes', key:'aggression' },
                  { label:'Ready to share OTP when sitter arrives', key:'otp' },
                ].map((item, i) => (
                  <div key={item.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 0', borderBottom:i<3?'1px solid rgba(255,107,53,0.1)':'none' }}>
                    <div style={{ width:20, height:20, borderRadius:6, background:'#FFE0CC', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:12 }}>✓</span>
                    </div>
                    <span style={{ fontSize:12, color:'#555' }}>{item.label}</span>
                  </div>
                ))}
              </div>`;

// Find the confirmed step review section and add checklist
bf = bf.replace(
  `              {[
                    { label:'Booking ref', val:b.booking_ref },`,
  BOOKING_REMINDER + `
              {[
                    { label:'Booking ref', val:b.booking_ref },`
);

fs.writeFileSync('src/BookingFlow.js', bf, 'utf8');
console.log('BookingFlow updated, bytes:', bf.length);

console.log('\nAll 3 files updated successfully.');
