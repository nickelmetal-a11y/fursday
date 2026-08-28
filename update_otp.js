const fs = require('fs');
let changes = 0;

// ═══ SitterDashboard: replace "Start walk" with OTP entry, add "Complete with OTP" ═══
let sd = fs.readFileSync('src/SitterDashboard.js', 'utf8');

// Add OTP state
sd = sd.replace(
  `  const [broadcastRequests, setBroadcastRequests] = useState([]);`,
  `  const [broadcastRequests, setBroadcastRequests] = useState([]);
  const [otpEntry, setOtpEntry] = useState({});
  const [otpError, setOtpError] = useState({});`
);

// Add OTP verify functions before BookingCard
sd = sd.replace(
  `  const acceptBroadcast = async (req) => {`,
  `  const verifyStartOtp = async (booking) => {
    const entered = (otpEntry[booking.id] || '').trim();
    if (entered !== booking.start_otp) {
      setOtpError({ ...otpError, [booking.id]: 'Wrong OTP. Ask the pet parent for the code shown in their app.' });
      return;
    }
    await supabase.from('bookings').update({ status:'active', started_at:new Date().toISOString(), start_verified_at:new Date().toISOString() }).eq('id', booking.id);
    setOtpError({ ...otpError, [booking.id]: null });
    setOtpEntry({ ...otpEntry, [booking.id]: '' });
    loadData();
  };

  const completeWithOtp = async (booking) => {
    const needsEndOtp = ['boarding','daycare'].includes(booking.service_type);
    if (needsEndOtp) {
      await supabase.from('bookings').update({ status:'completed', completed_at:new Date().toISOString() }).eq('id', booking.id);
    } else {
      await supabase.from('bookings').update({ status:'completed', completed_at:new Date().toISOString(), end_verified_at:new Date().toISOString() }).eq('id', booking.id);
    }
    loadData();
  };

  const acceptBroadcast = async (req) => {`
);

// Replace the "Start walk" button with OTP entry UI
sd = sd.replace(
  `            {b.status === 'confirmed' && (
              <button onClick={() => startWalk(b.id)}
                style={{ width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 12, border: 'none', background: t.primary, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Start walk ðŸ¦®
              </button>
            )}`,
  `            {b.status === 'confirmed' && (
              <div style={{ marginTop:10, background:t.light, borderRadius:12, padding:'12px 14px' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>
                  {['boarding','daycare'].includes(b.service_type) ? 'Enter drop-off OTP to start' : 'Enter OTP to start the walk'}
                </div>
                <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>Ask {b.users?.name || 'the pet parent'} for the 4-digit code shown in their app.</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={otpEntry[b.id] || ''} onChange={e => setOtpEntry({ ...otpEntry, [b.id]: e.target.value.replace(/\\D/g,'').slice(0,4) })}
                    placeholder="0000" inputMode="numeric" maxLength={4}
                    style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:18, letterSpacing:6, textAlign:'center', outline:'none', boxSizing:'border-box' }} />
                  <button onClick={() => verifyStartOtp(b)}
                    style={{ padding:'0 20px', borderRadius:10, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>Start</button>
                </div>
                {otpError[b.id] && <div style={{ fontSize:11, color:'#C62828', marginTop:6 }}>{otpError[b.id]}</div>}
              </div>
            )}`
);

// Replace the "Complete walk" button with service-aware completion
sd = sd.replace(
  `            {b.status === 'active' && (
              <button onClick={() => completeBooking(b.id)}
                style={{ width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 12, border: 'none', background: '#2E7D32', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Complete walk âœ“
              </button>
            )}`,
  `            {b.status === 'active' && (
              <div style={{ marginTop:10 }}>
                {['boarding','daycare'].includes(b.service_type) ? (
                  <div style={{ background:'#E8F5E9', borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1B5E20', marginBottom:6 }}>Show pick-up OTP to pet parent</div>
                    <div style={{ fontSize:11, color:'#388E3C', marginBottom:8 }}>When {b.users?.name || 'the parent'} collects their dog, show them this code to confirm safe return.</div>
                    <div style={{ background:'white', borderRadius:10, padding:'10px', textAlign:'center', fontSize:26, fontWeight:800, letterSpacing:8, color:'#2E7D32', marginBottom:8 }}>{b.end_otp || '----'}</div>
                    <button onClick={() => completeWithOtp(b)}
                      style={{ width:'100%', padding:'10px 0', borderRadius:10, border:'none', background:'#2E7D32', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                      Parent has collected the dog \u2713
                    </button>
                  </div>
                ) : (
                  <button onClick={() => completeWithOtp(b)}
                    style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:'#2E7D32', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                    Complete walk \u2713
                  </button>
                )}
              </div>
            )}`
);

fs.writeFileSync('src/SitterDashboard.js', sd, 'utf8');
changes++; console.log('SitterDashboard: OTP entry + completion added');

// ═══ BookingsDashboard: show parent's start OTP + enter pick-up OTP ═══
let bd = fs.readFileSync('src/BookingsDashboard.js', 'utf8');

// We need to find where confirmed/active bookings are displayed and add OTP
// First check if there's an expanded detail section — add OTP display for confirmed bookings
// Add helper near the top of the component
if (bd.includes('export default function BookingsDashboard')) {
  // Add OTP state after the function opening
  bd = bd.replace(
    /export default function BookingsDashboard\(\{([^}]*)\}\) \{/,
    `export default function BookingsDashboard({ $1 }) {
  const [endOtpEntry, setEndOtpEntry] = React.useState({});
  const [endOtpError, setEndOtpError] = React.useState({});
  const verifyEndOtp = async (booking) => {
    const entered = (endOtpEntry[booking.id] || '').trim();
    if (entered !== booking.end_otp) {
      setEndOtpError({ ...endOtpError, [booking.id]: 'Wrong OTP. Ask the sitter for the code in their app.' });
      return;
    }
    const { supabase } = require('./supabase');
    await supabase.from('bookings').update({ status:'completed', completed_at:new Date().toISOString(), end_verified_at:new Date().toISOString() }).eq('id', booking.id);
    setEndOtpError({ ...endOtpError, [booking.id]: null });
    window.location.reload();
  };`
  );
  changes++; console.log('BookingsDashboard: OTP state added');
} else {
  console.log('BookingsDashboard: function signature not matched — manual needed');
}

fs.writeFileSync('src/BookingsDashboard.js', bd, 'utf8');

console.log('Total changes:', changes);
console.log('NOTE: BookingsDashboard OTP display needs the booking card structure — will verify next');
