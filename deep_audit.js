const fs = require('fs');
const R = (f) => { try { return fs.readFileSync('src/'+f,'utf8'); } catch(e){ return null; } };
let pass=0, fail=0, warn=0;
const P = (l) => { pass++; console.log('PASS  '+l); };
const F = (l) => { fail++; console.log('FAIL  '+l); };
const W = (l) => { warn++; console.log('WARN  '+l); };
const section = (s) => console.log('\\n========== '+s+' ==========');

const files = ['App.js','BookingFlow.js','BookingsDashboard.js','SitterDashboard.js','ExploreScreen.js','UserProfile.js','SitterOnboarding.js','SitterEditProfile.js','ParentOnboarding.js','BroadcastRequest.js','PaymentScreen.js','BookingReceipt.js','ChatScreen.js','WalkReportCard.js','PetProfile.js','LoginScreen.js','FirstLoginPrompt.js','SitterProfile.js','AdminPanel.js','TermsAndConditions.js','PrivacyPolicy.js'];

section('FILE EXISTENCE');
files.forEach(f => { const c=R(f); if(c===null) F('missing: '+f); else P('exists: '+f+' ('+c.length+' bytes)'); });

const a = R('App.js');

section('BALANCED BRACES / PARENS (corruption check)');
files.forEach(f => {
  const c = R(f); if(!c) return;
  const open = (c.match(/\{/g)||[]).length, close = (c.match(/\}/g)||[]).length;
  const po = (c.match(/\(/g)||[]).length, pc = (c.match(/\)/g)||[]).length;
  if (open===close && po===pc) P('balanced: '+f);
  else F('UNBALANCED: '+f+' braces '+open+'/'+close+' parens '+po+'/'+pc);
});

section('IMPORTS RESOLVE (App.js imports vs files)');
const importMatches = [...a.matchAll(/import\s+(\w+)\s+from\s+'\.\/(\w+)'/g)];
importMatches.forEach(m => {
  const comp = m[2];
  if (R(comp+'.js')!==null) P('import ok: '+comp);
  else F('import BROKEN: '+comp+' (no '+comp+'.js)');
});

section('SCREEN ROUTES (every show* state has a return)');
const showStates = [...a.matchAll(/const \[(show\w+),/g)].map(m=>m[1]);
showStates.forEach(s => {
  if (a.includes('if ('+s+')') || a.includes('if ('+s+' ')) P('route exists: '+s);
  else W('no route guard for: '+s);
});

section('NAV HANDLERS (no dead onBack-only navs)');
['BookingsDashboard.js','ExploreScreen.js','UserProfile.js'].forEach(f => {
  const c = R(f); if(!c) return;
  if (c.includes("if(n.id==='home') onBack(); }}") && !c.includes('onNav')) F('dead nav: '+f);
  else if (c.includes('onNav')) P('live nav: '+f);
  else W('unclear nav: '+f);
});

section('ONNAV PROPS PASSED FROM APP.JS');
['BookingsDashboard','ExploreScreen','UserProfile'].forEach(comp => {
  const re = new RegExp('<'+comp+'[^/]*onNav=');
  if (re.test(a)) P('App passes onNav to: '+comp);
  else F('App does NOT pass onNav to: '+comp);
});

section('OTP WIRING (functions defined AND called)');
const sd = R('SitterDashboard.js');
if (sd.includes('const verifyStartOtp') && sd.includes('verifyStartOtp(b)')) P('verifyStartOtp defined + called');
else F('verifyStartOtp not wired (def:'+sd.includes('const verifyStartOtp')+' call:'+sd.includes('verifyStartOtp(b)')+')');
if (sd.includes('const completeWithOtp') && sd.includes('completeWithOtp(b)')) P('completeWithOtp defined + called');
else F('completeWithOtp not wired');
if (sd.includes('otpEntry') && sd.includes('setOtpEntry')) P('otpEntry state wired');
else F('otpEntry state missing');
if (sd.includes('b.end_otp')) P('end_otp displayed to sitter');
else F('end_otp not displayed');
const bd = R('BookingsDashboard.js');
if (bd.includes('b.start_otp')) P('start_otp shown to parent');
else F('start_otp not shown to parent');
if (bd.includes('const verifyEndOtp') && bd.includes('verifyEndOtp(b)')) P('verifyEndOtp defined + called');
else F('verifyEndOtp not wired');

section('OLD FUNCTION LEFTOVERS (should be replaced)');
if (sd.includes('startWalk(b.id)')) W('SitterDashboard still references startWalk (old) — may be orphaned');
else P('no orphaned startWalk call');
if (sd.includes('completeBooking(b.id)')) W('SitterDashboard still references completeBooking (old)');
else P('no orphaned completeBooking call');

section('BOOKINGFLOW SERVICES');
const bf = R('BookingFlow.js');
const svcCount = (bf.match(/\{ id: '(walk30|boarding|daycare)'/g)||[]).length;
if (svcCount===3) P('BookingFlow has exactly 3 services');
else W('BookingFlow service count in SERVICES array: '+svcCount);
if (bf.includes("id: 'dropin'") || bf.includes("id: 'housesit'")) F('BookingFlow still has dropin/housesit in SERVICES');
else P('BookingFlow SERVICES clean');
if (bf.includes('initialService')) P('BookingFlow accepts initialService prop');
else F('BookingFlow missing initialService');

section('SERVICE-AWARE DATES');
if (bf.includes('isBoarding') && bf.includes('isDaycare') && bf.includes('isWalker')) P('service flags present');
else F('service flags missing');
if (bf.includes('endDayOffset') && bf.includes('nights')) P('boarding date range logic');
else F('boarding date range missing');
if (bf.includes('dropTime') && bf.includes('pickTime')) P('daycare drop/pick times');
else F('daycare times missing');

section('EMAIL EDGE FUNCTION WIRING');
if (a.includes('sendBookingEmail') && a.includes('send-booking-email')) P('email helper + edge URL present');
else F('email wiring incomplete');
if (a.includes('sendBookingEmail(paymentBooking)')) P('email called on payment success');
else F('email NOT called on payment success');

section('MAP WIRING');
if (a.includes('mapRef') && a.includes('mapInstanceRef')) P('map refs present');
else F('map refs missing');
if (a.includes('_sitterMarkers')) P('separate marker update (perf fix)');
else F('marker update effect missing');
if (a.includes('zoomIn()') && a.includes('zoomOut()') && a.includes('setView([userLocation')) P('zoom + locate buttons');
else F('map controls incomplete');

section('SERVICE NAMING CONSISTENCY');
['BookingFlow.js','SitterOnboarding.js','SitterEditProfile.js'].forEach(f => {
  const c = R(f); if(!c) return;
  if (c.includes('Request a walker')) P(f+' uses "Request a walker"');
  else F(f+' missing "Request a walker"');
});

section('SUMMARY');
console.log('PASS: '+pass+'  FAIL: '+fail+'  WARN: '+warn);
