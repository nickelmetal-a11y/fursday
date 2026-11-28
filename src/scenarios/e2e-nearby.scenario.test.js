// E2E section B: "Ask all sitters" played through the whole app. The parent
// sends one request from Home, invited sitters answer from Jobs, and the parent
// books the chosen offer. RLS is not reproduced by the fake database, so "not
// invited" is checked on what the sitter's screen shows.
import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import { toISODate } from '../AvailabilityCalendar';
import App from '../App';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../paymentsClient', () => require('../testing/fakePayments'));
jest.mock('../geolocationService', () => ({
  checkLocationRestriction: () => Promise.resolve({ allowed: true, ip: '127.0.0.1' }),
  getLocationRestrictedMessage: () => 'Coming soon to your area',
}));

const RealDate = Date;
function freezeTime(target) {
  const offset = target.getTime() - RealDate.now();
  class MockDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(RealDate.now() + offset); else super(...a); }
    static now() { return RealDate.now() + offset; }
  }
  global.Date = MockDate;
}

const SLOW = { timeout: 8000 };
const MIN = 60 * 1000;
const HOME = { lat: 28.4722, lng: 77.0981 }; // DLF Phase 1
const nextWeekday = (weekday) => { const d = new RealDate(); d.setHours(0, 0, 0, 0); do d.setDate(d.getDate() + 1); while (d.getDay() !== weekday); return d; };
const WED = nextWeekday(3);
const WED_ISO = toISODate(WED);
const dayLabel = (d) => d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const invitedIds = (requestId) => db.rows('broadcast_recipients', { request_id: requestId }).map(r => r.sitter_id);
const notesFor = (userId, type) => db.rows('notifications', { user_id: userId, type });
const place = (id, dLat) => Object.assign(db.one('sitter_profiles', { id }), { lat: HOME.lat + dLat, lng: HOME.lng });

function addSitter(key, { name, dLat, services = [['walk30', 33000]], ...extra }) {
  const userId = 'u-' + key, id = 'sp-' + key;
  if (!db.one('users', { id: userId })) db.table('users').push({ id: userId, name, email: key + '@test.example' });
  db.table('sitter_profiles').push({ id, user_id: userId, city_id: IDS.gurgaon, status: 'active', avg_rating: 4.2, review_count: 2, rating: 4.2,
    ...(dLat != null ? { lat: HOME.lat + dLat, lng: HOME.lng } : {}), ...extra });
  services.forEach(([type, paise], i) => db.table('sitter_services').push({ id: 'svc-' + key + i, sitter_id: id, service_type: type, price_paise: paise, is_active: true }));
  return id;
}

async function openApp(userId) {
  cleanup();
  db.signInAs(userId);
  render(<App />);
  await screen.findByRole('navigation', { name: 'Main' }, SLOW);
}

// Home → "Switch to sitter mode" → Jobs, the way a sitter (who is also a parent account) gets there.
async function openJobs(userId, count) {
  await openApp(userId);
  fireEvent.click(await screen.findByText('Switch to sitter mode', {}, SLOW));
  const tab = await screen.findByRole('button', { name: 'Open requests (' + count + ')' }, SLOW);
  return tab;
}

async function openRequestsTab(userId, count) {
  fireEvent.click(await openJobs(userId, count));
  await waitFor(() => expect(screen.queryByRole('status', { name: /Pet parents near you/ })).toBeNull(), SLOW);
}

async function parentSends({ day = WED, time = '7:00 AM', urgent = false } = {}) {
  await openApp(IDS.meera);
  fireEvent.click(await screen.findByText('Ask all sitters', {}, SLOW));
  fireEvent.click(await screen.findByText('Request a walker'));
  fireEvent.click(screen.getByText('Continue →'));
  fireEvent.click(screen.getByRole('button', { name: dayLabel(day) }));
  fireEvent.click(screen.getByText(time));
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Sheru');
  fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'DLF Phase 1' } });
  fireEvent.click(screen.getByRole('option', { name: /DLF Phase 1/ }));
  fireEvent.click(screen.getByText('Continue →'));
  if (urgent) fireEvent.click(screen.getByText('Urgent: first to accept gets it'));
  fireEvent.click(screen.getByText('Send to nearby carers'));
  await screen.findByText('Your request', {}, SLOW);
  await screen.findByText(/^Sent to \d+ nearby/, {}, SLOW);
  return db.rows('broadcast_requests', { pet_parent_id: IDS.meera }).pop();
}

// Home card "Your request is out" → the request's status screen.
async function parentOpensRequest() {
  await openApp(IDS.meera);
  fireEvent.click(await screen.findByText('Your request is out', {}, SLOW));
  await screen.findByText('Your request', {}, SLOW);
}

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  place(IDS.ram, 0.009);
  place(IDS.priya, 0.02);
  place(IDS.sunita, 0.06);
});

