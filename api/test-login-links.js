// Admin-only: one-time magic login links for the seeded TEST accounts, so the
// owner can try the app as any test parent or sitter on a phone. Hard rules:
//   1. The caller must send a Supabase access token for a users.is_admin account.
//   2. Links are only ever made for emails matching TEST_EMAIL (fake
//      @example.com addresses); real customers can never be impersonated.
// Uses SUPABASE_SERVICE_ROLE_KEY, which exists only in Vercel's server env.

const SUPABASE_URL = 'https://vucboyiklqdxpqbpfplt.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = 'https://fursday.vercel.app';
const ALLOWED_ORIGINS = ['https://fursday-admin.vercel.app', 'http://localhost:3000'];
// example.com is reserved (RFC 2606): no real person can sign up with it.
const TEST_EMAIL = /@example\.com$/i;

const admin = (path, options = {}) => fetch(SUPABASE_URL + path, {
  ...options,
  headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY, 'Content-Type': 'application/json', ...(options.headers || {}) },
});

module.exports = async function handler(req, res) {
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
    const adminRow = await (await admin('/rest/v1/users?select=is_admin&id=eq.' + encodeURIComponent(caller.id))).json();
    if (!adminRow?.[0]?.is_admin) { res.status(403).json({ error: 'Admins only' }); return; }
    // Phase 1: same rule as migration 034, admin actions need a two-factor session.
    let aal = 'aal1';
    try { aal = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).aal || 'aal1'; } catch { /* malformed token */ }
    if (process.env.ADMIN_REQUIRE_2FA === 'true' && aal !== 'aal2') { res.status(403).json({ error: 'Two-step sign-in required' }); return; }

    const list = await (await admin('/auth/v1/admin/users?per_page=1000')).json();
    const testUsers = (list.users || []).filter(u => TEST_EMAIL.test(u.email || ''));
    if (testUsers.length === 0) { res.status(200).json({ accounts: [] }); return; }

    const ids = testUsers.map(u => u.id).join(',');
    const profiles = await (await admin('/rest/v1/users?select=id,name&id=in.(' + ids + ')')).json();
    const sitters = await (await admin('/rest/v1/sitter_profiles?select=user_id,status&user_id=in.(' + ids + ')')).json();
    const nameById = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
    const sitterByUser = Object.fromEntries((sitters || []).map(s => [s.user_id, s.status]));

    const accounts = [];
    for (const u of testUsers) {
      const r = await admin('/auth/v1/admin/generate_link', {
        method: 'POST',
        body: JSON.stringify({ type: 'magiclink', email: u.email, redirect_to: APP_URL }),
      });
      const body = await r.json();
      const link = body.action_link || body.properties?.action_link;
      accounts.push({
        name: nameById[u.id] || u.email,
        email: u.email,
        role: sitterByUser[u.id] ? 'sitter' : 'parent',
        sitterStatus: sitterByUser[u.id] || null,
        link: link || null,
        error: link ? null : (body.msg || body.error || 'Could not create link'),
      });
    }
    accounts.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'parent' ? -1 : 1));
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ accounts, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
