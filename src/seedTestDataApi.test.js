// Rules for api/seed-test-data.js: admins only, @example.com accounts only,
// safe to run twice, and real customers are never touched.
const path = require('path');

const mkRes = () => {
  const res = { headers: {}, statusCode: null, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
};
const TOKEN = 'Bearer h.' + Buffer.from(JSON.stringify({ sub: 'u-admin', aal: 'aal1' })).toString('base64url') + '.s';

let db, authUsers, isAdmin, createdAuth, handler;
const reply = (status, body) => ({ ok: status < 400, status, text: async () => (body === undefined ? '' : JSON.stringify(body)), json: async () => body, arrayBuffer: async () => new ArrayBuffer(4), headers: { get: () => 'image/png' } });

// Tiny PostgREST stand-in: eq / in filters, POST (with merge-duplicates), PATCH.
function restCall(url, opts) {
  const u = new URL(url);
  const table = u.pathname.replace('/rest/v1/', '');
  const rows = (db[table] = db[table] || []);
  const filters = [...u.searchParams.entries()].filter(([k]) => !['select', 'on_conflict'].includes(k));
  const match = (r) => filters.every(([k, v]) => v.startsWith('eq.') ? String(r[k]) === v.slice(3) : v.startsWith('in.(') ? v.slice(4, -1).split(',').includes(String(r[k])) : true);
  const method = opts.method || 'GET';
  if (method === 'GET') return reply(200, rows.filter(match));
  const body = JSON.parse(opts.body);
  if (method === 'PATCH') { rows.filter(match).forEach(r => Object.assign(r, body)); return reply(200, rows.filter(match)); }
  const list = (Array.isArray(body) ? body : [body]).map(r => ({ id: r.id || table + '-' + (rows.length + 1), ...r }));
  const conflict = u.searchParams.get('on_conflict');
  const out = list.map(r => {
    const existing = conflict && rows.find(x => x[conflict] === r[conflict]);
    if (existing) return Object.assign(existing, r);
    rows.push(r); return r;
  });
  return reply(201, out);
}

const fakeFetch = async (url, opts = {}) => {
  if (url.endsWith('/auth/v1/user')) return reply(200, { id: 'u-admin' });
  if (url.includes('/rest/v1/users?select=is_admin')) return reply(200, [{ is_admin: isAdmin }]);
  if (url.includes('/auth/v1/admin/users?')) return reply(200, { users: authUsers });
  if (url.endsWith('/auth/v1/admin/users')) {
    const { email } = JSON.parse(opts.body);
    const user = { id: 'auth-' + email.split('@')[0], email };
    authUsers.push(user); createdAuth.push(email);
    return reply(200, user);
  }
  if (url.includes('/storage/v1/object/')) return reply(200, {});
  if (url.includes('dog.ceo')) return reply(200, { message: 'https://images.dog.test/1.jpg' });
  if (url.startsWith('https://images.') || url.includes('dicebear')) return reply(200, {});
  if (url.includes('/rest/v1/')) return restCall(url, opts);
  throw new Error('unexpected ' + url);
};

beforeEach(() => {
  jest.resetModules();
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  handler = require(path.join(__dirname, '..', 'api', 'seed-test-data.js'));
  isAdmin = true; createdAuth = [];
  authUsers = [{ id: 'u-real', email: 'real.customer@gmail.com' }, { id: 'u-priya', email: 'fursday.test.sitter.priya@example.com' }];
  db = {
    cities: [{ id: 'c-ncr', name: 'Gurgaon' }, { id: 'c-pune', name: 'Pune' }],
    users: [{ id: 'u-real', name: 'Real Sitter' }, { id: 'u-priya', name: 'Priya Kapoor (TEST)' }],
    sitter_profiles: [
      { id: 'sp-real', user_id: 'u-real', city_id: 'c-ncr', status: 'active', bio: 'short' },
      { id: 'sp-priya', user_id: 'u-priya', city_id: 'c-ncr', status: 'active', bio: 'short' },
    ],
    sitter_profile_photos: [], sitter_services: [], pet_profiles: [], bookings: [], sitter_pii: [],
  };
  global.fetch = fakeFetch;
});

const run = async (step) => { const res = mkRes(); await handler({ method: 'POST', headers: { authorization: TOKEN }, body: { step } }, res); return res; };

test('refuses a signed-in non-admin and changes nothing', async () => {
  isAdmin = false;
  const res = await run('pune');
  expect(res.statusCode).toBe(403);
  expect(createdAuth).toHaveLength(0);
});

test('pune step creates only @example.com accounts with sitters, pets and bookings; a second run reuses them', async () => {
  const res = await run('pune');
  expect(res.statusCode).toBe(200);
  expect(createdAuth).toHaveLength(8);
  expect(createdAuth.every(e => e.endsWith('@example.com'))).toBe(true);
  const puneSitters = db.sitter_profiles.filter(s => s.city_id === 'c-pune');
  expect(puneSitters).toHaveLength(5);
  expect(puneSitters.find(s => s.base_area === 'Koregaon Park')).toMatchObject({ service_radius_km: 6, status: 'active' });
  expect(puneSitters.every(s => s.headline && s.bio.length > 120)).toBe(true);
  const host = puneSitters.find(s => s.provider_type === 'boarding');
  expect(host).toMatchObject({ base_area: 'Wakad', status: 'active', home_details: expect.objectContaining({ home_type: 'independent_house', max_dogs: 2 }) });
  expect(host.home_photos).toHaveLength(3);
  expect(puneSitters.filter(s => s.provider_type === 'sitter')).toHaveLength(4);
  expect(db.pet_profiles).toHaveLength(3);
  expect(db.bookings).toHaveLength(6);
  expect(db.bookings.every(b => b.city_id === 'c-pune' && b.address_area)).toBe(true);

  createdAuth = [];
  await run('pune');
  expect(createdAuth).toHaveLength(0);
  expect(db.sitter_profiles.filter(s => s.city_id === 'c-pune')).toHaveLength(5);
  expect(db.bookings).toHaveLength(6);
});

test('profiles step enriches TEST sitters only, never a real customer', async () => {
  const res = await run('profiles');
  expect(res.statusCode).toBe(200);
  const priya = db.sitter_profiles.find(s => s.id === 'sp-priya');
  expect(priya.headline).toBeTruthy();
  expect(priya.highlights.length).toBeGreaterThan(0);
  expect(priya.bio.length).toBeGreaterThan(120);
  expect(priya.base_area).toBeTruthy();
  expect(priya.profile_photo_url).toMatch(/sitter-photos\/test-seed\//);
  expect(db.sitter_profile_photos.filter(p => p.sitter_id === 'sp-priya')).toHaveLength(2);
  expect(db.sitter_profiles.find(s => s.id === 'sp-real')).toEqual({ id: 'sp-real', user_id: 'u-real', city_id: 'c-ncr', status: 'active', bio: 'short' });
  expect(res.body.report.join(' ')).toMatch(/Priya Kapoor \(TEST\): .*headline/);
});

test('pune step still saves sitters when migration 037 has not run', async () => {
  const realFetch = global.fetch;
  global.fetch = async (url, opts = {}) => (opts.method === 'PATCH' && /provider_type|home_details/.test(opts.body || '')
    ? reply(400, { message: "Could not find the 'home_details' column of 'sitter_profiles' in the schema cache" })
    : realFetch(url, opts));
  const res = await run('pune');
  expect(res.statusCode).toBe(200);
  expect(res.body.notes.join(' ')).toMatch(/migration 037/);
  const host = db.sitter_profiles.find(s => s.base_area === 'Wakad');
  expect(host).toMatchObject({ status: 'active', headline: expect.any(String) });
  expect(host.provider_type).toBeUndefined();
});

test('rejects an unknown step', async () => {
  const res = await run('everything');
  expect(res.statusCode).toBe(400);
});