afterEach(() => {
  cleanup();
  global.Date = RealDate;
});

describe('B1: who a new walk request reaches', () => {
  test('wave 1 invites matching sitters within 5 km only; paused, pending, wrong-service, wrong-city, day-off and the parent herself are left out; an NCR sitter filed under Delhi is still matched', async () => {
    db.table('cities').push({ id: 'city-delhi', name: 'Delhi' });
    const paused = addSitter('paused', { name: 'Paused Pal', dLat: 0.01, is_paused: true });
    Object.assign(db.one('sitter_profiles', { id: IDS.vikram }), { city_id: IDS.gurgaon, lat: HOME.lat + 0.01, lng: HOME.lng });
    const boarder = addSitter('boarder', { name: 'Boarding Only', dLat: 0.01, services: [['boarding', 90000]] });
    const pune = addSitter('pune', { name: 'Pune Walker', dLat: 0.01, city_id: IDS.pune });
    const dayOff = addSitter('dayoff', { name: 'Day Off', dLat: 0.01 });
    db.insert('sitter_availability', { sitter_id: dayOff, date: WED_ISO, is_available: false });
    const delhi = addSitter('delhi', { name: 'Delhi Walker', dLat: 0.03, city_id: 'city-delhi' });
    const own = addSitter('meera', { name: 'Meera Iyer', dLat: 0.005 });
    db.one('sitter_profiles', { id: own }).user_id = IDS.meera;

    const req = await parentSends();
    expect(req).toMatchObject({ city_id: IDS.gurgaon, service_type: 'walk30', scheduled_date: WED_ISO, scheduled_time: '7:00 AM', wave: 1, radius_km: 5, status: 'open' });
    expect(invitedIds(req.id)).toEqual([IDS.ram, IDS.priya, delhi]);
    expect(screen.getByText('Sent to 3 nearby · 0 viewed · 0 offers')).toBeInTheDocument();
    expect(screen.getByText('Looking within 5 km')).toBeInTheDocument();
    for (const id of [IDS.sunita, paused, IDS.vikram, boarder, pune, dayOff, own]) expect(invitedIds(req.id)).not.toContain(id);
    expect(notesFor(IDS.priyaUser, 'broadcast_request')).toHaveLength(1);
    expect(notesFor('u-delhi', 'broadcast_request')).toHaveLength(1);
    expect(notesFor(IDS.sunitaUser, 'broadcast_request')).toHaveLength(0);
    expect(notesFor('u-paused', 'broadcast_request')).toHaveLength(0);
  }, 30000);

  test('sitters with no base location set (every live sitter today) are still invited, after the ones whose distance is known', async () => {
    for (const id of [IDS.ram, IDS.sunita]) Object.assign(db.one('sitter_profiles', { id }), { lat: null, lng: null, base_area: null, base_pincode: null });
    const req = await parentSends();
    expect(invitedIds(req.id)).toEqual([IDS.priya, IDS.sunita, IDS.ram]);
    expect(db.one('broadcast_recipients', { request_id: req.id, sitter_id: IDS.ram }).distance_km).toBeNull();

    await openRequestsTab(IDS.ramUser, 1);
    const card = await screen.findByRole('article', { name: /DLF Phase 1/ }, SLOW);
    expect(within(card).queryByText(/km/)).toBeNull();
    expect(within(card).getByRole('button', { name: 'Accept at my price · Rs.350' })).toBeInTheDocument();
  }, 30000);

  test('the weekly schedule decides: a Saturday walk skips Mon–Fri sitters, and a 4 PM walk reaches nobody who left "afternoon" off', async () => {
    const sat = nextWeekday(6);
    let req = await parentSends({ day: sat });
    expect(invitedIds(req.id)).toEqual([IDS.ram]);
    db.one('broadcast_requests', { id: req.id }).status = 'cancelled';

    req = await parentSends({ time: '4:00 PM' });
    expect(req.scheduled_time).toBe('4:00 PM');
    expect(invitedIds(req.id)).toEqual([]);
    expect(await screen.findByText('No one free? Here are the nearest carers', {}, SLOW)).toBeInTheDocument();

    db.one('broadcast_requests', { id: req.id }).status = 'cancelled';
    db.one('sitter_profiles', { id: IDS.priya }).afternoon_slot = true;
    req = await parentSends({ time: '4:00 PM' });
    expect(invitedIds(req.id)).toEqual([IDS.priya]);
  }, 45000);
});

