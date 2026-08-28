const fs = require('fs');
let changes = 0;

// ═══ PART 1: SitterOnboarding — remove dropin + housesit, rename ═══
let so = fs.readFileSync('src/SitterOnboarding.js', 'utf8');
so = so.replace(
  `const SERVICES = [
  { id: 'walk30', name: 'Dog Walking', sub: '30 min per walk', icon: '🦮', avg: 320, default: 299, min: 149, max: 599, bookings: 20 },
  { id: 'boarding', name: 'Home Boarding', sub: 'Per night', icon: '🏠', avg: 899, default: 799, min: 499, max: 1999, bookings: 4 },
  { id: 'daycare', name: 'Doggy Daycare', sub: 'Per day', icon: '☀️', avg: 699, default: 599, min: 399, max: 1299, bookings: 8 },
  { id: 'dropin', name: 'Drop-in Visit', sub: '30 min check-in', icon: '🔔', avg: 249, default: 199, min: 99, max: 499, bookings: 8 },
  { id: 'housesit', name: 'House Sitting', sub: 'Per night at your home', icon: '🏡', avg: 1299, default: 1099, min: 799, max: 1999, bookings: 2 },`,
  `const SERVICES = [
  { id: 'walk30', name: 'Request a walker', sub: '30 min per walk', icon: '🦮', avg: 320, default: 299, min: 149, max: 599, bookings: 20 },
  { id: 'boarding', name: 'Home boarding', sub: 'Per night', icon: '🏠', avg: 899, default: 799, min: 499, max: 1999, bookings: 4 },
  { id: 'daycare', name: 'Doggy daycare', sub: 'Per day', icon: '☀️', avg: 699, default: 599, min: 399, max: 1299, bookings: 8 },`
);
fs.writeFileSync('src/SitterOnboarding.js', so, 'utf8');
changes++; console.log('SitterOnboarding services cleaned');

// ═══ PART 2: SitterEditProfile — remove dropin + housesit, rename ═══
let se = fs.readFileSync('src/SitterEditProfile.js', 'utf8');
se = se.replace(
  `, name: 'Dog Walking', sub: '30 min', icon: '🦮', min: 149, max: 599, step: 50 },
  { id: 'boarding', name: 'Home Boarding', sub: 'Per night', icon: '🏠', min: 499, max: 1999, step: 100 },
  { id: 'daycare', name: 'Doggy Daycare', sub: 'Per day', icon: '☀️', min: 399, max: 1299, step: 50 },
  { id: 'dropin', name: 'Drop-in Visit', sub: '30 min', icon: '🔔', min: 99, max: 499, step: 50 },
  { id: 'housesit', name: 'House Sitting', sub: 'Per night', icon: '🏡', min: 799, max: 1999, step: 100 },
];`,
  `, name: 'Request a walker', sub: '30 min', icon: '🦮', min: 149, max: 599, step: 50 },
  { id: 'boarding', name: 'Home boarding', sub: 'Per night', icon: '🏠', min: 499, max: 1999, step: 100 },
  { id: 'daycare', name: 'Doggy daycare', sub: 'Per day', icon: '☀️', min: 399, max: 1299, step: 50 },
];`
);
fs.writeFileSync('src/SitterEditProfile.js', se, 'utf8');
changes++; console.log('SitterEditProfile services cleaned');

// ═══ PART 3: BookingFlow — service-aware date/time in schedule step ═══
let bf = fs.readFileSync('src/BookingFlow.js', 'utf8');

// Add state for date range + times
bf = bf.replace(
  `  const [selectedTime, setSelectedTime] = useState(null);`,
  `  const [selectedTime, setSelectedTime] = useState(null);
  const [endDayOffset, setEndDayOffset] = useState(1);
  const [dropTime, setDropTime] = useState(null);
  const [pickTime, setPickTime] = useState(null);`
);

// Add helper to compute nights
bf = bf.replace(
  `  const totalPrice = service ? service.price + getPriceAdjustment() : 0;`,
  `  const nights = Math.max(1, endDayOffset - selectedDay);
  const isBoarding = selectedService === 'boarding';
  const isDaycare = selectedService === 'daycare';
  const isWalker = selectedService === 'walk30';
  const basePrice = service ? service.price + getPriceAdjustment() : 0;
  const totalPrice = isBoarding ? basePrice * nights : basePrice;`
);

// Replace the schedule step (step 1) time-picker section
// Find the step 1 block and replace the time picker
const OLD_TIME = `            <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Pick a time</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
              {TIME_SLOTS.map(t => (
                <div key={t} onClick={() => setSelectedTime(t)}
                  style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:selectedTime===t?ORANGE:'white', border:selectedTime===t?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:selectedTime===t?600:400, color:selectedTime===t?'white':'#555', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
                  {t}
                </div>
              ))}
            </div>`;

