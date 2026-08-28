const fs = require('fs');
let log = [];
const L = s => { log.push(s); console.log(s); };

let sd = fs.readFileSync('src/SitterDashboard.js', 'utf8');
let changed = false;

// ═══ Replace the "Start walk" confirmed button with OTP entry ═══
// Find the confirmed block
const startIdx = sd.indexOf("{b.status === 'confirmed' && (");
if (startIdx > -1) {
  // Find the matching )} closing this block — it ends right before "{b.status === 'active'"
  const activeIdx = sd.indexOf("{b.status === 'active' && (", startIdx);
  if (activeIdx > -1) {
    // The confirmed block is from startIdx to just before activeIdx
    // But we need to include the closing )} and whitespace
    const before = sd.slice(0, startIdx);
    const afterActive = sd.slice(activeIdx);

    const newConfirmed = `{b.status === 'confirmed' && (
              <div style={{ marginTop:10, background:t.light, borderRadius:12, padding:'12px 14px' }}>
                <div style={{ fontSize:12, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>
                  {['boarding','daycare'].includes(b.service_type) ? 'Enter drop-off OTP to start' : 'Enter OTP to start the walk'}
                </div>
                <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>Ask {b.users?.name || 'the pet parent'} for the 4-digit code shown in their app.</div>
                <div style={{ display:'flex', gap:8 }}>
                  <input value={otpEntry[b.id] || ''} onChange={e => setOtpEntry({ ...otpEntry, [b.id]: e.target.value.replace(/\D/g,'').slice(0,4) })}
                    placeholder="0000" inputMode="numeric" maxLength={4}
                    style={{ flex:1, padding:'10px 14px', borderRadius:10, border:'1.5px solid #E0E0E0', fontSize:18, letterSpacing:6, textAlign:'center', outline:'none', boxSizing:'border-box' }} />
                  <button onClick={() => verifyStartOtp(b)}
                    style={{ padding:'0 20px', borderRadius:10, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>Start</button>
                </div>
                {otpError[b.id] && <div style={{ fontSize:11, color:'#C62828', marginTop:6 }}>{otpError[b.id]}</div>}
              </div>
            )}
            `;

    sd = before + newConfirmed + afterActive;
    changed = true;
    L('FIXED: confirmed block replaced with OTP entry');
  } else L('ABORT: active block not found after confirmed');
} else L('ABORT: confirmed block not found');

// ═══ Replace the "completeBooking" active button with end_otp display ═══
sd = fs.readFileSync ? sd : sd; // keep current
const compIdx = sd.indexOf('completeBooking(b.id)');
if (compIdx > -1) {
  // Find the enclosing block start and end
  const blockStart = sd.lastIndexOf("{b.status === 'active' && (", compIdx);
  // Find the closing )} — search for the button close then )}
  const btnClose = sd.indexOf('</button>', compIdx);
  const blockEnd = sd.indexOf(')}', btnClose) + 2;

  if (blockStart > -1 && blockEnd > -1) {
    const before = sd.slice(0, blockStart);
    const after = sd.slice(blockEnd);

    const newActive = `{b.status === 'active' && (
              <div style={{ marginTop:10 }}>
                {['boarding','daycare'].includes(b.service_type) ? (
                  <div style={{ background:'#E8F5E9', borderRadius:12, padding:'12px 14px' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#1B5E20', marginBottom:6 }}>Show pick-up OTP to pet parent</div>
                    <div style={{ fontSize:11, color:'#388E3C', marginBottom:8 }}>When {b.users?.name || 'the parent'} collects their dog, show them this code.</div>
                    <div style={{ background:'white', borderRadius:10, padding:'10px', textAlign:'center', fontSize:26, fontWeight:800, letterSpacing:8, color:'#2E7D32', marginBottom:8 }}>{b.end_otp || '----'}</div>
                    <button onClick={() => completeWithOtp(b)}
                      style={{ width:'100%', padding:'10px 0', borderRadius:10, border:'none', background:'#2E7D32', color:'white', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                      Parent collected the dog \u2713
                    </button>
                  </div>
                ) : (
                  <button onClick={() => completeWithOtp(b)}
                    style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:'#2E7D32', color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                    Complete walk \u2713
                  </button>
                )}
              </div>
            )}`;

    sd = before + newActive + after;
    changed = true;
    L('FIXED: active block replaced with end_otp display');
  } else L('ABORT: could not bound active block');
} else L('ABORT: completeBooking not found');

if (changed) fs.writeFileSync('src/SitterDashboard.js', sd, 'utf8');
L('\\nDONE');
