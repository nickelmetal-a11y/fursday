// "Send a request to nearby carers": the parent builds one request, matching
// carers nearby are invited in widening waves, they accept/quote/decline, and
// the parent picks an offer that is handed to the booking flow.
import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { db, supabase } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import { toISODate } from '../AvailabilityCalendar';
import { startsAt } from '../broadcastMatching';
import BroadcastRequest from '../BroadcastRequest';
import SitterDashboard from '../SitterDashboard';
import LanguageToggle from '../LanguageToggle';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));

const HOME = { lat: 28.4722, lng: 77.0981 }; // DLF Phase 1
const MIN = 60 * 1000;
// Wednesday is always a working day for Priya (Mon–Fri), so nothing here depends on today's weekday.
const nextWeekday = (weekday) => { const d = new Date(); d.setHours(0, 0, 0, 0); do d.setDate(d.getDate() + 1); while (d.getDay() !== weekday); return d; };
const WED = nextWeekday(3);
const WED_ISO = toISODate(WED);
const dayLabel = (d) => d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const ago = (ms) => new Date(Date.now() - ms).toISOString();
const notesFor = (userId, type) => db.rows('notifications', { user_id: userId, ...(type ? { type } : {}) });

function seedRequest(id, extra = {}) {
  return db.insert('broadcast_requests', {
    id, pet_parent_id: IDS.meera, city_id: IDS.gurgaon, service_type: 'walk30', scheduled_date: WED_ISO, scheduled_time: '7:00 AM',
    area: 'DLF Phase 1', address_pincode: '122002', address_lat: HOME.lat, address_lng: HOME.lng, pet_id: IDS.sheru,
    pet_summary: { name: 'Sheru', breed: 'Indie/Mixed', size: 'medium', age_years: 2, energy: 'moderate' },
    mode: 'compare', budget_max_paise: 50000, wave: 1, radius_km: 5, status: 'open', notes: 'Evening walk for Sheru',
    last_wave_at: new Date().toISOString(), expires_at: new Date(Date.now() + 6 * 60 * MIN).toISOString(), ...extra,
  });
}
const invite = (requestId, sitterId, extra = {}) => db.insert('broadcast_recipients', {
  request_id: requestId, sitter_id: sitterId, wave: 1, distance_km: 2.2, notified_at: new Date().toISOString(), viewed_at: null, declined_at: null, decline_reason: null, ...extra,
});

async function openFeedAs(userId, count = 1, tabName = 'Open requests') {
  db.signInAs(userId);
  render(<SitterDashboard city="Gurgaon" onBack={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: tabName + ' (' + count + ')' }));
}

async function parentSendsRequest({ urgent = false } = {}) {
  db.signInAs(IDS.meera);
  const onSitterAccepted = jest.fn();
  render(<BroadcastRequest city="Gurgaon" onBack={jest.fn()} onSitterAccepted={onSitterAccepted} />);
  fireEvent.click(screen.getByText('Request a walker'));
  fireEvent.click(screen.getByText('Continue →'));
  fireEvent.click(screen.getByRole('button', { name: dayLabel(WED) }));
  fireEvent.click(screen.getByText('7:00 AM'));
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Sheru');
  fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'DLF Phase 1' } });
  fireEvent.click(screen.getByRole('option', { name: /DLF Phase 1/ }));
  fireEvent.click(screen.getByText('Continue →'));
  if (urgent) fireEvent.click(screen.getByText('Urgent: first to accept gets it'));
  fireEvent.change(screen.getByLabelText('Max budget (optional)'), { target: { value: '450' } });
  fireEvent.click(screen.getByText('Send to nearby carers'));
  await screen.findByText('Your request');
  return { onSitterAccepted };
}

beforeEach(() => {
  db.reset(buildSeed());
  localStorage.clear();
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  const place = (id, dLat) => Object.assign(db.one('sitter_profiles', { id }), { lat: HOME.lat + dLat, lng: HOME.lng });
  place(IDS.ram, 0.009);     // ~1 km
  place(IDS.priya, 0.02);    // ~2.2 km
  place(IDS.sunita, 0.06);   // ~6.7 km, outside wave 1 and her default 5 km radius
});