describe('B2/B3: what each sitter sees on Jobs', () => {
  test('B2: the invited sitter sees the request from the Jobs banner; a sitter who was not invited sees an empty list', async () => {
    const req = await parentSends();
    expect(invitedIds(req.id)).not.toContain(IDS.sunita);

    await openJobs(IDS.priyaUser, 1);
    fireEvent.click(screen.getByText('1 open request near you'));
    const card = await screen.findByRole('article', { name: /DLF Phase 1/ }, SLOW);
    expect(within(card).getByText(/^2\.\d km · Indie\/Mixed, medium · Wed/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Accept at my price · Rs.400' })).toBeInTheDocument();
    await waitFor(() => expect(db.one('broadcast_recipients', { request_id: req.id, sitter_id: IDS.priya }).viewed_at).toBeTruthy());

    await openRequestsTab(IDS.sunitaUser, 0);
    expect(await screen.findByText('No requests right now')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: /DLF Phase 1/ })).toBeNull();
    expect(screen.queryByText('1 open request near you')).toBeNull();
  }, 30000);

  test('B3: a paused sitter gets no invite and is told why on Jobs and in the requests list; the notice opens her profile', async () => {
    db.one('sitter_profiles', { id: IDS.priya }).is_paused = true;
    const req = await parentSends();
    expect(invitedIds(req.id)).toEqual([IDS.ram]);

    await openJobs(IDS.priyaUser, 0);
    const notice = /^You're paused, so new nearby requests won't reach you/;
    expect(await screen.findByText(notice)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open requests (0)' }));
    expect(await screen.findByText('No requests right now')).toBeInTheDocument();
    expect(screen.getAllByText(notice)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /^New \(\d+\)$/ }));
    fireEvent.click(await screen.findByText(notice));
    expect(await screen.findByRole('button', { name: 'Paused — tap to go live' }, SLOW)).toHaveAttribute('aria-pressed', 'true');
  }, 30000);
});

