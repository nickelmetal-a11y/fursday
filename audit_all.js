const fs = require('fs');
const R = (f) => { try { return fs.readFileSync('src/'+f,'utf8'); } catch(e){ return ''; } };

const check = (label, cond) => console.log((cond?'PASS':'FAIL') + '  ' + label);
const has = (s, ...subs) => subs.every(x => s.includes(x));

console.log('\n========== NAVIGATION ==========');
['App.js','BookingsDashboard.js','ExploreScreen.js','UserProfile.js'].forEach(f => {
  const c = R(f);
  const hasProfileLabel = c.includes("label:'Profile'") || c.includes("label: 'Profile'");
  const hasMyPets = c.includes("'My Pets'");
  check(f + ' — no "Profile" nav label', !hasProfileLabel);
  check(f + ' — has "My Pets" label', hasMyPets || f==='App.js');
});
check('BookingsDashboard has onNav prop', R('BookingsDashboard.js').includes('onNav'));
check('ExploreScreen has onNav prop', R('ExploreScreen.js').includes('onNav'));
check('UserProfile has onNav prop', R('UserProfile.js').includes('onNav'));

console.log('\n========== SERVICES (only 3 allowed) ==========');
const so = R('SitterOnboarding.js');
check('SitterOnboarding — no dropin selectable', !so.includes("id: 'dropin'"));
check('SitterOnboarding — no housesit selectable', !so.includes("id: 'housesit'"));
const se = R('SitterEditProfile.js');
check('SitterEditProfile — no dropin selectable', !se.includes("id: 'dropin'"));
check('SitterEditProfile — no housesit selectable', !se.includes("id: 'housesit'"));
const bf = R('BookingFlow.js');
check('BookingFlow — no dropin selectable', !bf.includes("id: 'dropin'"));
check('BookingFlow — no housesit selectable', !bf.includes("id: 'housesit'"));

console.log('\n========== SERVICE NAMING ==========');
check('BookingFlow — "Request a walker"', bf.includes('Request a walker'));
check('SitterOnboarding — "Request a walker"', so.includes('Request a walker'));
check('SitterEditProfile — "Request a walker"', se.includes('Request a walker'));

console.log('\n========== DATE / TIME (service-aware) ==========');
check('BookingFlow — boarding end date', bf.includes('endDayOffset'));
check('BookingFlow — daycare pickup time', bf.includes('pickTime'));
check('BookingFlow — nights calc', bf.includes('nights'));

console.log('\n========== OTP ==========');
const sd = R('SitterDashboard.js');
check('SitterDashboard — verifyStartOtp', sd.includes('verifyStartOtp'));
check('SitterDashboard — completeWithOtp', sd.includes('completeWithOtp'));
check('SitterDashboard — end_otp display', sd.includes('end_otp'));
const bd = R('BookingsDashboard.js');
check('BookingsDashboard — start_otp display', bd.includes('start_otp'));
check('BookingsDashboard — verifyEndOtp', bd.includes('verifyEndOtp'));

console.log('\n========== MAP ==========');
const a = R('App.js');
check('App.js — mapRef defined', a.includes('const mapRef'));
check('App.js — CartoDB or OSM tiles', a.includes('cartocdn') || a.includes('openstreetmap'));
check('App.js — map marker update effect', a.includes('_sitterMarkers'));
check('App.js — custom zoom buttons', a.includes('zoomIn') && a.includes('zoomOut'));
check('App.js — locate button', a.includes('setView([userLocation'));

console.log('\n========== PRO DASHBOARD ==========');
check('SitterDashboard — dark header', sd.includes('#0f0f1a'));
check('SitterDashboard — tier badge', sd.includes('Bronze Pro') || sd.includes('Bronze'));
check('SitterDashboard — no "Sitter Dashboard" text', !sd.includes('Sitter Dashboard'));
check('SitterDashboard — broadcast tab', sd.includes('broadcastRequests'));

console.log('\n========== EMAIL ==========');
check('App.js — sendBookingEmail helper', a.includes('sendBookingEmail'));
check('App.js — calls edge function', a.includes('send-booking-email'));

console.log('\n========== RESPONSIBILITY SCREENS ==========');
check('ParentOnboarding — responsibilities', R('ParentOnboarding.js').includes('responsibilit') || R('ParentOnboarding.js').includes('Required'));
check('SitterOnboarding — responsibilities', so.includes('responsibilit') || so.includes('paw'));

console.log('\n========== DONE ==========');
