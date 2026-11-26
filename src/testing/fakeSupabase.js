// In-memory stand-in for the Supabase client, used by the scenario tests in
// src/scenarios/. Real screens run against it unchanged, so a scenario can
// play the parent, switch to the sitter, then the admin, and inspect the rows
// each action actually wrote. It does not reproduce Postgres RLS; security
// rules are checked separately against the live database.

let tables = {};
let currentUser = null;
let idCounter = 0;
let rpcHandlers = {};
let channels = [];
const authListeners = new Set();

const newId = () => 'id-' + (++idCounter);
const clone = (v) => JSON.parse(JSON.stringify(v));

export const db = {
  reset(seed = {}) {
    tables = clone(seed);
    currentUser = null;
    idCounter = 0;
    rpcHandlers = { ...defaultRpcs };
    channels = [];
  },
  table(name) { return (tables[name] = tables[name] || []); },
  rows(name, where = {}) { return db.table(name).filter(r => Object.entries(where).every(([k, v]) => r[k] === v)); },
  one(name, where) { return db.rows(name, where)[0]; },
  insert(name, row) { const r = { id: newId(), created_at: new Date().toISOString(), ...row }; db.table(name).push(r); return r; },
  signInAs(userId) {
    const u = db.one('users', { id: userId });
    currentUser = userId ? { id: userId, email: u?.email || userId + '@test.example' } : null;
    authListeners.forEach(fn => fn(currentUser ? 'SIGNED_IN' : 'SIGNED_OUT', currentUser ? { user: currentUser } : null));
  },
  get user() { return currentUser; },
  onRpc(name, fn) { rpcHandlers[name] = fn; },
  channelCount() { return channels.length; },
};

// --- relations: which column links a row to an embedded table -------------
function resolveEmbed(parentTable, row, embedTable) {
  if (embedTable === 'sitter_services' || embedTable === 'sitter_profile_photos') {
    return db.table(embedTable).filter(r => r.sitter_id === row.id);
  }
  const fkByTable = {
    users: ['user_id', 'pet_parent_id', 'reviewer_id', 'reported_by'],
    sitter_profiles: ['sitter_id'],
    bookings: ['booking_id'],
    cities: ['city_id'],
    pet_profiles: ['pet_id'],
  };
  const fk = (fkByTable[embedTable] || [embedTable.replace(/s$/, '') + '_id']).find(c => row[c] !== undefined);
  if (!fk || row[fk] == null) return null;
  return db.table(embedTable).find(r => r.id === row[fk]) || null;
}

function parseSelect(str) {
  const embeds = [];
  let depth = 0, start = -1, name = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(') { if (depth === 0) { name = str.slice(0, i).split(',').pop().trim(); start = i + 1; } depth++; }
    else if (c === ')') { depth--; if (depth === 0) embeds.push({ table: name.split('!')[0].split(':').pop(), inner: str.slice(start, i) }); }
  }
  return embeds;
}

function withEmbeds(parentTable, row, selectStr) {
  const out = { ...row };
  for (const e of parseSelect(selectStr || '')) {
    const v = resolveEmbed(parentTable, row, e.table);
    out[e.table] = Array.isArray(v) ? v.map(x => withEmbeds(e.table, x, e.inner)) : v ? withEmbeds(e.table, v, e.inner) : null;
  }
  return out;
}

