import { toISODate } from './AvailabilityCalendar';
import {
  matchCarers, nextWave, requestDates, dogsByNight, roomOn, hostCapacity, loadNightsTaken, expiryFor, startsAt, petSize, petSummary, waveRadius, dateRangeLabel, formatLeft,
  WAVE_GAP_MS, URGENT_WINDOW_MS, COMPARE_WINDOW_MS,
} from './broadcastMatching';

jest.mock('./supabase', () => ({ supabase: {} }));

const HOME = { lat: 28.4722, lng: 77.0981 };
// ~1.1 km of latitude per 0.01 degree.
const at = (dLat) => ({ lat: HOME.lat + dLat, lng: HOME.lng });
const sitter = (id, extra = {}) => ({
  id, user_id: 'u-' + id, city_id: 'c1', status: 'active', avg_rating: 4.5,
  sitter_services: [{ service_type: 'walk30', price_paise: 40000, is_active: true }, { service_type: 'boarding', price_paise: 120000, is_active: true }],
  ...at(0.02), ...extra,
});
// The next date (1–7 days ahead) that falls on `weekday` (0 = Sunday).
const nextWeekday = (weekday) => { const d = new Date(); d.setHours(0, 0, 0, 0); do d.setDate(d.getDate() + 1); while (d.getDay() !== weekday); return d; };
const plusDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const WED = toISODate(nextWeekday(3));
const request = (extra = {}) => ({
  id: 'r1', city_id: 'c1', service_type: 'walk30', scheduled_date: WED, scheduled_time: '7:00 AM',
  address_lat: HOME.lat, address_lng: HOME.lng, pet_summary: { size: 'large' }, wave: 1, status: 'open', ...extra,
});
const ids = (list) => list.map(m => m.sitter.id);

describe('matchCarers', () => {
  test('keeps only active, unpaused carers in the same city who offer the service', () => {
    const sitters = [
      sitter('ok'),
      sitter('pending', { status: 'pending' }),
      sitter('paused', { is_paused: true }),
      sitter('pune', { city_id: 'c2' }),
      sitter('noWalks', { sitter_services: [{ service_type: 'boarding', price_paise: 1 }] }),
      sitter('walksOff', { sitter_services: [{ service_type: 'walk30', price_paise: 1, is_active: false }] }),
    ];
    expect(ids(matchCarers({ sitters, request: request() }))).toEqual(['ok']);
  });

  test('respects the weekly schedule, date overrides and the time slot', () => {
    const sitters = [
      sitter('weekdays', { availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }),
      sitter('weekends', { availability_days: ['Sat', 'Sun'] }),
      sitter('blocked'),
      sitter('eveningsOnly', { morning_slot: false }),
    ];
    const availability = [{ sitter_id: 'blocked', date: WED, is_available: false, time_slots: [] }];
    expect(ids(matchCarers({ sitters, availability, request: request() })).sort()).toEqual(['weekdays']);
    expect(ids(matchCarers({ sitters, availability, request: request({ scheduled_time: '6:00 PM' }) })).sort()).toEqual(['eveningsOnly', 'weekdays']);
  });

  test('ignoreAvailability brings back carers who are busy that day', () => {
    const sitters = [sitter('weekends', { availability_days: ['Sat', 'Sun'] })];
    expect(matchCarers({ sitters, request: request() })).toHaveLength(0);
    expect(ids(matchCarers({ sitters, request: request(), ignoreAvailability: true }))).toEqual(['weekends']);
  });

  test('boarding needs every night of the stay', () => {
    const fri = nextWeekday(5);
    const req = request({ service_type: 'boarding', scheduled_date: toISODate(fri), end_date: toISODate(plusDays(fri, 2)) });
    const sitters = [sitter('free'), sitter('busySat')];
    const availability = [{ sitter_id: 'busySat', date: toISODate(plusDays(fri, 1)), is_available: false, time_slots: [] }];
    expect(ids(matchCarers({ sitters, availability, request: req }))).toEqual(['free']);
    expect(ids(matchCarers({ sitters, availability, request: { ...req, end_date: toISODate(plusDays(fri, 1)) } })).sort()).toEqual(['busySat', 'free']);
  });

  test('a host who lists accepted sizes must take the dog\'s size; hosts without sizes are kept', () => {
    const sitters = [
      sitter('smallOnly', { home_details: { sizes: ['small'] } }),
      sitter('anyLarge', { home_details: { sizes: ['Small', 'Large'], max_dogs: 2 } }),
      sitter('noDetails', { home_details: {} }),
      sitter('legacy'),
    ];
    expect(ids(matchCarers({ sitters, request: request() })).sort()).toEqual(['anyLarge', 'legacy', 'noDetails']);
    expect(matchCarers({ sitters, request: request({ pet_summary: {} }) })).toHaveLength(4);
  });

  test('distance: inside the wave radius, or inside the carer\'s own radius; unknown locations go last', () => {
    const sitters = [
      sitter('near', at(0.02)),
      sitter('mid', at(0.06)),
      sitter('midWideRadius', { ...at(0.09), service_radius_km: 15 }),
      sitter('far', at(0.2)),
      sitter('nowhere', { lat: null, lng: null }),
    ];
    const wave1 = matchCarers({ sitters, request: request(), radiusKm: 5 });
    expect(ids(wave1)).toEqual(['near', 'midWideRadius', 'nowhere']);
    expect(wave1.find(m => m.sitter.id === 'midWideRadius').withinRadius).toBe(true);
    expect(wave1[0].km).toBeCloseTo(2.2, 0);
    expect(ids(matchCarers({ sitters, request: request(), radiusKm: 8 }))).toEqual(['near', 'mid', 'midWideRadius', 'nowhere']);
  });

  test('ranks by distance, then rating, caps the wave size and skips carers already invited', () => {
    const sitters = Array.from({ length: 10 }, (_, i) => sitter('s' + i, { ...at(0.01), avg_rating: i / 2 }));
    sitters.push(sitter('closest', at(0.001)));
    const out = matchCarers({ sitters, request: request(), exclude: ['s9'] });
    expect(out).toHaveLength(8);
    expect(ids(out).slice(0, 3)).toEqual(['closest', 's8', 's7']);
    expect(ids(out)).not.toContain('s9');
    expect(out[0].pricePaise).toBe(40000);
  });

  test('falls back to the locality when the request has no exact pin', () => {
    const sitters = [sitter('near', at(0.02))];
    const out = matchCarers({ sitters, request: request({ address_lat: null, address_lng: null, area: 'DLF Phase 1' }) });
    expect(out[0].km).toBeCloseTo(2.2, 0);
  });
});

