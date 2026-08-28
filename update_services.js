const fs = require('fs');
let changes = 0;

const SERVICE_MAP = {
  'Dog Walking': 'Request a walker',
  'Home Boarding': 'Home boarding',
  'Doggy Daycare': 'Doggy daycare',
  'Drop-in Visit': 'Drop-in visit',
  'House Sitting': 'House sitting',
};

const files = [
  'src/BookingsDashboard.js',
  'src/SitterDashboard.js',
  'src/WalkReportCard.js',
  'src/BroadcastRequest.js',
  'src/ExploreScreen.js',
];

files.forEach(f => {
  if (!fs.existsSync(f)) { console.log('SKIP (not found):', f); return; }
  let c = fs.readFileSync(f, 'utf8');
  let changed = false;
  Object.entries(SERVICE_MAP).forEach(([old, nw]) => {
    if (c.includes(old)) { c = c.split(old).join(nw); changed = true; }
  });
  if (changed) { fs.writeFileSync(f, c, 'utf8'); changes++; console.log('Updated:', f); }
  else console.log('No changes:', f);
});

// BookingFlow — rename + hide dropin/housesit
let bf = fs.readFileSync('src/BookingFlow.js', 'utf8');
bf = bf.replace(
  `const SERVICES = [
  { id: 'walk30', name: 'Dog Walking', sub: '30 minutes', icon: 'ðŸ¦®', price: 349, desc: 'GPS-tracked walk with live map and photo update' },
  { id: 'boarding', name: 'Home Boarding', sub: 'per night', icon: 'ðŸ ', price: 849, desc: 'Your dog stays at the sitter verified home' },
  { id: 'daycare', name: 'Doggy Daycare', sub: 'per day', icon: 'â˜€ï¸', price: 649, desc: 'Drop off in the morning, pick up in the evening' },
  { id: 'dropin', name: 'Drop-in Visit', sub: '30 minutes', icon: 'ðŸ""', price: 249, desc: 'Quick welfare check, feed, and cuddle' },
  { id: 'housesit', name: 'House Sitting', sub: 'per night', icon: 'ðŸ¡', price: 1099, desc: 'Sitter stays at your home overnight' },
];`,
  `const SERVICES = [
  { id: 'walk30', name: 'Request a walker', sub: '30 minutes', icon: '🦮', price: 349, desc: 'GPS-tracked walk with walk report and paw wipe' },
  { id: 'boarding', name: 'Home boarding', sub: 'per night', icon: '🏠', price: 849, desc: 'Your dog stays at the sitter home — safe and cosy' },
  { id: 'daycare', name: 'Doggy daycare', sub: 'per day', icon: '☀️', price: 649, desc: 'Drop off in the morning, pick up in the evening' },
];`
);
// Also add initialService prop support
bf = bf.replace(
  `export default function BookingFlow({ onBack, sitter, city }) {`,
  `export default function BookingFlow({ onBack, sitter, city, initialService }) {`
);
bf = bf.replace(
  `  const [selectedService, setSelectedService] = useState(null);`,
  `  const [selectedService, setSelectedService] = useState(initialService || null);`
);
// If initialService is provided, skip to step 1
bf = bf.replace(
  `  const [step, setStep] = useState(0);`,
  `  const [step, setStep] = useState(initialService ? 1 : 0);`
);
fs.writeFileSync('src/BookingFlow.js', bf, 'utf8');
changes++; console.log('Updated: src/BookingFlow.js (services renamed + initialService)');

console.log('Total changes:', changes);
