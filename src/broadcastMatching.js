// Who should hear about a parent's "send to nearby carers" request, and when
// the search widens. Pure functions only, so the rules are easy to test.
import { pointFor, sitterCovers } from './geo';
import { isSitterAvailable, toISODate } from './AvailabilityCalendar';

// Labels shared by the parent's request screens and the sitter's feed.
export const TIME_SLOTS = ['6:00 AM', '7:00 AM', '8:00 AM', '10:00 AM', '11:00 AM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'];

export function formatLeft(ms, tr) {
  const mins = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? tr('nearby_hm', { h, m }) : tr('nearby_m', { m });
}

export const WAVES = [
  { wave: 1, radiusKm: 5 },
  { wave: 2, radiusKm: 8 },
  { wave: 3, radiusKm: 12 },
];
export const WAVE_SIZE = 8;
export const WAVE_GAP_MS = 15 * 60 * 1000;
export const URGENT_WINDOW_MS = 2 * 60 * 60 * 1000;
export const COMPARE_WINDOW_MS = 12 * 60 * 60 * 1000;
const MIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_NIGHTS = 30;
export const NIGHT_SERVICES = ['boarding', 'housesit'];

export const waveRadius = (wave) => (WAVES.find(w => w.wave === Number(wave)) || WAVES[WAVES.length - 1]).radiusKm;
export const lastWave = WAVES[WAVES.length - 1].wave;

const parseISO = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

export function petSize(pet) {
  if (pet?.size) return String(pet.size).toLowerCase();
  const kg = Number(pet?.weight_kg);
  if (!kg) return null;
  return kg < 10 ? 'small' : kg <= 25 ? 'medium' : 'large';
}

export function petSummary(pet) {
  if (!pet) return {};
  return {
    name: pet.name || null, breed: pet.breed || null, size: petSize(pet),
    age_years: pet.age_years ?? null, weight_kg: pet.weight_kg ?? null, gender: pet.gender || null,
    energy: pet.energy_level || null, strangers: pet.behavior_strangers || null, leash: pet.behavior_leash || null,
    notes: pet.notes || null,
  };
}

// Boarding and house-sitting need every night from the start date up to the
// night before the end date; other services need just the one day.
export function requestDates(startISO, endISO, service) {
  if (!startISO) return [];
  const start = String(startISO).slice(0, 10);
  const end = endISO ? String(endISO).slice(0, 10) : null;
  if (!NIGHT_SERVICES.includes(service) || !end || end <= start) return [start];
  const out = [];
  for (const d = parseISO(start); toISODate(d) < end && out.length < MAX_NIGHTS; d.setDate(d.getDate() + 1)) out.push(toISODate(d));
  return out;
}

