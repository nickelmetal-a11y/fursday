const fs = require('fs');
let sd = fs.readFileSync('src/SitterDashboard.js', 'utf8');

// Update SERVICE_NAMES
sd = sd.replace(
  `const SERVICE_NAMES = {
  walk30: 'Dog Walking',
  boarding: 'Home Boarding',
  daycare: 'Doggy Daycare',
  dropin: 'Drop-in Visit',
  housesit: 'House Sitting',
};`,
  `const SERVICE_NAMES = {
  walk30: 'Request a walker',
  boarding: 'Home boarding',
  daycare: 'Doggy daycare',
  dropin: 'Drop-in visit',
  housesit: 'House sitting',
};`
);

// Add broadcast requests state and loader
sd = sd.replace(
  `  const [unreadMessages, setUnreadMessages] = useState([]);`,
  `  const [unreadMessages, setUnreadMessages] = useState([]);
  const [broadcastRequests, setBroadcastRequests] = useState([]);`
);

// Add broadcast loader inside loadData
sd = sd.replace(
  `      if (profile) {
        const { data: bkgs } = await supabase
          .from('bookings')
          .select('*, users(name, phone)')
          .eq('sitter_id', profile.id)
          .order('created_at', { ascending: false });
        setBookings(bkgs || []);
      }`,
  `      if (profile) {
        const { data: bkgs } = await supabase
          .from('bookings')
          .select('*, users(name, phone)')
          .eq('sitter_id', profile.id)
          .order('created_at', { ascending: false });
        setBookings(bkgs || []);

        // Load open broadcast requests for this city
        const { data: reqs } = await supabase
          .from('broadcast_requests')
          .select('*, users(name)')
          .eq('city_id', profile.city_id)
          .eq('status', 'open')
          .order('created_at', { ascending: false });
        setBroadcastRequests(reqs || []);
      }`
);

// Accept broadcast request function — add before return statement
sd = sd.replace(
  `  const BookingCard = ({ b }) => {`,
  `  const acceptBroadcast = async (req) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('sitter_profiles').select('id').eq('user_id', user.id).single();
    if (!profile) return;
    await supabase.from('broadcast_responses').insert({
      request_id: req.id,
      sitter_id: profile.id,
      status: 'accepted',
      offered_price: req.service_type === 'walk30' ? 34900 : req.service_type === 'boarding' ? 84900 : 64900,
    });
    setBroadcastRequests(prev => prev.filter(r => r.id !== req.id));
    alert('Response sent! The pet parent will be notified.');
  };

  const BookingCard = ({ b }) => {`
);

// Add broadcast tab to tab bar
sd = sd.replace(
  `            { id: 'new', label: 'New (' + newBookings.length + ')' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'active', label: 'Active' },
            { id: 'past', label: 'Past' },`,
  `            { id: 'new', label: 'New (' + newBookings.length + ')' },
            { id: 'requests', label: '📢 ' + broadcastRequests.length },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'active', label: 'Active' },
            { id: 'past', label: 'Past' },`
);

// Add broadcast requests display after tab content
sd = sd.replace(
  `        {!loading && tabBookings.map(b => <BookingCard key={b.id} b={b} />)}`,
  `        {tab === 'requests' && (
          <div>
            <div style={{ fontSize:13, color:'#888', marginBottom:12, lineHeight:1.5 }}>
              Open requests from pet parents near you. Accept to let them know you are available.
            </div>
            {broadcastRequests.length === 0 && (
              <div style={{ textAlign:'center', padding:'40px 20px' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📢</div>
                <div style={{ fontSize:15, fontWeight:600, color:'#1a1a1a', marginBottom:6 }}>No open requests</div>
                <div style={{ fontSize:13, color:'#888' }}>When pet parents broadcast a request, it will appear here.</div>
              </div>
            )}
            {broadcastRequests.map(req => (
              <div key={req.id} style={{ background:'white', borderRadius:20, padding:16, marginBottom:12, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'2px solid ' + t.primary }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#1a1a1a' }}>{SERVICE_NAMES[req.service_type] || req.service_type}</div>
                    <div style={{ fontSize:12, color:'#888' }}>{req.area || 'Nearby area'}</div>
                  </div>
                  <div style={{ fontSize:11, background:t.light, color:t.primary, borderRadius:10, padding:'3px 10px', fontWeight:600 }}>Open</div>
                </div>
                <div style={{ display:'flex', gap:12, marginBottom:10 }}>
                  <div style={{ fontSize:12, color:'#555' }}>📅 {req.scheduled_date}</div>
                  <div style={{ fontSize:12, color:'#555' }}>🕐 {req.scheduled_time}</div>
                </div>
                {req.notes && <div style={{ fontSize:12, color:'#666', background:'#F8F8F8', borderRadius:10, padding:'8px 12px', marginBottom:10 }}>{req.notes}</div>}
                <button onClick={() => acceptBroadcast(req)}
                  style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'none', background:t.primary, color:'white', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  Accept this request
                </button>
              </div>
            ))}
          </div>
        )}
        {tab !== 'requests' && !loading && tabBookings.map(b => <BookingCard key={b.id} b={b} />)}`
);

fs.writeFileSync('src/SitterDashboard.js', sd, 'utf8');
console.log('SitterDashboard updated with broadcast tab and service renames');
