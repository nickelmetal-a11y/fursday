const fs = require('fs');
let report = [];
const log = (s) => { report.push(s); console.log(s); };

// Helper: replace bottom nav block in a file by finding the nav array structurally
function fixBottomNav(file, activeId) {
  let c = fs.readFileSync('src/' + file, 'utf8');
  const orig = c;

  // Find the nav array — it starts with a map over 4 items containing home/book/explore/profile
  // Replace the dead onClick handler regardless of emoji encoding
  // Pattern 1: the old dead handler
  c = c.replace(
    /onClick=\{\(\) => \{ if\(n\.id==='home'\) onBack\(\); \}\}/g,
    "onClick={() => { if(n.id==='" + activeId + "') return; if(onNav) onNav(n.id); else onBack(); }}"
  );

  // Fix the Profile label → My Pets (handle both quote styles, any emoji)
  c = c.replace(/label:'Profile', emoji:'[^']*'/g, "label:'My Pets', emoji:'\\uD83D\\uDC15'");
  c = c.replace(/label: 'Profile', emoji: '[^']*'/g, "label: 'My Pets', emoji: '\\uD83D\\uDC15'");

  if (c !== orig) { fs.writeFileSync('src/' + file, c, 'utf8'); log('FIXED nav: ' + file); }
  else log('NO CHANGE nav: ' + file + ' (pattern not found — check manually)');
}

fixBottomNav('BookingsDashboard.js', 'book');
fixBottomNav('ExploreScreen.js', 'explore');
fixBottomNav('UserProfile.js', 'profile');

// ═══ ExploreScreen: remove dropin/housesit filter chips ═══
let e = fs.readFileSync('src/ExploreScreen.js', 'utf8');
const eOrig = e;
// Remove the two lines with dropin and housesit from SERVICES array
e = e.replace(/\s*\{ id: 'dropin', label: 'Drop-in', emoji: '[^']*' \},/g, '');
e = e.replace(/\s*\{ id: 'housesit', label: 'House sit', emoji: '[^']*' \},/g, '');
if (e !== eOrig) { fs.writeFileSync('src/ExploreScreen.js', e, 'utf8'); log('FIXED: ExploreScreen dropin/housesit chips removed'); }
else log('NO CHANGE: ExploreScreen chips (already clean or pattern diff)');

// ═══ App.js: add onNav to BookingsDashboard call ═══
let a = fs.readFileSync('src/App.js', 'utf8');
const aOrig = a;

// BookingsDashboard — check if onNav already present in its call
const bdCallIdx = a.indexOf('if (showBookings) return <BookingsDashboard');
if (bdCallIdx > -1) {
  const bdCallEnd = a.indexOf('/>;', bdCallIdx);
  const bdCall = a.slice(bdCallIdx, bdCallEnd);
  if (!bdCall.includes('onNav')) {
    a = a.slice(0, bdCallEnd) + ' onNav={id => { setShowBookings(false); if(id===\'home\'){ goHome(); } else if(id===\'explore\'){ setActiveNav(\'explore\'); setShowExplore(true); } else if(id===\'profile\'){ setActiveNav(\'profile\'); setShowUserProfile(true); } }} ' + a.slice(bdCallEnd);
    log('FIXED: App.js BookingsDashboard onNav added');
  } else log('OK: App.js BookingsDashboard already has onNav');
}

// PaymentScreen — add sendBookingEmail call on success
const payIdx = a.indexOf('if (showPayment) return <PaymentScreen');
if (payIdx > -1) {
  const payEnd = a.indexOf('/>;', payIdx);
  const payCall = a.slice(payIdx, payEnd);
  if (!payCall.includes('sendBookingEmail')) {
    // add the email call inside onSuccess
    a = a.replace(
      `onSuccess={paymentId => { setShowPayment(false); setReceiptData({ ...paymentBooking, paymentId }); setShowReceipt(true); }}`,
      `onSuccess={paymentId => { setShowPayment(false); if(paymentBooking?.id) sendBookingEmail(paymentBooking); setReceiptData({ ...paymentBooking, paymentId }); setShowReceipt(true); }}`
    );
    log('FIXED: App.js PaymentScreen email call added');
  } else log('OK: App.js PaymentScreen already calls sendBookingEmail');
}

// Add sendBookingEmail helper if missing
if (!a.includes('const sendBookingEmail')) {
  const helper = `
  const sendBookingEmail = async (booking) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: parentRow } = await supabase.from('users').select('name,email').eq('id', user?.id).single();
      let sitterName = '', sitterEmail = '';
      if (booking.sitter_id) {
        const { data: sp } = await supabase.from('sitter_profiles').select('user_id').eq('id', booking.sitter_id).single();
        if (sp?.user_id) {
          const { data: su } = await supabase.from('users').select('name,email').eq('id', sp.user_id).single();
          sitterName = su?.name || ''; sitterEmail = su?.email || '';
        }
      }
      const { data: full } = await supabase.from('bookings').select('*').eq('id', booking.id).single();
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('https://vucboyiklqdxpqbpfplt.supabase.co/functions/v1/send-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
        body: JSON.stringify({
          booking_ref: full?.booking_ref, service_type: full?.service_type,
          scheduled_date: full?.scheduled_date, scheduled_time: full?.scheduled_time,
          end_date: full?.end_date, gross_amount_paise: full?.gross_amount_paise, start_otp: full?.start_otp,
          parent_name: parentRow?.name, parent_email: parentRow?.email,
          sitter_name: sitterName, sitter_email: sitterEmail,
        }),
      });
    } catch(e) { console.log('Email error:', e); }
  };
`;
  a = a.replace('  const requestBooking = async (sitter) => {', helper + '\n  const requestBooking = async (sitter) => {');
  log('FIXED: App.js sendBookingEmail helper added');
} else log('OK: App.js already has sendBookingEmail helper');

if (a !== aOrig) fs.writeFileSync('src/App.js', a, 'utf8');

// ═══ SitterDashboard: rename "My Profile" tab, verify no "Sitter Dashboard" ═══
let sd = fs.readFileSync('src/SitterDashboard.js', 'utf8');
const sdOrig = sd;
sd = sd.replace(/label: 'My Profile', emoji: '[^']*'/g, "label: 'Edit profile', emoji: '\\u270F\\uFE0F'");
if (sd !== sdOrig) { fs.writeFileSync('src/SitterDashboard.js', sd, 'utf8'); log('FIXED: SitterDashboard profile tab renamed'); }

log('\\n=== DONE. Deploy and test. ===');