describe('B4: offer to booking', () => {
  test('a sitter quotes, the parent books that offer, the booking starts confirmed and linked, and the other sitter sees it went to someone else', async () => {
    const req = await parentSends();

    await openRequestsTab(IDS.priyaUser, 1);
    fireEvent.click(await screen.findByRole('button', { name: 'Send a quote' }, SLOW));
    fireEvent.change(screen.getByLabelText('Your price (Rs.)'), { target: { value: '380' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send quote' }));
    await screen.findByText('You offered Rs.380');

    await openRequestsTab(IDS.ramUser, 1);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept at my price · Rs.350' }, SLOW));
    await screen.findByText('Waiting for the parent');
    expect(notesFor(IDS.meera, 'broadcast_offer')).toHaveLength(2);

    await parentOpensRequest();
    await screen.findByText('Offers (2)', {}, SLOW);
    fireEvent.click(within(screen.getByRole('article', { name: 'Priya Kapoor' })).getByRole('button', { name: 'Book this sitter' }));
    await screen.findByText('Pick a time', {}, SLOW);
    expect(screen.getByText('7:00 AM').closest('button')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByText('Continue →'));
    await screen.findByText('Which pet?');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Continue →'));
    await screen.findByText('Review booking');
    expect(screen.getByText('Total').parentElement.textContent).toMatch(/Rs\.380/);
    fireEvent.click(screen.getByText('Request booking 🐾'));

    await waitFor(() => expect(db.rows('bookings', { pet_parent_id: IDS.meera, booking_date: WED_ISO, sitter_id: IDS.priya })).toHaveLength(1), SLOW);
    const [booking] = db.rows('bookings', { pet_parent_id: IDS.meera, booking_date: WED_ISO, sitter_id: IDS.priya });
    expect(booking).toMatchObject({ status: 'confirmed', sitter_id: IDS.priya, pet_id: IDS.sheru, service_type: 'walk30', time_slot: '7:00 AM', gross_amount_paise: 38000, sitter_payout_paise: 38000 });
    await waitFor(() => expect(db.one('broadcast_requests', { id: req.id })).toMatchObject({ status: 'filled', chosen_sitter_id: IDS.priya, booking_id: booking.id }));
    expect(notesFor(IDS.priyaUser, 'broadcast_chosen')).toHaveLength(1);
    expect(notesFor(IDS.ramUser, 'broadcast_closed')).toHaveLength(1);

    await openRequestsTab(IDS.ramUser, 0);
    expect(await screen.findByText('Booked by someone else', {}, SLOW)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Accept at my price/ })).toBeNull();
    await openRequestsTab(IDS.priyaUser, 0);
    expect(await screen.findByText('You got it', {}, SLOW)).toBeInTheDocument();
  }, 60000);
});

describe('B5–B8: the request over time', () => {
  test('B5: with no offers, reopening after 15 minutes widens to 8 km, then after another 15 to 12 km', async () => {
    const far = addSitter('far', { name: 'Far Walker', dLat: 0.09 });
    const start = new RealDate();
    const req = await parentSends();
    expect(invitedIds(req.id)).toEqual([IDS.ram, IDS.priya]);

    freezeTime(new RealDate(+start + 16 * MIN));
    await parentOpensRequest();
    expect(await screen.findByText('Looking within 8 km', {}, SLOW)).toBeInTheDocument();
    expect(db.one('broadcast_recipients', { request_id: req.id, sitter_id: IDS.sunita })).toMatchObject({ wave: 2 });
    expect(invitedIds(req.id)).not.toContain(far);

    freezeTime(new RealDate(+start + 32 * MIN));
    await parentOpensRequest();
    expect(await screen.findByText('Looking within 12 km', {}, SLOW)).toBeInTheDocument();
    expect(db.one('broadcast_recipients', { request_id: req.id, sitter_id: far })).toMatchObject({ wave: 3 });
    expect(db.one('broadcast_requests', { id: req.id })).toMatchObject({ wave: 3, radius_km: 12 });
    expect(screen.getByText('Sent to 4 nearby · 0 viewed · 0 offers')).toBeInTheDocument();
    expect(notesFor('u-far', 'broadcast_request')).toHaveLength(1);
  }, 45000);

  test('B6: urgent mode — the first sitter to accept is chosen automatically and the parent goes straight to booking', async () => {
    const req = await parentSends({ urgent: true });
    expect(req.mode).toBe('urgent');

    await openRequestsTab(IDS.priyaUser, 1);
    expect(await screen.findByText('Urgent: the first carer to accept gets it.', {}, SLOW)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send a quote' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Accept at my price · Rs.400' }));
    await screen.findByText('Waiting for the parent');

    await parentOpensRequest();
    expect(await screen.findByText('Priya Kapoor accepted first', {}, SLOW)).toBeInTheDocument();
    expect(db.one('broadcast_requests', { id: req.id })).toMatchObject({ status: 'filled', chosen_sitter_id: IDS.priya });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to booking' }));
    await screen.findByText('Pick a time', {}, SLOW);

    await openRequestsTab(IDS.ramUser, 0);
    expect(await screen.findByText('Booked by someone else', {}, SLOW)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Accept at my price/ })).toBeNull();
  }, 45000);

  test('B7: once the request expires, invited sitters see "Closed" (whether or not they replied) and can no longer reply', async () => {
    const req = await parentSends();
    await openRequestsTab(IDS.ramUser, 1);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept at my price · Rs.350' }, SLOW));
    await screen.findByText('Waiting for the parent');

    freezeTime(new RealDate(Date.parse(req.expires_at) + MIN));
    await openRequestsTab(IDS.priyaUser, 0);
    const card = await screen.findByRole('article', { name: /DLF Phase 1/ }, SLOW);
    expect(within(card).getByText('Closed')).toBeInTheDocument();
    expect(within(card).queryByRole('button')).toBeNull();

    await openRequestsTab(IDS.ramUser, 0);
    const answered = await screen.findByRole('article', { name: /DLF Phase 1/ }, SLOW);
    expect(within(answered).getByText('Closed')).toBeInTheDocument();
    expect(within(answered).queryByText('Waiting for the parent')).toBeNull();

    await openApp(IDS.meera);
    expect(await screen.findByText('Not sure who to pick? Ask nearby sitters', {}, SLOW)).toBeInTheDocument();
    expect(screen.queryByText('Your request is out')).toBeNull();
  }, 45000);

  test('B8: the parent cancels; invited sitters see "Cancelled by the parent" and the Jobs count drops to 0', async () => {
    const req = await parentSends();
    await openRequestsTab(IDS.ramUser, 1);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept at my price · Rs.350' }, SLOW));
    await screen.findByText('Waiting for the parent');

    await parentOpensRequest();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel request' }, SLOW));
    await waitFor(() => expect(db.one('broadcast_requests', { id: req.id }).status).toBe('cancelled'));
    expect(await screen.findByText('Not sure who to pick? Ask nearby sitters', {}, SLOW)).toBeInTheDocument();

    for (const user of [IDS.ramUser, IDS.priyaUser]) {
      await openRequestsTab(user, 0);
      const card = await screen.findByRole('article', { name: /DLF Phase 1/ }, SLOW);
      expect(within(card).getByText('Cancelled by the parent')).toBeInTheDocument();
      expect(within(card).queryByRole('button')).toBeNull();
    }
  }, 45000);
});

test('B9: a parent who is also a sitter never sees her own request in her Jobs feed', async () => {
  const own = addSitter('meera', { name: 'Meera Iyer', dLat: 0.005, availability_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] });
  db.one('sitter_profiles', { id: own }).user_id = IDS.meera;
  const req = await parentSends();
  expect(invitedIds(req.id)).not.toContain(own);

  await openRequestsTab(IDS.meera, 0);
  expect(await screen.findByText('No requests right now')).toBeInTheDocument();
}, 30000);
