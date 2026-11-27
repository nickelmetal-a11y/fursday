// Admin-only: fills the live database with TEST data for trying the app.
//   step "pune":     creates Pune TEST parents, sitters (one a boarding-only
//                    host with home details), pets and two bookings.
//   step "profiles": gives every TEST sitter a face photo, 2 dog photos, a
//                    headline, highlights, a proper description, base area and
//                    service radius (only fills what is missing or thin).
// Same hard rules as test-login-links.js: the caller must be a users.is_admin
// account, and nothing outside @example.com accounts is ever created or
// changed. Safe to run again: existing accounts are reused, not duplicated.
const { PUNE_PEOPLE, PROFILE_POOL } = require('./_testData');

const SUPABASE_URL = 'https://vucboyiklqdxpqbpfplt.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ALLOWED_ORIGINS = ['https://fursday-admin.vercel.app', 'http://localhost:3000'];
const TEST_EMAIL = /@example\.com$/i;
// Columns added by migrations 035 and 037. If one hasn't run yet we save
// without its columns and say so, rather than failing the whole step.
const OPTIONAL_COLUMNS = [
  { cols: ['headline', 'highlights', 'base_area', 'base_pincode', 'service_radius_km', 'profile_updated_at'], note: 'Run migration 035 to save headline, highlights, base area and radius.' },
  { cols: ['provider_type', 'home_details', 'home_photos'], note: 'Run migration 037 to save the boarding host type, home details and home photos.' },
];

const api = (path, options = {}) => fetch(SUPABASE_URL + path, {
  ...options,
  headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', ...(options.headers || {}) },
});
const json = async (r) => { const t = await r.text(); try { return t ? JSON.parse(t) : null; } catch { return t; } };
const rest = async (path, method = 'GET', body, prefer = 'return=representation') => {
  const r = await api('/rest/v1/' + path, { method, body: body ? JSON.stringify(body) : undefined, headers: { Prefer: prefer } });
  const data = await json(r);
  if (!r.ok) throw new Error((data && (data.message || data.msg)) || ('HTTP ' + r.status));
  return data;
};
const isoDate = (days) => new Date(Date.now() + days * 864e5).toISOString().split('T')[0];

// Update a sitter row; retry without a migration's columns if they don't exist yet.
async function patchSitter(id, fields, notes) {
  const left = [...OPTIONAL_COLUMNS];
  let row = fields;
  for (;;) {
    try { return await rest('sitter_profiles?id=eq.' + id, 'PATCH', row); } catch (e) {
      if (!/column|schema cache/i.test(e.message) || !left.length) throw e;
      const named = left.findIndex(g => g.cols.some(c => e.message.includes(c)));
      const [group] = left.splice(named < 0 ? 0 : named, 1);
      notes.add(group.note);
      row = Object.fromEntries(Object.entries(row).filter(([k]) => !group.cols.includes(k)));
    }
  }
}

// A plain illustrated card standing in for a real home photo on TEST hosts.
const homePlaceholder = (label, i) => {
  const bg = ['#EEF1F7', '#EAF3EA', '#FDF1E4'][i % 3];
  return '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">'
    + '<rect width="800" height="600" fill="' + bg + '"/>'
    + '<path d="M250 330l150-120 150 120v150H250z" fill="#fff" stroke="#14254A" stroke-width="10" stroke-linejoin="round"/>'
    + '<rect x="370" y="390" width="60" height="90" fill="#14254A"/>'
    + '<text x="400" y="555" font-family="Arial, sans-serif" font-size="40" text-anchor="middle" fill="#14254A">' + label + ' (TEST)</text></svg>';
};
async function storeSvg(svg, path) {
  try {
    const up = await fetch(SUPABASE_URL + '/storage/v1/object/sitter-photos/' + path, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'image/svg+xml', 'x-upsert': 'true' },
      body: svg,
    });
    return up.ok ? SUPABASE_URL + '/storage/v1/object/public/sitter-photos/' + path : null;
  } catch { return null; }
}