const NEW_TIME = `            {/* Boarding: end date picker */}
            {isBoarding && (
              <>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:8 }}>Check-out date</div>
                <div style={{ display:'flex', gap:8, overflowX:'auto', paddingBottom:8, marginBottom:16, scrollbarWidth:'none' }}>
                  {days.map((d,i) => (
                    i > selectedDay ? (
                    <div key={i} onClick={() => setEndDayOffset(i)}
                      style={{ flexShrink:0, width:54, borderRadius:14, padding:'10px 6px', textAlign:'center', cursor:'pointer', background:endDayOffset===i?'#2E7D32':'white', border:endDayOffset===i?'none':'1px solid #F0F0F0', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' }}>
                      <div style={{ fontSize:10, color:endDayOffset===i?'rgba(255,255,255,0.8)':'#AAA', marginBottom:4 }}>{DAY_NAMES[d.getDay()]}</div>
                      <div style={{ fontSize:17, fontWeight:700, color:endDayOffset===i?'white':'#1a1a1a' }}>{d.getDate()}</div>
                      <div style={{ fontSize:10, color:endDayOffset===i?'rgba(255,255,255,0.7)':'#CCC', marginTop:2 }}>{MONTH_NAMES[d.getMonth()]}</div>
                    </div>
                    ) : null
                  ))}
                </div>
                <div style={{ background:'#E8F5E9', borderRadius:12, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#2E7D32', fontWeight:600, textAlign:'center' }}>
                  {nights} night{nights>1?'s':''} · Rs.{basePrice} × {nights} = Rs.{basePrice*nights}
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Drop-off time</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {TIME_SLOTS.map(tt => (
                    <div key={tt} onClick={() => setSelectedTime(tt)}
                      style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:selectedTime===tt?ORANGE:'white', border:selectedTime===tt?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:selectedTime===tt?600:400, color:selectedTime===tt?'white':'#555' }}>{tt}</div>
                  ))}
                </div>
              </>
            )}

            {/* Daycare: drop-off + pick-up times */}
            {isDaycare && (
              <>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Drop-off time</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {TIME_SLOTS.map(tt => (
                    <div key={tt} onClick={() => { setDropTime(tt); setSelectedTime(tt); }}
                      style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:dropTime===tt?ORANGE:'white', border:dropTime===tt?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:dropTime===tt?600:400, color:dropTime===tt?'white':'#555' }}>{tt}</div>
                  ))}
                </div>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Pick-up time</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {TIME_SLOTS.map(tt => (
                    <div key={tt} onClick={() => setPickTime(tt)}
                      style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:pickTime===tt?'#2E7D32':'white', border:pickTime===tt?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:pickTime===tt?600:400, color:pickTime===tt?'white':'#555' }}>{tt}</div>
                  ))}
                </div>
              </>
            )}

            {/* Walker: single time */}
            {isWalker && (
              <>
                <div style={{ fontSize:14, fontWeight:600, color:'#1a1a1a', marginBottom:12 }}>Pick a time</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
                  {TIME_SLOTS.map(tt => (
                    <div key={tt} onClick={() => setSelectedTime(tt)}
                      style={{ padding:'10px 8px', borderRadius:12, textAlign:'center', cursor:'pointer', background:selectedTime===tt?ORANGE:'white', border:selectedTime===tt?'none':'1px solid #F0F0F0', fontSize:13, fontWeight:selectedTime===tt?600:400, color:selectedTime===tt?'white':'#555', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>{tt}</div>
                  ))}
                </div>
              </>
            )}`;

if (bf.includes(OLD_TIME)) {
  bf = bf.replace(OLD_TIME, NEW_TIME);
  changes++; console.log('BookingFlow schedule step made service-aware');
} else {
  console.log('WARNING: BookingFlow time picker block not found exactly');
}

// Update the "Pick a date" heading to be service-aware
bf = bf.replace(
  `            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>Pick a date & time</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:14 }}>Next 14 days available</div>`,
  `            <div style={{ fontSize:17, fontWeight:700, color:'#1a1a1a', marginBottom:4 }}>{isBoarding ? 'Check-in date' : 'Pick a date & time'}</div>
            <div style={{ fontSize:13, color:'#888', marginBottom:14 }}>Next 14 days available</div>`
);

// Update canContinue for daycare (needs both times)
bf = bf.replace(
  `    if (step === 1) return !!selectedTime;`,
  `    if (step === 1) { if(isDaycare) return !!dropTime && !!pickTime; return !!selectedTime; }`
);

// Save booking — store end date + times in notes for boarding/daycare
bf = bf.replace(
  `        scheduled_time: selectedTime || '07:00',
        gross_amount_paise: totalPrice * 100,`,
  `        scheduled_time: selectedTime || dropTime || '07:00',
        gross_amount_paise: totalPrice * 100,
        end_date: isBoarding ? (() => { const d=new Date(); d.setDate(d.getDate()+endDayOffset); return d.toISOString().split('T')[0]; })() : null,
        pickup_time: isDaycare ? pickTime : null,`
);

fs.writeFileSync('src/BookingFlow.js', bf, 'utf8');
console.log('Total changes:', changes);
