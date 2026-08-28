const fs = require('fs');
let log = [];
const L = s => { log.push(s); console.log(s); };

// ═══ FIX 1: BookingFlow SERVICES array (positions 250-958) ═══
let b = fs.readFileSync('src/BookingFlow.js', 'utf8');
const oldServices = b.slice(250, 958);
// Verify we're at the right spot
if (oldServices.startsWith('const SERVICES') && oldServices.includes('housesit')) {
  const newServices = `const SERVICES = [
  { id: 'walk30', name: 'Request a walker', sub: '30 minutes', icon: '\uD83E\uDDAE', price: 349, desc: 'GPS-tracked walk with walk report and paw wipe' },
  { id: 'boarding', name: 'Home boarding', sub: 'per night', icon: '\uD83C\uDFE0', price: 849, desc: 'Your dog stays at the sitter home, safe and cosy' },
  { id: 'daycare', name: 'Doggy daycare', sub: 'per day', icon: '\u2600\uFE0F', price: 649, desc: 'Drop off in the morning, pick up in the evening' },
];`;
  b = b.slice(0, 250) + newServices + b.slice(958);
  fs.writeFileSync('src/BookingFlow.js', b, 'utf8');
  L('FIXED: BookingFlow SERVICES array — now 3 services, renamed');
} else {
  L('ABORT: BookingFlow positions shifted — oldServices starts with: ' + JSON.stringify(oldServices.slice(0,40)));
}

L('\\n=== Now run diagnostic for SitterDashboard active block ===');
