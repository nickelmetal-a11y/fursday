import React, { useState } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { supabase } from './supabase';

const ORANGE = '#FF6B35';
const ORANGE_LIGHT = '#FFF0EB';
const DARK = '#0f0f1a';
const DARK2 = '#1a1a2e';

const CITY_DATA = {
  Gurgaon: { avg: 22000, top: 45000 },
  Pune: { avg: 19000, top: 40000 },
};

const SERVICES = [
  { id: 'walk30', name: 'Request a walker', sub: '30 min per walk', icon: '🦮', avg: 320, default: 299, min: 149, max: 599, bookings: 20 },
  { id: 'boarding', name: 'Home boarding', sub: 'Per night', icon: '🏠', avg: 899, default: 799, min: 499, max: 1999, bookings: 4 },
  { id: 'daycare', name: 'Doggy daycare', sub: 'Per day', icon: '☀️', avg: 699, default: 599, min: 399, max: 1299, bookings: 8 },
];

const EXPERIENCE_OPTIONS = ['Less than 1 year', '1-2 years', '3-5 years', '5+ years'];
const LANGUAGES = ['Hindi', 'English', 'Marathi', 'Punjabi', 'Tamil', 'Telugu', 'Kannada', 'Bengali'];

export default function SitterOnboarding({ onDone, city }) {
  const [screen, setScreen] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [chatStep, setChatStep] = useState(0);
  const [services, setServices] = useState([]);
  const [prices, setPrices] = useState(Object.fromEntries(SERVICES.map(s => [s.id, s.default])));
  const [pricingIdx, setPricingIdx] = useState(0);
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [languages, setLanguages] = useState(['Hindi', 'English']);
  const [aadhaar, setAadhaar] = useState('');
  const [upiId, setUpiId] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [availableDays, setAvailableDays] = useState(['Mon','Tue','Wed','Thu','Fri']);
  const [morningSlot, setMorningSlot] = useState(true);
  const [eveningSlot, setEveningSlot] = useState(true);
  const [afternoonSlot, setAfternoonSlot] = useState(false);
  const [maxDogs, setMaxDogs] = useState('1');
  const [advanceNotice, setAdvanceNotice] = useState('24hrs');
  const [saving, setSaving] = useState(false);
  const [sitterLat, setSitterLat] = useState(null);
  const [sitterLng, setSitterLng] = useState(null);

  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setSitterLat(pos.coords.latitude); setSitterLng(pos.coords.longitude); },
        () => {}
      );
    }
  }, []);

  const cityInfo = CITY_DATA[city];
  const activeServices = SERVICES.filter(s => services.includes(s.id));
  const estimated = activeServices.reduce((sum, s) => sum + prices[s.id] * s.bookings, 0);
  const pricingService = activeServices[pricingIdx];

  const toggleService = id => setServices(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const toggleLang = lang => setLanguages(prev =>
    prev.includes(lang) ? prev.filter(x => x !== lang) : [...prev, lang]
  );

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification('Welcome to Fursday! 🐾', {
          body: 'You will be notified when pet parents request your services.',
          icon: '/favicon.ico',
        });
      }
    }
  };

  const handleGoLive = async () => {
    setSaving(true);
    await requestNotificationPermission();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: cityRow, error: cityError } = await supabase.from('cities').select('id').eq('name', city).single();
      console.log('City lookup:', city, cityRow, cityError);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log('User:', currentUser?.id);
      if (!currentUser) { alert('Not logged in! Please log in first.'); setSaving(false); return; }
      if (!cityRow) { 
        alert('City not found: ' + city + '. Please select Gurgaon or Pune.');
        setSaving(false); 
        return; 
      }
      if (currentUser && cityRow) {
        await supabase.from('users').upsert({ id: currentUser.id, name, phone: '+91' + phone, city_id: cityRow.id });
        const { data: sitter, error: sitterError } = await supabase.from('sitter_profiles').upsert({
          user_id: currentUser.id, city_id: cityRow.id,
          bio, experience_years: parseInt(experience) || 0,
          experience_text: experience || null,
          languages, status: 'pending',
          availability_days: availableDays,
          morning_slot: morningSlot,
          afternoon_slot: afternoonSlot,
          evening_slot: eveningSlot,
          max_dogs: parseInt(maxDogs) || 1,
          advance_notice: advanceNotice,
        }).select().single();
        if (sitter) {
          const rows = activeServices.map(s => ({
            sitter_id: sitter.id, service_type: s.id,
            price_paise: prices[s.id] * 100, is_active: true,
          }));
          await supabase.from('sitter_services').insert(rows);

          // Save PII to sitter_pii table
          if (aadhaar || upiId) {
            await supabase.from('sitter_pii').upsert({
              sitter_id: sitter.id,
              aadhaar_number: aadhaar || null,
              upi_id: upiId || null,
            });
          }
        }
      }
    } catch(e) { console.log('Error:', e); }
    setSaving(false);
    setScreen(9);
  };

  const wrap = (children, dark) => (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: dark ? DARK : '#F8F8F8', fontFamily: '-apple-system,sans-serif', paddingBottom: 100 }}>
      {children}
    </div>
  );

  const BackBtn = ({ to, dark }) => (
    <button onClick={() => setScreen(to)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: dark ? 'rgba(255,255,255,0.5)' : '#888', fontSize: 13, padding: '56px 24px 0', marginBottom: 24 }}>
      <ArrowLeft size={16} /> Back
    </button>
  );

  const BottomBtn = ({ label, onClick, disabled, dark }) => (
    <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, padding: '12px 24px 28px', background: dark ? DARK : 'white', borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : '#F0F0F0'}` }}>
      <button onClick={onClick} disabled={disabled}
        style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: disabled ? '#E0E0E0' : ORANGE, color: disabled ? '#AAA' : 'white', fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {label}
      </button>
    </div>
  );

  // SCREEN 0 — City + earnings
  if (screen === 0) return wrap(
    <div style={{ padding: '0 24px 40px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ paddingTop: 56, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🐾</div>
        <span style={{ color: 'white', fontSize: 17, fontWeight: 700 }}>Fursday</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>YOUR CITY</div>
        <div style={{ width: '100%', padding: '14px 16px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 16, fontWeight: 600, marginBottom: 28 }}>
          {city === 'Pune' ? '🌴' : '🏙️'} {city || 'Gurgaon'}
        </div>
        <div style={{ fontSize: 52, fontWeight: 900, color: ORANGE, lineHeight: 1, marginBottom: 4 }}>Rs.{cityInfo.avg.toLocaleString('en-IN')}</div>
        <div style={{ fontSize: 16, color: 'white', fontWeight: 600, marginBottom: 6 }}>average per month</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Top sitters earn Rs.{cityInfo.top.toLocaleString('en-IN')} in {city}</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          {[{v:'Set your own', s:'schedule'},{v:'No lock-in',s:'quit anytime'},{v:'Rs.0',s:'to join'}].map((x,i) => (
            <div key={i} style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{x.v}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{x.s}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setScreen(1)}
          style={{ width: '100%', padding: '18px 0', borderRadius: 18, border: 'none', background: ORANGE, color: 'white', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
          I want to earn this 🐾
        </button>
        <button onClick={onDone}
          style={{ width: '100%', marginTop: 12, padding: '12px 0', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 13, cursor: 'pointer' }}>
          Not now
        </button>
      </div>
    </div>
  , true);

  // SCREEN 1 — Name + WhatsApp chat
  if (screen === 1) return wrap(
    <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <BackBtn to={0} dark={true} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🐾</div>
        <div>
          <div style={{ color: 'white', fontSize: 14, fontWeight: 600 }}>Fursday</div>
          <div style={{ color: '#2ECC71', fontSize: 11 }}>Online now</div>
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🐾</div>
          <div style={{ background: DARK2, borderRadius: '18px 18px 18px 4px', padding: '12px 16px' }}>
            <div style={{ color: 'white', fontSize: 14, lineHeight: 1.5 }}>Hey! Welcome to Fursday. What should I call you?</div>
          </div>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Your full name..."
          style={{ width: '100%', padding: '14px 16px', borderRadius: 16, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', fontSize: 15, color: 'white', outline: 'none', marginBottom: 8, boxSizing: 'border-box' }} />
        {name.length > 1 && chatStep === 0 && (
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <button onClick={() => setChatStep(1)} style={{ padding: '8px 20px', borderRadius: 20, border: 'none', background: ORANGE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Send</button>
          </div>
        )}
        {chatStep >= 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <div style={{ background: ORANGE, borderRadius: '18px 18px 4px 18px', padding: '10px 16px' }}>
                <div style={{ color: 'white', fontSize: 14 }}>{name}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🐾</div>
              <div style={{ background: DARK2, borderRadius: '18px 18px 18px 4px', padding: '12px 16px' }}>
                <div style={{ color: 'white', fontSize: 14 }}>Great, {name}! Your WhatsApp number?</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <div style={{ padding: '14px 12px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>+91</div>
              <input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} placeholder="WhatsApp number"
                style={{ flex: 1, padding: '14px 16px', borderRadius: 14, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.06)', fontSize: 15, color: 'white', outline: 'none' }} />
            </div>
            {phone.length === 10 && !/^[6-9]\d{9}$/.test(phone) && (
              <div style={{ fontSize: 12, color: '#FF6B35', marginBottom: 8 }}>Enter a valid Indian mobile number</div>
            )}
            {phone.length === 10 && /^[6-9]\d{9}$/.test(phone) && (
              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <button onClick={() => setScreen(2)} style={{ padding: '8px 20px', borderRadius: 20, border: 'none', background: ORANGE, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  , true);

  // SCREEN 2 — Services
  if (screen === 2) return wrap(
    <div style={{ padding: '0 24px 100px', minHeight: '100vh' }}>
      <BackBtn to={1} dark={true} />
      <div style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 4, paddingTop: 0 }}>What will you offer?</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Select all that apply</div>
      <div style={{ background: DARK2, borderRadius: 20, padding: '16px 20px', marginBottom: 20, border: '1px solid rgba(255,107,53,0.3)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Estimated monthly earnings</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: services.length > 0 ? ORANGE : 'rgba(255,255,255,0.2)' }}>
          Rs.{estimated.toLocaleString('en-IN')}
        </div>
        {services.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Select services to see your earnings</div>}
      </div>
      {SERVICES.map(s => {
        const sel = services.includes(s.id);
        return (
          <div key={s.id} onClick={() => toggleService(s.id)}
            style={{ background: sel ? 'rgba(255,107,53,0.12)' : DARK2, borderRadius: 16, padding: '14px 16px', marginBottom: 10, border: sel ? '1.5px solid ' + ORANGE : '1.5px solid rgba(255,255,255,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{s.sub} · avg Rs.{s.avg}</div>
            </div>
            {sel
              ? <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ORANGE }}>+Rs.{(prices[s.id] * s.bookings).toLocaleString('en-IN')}/mo</div>
                  <CheckCircle size={16} color={ORANGE} style={{ marginTop: 2 }} />
                </div>
              : <div style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 20 }}>+</div>
            }
          </div>
        );
      })}
      <BottomBtn label={services.length > 0 ? 'Set my prices' : 'Select at least one service'} onClick={() => { if(services.length > 0){ setPricingIdx(0); setScreen(3); } }} disabled={services.length === 0} dark={true} />
    </div>
  , true);

  // SCREEN 3 — Pricing
  if (screen === 3) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={2} dark={false} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 13, color: '#888' }}>Pricing {pricingIdx + 1} of {activeServices.length}</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {activeServices.map((_, i) => (
            <div key={i} style={{ width: i === pricingIdx ? 20 : 8, height: 6, borderRadius: 3, background: i <= pricingIdx ? ORANGE : '#E0E0E0' }} />
          ))}
        </div>
      </div>
      {pricingService && (
        <div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 2 }}>{pricingService.icon} {pricingService.name}</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{pricingService.sub}</div>
          <div style={{ background: 'white', borderRadius: 20, padding: 20, marginBottom: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: '#888' }}>Your price</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: ORANGE }}>Rs.{prices[pricingService.id]}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#AAA' }}>Market avg</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>Rs.{pricingService.avg}</div>
              </div>
            </div>
            <input type="range" min={pricingService.min} max={pricingService.max} step={50} value={prices[pricingService.id]}
              onChange={e => setPrices(prev => ({ ...prev, [pricingService.id]: parseInt(e.target.value) }))}
              style={{ width: '100%', marginBottom: 14, accentColor: ORANGE }} />
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {[{l:'Low',v:pricingService.min},{l:'Avg',v:pricingService.avg},{l:'High',v:pricingService.max}].map(btn => (
                <button key={btn.v} onClick={() => setPrices(prev => ({ ...prev, [pricingService.id]: btn.v }))}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: prices[pricingService.id] === btn.v ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: prices[pricingService.id] === btn.v ? ORANGE_LIGHT : 'white', color: prices[pricingService.id] === btn.v ? ORANGE : '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {btn.l}
                </button>
              ))}
            </div>
            <div style={{ background: ORANGE_LIGHT, borderRadius: 12, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, color: '#888' }}>Monthly estimate</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: ORANGE }}>Rs.{(prices[pricingService.id] * pricingService.bookings).toLocaleString('en-IN')}/mo</div>
            </div>
          </div>
        </div>
      )}
      <BottomBtn label={pricingIdx < activeServices.length - 1 ? 'Next service' : 'Done with pricing'} onClick={() => { if(pricingIdx < activeServices.length - 1) setPricingIdx(i => i + 1); else setScreen(4); }} dark={false} />
    </div>
  , false);

  // SCREEN 4 — About you
  if (screen === 4) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={3} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>About you</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Help pet parents trust you</div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>Profile photo</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: ORANGE_LIGHT, border: '2px dashed ' + ORANGE, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <span style={{ fontSize: 24 }}>📷</span>
            <span style={{ fontSize: 10, color: ORANGE, marginTop: 2 }}>Add photo</span>
          </div>
          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>A clear photo of your face increases bookings by 3x. Sitters with photos earn significantly more.</div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Bio</div>
        <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={200}
          placeholder="Tell pet parents about yourself. How long have you had pets? What do you love about animals?"
          style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 13, color: '#1a1a1a', outline: 'none', resize: 'none', minHeight: 90, lineHeight: 1.6, fontFamily: 'inherit', boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#CCC', textAlign: 'right', marginTop: 4 }}>{bio.length}/200</div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>Experience with pets</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {EXPERIENCE_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setExperience(opt)}
              style={{ padding: '8px 14px', borderRadius: 20, border: experience === opt ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: experience === opt ? ORANGE_LIGHT : 'white', color: experience === opt ? ORANGE : '#555', fontSize: 13, fontWeight: experience === opt ? 600 : 400, cursor: 'pointer' }}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>Languages spoken</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {LANGUAGES.map(lang => (
            <button key={lang} onClick={() => toggleLang(lang)}
              style={{ padding: '8px 14px', borderRadius: 20, border: languages.includes(lang) ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: languages.includes(lang) ? ORANGE_LIGHT : 'white', color: languages.includes(lang) ? ORANGE : '#555', fontSize: 13, fontWeight: languages.includes(lang) ? 600 : 400, cursor: 'pointer' }}>
              {lang}
            </button>
          ))}
        </div>
      </div>

      <BottomBtn label="Continue" onClick={() => setScreen(5)} dark={false} />
    </div>
  , false);

  // SCREEN 5 — Availability
  if (screen === 5) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={4} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>Your availability</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Set your schedule — change anytime</div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>Available days</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
            const sel = availableDays.includes(day);
            return (
              <button key={day} onClick={() => setAvailableDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])}
                style={{ padding: '8px 14px', borderRadius: 20, border: sel ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: sel ? ORANGE_LIGHT : 'white', color: sel ? ORANGE : '#555', fontSize: 13, fontWeight: sel ? 600 : 400, cursor: 'pointer' }}>
                {day}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={() => setAvailableDays(['Mon','Tue','Wed','Thu','Fri'])}
            style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid #E0E0E0', background: 'white', color: '#888', fontSize: 12, cursor: 'pointer' }}>
            Weekdays
          </button>
          <button onClick={() => setAvailableDays(['Sat','Sun'])}
            style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid #E0E0E0', background: 'white', color: '#888', fontSize: 12, cursor: 'pointer' }}>
            Weekends
          </button>
          <button onClick={() => setAvailableDays(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])}
            style={{ flex: 1, padding: '6px 0', borderRadius: 10, border: '1px solid #E0E0E0', background: 'white', color: '#888', fontSize: 12, cursor: 'pointer' }}>
            All days
          </button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>Available time slots</div>
        {[
          { label: 'Morning', sub: '6am - 10am', key: 'morning', val: morningSlot, set: setMorningSlot },
          { label: 'Afternoon', sub: '12pm - 4pm', key: 'afternoon', val: afternoonSlot, set: setAfternoonSlot },
          { label: 'Evening', sub: '5pm - 8pm', key: 'evening', val: eveningSlot, set: setEveningSlot },
        ].map(slot => (
          <div key={slot.key} onClick={() => slot.set(!slot.val)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: slot.key !== 'evening' ? '1px solid #F5F5F5' : 'none', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#1a1a1a' }}>{slot.label}</div>
              <div style={{ fontSize: 11, color: '#888' }}>{slot.sub}</div>
            </div>
            <div style={{ width: 44, height: 24, borderRadius: 12, background: slot.val ? ORANGE : '#E0E0E0', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
              <div style={{ position: 'absolute', top: 2, left: slot.val ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>Max dogs at one time</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['1','2','3','4+'].map(n => (
            <button key={n} onClick={() => setMaxDogs(n)}
              style={{ flex: 1, padding: '12px 0', borderRadius: 12, border: maxDogs === n ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: maxDogs === n ? ORANGE_LIGHT : 'white', color: maxDogs === n ? ORANGE : '#555', fontSize: 16, fontWeight: maxDogs === n ? 700 : 400, cursor: 'pointer' }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 10 }}>Advance notice needed</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Same day','12hrs','24hrs','48hrs','1 week'].map(n => (
            <button key={n} onClick={() => setAdvanceNotice(n)}
              style={{ padding: '8px 14px', borderRadius: 20, border: advanceNotice === n ? '2px solid ' + ORANGE : '1.5px solid #E0E0E0', background: advanceNotice === n ? ORANGE_LIGHT : 'white', color: advanceNotice === n ? ORANGE : '#555', fontSize: 12, fontWeight: advanceNotice === n ? 600 : 400, cursor: 'pointer' }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <BottomBtn label="Continue" onClick={() => setScreen(6)} dark={false} />
    </div>
  , false);

  // SCREEN 6 — ID Verification
  if (screen === 6) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={5} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>ID Verification</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Required before your first booking</div>

      <div style={{ background: '#E3F2FD', borderRadius: 14, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🛡️</span>
        <div style={{ fontSize: 12, color: '#1565C0', lineHeight: 1.6 }}>
          <strong>Why we verify:</strong> Aadhaar verification builds trust with pet parents and is required by our insurance provider. Your data is encrypted and never shared.
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>Aadhaar number</div>
        <input value={aadhaar} onChange={e => setAadhaar(e.target.value.replace(/\D/g,'').slice(0,12))}
          placeholder="XXXX XXXX XXXX"
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 16, color: '#1a1a1a', outline: 'none', letterSpacing: 4, boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#AAA', marginTop: 6 }}>12-digit Aadhaar number. Verified manually within 24 hours.</div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>UPI ID for payouts</div>
        <input value={upiId} onChange={e => setUpiId(e.target.value)}
          placeholder="e.g. yourname@paytm, yourname@oksbi"
          style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid #E0E0E0', fontSize: 15, color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
        <div style={{ fontSize: 11, color: '#AAA', marginTop: 6 }}>We pay you directly to this UPI ID after each completed booking.</div>
      </div>

      <div style={{ background: 'white', borderRadius: 18, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 8 }}>What happens next</div>
        {['Our team verifies your Aadhaar within 24 hours', 'You get a Verified badge on your profile', 'Verified sitters get 40% more bookings'].map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid #F5F5F5' : 'none' }}>
            <CheckCircle size={16} color={ORANGE} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: '#555' }}>{item}</span>
          </div>
        ))}
      </div>

      <BottomBtn label="Continue" onClick={() => setScreen(7)} dark={false} />
    </div>
  , false);

  // SCREEN 7 — Sitter responsibilities
  if (screen === 7) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={6} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>Your responsibilities</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>What Fursday expects from every sitter</div>

      <div style={{ background:'#FFF0EB', borderRadius:14, padding:'12px 16px', marginBottom:14, display:'flex', gap:10 }}>
        <span style={{ fontSize:18 }}>ℹ️</span>
        <div style={{ fontSize:12, color:'#FF6B35', lineHeight:1.6 }}>These apply to every booking. Pet owners have matching responsibilities shown to them.</div>
      </div>

      {[
        { emoji:'🦺', label:'Carry your full kit', detail:'Every walk needs fresh biodegradable bags, paw wipes, and hand sanitiser. Provided by Fursday.', required:true },
        { emoji:'⏰', label:'Arrive on time', detail:'Be at the location within 10 minutes of the slot. Late by 20+ min = automatic Rs.50 discount to owner.', required:true },
        { emoji:'📱', label:'Enter OTP before starting', detail:'Owner gives you a 4-digit OTP. Enter it in the app before starting the walk. No OTP = no walk.', required:true },
        { emoji:'🧹', label:'Always pick up potty', detail:'Never leave waste. Use biodegradable bags. Clean Paws Promise applies to every Fursday walk.', required:true },
        { emoji:'🐾', label:'Wipe paws after walk', detail:'Clean the dog paws before re-entering the home. Use the wipe from your kit.', required:true },
        { emoji:'📋', label:'Submit walk report', detail:'Report must be submitted before payment is released. No report = no payment.', required:true },
        { emoji:'🚫', label:'No food, water, or medication', detail:'Do not provide food, water, treats, or medication unless explicitly agreed in writing before booking.', required:false },
        { emoji:'🔒', label:'Keep owner details private', detail:'Never share the owner address or contact details. Phone numbers are hidden until booking is confirmed.', required:true },
        { emoji:'💰', label:'No off-platform deals', detail:'Soliciting direct payment from owners is strictly prohibited. Account suspended immediately.', required:true },
        { emoji:'🆘', label:'Emergency button if anything goes wrong', detail:'Any dog bite, injury, or incident: press emergency button in app within 2 hours. Photos mandatory.', required:true },
      ].map((item, i) => (
        <div key={i} style={{ background:'white', borderRadius:14, padding:'12px 14px', marginBottom:8, display:'flex', gap:12, alignItems:'flex-start', boxShadow:'0 1px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ width:38, height:38, borderRadius:10, background:item.required?'#FFF0EB':'#F8F8F8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{item.emoji}</div>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a1a' }}>{item.label}</div>
              {item.required && <span style={{ fontSize:10, background:'#FCEBEB', color:'#A32D2D', borderRadius:6, padding:'1px 6px', fontWeight:600 }}>Required</span>}
            </div>
            <div style={{ fontSize:12, color:'#888', lineHeight:1.5 }}>{item.detail}</div>
          </div>
        </div>
      ))}

      <div style={{ background:'#E8F5E9', borderRadius:14, padding:'12px 16px', marginBottom:16, display:'flex', gap:10 }}>
        <span style={{ fontSize:16 }}>✓</span>
        <div style={{ fontSize:12, color:'#2E7D32', lineHeight:1.6 }}>Violating these responsibilities may result in account suspension. Fursday protects both sitters and owners fairly.</div>
      </div>

      <BottomBtn label="I accept these responsibilities" onClick={() => setScreen(8)} dark={false} />
    </div>
  , false);

  // SCREEN 8 — Review + agree
  if (screen === 8) return wrap(
    <div style={{ padding: '0 20px 100px', minHeight: '100vh' }}>
      <BackBtn to={7} dark={false} />
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 }}>Review & go live</div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Almost there!</div>

      <div style={{ background: DARK, borderRadius: 24, padding: 20, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Estimated monthly earnings</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: ORANGE, marginBottom: 4 }}>Rs.{estimated.toLocaleString('en-IN')}/mo</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 14 }}>across {activeServices.length} service{activeServices.length > 1 ? 's' : ''} in {city}</div>
        {activeServices.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: i < activeServices.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{s.icon} {s.name}</span>
            <span style={{ fontSize: 13, color: ORANGE, fontWeight: 600 }}>Rs.{prices[s.id]}</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 16, padding: 16, marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>Complete after approval</div>
        {['Aadhaar verification (24hrs)', 'Add home photos', 'Complete pet care certification (free, 2hrs)'].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid #F5F5F5' : 'none' }}>
            <div style={{ width: 20, height: 20, borderRadius: 10, background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: '#CCC' }}>○</span>
            </div>
            <span style={{ fontSize: 13, color: '#555' }}>{item}</span>
          </div>
        ))}
      </div>

      <div onClick={() => setAgreed(!agreed)}
        style={{ background: agreed ? '#E8F5E9' : 'white', borderRadius: 16, padding: '14px 16px', marginBottom: 14, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', display: 'flex', gap: 10, border: agreed ? '1.5px solid #A5D6A7' : '1.5px solid transparent' }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, border: agreed ? 'none' : '1.5px solid #DDD', background: agreed ? ORANGE : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
          {agreed && <CheckCircle size={14} color="white" />}
        </div>
        <div style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
          I agree to Fursday's <span style={{ color: ORANGE, fontWeight: 600 }}>Sitter Terms of Service</span>. I understand my prices are visible to pet parents and I can change them anytime.
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 390, padding: '12px 20px 28px', background: '#F8F8F8', borderTop: '1px solid #E0E0E0' }}>
        <button onClick={() => agreed && !saving && handleGoLive()} disabled={!agreed || saving}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: agreed && !saving ? ORANGE : '#E0E0E0', color: agreed && !saving ? 'white' : '#AAA', fontSize: 15, fontWeight: 700, cursor: agreed && !saving ? 'pointer' : 'not-allowed' }}>
          {saving ? 'Saving...' : '🚀 Go live on Fursday'}
        </button>
      </div>
    </div>
  , false);

  // SCREEN 9 — Celebration
  return wrap(
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: 'white', marginBottom: 8, lineHeight: 1.2 }}>
        You're live,<br /><span style={{ color: ORANGE }}>{name}!</span>
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.6 }}>
        Profile under review.<br />We will WhatsApp you within 24 hours.
      </div>
      <div style={{ background: DARK2, borderRadius: 24, padding: 20, width: '100%', marginBottom: 16, border: '1px solid rgba(255,107,53,0.2)' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Your earning potential</div>
        <div style={{ fontSize: 40, fontWeight: 900, color: ORANGE }}>Rs.{estimated.toLocaleString('en-IN')}</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>estimated monthly in {city}</div>
      </div>
      <div style={{ background: '#128C7E', borderRadius: 18, padding: '14px 20px', width: '100%', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 24 }}>💬</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>WhatsApp notification</div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>+91 {phone} when approved</div>
        </div>
        <CheckCircle size={18} color="white" style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </div>
      <button onClick={() => { if(window.confirm) { onDone('sitter'); } else { onDone(); } }}
        style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', background: ORANGE, color: 'white', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
        Go to Sitter Dashboard 🐾
      </button>
    </div>
  , true);
}