// Copy an image into our own storage so the app never depends on a third party.
async function storeImage(sourceUrl, path) {
  try {
    const img = await fetch(sourceUrl);
    if (!img.ok) return null;
    const bytes = Buffer.from(await img.arrayBuffer());
    const up = await fetch(SUPABASE_URL + '/storage/v1/object/sitter-photos/' + path, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': img.headers.get('content-type') || 'image/jpeg', 'x-upsert': 'true' },
      body: bytes,
    });
    return up.ok ? SUPABASE_URL + '/storage/v1/object/public/sitter-photos/' + path : null;
  } catch { return null; }
}
async function randomDogUrl() {
  try { const r = await (await fetch('https://dog.ceo/api/breeds/image/random')).json(); return r.message || null; } catch { return null; }
}

async function findOrCreateAuthUser(person, existing) {
  const found = existing.find(u => (u.email || '').toLowerCase() === person.email.toLowerCase());
  if (found) return { id: found.id, created: false };
  const r = await api('/auth/v1/admin/users', { method: 'POST', body: JSON.stringify({ email: person.email, email_confirm: true, user_metadata: { name: person.name } }) });
  const body = await json(r);
  if (!r.ok) throw new Error('Could not create ' + person.email + ': ' + (body?.msg || body?.message || r.status));
  return { id: body.id, created: true };
}