describe('nextWave', () => {
  const t0 = Date.parse('2026-12-02T10:00:00Z');
  const open = (extra) => ({ status: 'open', wave: 1, last_wave_at: new Date(t0).toISOString(), expires_at: new Date(t0 + COMPARE_WINDOW_MS).toISOString(), ...extra });

  test('widens 5 → 8 → 12 km every 15 minutes while nobody has offered', () => {
    expect(nextWave(open(), t0 + WAVE_GAP_MS - 1000)).toBeNull();
    expect(nextWave(open(), t0 + WAVE_GAP_MS)).toEqual({ wave: 2, radiusKm: 8 });
    expect(nextWave(open({ wave: 2 }), t0 + WAVE_GAP_MS + 1)).toEqual({ wave: 3, radiusKm: 12 });
    expect(nextWave(open({ wave: 3 }), t0 + 5 * WAVE_GAP_MS)).toBeNull();
    expect(waveRadius(1)).toBe(5);
  });

  test('stops once there is an offer, the request is closed or it has expired', () => {
    const later = t0 + 2 * WAVE_GAP_MS;
    expect(nextWave(open(), later, { offerCount: 1 })).toBeNull();
    expect(nextWave(open({ status: 'filled' }), later)).toBeNull();
    expect(nextWave(open({ expires_at: new Date(later - 1).toISOString() }), later)).toBeNull();
    expect(nextWave(open({ last_wave_at: null, created_at: new Date(t0).toISOString() }), later)).toEqual({ wave: 2, radiusKm: 8 });
  });
});

describe('dates, expiry and pets', () => {
  test('requestDates lists each night of a stay, or the single day', () => {
    expect(requestDates('2026-12-04', '2026-12-06', 'boarding')).toEqual(['2026-12-04', '2026-12-05']);
    expect(requestDates('2026-12-04', '2026-12-06', 'walk30')).toEqual(['2026-12-04']);
    expect(requestDates('2026-12-04', null, 'housesit')).toEqual(['2026-12-04']);
    expect(requestDates(null)).toEqual([]);
  });

  test('urgent closes after ~2h, compare after ~12h, never after the start (min 15 min)', () => {
    const now = new Date('2026-12-02T08:00:00');
    expect(+expiryFor('urgent', null, now) - +now).toBe(URGENT_WINDOW_MS);
    expect(+expiryFor('compare', startsAt('2026-12-05', '7:00 AM'), now) - +now).toBe(COMPARE_WINDOW_MS);
    expect(expiryFor('compare', startsAt('2026-12-02', '6:00 PM'), now)).toEqual(new Date('2026-12-02T18:00:00'));
    expect(+expiryFor('urgent', startsAt('2026-12-02', '8:00 AM'), now) - +now).toBe(15 * 60 * 1000);
    expect(startsAt('2026-12-02', '12:00 AM').getHours()).toBe(0);
  });

  test('pet size comes from weight, and the summary snapshots what sitters need', () => {
    expect(petSize({ weight_kg: 6 })).toBe('small');
    expect(petSize({ weight_kg: 18 })).toBe('medium');
    expect(petSize({ weight_kg: 28 })).toBe('large');
    expect(petSize({})).toBeNull();
    expect(petSummary({ name: 'Bruno', breed: 'Labrador', weight_kg: 28, age_years: 3, energy_level: 'hyper', user_id: 'x' }))
      .toMatchObject({ name: 'Bruno', breed: 'Labrador', size: 'large', age_years: 3, energy: 'hyper' });
    expect(petSummary(null)).toEqual({});
  });

  test('labels: weekday range for stays, countdown in hours and minutes', () => {
    expect(dateRangeLabel('2026-12-04', '2026-12-06')).toBe('Fri–Sun');
    expect(dateRangeLabel('2026-12-04')).toMatch(/Fri/);
    const tr = (k, v) => (k === 'nearby_hm' ? v.h + 'h ' + v.m + 'm' : v.m + ' min');
    expect(formatLeft(102 * 60000, tr)).toBe('1h 42m');
    expect(formatLeft(9 * 60000 + 1, tr)).toBe('10 min');
  });
});