// --- query builder ----------------------------------------------------------
function builder(tableName) {
  const filters = [];
  let mode = 'select', payload = null, selectStr = '*', returning = false;
  let orderBy = null, limitN = null, single = false, maybe = false, upsertKey = null;

  const api = {
    select(s = '*') { if (mode === 'select') selectStr = s; else { returning = true; selectStr = s; } return api; },
    insert(rows) { mode = 'insert'; payload = rows; return api; },
    upsert(rows, opts = {}) { mode = 'upsert'; payload = rows; upsertKey = opts.onConflict || 'id'; return api; },
    update(fields) { mode = 'update'; payload = fields; return api; },
    delete() { mode = 'delete'; return api; },
    eq(c, v) { filters.push(r => r[c] === v); return api; },
    neq(c, v) { filters.push(r => r[c] !== v); return api; },
    in(c, vs) { filters.push(r => vs.includes(r[c])); return api; },
    is(c, v) { filters.push(r => (v === null ? r[c] == null : r[c] === v)); return api; },
    not(c, op, v) { filters.push(r => (op === 'is' && v === null ? r[c] != null : r[c] !== v)); return api; },
    gte(c, v) { filters.push(r => r[c] >= v); return api; },
    lte(c, v) { filters.push(r => r[c] <= v); return api; },
    gt(c, v) { filters.push(r => r[c] > v); return api; },
    lt(c, v) { filters.push(r => r[c] < v); return api; },
    ilike(c, v) { const re = new RegExp('^' + v.replace(/%/g, '.*') + '$', 'i'); filters.push(r => re.test(r[c] || '')); return api; },
    or() { return api; },
    order(c, { ascending = true } = {}) { orderBy = { c, ascending }; return api; },
    limit(n) { limitN = n; return api; },
    range(a, b) { limitN = b - a + 1; return api; },
    single() { single = true; return api; },
    maybeSingle() { single = true; maybe = true; return api; },
    then(resolve, reject) { return Promise.resolve().then(run).then(resolve, reject); },
  };

  function finish(rows) {
    let data = rows.map(r => withEmbeds(tableName, r, selectStr));
    if (orderBy) data.sort((a, b) => (a[orderBy.c] > b[orderBy.c] ? 1 : -1) * (orderBy.ascending ? 1 : -1));
    if (limitN != null) data = data.slice(0, limitN);
    if (single) {
      if (data.length === 1) return { data: data[0], error: null };
      if (data.length === 0 && maybe) return { data: null, error: null };
      return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
    }
    return { data, error: null };
  }

  function run() {
    const t = db.table(tableName);
    const match = r => filters.every(f => f(r));
    if (mode === 'select') return finish(t.filter(match));
    const list = Array.isArray(payload) ? payload : [payload];
    if (mode === 'insert') {
      const added = list.map(p => db.insert(tableName, p));
      added.forEach(r => fire(tableName, 'INSERT', r));
      return returning ? finish(added) : { data: null, error: null };
    }
    if (mode === 'upsert') {
      const out = list.map(p => {
        const existing = t.find(r => r[upsertKey] !== undefined && r[upsertKey] === p[upsertKey]);
        if (existing) { Object.assign(existing, p); fire(tableName, 'UPDATE', existing); return existing; }
        const r = db.insert(tableName, p); fire(tableName, 'INSERT', r); return r;
      });
      return returning ? finish(out) : { data: null, error: null };
    }
    if (mode === 'update') {
      const changed = t.filter(match);
      changed.forEach(r => { Object.assign(r, payload); fire(tableName, 'UPDATE', r); });
      return returning ? finish(changed) : { data: null, error: null };
    }
    if (mode === 'delete') {
      const keep = t.filter(r => !match(r));
      tables[tableName] = keep;
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }
  return api;
}

// Mirrors trigger reviews_refresh_sitter_rating (migration 032).
function afterWrite(table, row) {
  if (table !== 'reviews' || !row?.sitter_id) return;
  const list = db.rows('reviews', { sitter_id: row.sitter_id });
  const sp = db.one('sitter_profiles', { id: row.sitter_id });
  if (!sp) return;
  const avg = list.length ? Math.round((list.reduce((a, r) => a + (r.rating || 0), 0) / list.length) * 100) / 100 : 0;
  Object.assign(sp, { review_count: list.length, avg_rating: avg, rating: avg });
}

function fire(table, event, row) {
  afterWrite(table, row);
  channels.forEach(ch => ch.handlers.forEach(h => {
    if (h.config.table && h.config.table !== table) return;
    if (h.config.event && h.config.event !== '*' && h.config.event !== event) return;
    if (h.config.filter) {
      const [col, rest] = h.config.filter.split('=');
      const val = rest.replace(/^eq\./, '');
      if (String(row[col]) !== val) return;
    }
    h.cb({ eventType: event, new: { ...row } });
  }));
}

// --- RPCs mirroring the SQL functions in supabase/migrations ---------------
const defaultRpcs = {
  get_user_contact: ({ target_id }) => {
    const u = db.one('users', { id: target_id });
    return u ? [{ phone: u.phone || null, email: u.email || null }] : [];
  },
  is_admin_user: () => !!(currentUser && db.one('users', { id: currentUser.id })?.is_admin),
  preview_promo: ({ p_code, p_amount_rupees }) => {
    const p = db.table('promo_codes').find(x => x.code.toUpperCase() === String(p_code).toUpperCase() && x.status === 'active');
    if (!p) return { error: 'invalid' };
    if (currentUser && db.rows('promo_usage', { promo_id: p.id, user_id: currentUser.id }).length) return { error: 'already_used' };
    if (p.min_booking_amount && p_amount_rupees < p.min_booking_amount) return { error: 'min_amount', min_amount: p.min_booking_amount };
    let d = Math.max(p.discount_amount || 0, ((p.discount_percent || 0) * p_amount_rupees) / 100);
    if (p.max_discount_amount) d = Math.min(d, p.max_discount_amount);
    return { promo_id: p.id, code: p.code, discount: Math.round(Math.min(d, p_amount_rupees)) };
  },
  apply_promo_to_booking: ({ p_booking_id, p_code }) => {
    const b = db.one('bookings', { id: p_booking_id });
    if (!b || b.pet_parent_id !== currentUser?.id) return { error: 'not_your_booking' };
    const prev = defaultRpcs.preview_promo({ p_code, p_amount_rupees: b.sitter_payout_paise / 100 });
    if (prev.error) return prev;
    b.gross_amount_paise = Math.max(0, b.sitter_payout_paise - prev.discount * 100);
    db.insert('promo_usage', { promo_id: prev.promo_id, user_id: currentUser.id, booking_id: b.id });
    return prev;
  },
};

// --- the client ----------------------------------------------------------------
export const supabase = {
  from: (t) => builder(t),
  rpc: (name, args) => {
    const h = rpcHandlers[name];
    if (!h) return Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'Could not find the function ' + name } });
    try { return Promise.resolve({ data: h(args || {}), error: null }); }
    catch (e) { return Promise.resolve({ data: null, error: { message: e.message } }); }
  },
  auth: {
    getUser: () => Promise.resolve({ data: { user: currentUser }, error: null }),
    getSession: () => Promise.resolve({ data: { session: currentUser ? { user: currentUser } : null }, error: null }),
    onAuthStateChange: (fn) => { authListeners.add(fn); return { data: { subscription: { unsubscribe: () => authListeners.delete(fn) } } }; },
    signOut: () => { db.signInAs(null); return Promise.resolve({ error: null }); },
    signInWithOtp: () => Promise.resolve({ error: null }),
    verifyOtp: () => Promise.resolve({ data: { user: currentUser }, error: null }),
    mfa: {
      getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: 'aal1', nextLevel: 'aal1' } }),
      listFactors: () => Promise.resolve({ data: { totp: [], all: [] } }),
    },
  },
  storage: {
    from: (bucket) => ({
      upload: (path) => { db.insert('_storage', { bucket, path }); return Promise.resolve({ data: { path }, error: null }); },
      getPublicUrl: (path) => ({ data: { publicUrl: 'https://storage.test/' + bucket + '/' + path } }),
    }),
  },
  channel: (name) => {
    const ch = { name, handlers: [] };
    ch.on = (_type, config, cb) => { ch.handlers.push({ config: config || {}, cb }); return ch; };
    ch.subscribe = () => { channels.push(ch); return ch; };
    ch.unsubscribe = () => { channels = channels.filter(c => c !== ch); };
    return ch;
  },
  removeChannel: (ch) => { channels = channels.filter(c => c !== ch); return Promise.resolve(); },
};

export const sendLocalNotification = () => {};
export const requestNotifications = () => Promise.resolve();