async function seedPune(authUsers, notes) {
  const report = [];
  const [city] = await rest('cities?select=id&name=eq.Pune');
  if (!city) throw new Error('No "Pune" row in cities');
  const ids = {};
  if (!PUNE_PEOPLE.every(p => TEST_EMAIL.test(p.email))) throw new Error('Seed data must use @example.com emails only');
  for (const p of PUNE_PEOPLE) {
    const { id, created } = await findOrCreateAuthUser(p, authUsers);
    ids[p.key] = id;
    // The signup trigger makes the users row; make sure it exists and is named.
    await rest('users?on_conflict=id', 'POST', { id, email: p.email, name: p.name, phone: p.phone }, 'resolution=merge-duplicates,return=minimal');
    let line = (created ? 'Created ' : 'Updated ') + p.name + ' (' + p.role + ')';

    if (p.role === 'sitter') {
      const existing = await rest('sitter_profiles?select=*&user_id=eq.' + id);
      const fields = {
        user_id: id, city_id: city.id, status: p.status, bio: p.bio, headline: p.headline, highlights: p.highlights,
        languages: p.languages, experience_years: p.experienceYears, experience_text: p.experienceYears + ' years',
        aadhaar_verified: p.status === 'active', base_area: p.area.name, base_pincode: p.area.pincode,
        lat: p.area.lat, lng: p.area.lng, service_radius_km: p.radiusKm, is_founding_sitter: !!p.founding,
        availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], morning_slot: true, evening_slot: true,
        avg_rating: p.rating || null, rating: p.rating || null, review_count: p.reviews || 0, max_dogs: 2, advance_notice: '24hrs',
        profile_updated_at: new Date().toISOString(),
        provider_type: p.provider || 'sitter', home_details: p.home || {},
      };
      let sitterId = existing?.[0]?.id;
      if (!sitterId) {
        const insertFields = { user_id: id, city_id: city.id, status: p.status };
        sitterId = (await rest('sitter_profiles', 'POST', insertFields))[0].id;
      }
      if (p.homePhotoLabels && !existing?.[0]?.home_photos?.length) {
        const urls = [];
        for (const [i, label] of p.homePhotoLabels.entries()) {
          const u = await storeSvg(homePlaceholder(label, i), id + '/home/test-seed-' + i + '.svg');
          if (u) urls.push(u);
        }
        if (urls.length) fields.home_photos = urls;
      }
      await patchSitter(sitterId, fields, notes);
      if (p.status === 'active') {
        await rest('sitter_pii?on_conflict=sitter_id', 'POST', { sitter_id: sitterId, aadhaar_number: p.aadhaar, upi_id: p.upi }, 'resolution=merge-duplicates,return=minimal').catch(e => notes.add('sitter_pii: ' + e.message));
      }
      const svcs = await rest('sitter_services?select=service_type&sitter_id=eq.' + sitterId);
      if (!svcs?.length) {
        await rest('sitter_services', 'POST', p.services.map(([service_type, rs]) => ({ sitter_id: sitterId, service_type, price_paise: rs * 100, is_active: true })), 'return=minimal');
      }
      ids[p.key + 'Sitter'] = sitterId;
      line += ', ' + p.area.name + ', ' + p.radiusKm + ' km' + (p.provider ? ', ' + p.provider + ' host' : '');
    } else {
      const pets = await rest('pet_profiles?select=id&user_id=eq.' + id);
      if (pets?.length) ids[p.key + 'Pet'] = pets[0].id;
      else {
        const photo = await storeImage(await randomDogUrl(), 'test-seed/pet-' + p.key + '.jpg');
        ids[p.key + 'Pet'] = (await rest('pet_profiles', 'POST', { user_id: id, ...p.pet, photo_url: photo }))[0].id;
      }
      line += ', pet ' + p.pet.name + ', ' + p.area.name;
    }
    report.push(line);
  }

  // Two bookings per Pune parent (one upcoming, one done) unless they already have some.
  for (const p of PUNE_PEOPLE.filter(x => x.role === 'parent')) {
    const have = await rest('bookings?select=id&pet_parent_id=eq.' + ids[p.key]);
    if (have?.length) continue;
    const sitterKey = p.bookWith + 'Sitter';
    const price = PUNE_PEOPLE.find(x => x.key === p.bookWith).services[0][1] * 100;
    const base = {
      pet_parent_id: ids[p.key], sitter_id: ids[sitterKey], pet_id: ids[p.key + 'Pet'], city_id: city.id,
      service_type: 'walk30', time_slot: '07:00 AM', gross_amount_paise: price, sitter_payout_paise: price,
      address_flat: p.address.flat, address_society: p.address.society, address_area: p.area.name, address_pincode: p.area.pincode,
    };
    const rows = [
      { ...base, booking_date: isoDate(3), status: 'confirmed', payment_status: 'paid', booking_ref: 'PUN' + Math.floor(100000 + Math.random() * 900000), start_otp: String(1000 + Math.floor(Math.random() * 9000)) },
      { ...base, booking_date: isoDate(-2), status: 'completed', payment_status: 'paid', booking_ref: 'PUN' + Math.floor(100000 + Math.random() * 900000), completed_at: new Date(Date.now() - 2 * 864e5).toISOString() },
    ];
    try { await rest('bookings', 'POST', rows, 'return=minimal'); }
    catch (e) {
      if (!/column|schema cache/i.test(e.message)) throw e;
      notes.add('Run migration 035 to store the booking area and pincode.');
      await rest('bookings', 'POST', rows.map(({ address_area, address_pincode, ...r }) => r), 'return=minimal');
    }
    report.push('2 bookings for ' + p.name);
  }
  return report;
}