describe('Parent sends one request', () => {
  test('NR1: the request is stored with the pet snapshot and place, wave 1 invites only nearby matching carers, each is notified', async () => {
    await parentSendsRequest();
    await screen.findByText('Sent to 2 nearby · 0 viewed · 0 offers');
    expect(screen.getByText('Looking within 5 km')).toBeInTheDocument();
    expect(screen.getByText(/^Closes in/)).toBeInTheDocument();

    const req = db.one('broadcast_requests', { pet_parent_id: IDS.meera });
    expect(req).toMatchObject({
      city_id: IDS.gurgaon, service_type: 'walk30', scheduled_date: WED_ISO, scheduled_time: '7:00 AM', area: 'DLF Phase 1',
      address_pincode: '122002', pet_id: IDS.sheru, mode: 'compare', budget_max_paise: 45000, status: 'open', wave: 1, radius_km: 5, end_date: null,
    });
    expect(req.pet_summary).toMatchObject({ name: 'Sheru', breed: 'Indie/Mixed', size: 'medium' });
    expect(req.address_lat).toBe(28.47);
    expect(req.address_lng).toBe(77.1);
    expect(Date.parse(req.expires_at)).toBeLessThanOrEqual(+startsAt(WED_ISO, '7:00 AM'));
    expect(Date.parse(req.expires_at) - Date.now()).toBeLessThanOrEqual(12 * 60 * MIN);

    const invited = db.rows('broadcast_recipients', { request_id: req.id });
    expect(invited.map(r => r.sitter_id)).toEqual([IDS.ram, IDS.priya]);
    expect(invited.every(r => r.wave === 1)).toBe(true);
    expect(invited[0].distance_km).toBeCloseTo(1, 0);

    expect(notesFor(IDS.ramUser, 'broadcast_request')).toHaveLength(1);
    expect(notesFor(IDS.priyaUser, 'broadcast_request')[0].title).toMatch(/^New request near you: Dog walk, \d\.\d km, Indie\/Mixed, Wed/);
    expect(notesFor(IDS.sunitaUser, 'broadcast_request')).toHaveLength(0);
    expect(notesFor(IDS.vikramUser)).toHaveLength(0);
  });

  test('NR2: a boarding request needs every night free, and only carers offering boarding are invited', async () => {
    db.signInAs(IDS.meera);
    render(<BroadcastRequest city="Gurgaon" onBack={jest.fn()} onSitterAccepted={jest.fn()} />);
    fireEvent.click(screen.getByText('Home boarding'));
    fireEvent.click(screen.getByText('Continue →'));
    const mon = nextWeekday(1);
    const thu = new Date(mon); thu.setDate(mon.getDate() + 3);
    fireEvent.click(within(screen.getByRole('group', { name: 'From' })).getByRole('button', { name: dayLabel(mon) }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Until' })).getByRole('button', { name: dayLabel(thu) }));
    fireEvent.click(screen.getByText('6:00 PM'));
    fireEvent.click(screen.getByText('Continue →'));
    await screen.findByText('Sheru');
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'DLF Phase 1' } });
    fireEvent.click(screen.getByRole('option', { name: /DLF Phase 1/ }));
    fireEvent.click(screen.getByText('Continue →'));
    fireEvent.click(screen.getByText('Send to nearby carers'));
    await screen.findByText(/^Sent to 1 nearby/);

    const req = db.one('broadcast_requests', { pet_parent_id: IDS.meera });
    expect(req).toMatchObject({ service_type: 'boarding', scheduled_date: toISODate(mon), end_date: toISODate(thu) });
    expect(db.rows('broadcast_recipients', { request_id: req.id }).map(r => r.sitter_id)).toEqual([IDS.priya]);
  });

  test('NR3: before migration 037 the request still goes out (city-wide) and the parent is told; sitters see it', async () => {
    const realFrom = supabase.from;
    const failing = (message) => {
      const res = { data: null, error: { message } };
      const chain = new Proxy({}, { get: (_, k) => (k === 'then' ? (ok, bad) => Promise.resolve(res).then(ok, bad) : () => chain) });
      return chain;
    };
    supabase.from = (t) => {
      if (t === 'broadcast_recipients') return failing('relation "public.broadcast_recipients" does not exist');
      const b = realFrom(t);
      if (t === 'broadcast_requests') {
        const insert = b.insert;
        b.insert = (row) => ('mode' in row ? failing("Could not find the 'end_date' column of 'broadcast_requests' in the schema cache") : insert(row));
      }
      return b;
    };
    try {
      await parentSendsRequest();
      expect(await screen.findByText(/Smart matching turns on after/)).toBeInTheDocument();
      const req = db.one('broadcast_requests', { pet_parent_id: IDS.meera });
      expect(req).toMatchObject({ area: 'DLF Phase 1', service_type: 'walk30', status: 'open' });
      expect(req).not.toHaveProperty('mode');
      cleanup();

      await openFeedAs(IDS.sunitaUser);
      expect(await screen.findByText('Showing every open request in your city.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Accept at my price/ }));
      await waitFor(() => expect(db.rows('broadcast_responses', { request_id: req.id })).toHaveLength(1));
      expect(db.one('broadcast_responses', { request_id: req.id })).toMatchObject({ sitter_id: IDS.sunita, status: 'accepted', offered_price: 30000 });
    } finally {
      supabase.from = realFrom;
    }
  });
});

describe('Sitter side', () => {
  test('NR4: a sitter sees only requests she was invited to, with match reasons but no address, and opening marks it viewed', async () => {
    seedRequest('req-a');
    seedRequest('req-b', { area: 'Sector 56' });
    invite('req-a', IDS.priya);
    invite('req-b', IDS.ram);
    await openFeedAs(IDS.priyaUser);
    const card = await screen.findByRole('article', { name: /DLF Phase 1/ });
    expect(screen.queryByText('Sector 56')).toBeNull();
    expect(within(card).getByText(/^2\.2 km · Indie\/Mixed, medium · Wed.* · within your radius$/)).toBeInTheDocument();
    expect(within(card).getByText('Budget up to Rs.500')).toBeInTheDocument();
    expect(within(card).getByText(/^Sheru · Indie\/Mixed · 2 yrs$/)).toBeInTheDocument();
    expect(within(card).getByText(/^Closes in/)).toBeInTheDocument();
    expect(within(card).queryByText(/122002/)).toBeNull();
    await waitFor(() => expect(db.one('broadcast_recipients', { request_id: 'req-a', sitter_id: IDS.priya }).viewed_at).toBeTruthy());
    expect(db.one('broadcast_recipients', { request_id: 'req-b', sitter_id: IDS.ram }).viewed_at).toBeNull();
  });

  test('NR5: accept at my price, send a quote, suggest another time, or say not this time', async () => {
    seedRequest('req-1');
    seedRequest('req-2', { area: 'Sector 56', created_at: ago(MIN) });
    invite('req-1', IDS.priya); invite('req-1', IDS.sunita); invite('req-1', IDS.ram); invite('req-2', IDS.ram);

    await openFeedAs(IDS.priyaUser);
    fireEvent.click(await screen.findByRole('button', { name: 'Accept at my price · Rs.400' }));
    await screen.findByText('Waiting for the parent');
    expect(db.one('broadcast_responses', { sitter_id: IDS.priya })).toMatchObject({ request_id: 'req-1', status: 'accepted', offered_price: 40000 });
    expect(notesFor(IDS.meera, 'broadcast_offer')[0]).toMatchObject({ title: 'Priya Kapoor replied to your request', body: 'Can do it for Rs.400.' });
    expect(screen.getByRole('button', { name: 'Open requests (0)' })).toBeInTheDocument();
    cleanup();

    await openFeedAs(IDS.sunitaUser);
    fireEvent.click(await screen.findByRole('button', { name: 'Send a quote' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send quote' }));
    expect(await screen.findByText('Enter your price first.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Your price (Rs.)'), { target: { value: '350' } });
    fireEvent.change(screen.getByLabelText('Short message (optional)'), { target: { value: 'मैं रोज़ इंडी कुत्तों को घुमाती हूं' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send quote' }));
    await screen.findByText('You offered Rs.350');
    expect(db.one('broadcast_responses', { sitter_id: IDS.sunita })).toMatchObject({ status: 'offered', offered_price: 35000, message: 'मैं रोज़ इंडी कुत्तों को घुमाती हूं' });
    cleanup();

    await openFeedAs(IDS.ramUser, 2);
    const first = await screen.findByRole('article', { name: /DLF Phase 1/ });
    fireEvent.click(within(first).getByRole('button', { name: 'Suggest another time' }));
    fireEvent.click(within(first).getByRole('button', { name: '6:00 PM' }));
    fireEvent.click(within(first).getByRole('button', { name: 'Suggest this time' }));
    await within(first).findByText(/You suggested 6:00 PM/);
    expect(db.one('broadcast_responses', { sitter_id: IDS.ram })).toMatchObject({ request_id: 'req-1', status: 'offered', proposed_time: '6:00 PM', offered_price: 35000 });

    const second = screen.getByRole('article', { name: /Sector 56/ });
    fireEvent.click(within(second).getByRole('button', { name: 'Not this time' }));
    fireEvent.click(within(second).getByRole('button', { name: 'Too far' }));
    fireEvent.click(within(second).getByRole('button', { name: 'Skip this request' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: /Sector 56/ })).toBeNull());
    expect(db.one('broadcast_recipients', { request_id: 'req-2', sitter_id: IDS.ram })).toMatchObject({ decline_reason: 'far' });
    expect(db.one('broadcast_recipients', { request_id: 'req-2', sitter_id: IDS.ram }).declined_at).toBeTruthy();
    expect(db.rows('broadcast_responses', { request_id: 'req-2' })).toHaveLength(0);
  });

  test('NR6: in urgent mode a sitter can only accept or pass', async () => {
    seedRequest('req-u', { mode: 'urgent' });
    invite('req-u', IDS.priya);
    await openFeedAs(IDS.priyaUser);
    expect(await screen.findByText('Urgent: the first carer to accept gets it.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Accept at my price/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send a quote' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Suggest another time' })).toBeNull();
  });

  test('NR7: a sitter still under review sees the invite but is told why she cannot reply', async () => {
    seedRequest('req-p', { city_id: IDS.pune, area: 'Baner', address_lat: null, address_lng: null, address_pincode: '411045' });
    invite('req-p', IDS.vikram);
    db.signInAs(IDS.vikramUser);
    render(<SitterDashboard city="Pune" onBack={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open requests (1)' }));
    expect(await screen.findByText('Your profile is still being reviewed, so you can look but not reply yet.')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: /Baner/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Accept at my price/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send a quote' })).toBeNull();
    expect(db.rows('broadcast_responses')).toHaveLength(0);
  });
});

describe('Parent chooses', () => {
  function requestWithOffers() {
    seedRequest('req-1');
    invite('req-1', IDS.ram, { distance_km: 1 });
    invite('req-1', IDS.priya, { viewed_at: ago(5 * MIN) });
    invite('req-1', IDS.sunita, { wave: 2, distance_km: 6.7, viewed_at: ago(4 * MIN) });
    db.insert('broadcast_responses', { id: 'resp-priya', request_id: 'req-1', sitter_id: IDS.priya, status: 'accepted', offered_price: 40000, created_at: ago(3 * MIN) });
    db.insert('broadcast_responses', { id: 'resp-sunita', request_id: 'req-1', sitter_id: IDS.sunita, status: 'offered', offered_price: 35000, message: 'I walk Indies every day', created_at: ago(2 * MIN) });
  }

  test('NR8: offers show live counts and sort; choosing one fills the request and hands the price and details to booking', async () => {
    requestWithOffers();
    db.signInAs(IDS.meera);
    const onSitterAccepted = jest.fn();
    render(<BroadcastRequest city="Gurgaon" requestId="req-1" onBack={jest.fn()} onSitterAccepted={onSitterAccepted} />);
    await screen.findByText('Offers (2)');
    expect(screen.getByText('Sent to 3 nearby · 2 viewed · 2 offers')).toBeInTheDocument();
    const order = () => screen.getAllByRole('article').map(n => n.getAttribute('aria-label'));
    expect(order()).toEqual(['सुनीता देवी', 'Priya Kapoor']);
    expect(screen.getByText('I walk Indies every day')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rating' }));
    expect(order()).toEqual(['Priya Kapoor', 'सुनीता देवी']);
    fireEvent.click(screen.getByRole('button', { name: 'Distance' }));
    expect(order()).toEqual(['Priya Kapoor', 'सुनीता देवी']);

    fireEvent.click(within(screen.getByRole('article', { name: 'Priya Kapoor' })).getByRole('button', { name: 'Book this sitter' }));
    await waitFor(() => expect(onSitterAccepted).toHaveBeenCalledTimes(1));
    const [sitter, prefill] = onSitterAccepted.mock.calls[0];
    expect(sitter).toMatchObject({ id: IDS.priya, name: 'Priya Kapoor' });
    expect(sitter.services.map(s => s.service_type)).toContain('walk30');
    expect(prefill).toEqual({ service: 'walk30', dateISO: WED_ISO, endDateISO: null, time: '7:00 AM', petId: IDS.sheru, priceRupees: 400, requestId: 'req-1' });

    expect(db.one('broadcast_requests', { id: 'req-1' })).toMatchObject({ status: 'filled', chosen_sitter_id: IDS.priya });
    expect(db.one('broadcast_responses', { id: 'resp-priya' }).status).toBe('chosen');
    expect(db.one('broadcast_responses', { id: 'resp-sunita' }).status).toBe('offered');
    expect(notesFor(IDS.priyaUser, 'broadcast_chosen')).toHaveLength(1);
    expect(notesFor(IDS.sunitaUser, 'broadcast_closed')).toHaveLength(1);
    cleanup();

    await openFeedAs(IDS.sunitaUser, 0);
    expect(await screen.findByText('Booked by someone else')).toBeInTheDocument();
    cleanup();
    await openFeedAs(IDS.priyaUser, 0);
    expect(await screen.findByText('You got it')).toBeInTheDocument();
  });

  test('NR9: urgent mode — the first carer to accept wins automatically', async () => {
    seedRequest('req-u', { mode: 'urgent' });
    invite('req-u', IDS.ram); invite('req-u', IDS.priya);
    db.insert('broadcast_responses', { id: 'resp-ram', request_id: 'req-u', sitter_id: IDS.ram, status: 'accepted', offered_price: 35000, created_at: ago(2 * MIN) });
    db.insert('broadcast_responses', { id: 'resp-priya', request_id: 'req-u', sitter_id: IDS.priya, status: 'accepted', offered_price: 40000, created_at: ago(MIN) });
    db.signInAs(IDS.meera);
    const onSitterAccepted = jest.fn();
    render(<BroadcastRequest city="Gurgaon" requestId="req-u" onBack={jest.fn()} onSitterAccepted={onSitterAccepted} />);
    expect(await screen.findByText('राम सिंह accepted first')).toBeInTheDocument();
    expect(db.one('broadcast_requests', { id: 'req-u' })).toMatchObject({ status: 'filled', chosen_sitter_id: IDS.ram });
    expect(db.one('broadcast_responses', { id: 'resp-priya' }).status).toBe('accepted');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to booking' }));
    expect(onSitterAccepted).toHaveBeenCalledWith(expect.objectContaining({ id: IDS.ram, name: 'राम सिंह' }), expect.objectContaining({ priceRupees: 350, requestId: 'req-u' }));
  });

  test('NR10: no reply before expiry shows the nearest carers (ignoring availability) to book directly', async () => {
    db.one('sitter_profiles', { id: IDS.ram }).availability_days = ['Sun'];
    seedRequest('req-x', { created_at: ago(13 * 60 * MIN), last_wave_at: ago(12 * 60 * MIN), wave: 3, radius_km: 12, expires_at: ago(MIN) });
    invite('req-x', IDS.priya);
    db.signInAs(IDS.meera);
    const onSitterAccepted = jest.fn();
    render(<BroadcastRequest city="Gurgaon" requestId="req-x" onBack={jest.fn()} onSitterAccepted={onSitterAccepted} />);
    expect(await screen.findByText('No one free? Here are the nearest carers')).toBeInTheDocument();
    expect(screen.getByText('Closed')).toBeInTheDocument();
    const books = await screen.findAllByRole('button', { name: /^Book / });
    expect(books.map(b => b.getAttribute('aria-label'))).toEqual(['Book राम सिंह', 'Book Priya Kapoor', 'Book सुनीता देवी']);
    fireEvent.click(screen.getByRole('button', { name: 'Book Priya Kapoor' }));
    expect(onSitterAccepted).toHaveBeenCalledWith(expect.objectContaining({ id: IDS.priya }), expect.objectContaining({ service: 'walk30', priceRupees: 400, requestId: null }));
  });

  test('NR11: after 15 minutes with no offer, reopening the request widens to 8 km and invites the next carers', async () => {
    seedRequest('req-w', { created_at: ago(20 * MIN), last_wave_at: ago(20 * MIN) });
    invite('req-w', IDS.ram); invite('req-w', IDS.priya);
    db.signInAs(IDS.meera);
    render(<BroadcastRequest city="Gurgaon" requestId="req-w" onBack={jest.fn()} onSitterAccepted={jest.fn()} />);
    expect(await screen.findByText('Looking within 8 km')).toBeInTheDocument();
    expect(screen.getByText('Sent to 3 nearby · 0 viewed · 0 offers')).toBeInTheDocument();
    expect(db.one('broadcast_recipients', { request_id: 'req-w', sitter_id: IDS.sunita })).toMatchObject({ wave: 2 });
    expect(db.one('broadcast_requests', { id: 'req-w' })).toMatchObject({ wave: 2, radius_km: 8 });
    expect(notesFor(IDS.sunitaUser, 'broadcast_request')).toHaveLength(1);
    expect(notesFor(IDS.priyaUser, 'broadcast_request')).toHaveLength(0);
  });

  test('NR12: the parent can cancel an open request', async () => {
    seedRequest('req-c');
    db.signInAs(IDS.meera);
    const onBack = jest.fn();
    render(<BroadcastRequest city="Gurgaon" requestId="req-c" onBack={onBack} onSitterAccepted={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(onBack).toHaveBeenCalled());
    expect(db.one('broadcast_requests', { id: 'req-c' }).status).toBe('cancelled');
  });

  test('NR13: reopening the builder offers a way back to the request already out', async () => {
    seedRequest('req-o');
    db.signInAs(IDS.meera);
    render(<BroadcastRequest city="Gurgaon" onBack={jest.fn()} onSitterAccepted={jest.fn()} />);
    fireEvent.click(await screen.findByText('You already have a request out'));
    expect(await screen.findByText('Your request')).toBeInTheDocument();
  });
});

test('NR14: Hindi — the sitter feed and the parent status read in Hindi', async () => {
  render(<LanguageToggle />);
  fireEvent.click(screen.getByText('हिं'));
  try {
    seedRequest('req-h');
    invite('req-h', IDS.priya);
    db.signInAs(IDS.meera);
    render(<BroadcastRequest city="Gurgaon" requestId="req-h" onBack={jest.fn()} onSitterAccepted={jest.fn()} />);
    expect(await screen.findByText('पास के 1 को भेजी · 0 ने देखी · 0 ऑफ़र')).toBeInTheDocument();
    expect(screen.getByText('5 किमी के अंदर ढूंढ रहे हैं')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'रिक्वेस्ट रद्द करें' })).toBeInTheDocument();
    cleanup();

    render(<LanguageToggle />);
    await openFeedAs(IDS.priyaUser, 1, 'खुली रिक्वेस्ट');
    expect(await screen.findByRole('button', { name: 'मेरी कीमत पर स्वीकार करें · Rs.400' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'अपनी कीमत भेजें' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'इस बार नहीं' })).toBeInTheDocument();
    expect(screen.getByText(/Indie\/Mixed, मध्यम/)).toBeInTheDocument();
  } finally {
    cleanup();
    render(<LanguageToggle />);
    fireEvent.click(screen.getByText('EN'));
  }
});