export function startsAt(dateISO, time) {
  if (!dateISO) return null;
  const d = parseISO(dateISO);
  const m = String(time || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (m) {
    let h = Number(m[1]);
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    d.setHours(h, Number(m[2] || 0), 0, 0);
  }
  return d;
}

// Urgent requests stay open about 2 hours, compare requests about 12, but
// never past the start time (with a short minimum so it can still be answered).
export function expiryFor(mode, start, now = new Date()) {
  const t = +now;
  let end = t + (mode === 'urgent' ? URGENT_WINDOW_MS : COMPARE_WINDOW_MS);
  if (start && +start < end) end = Math.max(+start, t + MIN_WINDOW_MS);
  return new Date(end);
}

export const isExpired = (request, now = Date.now()) => !!request?.expires_at && +now >= Date.parse(request.expires_at);

export function requestPoint(request) {
  if (request?.address_lat != null && request?.address_lng != null) return { lat: Number(request.address_lat), lng: Number(request.address_lng) };
  return pointFor({ area: request?.area, pincode: request?.address_pincode });
}

// ── Boarding capacity ──────────────────────────────────────────────────────
// A host can look after home_details.max_dogs (or sitter_profiles.max_dogs)
// dogs a night. Requests still waiting for an answer count too, so two
// parents can't both be promised the last spot. No limit set = no check.
export const CAPACITY_STATUSES = ['pending', 'confirmed', 'active'];
export const dogsOn = (b) => Number(b?.dogs) || (Array.isArray(b?.pet_ids) && b.pet_ids.length) || 1;
export function hostCapacity(sitter) {
  const n = Number(sitter?.home_details?.max_dogs ?? sitter?.max_dogs);
  return n > 0 ? n : null;
}

// { 'YYYY-MM-DD': dogs already staying that night } for one host.
export function dogsByNight(bookings, sitterId) {
  const out = {};
  for (const b of bookings || []) {
    if (sitterId && b.sitter_id !== sitterId) continue;
    if (!CAPACITY_STATUSES.includes(b.status) || !NIGHT_SERVICES.includes(b.service_type)) continue;
    for (const d of requestDates(b.booking_date, b.end_date, b.service_type)) out[d] = (out[d] || 0) + dogsOn(b);
  }
  return out;
}

export function roomOn(sitter, taken, dateISO) {
  const cap = hostCapacity(sitter);
  return cap == null ? Infinity : Math.max(0, cap - ((taken || {})[String(dateISO).slice(0, 10)] || 0));
}

// Night bookings for these hosts between two dates, in the shape dogsByNight
// reads. RLS hides other parents' bookings, so the security-definer RPC
// host_nights_taken is tried first; the plain select is the fallback.
export async function loadNightsTaken(client, sitterIds, fromISO, toISO) {
  const ids = (sitterIds || []).filter(Boolean);
  if (!ids.length) return [];
  try {
    const { data, error } = await client.rpc('host_nights_taken', { p_sitter_ids: ids, p_from: fromISO, p_to: toISO });
    if (!error && Array.isArray(data)) {
      return data.map(r => ({ sitter_id: r.sitter_id, booking_date: String(r.night).slice(0, 10), service_type: 'boarding', status: 'confirmed', dogs: Number(r.dogs) || 1 }));
    }
    const res = await client.from('bookings').select('id, sitter_id, service_type, status, booking_date, end_date, pet_ids').in('sitter_id', ids).in('status', CAPACITY_STATUSES);
    return Array.isArray(res?.data) ? res.data : [];
  } catch (e) {
    return [];
  }
}

function fitsSize(sitter, size) {
  const sizes = sitter?.home_details?.sizes || sitter?.accepted_sizes;
  if (!size || !Array.isArray(sizes) || sizes.length === 0) return true;
  return sizes.map(s => String(s).toLowerCase()).includes(size);
}

const ratingOf = (s) => Number(s?.avg_rating ?? s?.rating ?? 0);

// Carers who can take this request, nearest first, then best rated. A carer
// qualifies if their own travel radius reaches the address or they are within
// the current wave's radius. Carers with no base location are kept, last.
export function matchCarers({ sitters, availability = [], bookings = [], request, radiusKm, exclude = [], ignoreAvailability = false, limit = WAVE_SIZE }) {
  if (!request) return [];
  const radius = radiusKm ?? waveRadius(request.wave || 1);
  const point = requestPoint(request);
  const dates = requestDates(request.scheduled_date, request.end_date, request.service_type);
  const size = request.pet_summary?.size || null;
  const nightly = NIGHT_SERVICES.includes(request.service_type);
  const dogs = Number(request.pet_summary?.dogs) || (Array.isArray(request.pet_ids) && request.pet_ids.length) || 1;
  const out = [];
  for (const s of sitters || []) {
    if (exclude.includes(s.id)) continue;
    if (s.status !== 'active' || s.is_paused) continue;
    if (request.city_id && s.city_id && s.city_id !== request.city_id) continue;
    const svc = (s.sitter_services || []).find(x => x.service_type === request.service_type && x.is_active !== false);
    if (!svc) continue;
    if (!ignoreAvailability) {
      const rows = availability.filter(r => r.sitter_id === s.id);
      if (!dates.length || !dates.every((d, i) => isSitterAvailable(s, rows, d, i === 0 ? request.scheduled_time : null))) continue;
    }
    if (!fitsSize(s, size)) continue;
    if (nightly && hostCapacity(s) != null) {
      const taken = dogsByNight(bookings, s.id);
      if (dates.some(d => roomOn(s, taken, d) < dogs)) continue;
    }
    const cover = point ? sitterCovers(s, point) : { covers: true, km: null };
    const km = cover.km;
    const withinRadius = km != null && cover.covers;
    if (km != null && !cover.covers && km > radius) continue;
    out.push({ sitter: s, km, pricePaise: svc.price_paise, withinRadius, rating: ratingOf(s) });
  }
  out.sort((a, b) => {
    if (a.km == null && b.km != null) return 1;
    if (b.km == null && a.km != null) return -1;
    if (a.km != null && b.km != null && Math.abs(a.km - b.km) > 0.05) return a.km - b.km;
    return b.rating - a.rating;
  });
  return limit ? out.slice(0, limit) : out;
}

// The next wave to send, or null. A wave goes out only while the request is
// open and unexpired, nobody has offered yet, and 15 minutes have passed.
export function nextWave(request, now = Date.now(), { offerCount = 0 } = {}) {
  if (!request || request.status !== 'open' || offerCount > 0 || isExpired(request, now)) return null;
  const next = WAVES.find(w => w.wave === Number(request.wave || 1) + 1);
  if (!next) return null;
  const last = Date.parse(request.last_wave_at || request.created_at);
  if (!Number.isFinite(last) || +now - last < WAVE_GAP_MS) return null;
  return next;
}

// "Fri" for one day, "Fri–Sun" for a stay.
export function dateRangeLabel(startISO, endISO, locale = 'en-IN') {
  if (!startISO) return '';
  const wd = (iso) => parseISO(iso).toLocaleDateString(locale, { weekday: 'short' });
  const day = (iso) => parseISO(iso).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  if (endISO && String(endISO).slice(0, 10) > String(startISO).slice(0, 10)) return wd(startISO) + '–' + wd(endISO);
  return day(startISO);
}
