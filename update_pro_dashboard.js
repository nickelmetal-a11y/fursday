const fs = require('fs');
let sd = fs.readFileSync('src/SitterDashboard.js', 'utf8');

// 1. Rename "Sitter Dashboard" header to earnings-first Pro design
const OLD_DASH_HEAD = `      <div style={{ background: t.grad, padding: '48px 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Hi, {sitterProfile?.users?.name || 'there'} ðŸ'‹</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
              {sitterProfile ? (sitterProfile.status === 'active' ? 'You are live ðŸŸ¢' : 'Pending approval ðŸŸ¡') : 'Loading...'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12 }}>Total earned</div>
            <div style={{ color: 'white', fontSize: 20, fontWeight: 700 }}>Rs.{totalEarnings.toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          {[
            { label: 'New', val: newBookings.length, color: t.primary },
            { label: 'Upcoming', val: confirmedBookings.length, color: '#1565C0' },
            { label: 'Active', val: activeBookings.length, color: '#2E7D32' },
            { label: 'Done', val: pastBookings.length, color: '#888' },
          ].map((s, i) => (
            <div key={i} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>{s.val}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>`;

const TIERS = [
  {name:'Bronze', min:0, max:25, commission:15, next:'Silver'},
  {name:'Silver', min:25, max:75, commission:12, next:'Gold'},
  {name:'Gold', min:75, max:150, commission:10, next:'Platinum'},
  {name:'Platinum', min:150, max:300, commission:5, next:'Elite'},
  {name:'Elite', min:300, max:999, commission:0, next:null},
];

const NEW_DASH_HEAD = `      <div style={{ background: '#0f0f1a', padding: '48px 16px 16px' }}>
        {/* Top row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div>
            <div style={{ color:'white', fontSize:18, fontWeight:700 }}>Hi, {sitterProfile?.users?.name?.split(' ')[0] || 'there'} \uD83D\uDC4B</div>
            <div style={{ color:sitterProfile?.status==='active'?'#4CAF50':'#FFC107', fontSize:11, fontWeight:500, marginTop:2 }}>
              {sitterProfile?.status==='active'?'\u25CF You are live':'\u25CB Pending approval'}
            </div>
          </div>
          <div style={{ background:'#FF6B35', borderRadius:20, padding:'4px 12px', fontSize:11, color:'white', fontWeight:700 }}>
            {(() => {
              const walks = bookings.filter(b=>b.status==='completed').length;
              if(walks>=300) return '\uD83C\uDFC6 Elite Pro';
              if(walks>=150) return '\uD83E\uDD47 Platinum Pro';
              if(walks>=75) return '\uD83E\uDD47 Gold Pro';
              if(walks>=25) return '\uD83E\uDD48 Silver Pro';
              return '\uD83E\uDD49 Bronze Pro';
            })()}
          </div>
        </div>

        {/* Earnings hero */}
        <div style={{ textAlign:'center', marginBottom:12 }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>This month so far</div>
          <div style={{ fontSize:32, fontWeight:800, color:'#FF6B35' }}>Rs.{totalEarnings.toLocaleString('en-IN')}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2 }}>Payout on 5th of next month</div>
        </div>

        {/* Tier progress */}
        {(() => {
          const walks = bookings.filter(b=>b.status==='completed').length;
          const tiers = [{name:'Bronze',max:25,next:'Silver',comm:12},{name:'Silver',max:75,next:'Gold',comm:10},{name:'Gold',max:150,next:'Platinum',comm:5},{name:'Platinum',max:300,next:'Elite',comm:0}];
          const tier = tiers.find(t=>walks<t.max) || {name:'Elite',max:300,next:null,comm:0};
          const prev = tiers[tiers.indexOf(tier)-1];
          const prevMin = prev ? prev.max : 0;
          const pct = tier.next ? Math.min(100, Math.round((walks-prevMin)/(tier.max-prevMin)*100)) : 100;
          return (
            <div style={{ marginBottom:14 }}>
              <div style={{ background:'rgba(255,255,255,0.1)', borderRadius:4, height:6, marginBottom:5 }}>
                <div style={{ width:pct+'%', background:'#FF6B35', borderRadius:4, height:6, transition:'width 0.5s' }} />
              </div>
              {tier.next ? (
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textAlign:'right' }}>
                  {tier.max - walks} more walks \u2192 {tier.next} ({tier.comm}% commission)
                </div>
              ) : <div style={{ fontSize:10, color:'#FF6B35', textAlign:'center', fontWeight:600 }}>Elite Pro \u2014 0% commission</div>}
            </div>
          );
        })()}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[
            { label:'New requests', val:newBookings.length },
            { label:'Your rating', val:(sitterProfile?.rating||5.0).toFixed(1)+' \u2B50' },
            { label:'Total walks', val:bookings.filter(b=>b.status==='completed').length },
          ].map((s,i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'8px 6px', textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'white' }}>{s.val}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginTop:2, lineHeight:1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>`;

if (sd.includes(OLD_DASH_HEAD)) {
  sd = sd.replace(OLD_DASH_HEAD, NEW_DASH_HEAD);
  console.log('Pro dashboard header replaced');
} else {
  console.log('WARNING: Dashboard header not found — checking for partial match');
  const partial = sd.indexOf('Hi, {sitterProfile');
  if (partial > -1) console.log('Found at position:', partial);
}

// 2. Add broadcast alert banner before the tab bar
sd = sd.replace(
  `        <div style={{ background: 'white', borderRadius: 14, padding: 4, display: 'flex', gap: 4, marginBottom: 16`,
  `        {broadcastRequests.length > 0 && (
          <div onClick={() => setTab('requests')} style={{ background:'#FFF3E0', borderRadius:12, padding:'10px 14px', marginBottom:10, display:'flex', gap:8, alignItems:'center', cursor:'pointer', border:'1px solid #FFB085' }}>
            <span style={{ fontSize:18 }}>📢</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#E65100' }}>{broadcastRequests.length} open request{broadcastRequests.length>1?'s':''} near you</div>
              <div style={{ fontSize:11, color:'#BF6000' }}>Pet parents looking for help \u2014 tap to respond</div>
            </div>
            <span style={{ color:'#FF6B35', fontSize:16 }}>\u203A</span>
          </div>
        )}
        <div style={{ background: 'white', borderRadius: 14, padding: 4, display: 'flex', gap: 4, marginBottom: 16`
);

// 3. Fix bottom nav background for dark header
sd = sd.replace(
  `      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, background: 'white', borderTop: '1px solid #F0F0F0'`,
  `      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, background: 'white', borderTop: '1px solid #E0E0E0'`
);

fs.writeFileSync('src/SitterDashboard.js', sd, 'utf8');
console.log('SitterDashboard Pro redesign complete');
