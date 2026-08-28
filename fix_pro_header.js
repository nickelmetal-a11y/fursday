const fs = require('fs');
let sd = fs.readFileSync('src/SitterDashboard.js', 'utf8');
const idx = sd.indexOf('Hi, {sitterProfile');
const start = sd.lastIndexOf('\n      <div', idx);
const end = sd.indexOf('</div>\n      </div>', idx) + '</div>\n      </div>'.length;
console.log('start:', start, 'end:', end);
const before = sd.slice(0, start);
const after = sd.slice(end);
const newHead = `
      <div style={{ background:'#0f0f1a', padding:'48px 16px 16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div>
            <div style={{ color:'white', fontSize:18, fontWeight:700 }}>Hi, {sitterProfile?.users?.name?.split(' ')[0] || 'there'} 👋</div>
            <div style={{ color:sitterProfile?.status==='active'?'#4CAF50':'#FFC107', fontSize:11, fontWeight:500, marginTop:2 }}>
              {sitterProfile?.status==='active'?'● You are live':'○ Pending approval'}
            </div>
          </div>
          <div style={{ background:'#FF6B35', borderRadius:20, padding:'4px 12px', fontSize:11, color:'white', fontWeight:700 }}>
            {(() => { const w=bookings.filter(b=>b.status==='completed').length; if(w>=300)return'🏆 Elite Pro'; if(w>=150)return'🥇 Platinum Pro'; if(w>=75)return'🥈 Gold Pro'; if(w>=25)return'🥈 Silver Pro'; return'🥉 Bronze Pro'; })()}
          </div>
        </div>
        <div style={{ textAlign:'center', marginBottom:12 }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', marginBottom:3 }}>This month so far</div>
          <div style={{ fontSize:32, fontWeight:800, color:'#FF6B35' }}>Rs.{totalEarnings.toLocaleString('en-IN')}</div>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2 }}>Payout on 5th of next month</div>
        </div>
        {(() => { const w=bookings.filter(b=>b.status==='completed').length; const tiers=[{max:25,next:'Silver',comm:12},{max:75,next:'Gold',comm:10},{max:150,next:'Platinum',comm:5},{max:300,next:'Elite',comm:0}]; const tier=tiers.find(t=>w<t.max); const prev=tiers[tiers.indexOf(tier)-1]; const pMin=prev?prev.max:0; const pct=tier?Math.min(100,Math.round((w-pMin)/(tier.max-pMin)*100)):100; return (<div style={{ marginBottom:14 }}><div style={{ background:'rgba(255,255,255,0.1)', borderRadius:4, height:6, marginBottom:5 }}><div style={{ width:pct+'%', background:'#FF6B35', borderRadius:4, height:6 }} /></div>{tier?<div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', textAlign:'right' }}>{tier.max-w} more walks → {tier.next} ({tier.comm}% commission)</div>:<div style={{ fontSize:10, color:'#FF6B35', textAlign:'center', fontWeight:600 }}>Elite Pro — 0% commission 🎉</div>}</div>); })()}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[{label:'New requests',val:newBookings.length},{label:'Your rating',val:(sitterProfile?.rating||5.0).toFixed(1)+' ⭐'},{label:'Total walks',val:bookings.filter(b=>b.status==='completed').length}].map((s,i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.07)', borderRadius:10, padding:'8px 6px', textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'white' }}>{s.val}</div>
              <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', marginTop:2, lineHeight:1.3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>`;
const result = before + newHead + after;
fs.writeFileSync('src/SitterDashboard.js', result, 'utf8');
console.log('Pro header written, bytes:', result.length);
