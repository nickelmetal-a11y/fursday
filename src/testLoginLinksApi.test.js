// Security rules for api/test-login-links.js: admins only, test accounts only.
const path = require('path');

const mkRes = () => {
  const res = { headers: {}, statusCode: null, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
};

let handler;
let generated;
const authUsers = [
  { id: 'u-test-1', email: 'fursday.test.parent.ananya@example.com' },
  { id: 'u-test-2', email: 'fursday.test.sitter.priya@example.com' },
  { id: 'u-real', email: 'real.customer@gmail.com' },
];

const fakeFetch = (isAdmin) => async (url, opts = {}) => {
  const ok = (b) => ({ ok: true, status: 200, json: async () => b });
  if (url.endsWith('/auth/v1/user')) return opts.headers.Authorization === 'Bearer good' ? ok({ id: 'u-admin' }) : { ok: false, status: 401, json: async () => ({}) };
  if (url.includes('/rest/v1/users?select=is_admin')) return ok([{ is_admin: isAdmin }]);
  if (url.includes('/auth/v1/admin/users')) return ok({ users: authUsers });
  if (url.includes('/rest/v1/users?select=id,name')) return ok([{ id: 'u-test-1', name: 'Ananya (TEST)' }, { id: 'u-test-2', name: 'Priya (TEST)' }]);
  if (url.includes('/rest/v1/sitter_profiles')) return ok([{ user_id: 'u-test-2', status: 'active' }]);
  if (url.includes('/auth/v1/admin/generate_link')) { const { email } = JSON.parse(opts.body); generated.push(email); return ok({ action_link: 'https://link.test/' + email }); }
  throw new Error('unexpected ' + url);
};

beforeEach(() => {
  jest.resetModules();
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  handler = require(path.join(__dirname, '..', 'api', 'test-login-links.js'));
  generated = [];
});

test('refuses without a session', async () => {
  global.fetch = fakeFetch(true);
  const res = mkRes();
  await handler({ method: 'POST', headers: {} }, res);
  expect(res.statusCode).toBe(401);
});

test('refuses a signed-in non-admin', async () => {
  global.fetch = fakeFetch(false);
  const res = mkRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer good' } }, res);
  expect(res.statusCode).toBe(403);
  expect(generated).toHaveLength(0);
});

test('makes links only for fake test accounts, never a real customer', async () => {
  global.fetch = fakeFetch(true);
  const res = mkRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer good', origin: 'https://fursday-admin.vercel.app' } }, res);
  expect(res.statusCode).toBe(200);
  expect(generated).toEqual(['fursday.test.parent.ananya@example.com', 'fursday.test.sitter.priya@example.com']);
  expect(res.body.accounts.map(a => [a.name, a.role])).toEqual([['Ananya (TEST)', 'parent'], ['Priya (TEST)', 'sitter']]);
  expect(res.headers['Access-Control-Allow-Origin']).toBe('https://fursday-admin.vercel.app');
});

test('does not grant CORS to unknown sites', async () => {
  global.fetch = fakeFetch(true);
  const res = mkRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer good', origin: 'https://evil.example' } }, res);
  expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
});