describe('boarding capacity', () => {
  const stay = (extra = {}) => request({ service_type: 'boarding', scheduled_date: WED, end_date: toISODate(plusDays(nextWeekday(3), 3)), scheduled_time: null, pet_summary: {}, ...extra });
  const booked = (sitterId, from, to, extra = {}) => ({ sitter_id: sitterId, service_type: 'boarding', status: 'confirmed', booking_date: toISODate(from), end_date: toISODate(to), ...extra });

  test('skips a host who is full on any requested night, keeps one with room', () => {
    const wed = nextWeekday(3);
    const sitters = [sitter('full', { home_details: { max_dogs: 2 } }), sitter('room', { home_details: { max_dogs: 3 } }), sitter('noLimit')];
    // Two dogs already stay Thu night with both hosts.
    const bookings = [
      booked('full', plusDays(wed, 1), plusDays(wed, 2), { pet_ids: ['a', 'b'] }),
      booked('room', plusDays(wed, 1), plusDays(wed, 2), { pet_ids: ['a', 'b'] }),
      booked('noLimit', wed, plusDays(wed, 3), { pet_ids: ['a', 'b', 'c', 'd'] }),
    ];
    expect(ids(matchCarers({ sitters, bookings, request: stay() })).sort()).toEqual(['noLimit', 'room']);
    expect(ids(matchCarers({ sitters, request: stay() })).sort()).toEqual(['full', 'noLimit', 'room']);
  });

  test('pending requests count, cancelled ones and walks do not; a request for two dogs needs two spots', () => {
    const wed = nextWeekday(3);
    const sitters = [sitter('h', { max_dogs: 2 })];
    const pending = [booked('h', wed, plusDays(wed, 1), { status: 'pending' })];
    expect(ids(matchCarers({ sitters, bookings: pending, request: stay() }))).toEqual(['h']);
    expect(ids(matchCarers({ sitters, bookings: pending, request: stay({ pet_summary: { dogs: 2 } }) }))).toEqual([]);
    const ignored = [booked('h', wed, plusDays(wed, 3), { status: 'cancelled', pet_ids: ['a', 'b'] }), { ...booked('h', wed, wed), service_type: 'walk30', pet_ids: ['a', 'b'] }];
    expect(ids(matchCarers({ sitters, bookings: ignored, request: stay({ pet_summary: { dogs: 2 } }) }))).toEqual(['h']);
  });

  test('helpers: dogs per night, room left and capacity', () => {
    const wed = nextWeekday(3);
    const taken = dogsByNight([booked('h', wed, plusDays(wed, 2), { pet_ids: ['a', 'b'] }), booked('h', plusDays(wed, 1), plusDays(wed, 2))], 'h');
    expect(taken).toEqual({ [toISODate(wed)]: 2, [toISODate(plusDays(wed, 1))]: 3 });
    expect(roomOn({ home_details: { max_dogs: 4 } }, taken, toISODate(plusDays(wed, 1)))).toBe(1);
    expect(roomOn({}, taken, toISODate(wed))).toBe(Infinity);
    expect(hostCapacity({ home_details: { max_dogs: 3 }, max_dogs: 1 })).toBe(3);
    expect(hostCapacity({ max_dogs: 0 })).toBeNull();
  });

  test('loadNightsTaken uses the RPC when it exists, else reads bookings', async () => {
    const rpcClient = { rpc: jest.fn().mockResolvedValue({ data: [{ sitter_id: 'h', night: '2026-12-02', dogs: 2 }], error: null }) };
    expect(dogsByNight(await loadNightsTaken(rpcClient, ['h'], '2026-12-01', '2026-12-09'), 'h')).toEqual({ '2026-12-02': 2 });
    const rows = [{ sitter_id: 'h', service_type: 'boarding', status: 'confirmed', booking_date: '2026-12-03', end_date: '2026-12-04' }];
    const chain = { select: () => chain, in: () => chain, then: (r) => Promise.resolve({ data: rows }).then(r) };
    const fallback = { rpc: () => Promise.resolve({ data: null, error: { message: 'Could not find the function' } }), from: () => chain };
    expect(await loadNightsTaken(fallback, ['h'], '2026-12-01', '2026-12-09')).toEqual(rows);
    expect(await loadNightsTaken({}, ['h'], 'a', 'b')).toEqual([]);
  });
});
