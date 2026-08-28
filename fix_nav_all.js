const fs = require('fs');
let changes = 0;

// ═══ BookingsDashboard: add onNav prop + wire bottom nav ═══
let bd = fs.readFileSync('src/BookingsDashboard.js', 'utf8');

bd = bd.replace(
  `export default function BookingsDashboard({ onBack, city, onViewReport, onReview, onPayNow, onMessage }) {`,
  `export default function BookingsDashboard({ onBack, city, onViewReport, onReview, onPayNow, onMessage, onNav }) {`
);

bd = bd.replace(
  `        {[
          { id:'home', label:'Home', emoji:'ðŸ ' },
          { id:'book', label:'Bookings', emoji:'ðŸ“‹' },
          { id:'explore', label:'Explore', emoji:'ðŸ”' },
          { id:'profile', label:'Profile', emoji:'ðŸ‘¤' },
        ].map(n => (
          <div key={n.id} onClick={() => { if(n.id==='home') onBack(); }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}>
            <span style={{ fontSize:20 }}>{n.emoji}</span>
            <span style={{ fontSize:10, fontWeight:n.id==='book'?700:400, color:n.id==='book'?t.primary:'#BBB' }}>{n.label}</span>
            {n.id==='book' && <div style={{ width:4, height:4, borderRadius:2, background:t.primary }} />}
          </div>
        ))}`,
  `        {[
          { id:'home', label:'Home', emoji:'\uD83C\uDFE0' },
          { id:'book', label:'Bookings', emoji:'\uD83D\uDCCB' },
          { id:'explore', label:'Explore', emoji:'\uD83D\uDD0D' },
          { id:'profile', label:'My Pets', emoji:'\uD83D\uDC15' },
        ].map(n => (
          <div key={n.id} onClick={() => { if(n.id==='book') return; if(onNav) onNav(n.id); else onBack(); }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', minWidth:60 }}>
            <span style={{ fontSize:20 }}>{n.emoji}</span>
            <span style={{ fontSize:10, fontWeight:n.id==='book'?700:400, color:n.id==='book'?t.primary:'#BBB' }}>{n.label}</span>
            {n.id==='book' && <div style={{ width:4, height:4, borderRadius:2, background:t.primary }} />}
          </div>
        ))}`
);
fs.writeFileSync('src/BookingsDashboard.js', bd, 'utf8');
changes++; console.log('BookingsDashboard nav wired');

// ═══ UserProfile: add onNav prop + wire bottom nav + fix header title ═══
let up = fs.readFileSync('src/UserProfile.js', 'utf8');

up = up.replace(
  `export default function UserProfile({ onBack, city, onAddPet, onEditPet, onSignOut }) {`,
  `export default function UserProfile({ onBack, city, onAddPet, onEditPet, onSignOut, onNav }) {`
);

// Fix header title from "My Profile" to "My Pets"
up = up.replace(
  `<div style={{ color:'white', fontSize:17, fontWeight:700 }}>My Profile</div>`,
  `<div style={{ color:'white', fontSize:17, fontWeight:700 }}>My Pets & Profile</div>`
);

up = up.replace(
  `        {[
          { id:'home', label:'Home', emoji:'ðŸ ' },
          { id:'book', label:'Bookings', emoji:'ðŸ“‹' },
          { id:'explore', label:'Explore', emoji:'ðŸ”' },
          { id:'profile', label:'Profile', emoji:'ðŸ‘¤' },
        ].map(n => (
          <div key={n.id} onClick={() => { if(n.id==='home') onBack(); }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer' }}>
            <span style={{ fontSize:20 }}>{n.emoji}</span>
            <span style={{ fontSize:10, fontWeight:n.id==='profile'?700:400, color:n.id==='profile'?t.primary:'#BBB' }}>{n.label}</span>
            {n.id==='profile' && <div style={{ width:4, height:4, borderRadius:2, background:t.primary }} />}
          </div>
        ))}`,
  `        {[
          { id:'home', label:'Home', emoji:'\uD83C\uDFE0' },
          { id:'book', label:'Bookings', emoji:'\uD83D\uDCCB' },
          { id:'explore', label:'Explore', emoji:'\uD83D\uDD0D' },
          { id:'profile', label:'My Pets', emoji:'\uD83D\uDC15' },
        ].map(n => (
          <div key={n.id} onClick={() => { if(n.id==='profile') return; if(onNav) onNav(n.id); else onBack(); }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', minWidth:60 }}>
            <span style={{ fontSize:20 }}>{n.emoji}</span>
            <span style={{ fontSize:10, fontWeight:n.id==='profile'?700:400, color:n.id==='profile'?t.primary:'#BBB' }}>{n.label}</span>
            {n.id==='profile' && <div style={{ width:4, height:4, borderRadius:2, background:t.primary }} />}
          </div>
        ))}`
);
fs.writeFileSync('src/UserProfile.js', up, 'utf8');
changes++; console.log('UserProfile nav wired + title fixed');

// ═══ App.js: pass onNav to BookingsDashboard and UserProfile ═══
let a = fs.readFileSync('src/App.js', 'utf8');

// BookingsDashboard onNav
a = a.replace(
  `onMessage={(b, sitterName, sitterPhone) => { setChatBooking({ id:b.id, service:b.service_type, sitterName, otherPhone:sitterPhone }); setShowBookings(false); setShowChat(true); }} />;`,
  `onMessage={(b, sitterName, sitterPhone) => { setChatBooking({ id:b.id, service:b.service_type, sitterName, otherPhone:sitterPhone }); setShowBookings(false); setShowChat(true); }} onNav={id => { setShowBookings(false); if(id==='home'){ goHome(); } else if(id==='explore'){ setActiveNav('explore'); setShowExplore(true); } else if(id==='profile'){ setActiveNav('profile'); setShowUserProfile(true); } }} />;`
);

// UserProfile onNav
a = a.replace(
  `onSignOut={async () => { await supabase.auth.signOut(); setUser(null); setShowUserProfile(false); }} />;`,
  `onSignOut={async () => { await supabase.auth.signOut(); setUser(null); setShowUserProfile(false); }} onNav={id => { setShowUserProfile(false); if(id==='home'){ goHome(); } else if(id==='explore'){ setActiveNav('explore'); setShowExplore(true); } else if(id==='book'){ setActiveNav('book'); setShowBookings(true); } }} />;`
);

fs.writeFileSync('src/App.js', a, 'utf8');
changes++; console.log('App.js onNav handlers passed');

console.log('Total changes:', changes);