async function enrichProfiles(authUsers, notes) {
  const report = [];
  const ids = authUsers.map(u => u.id);
  if (!ids.length) return report;
  const sitters = await rest('sitter_profiles?select=*&user_id=in.(' + ids.join(',') + ')');
  const users = await rest('users?select=id,name&id=in.(' + ids.join(',') + ')');
  const cities = await rest('cities?select=id,name');
  const nameOf = Object.fromEntries(users.map(u => [u.id, u.name || '']));
  const cityOf = Object.fromEntries(cities.map(c => [c.id, c.name]));
  const counters = {};

  await Promise.all(sitters.map(async (s) => {
    const name = nameOf[s.user_id] || 'Sitter';
    const city = cityOf[s.city_id] === 'Pune' ? 'Pune' : 'Gurgaon';
    const hindi = /[ऀ-ॿ]/.test(name);
    const pool = PROFILE_POOL[city][hindi ? 'hi' : 'en'];
    const i = (counters[city + hindi] = (counters[city + hindi] || 0) + 1) - 1;
    const pick = pool[i % pool.length];
    const fields = {};
    if (!s.bio || s.bio.length < 120) fields.bio = pick.bio;
    if (!s.headline) fields.headline = pick.headline;
    if (!s.highlights?.length) fields.highlights = pick.highlights;
    if (!s.base_area) Object.assign(fields, { base_area: pick.area.name, base_pincode: pick.area.pincode, lat: pick.area.lat, lng: pick.area.lng });
    if (!s.experience_years) Object.assign(fields, { experience_years: pick.years, experience_text: pick.years + ' years' });
    if (!s.languages?.length) fields.languages = hindi ? ['Hindi'] : ['English', 'Hindi'];
    const added = [];
    if (!s.profile_photo_url) {
      const face = await storeImage(pick.face, 'test-seed/face-' + s.id + '.jpg');
      if (face) { fields.profile_photo_url = face; added.push('face photo'); }
    }
    const photos = await rest('sitter_profile_photos?select=id&sitter_id=eq.' + s.id);
    if ((photos?.length || 0) < 2) {
      const urls = [];
      for (let n = photos.length; n < 2; n++) {
        const u = await storeImage(await randomDogUrl(), 'test-seed/dog-' + s.id + '-' + n + '.jpg');
        if (u) urls.push({ sitter_id: s.id, photo_url: u, display_order: n });
      }
      if (urls.length) { await rest('sitter_profile_photos', 'POST', urls, 'return=minimal'); added.push(urls.length + ' dog photos'); }
    }
    if (Object.keys(fields).length) {
      fields.profile_updated_at = new Date().toISOString();
      await patchSitter(s.id, fields, notes);
    }
    const changed = Object.keys(fields).filter(k => !['lat', 'lng', 'base_pincode', 'experience_text', 'profile_updated_at', 'profile_photo_url'].includes(k));
    report.push(name + ': ' + ([...changed, ...added].join(', ') || 'already complete'));
  }));
  return report.sort();
}

async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Use POST' }); return; }
  if (!SERVICE_KEY) { res.status(500).json({ error: 'Server is not configured' }); return; }

  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) { res.status(401).json({ error: 'Sign in first' }); return; }
    const who = await fetch(SUPABASE_URL + '/auth/v1/user', { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + token } });
    if (!who.ok) { res.status(401).json({ error: 'Session expired, sign in again' }); return; }
    const caller = await who.json();
    const adminRow = await rest('users?select=is_admin&id=eq.' + encodeURIComponent(caller.id));
    if (!adminRow?.[0]?.is_admin) { res.status(403).json({ error: 'Admins only' }); return; }
    let aal = 'aal1';
    try { aal = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).aal || 'aal1'; } catch { /* malformed token */ }
    if (process.env.ADMIN_REQUIRE_2FA === 'true' && aal !== 'aal2') { res.status(403).json({ error: 'Two-step sign-in required' }); return; }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const step = body.step;
    if (!['pune', 'profiles'].includes(step)) { res.status(400).json({ error: 'step must be "pune" or "profiles"' }); return; }

    const list = await json(await api('/auth/v1/admin/users?per_page=1000'));
    const testUsers = (list?.users || []).filter(u => TEST_EMAIL.test(u.email || ''));
    const notes = new Set();
    const report = step === 'pune' ? await seedPune(testUsers, notes) : await enrichProfiles(testUsers, notes);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ step, report, notes: [...notes] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
module.exports.config = { maxDuration: 60 };
module.exports.TEST_EMAIL = TEST_EMAIL;
