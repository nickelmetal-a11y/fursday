// End-to-end journeys through <App/>, sections A (parent booking) and F
// (sitter) of E2E_SCENARIOS.md. Each test starts on Home and clicks through
// the real routing (Home → Explore → profile → checkout → Bookings), signing in
// as the parent, then the sitter, against the in-memory database. Money goes
// through the real api/payments handler (src/testing/fakePayments.js).
import React from 'react';
import { render, screen, fireEvent, waitFor, within, act, configure } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { payments } from '../testing/fakePayments';
import { buildSeed, IDS } from '../testing/seed';
import { toISODate } from '../AvailabilityCalendar';
import { priceFor } from '../pricing';
import App from '../App';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../paymentsClient', () => require('../testing/fakePayments'));
jest.mock('../compressImage', () => ({ compressImage: (file) => Promise.resolve(file) }));
jest.mock('../geolocationService', () => ({
  checkLocationRestriction: () => Promise.resolve({ allowed: true, ip: '127.0.0.1' }),
  getLocationRestrictedMessage: () => 'Coming soon to your area',
}));

// The synced drive and parallel suites make App-level renders slow; the default 1s wait is too tight.
configure({ asyncUtilTimeout: 8000 });

const fake = require('../testing/fakeSupabase');
const realVerify = fake.supabase.auth.verifyOtp;
const SLOW = { timeout: 8000 };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CARD = 'div[style*="border-radius: 20px"][style*="margin-bottom: 12px"]';
const KAVITA = { id: 'sp-kavita', user: 'u-kavita', name: 'Kavita Rane' };
const TEST_EMAIL = 'fursday.test.ananya@example.com';

const dayFrom = (n) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); };
const label = (d) => DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
const tiles = (d) => screen.getAllByRole('button', { name: new RegExp('^' + label(d)) });
const settle = () => act(() => new Promise(r => setTimeout(r, 40)));
const click = (target, scope = screen) => fireEvent.click(target?.nodeType ? target : scope.getByRole('button', { name: target }));
const next = () => fireEvent.click(screen.getByText('Continue →'));
const total = () => screen.getByText('Total').parentElement.textContent;
const nav = (name) => click(name, within(screen.getByRole('navigation', { name: 'Main' })));
const createOrders = () => payments.calls.filter(c => c.action === 'create-order');

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  payments.reset();
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  window.history.replaceState(null, '', '/');
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn(() => 'Change of plans');
});
afterEach(() => { fake.supabase.auth.verifyOtp = realVerify; });

function addBoardingHost(extra = {}) {
  db.insert('users', { id: KAVITA.user, name: KAVITA.name, email: 'kavita@test.example' });
  db.insert('sitter_profiles', { id: KAVITA.id, user_id: KAVITA.user, city_id: IDS.gurgaon, status: 'active', provider_type: 'boarding', home_details: { max_dogs: 3 }, ...extra });
  db.insert('sitter_services', { id: 'svc-kavita', sitter_id: KAVITA.id, service_type: 'boarding', price_paise: 100000, is_active: true });
}

async function openApp(userId = null) {
  db.signInAs(userId);
  const view = render(<App />);
  await screen.findByText('Top sitters near you', {}, SLOW);
  return view;
}

async function openSitterJobs(userId) {
  const view = await openApp(userId);
  fireEvent.click(await screen.findByRole('button', { name: /^Switch to sitter mode/ }, SLOW));
  await screen.findByRole('button', { name: /^New \(/ }, SLOW);
  await waitFor(() => expect(screen.queryByText('Loading your jobs...')).toBeNull(), SLOW);
  await settle();
  return view;
}

async function openParentBookings(userId) {
  const view = await openApp(userId);
  nav('Bookings');
  await waitFor(() => expect(screen.queryByText('Loading your bookings...')).toBeNull(), SLOW);
  return view;
}

const cardFor = (booking) => screen.getByText(booking.booking_date).closest(CARD);

// The Explore card for a sitter: the nearest ancestor holding its "Request booking" button.
function exploreCard(name) {
  let el = screen.getByText(name);
  while (!within(el).queryByRole('button', { name: 'Request booking' })) el = el.parentElement;
  return el;
}

async function openExploreTile(tile, firstName) {
  click(tile);
  expect(await screen.findByRole('heading', { name: 'Sitters near you' })).toBeInTheDocument();
  await screen.findByText(firstName, {}, SLOW);
}

async function onScheduleStep() {
  await screen.findByText('Book up to 60 days ahead');
  await settle();
}

// First open day from `from`, skipping the sitter's days off.
function pickOpenDay(from = 1) {
  let n = from;
  while (tiles(dayFrom(n))[0].getAttribute('aria-disabled') === 'true') n++;
  fireEvent.click(tiles(dayFrom(n))[0]);
  return n;
}

async function petsAndReview(names) {
  next();
  for (const n of names) fireEvent.click(await screen.findByText(n));
  fireEvent.click(screen.getByRole('checkbox'));
  next();
  await screen.findByText('Review booking');
}

async function requestBooking() {
  fireEvent.click(screen.getByText('Request booking 🐾'));
  await screen.findByText('Booking requested!');
}

async function signInThroughLoginScreen(userId) {
  expect(await screen.findByText("Sign in to continue. We'll bring you right back.")).toBeInTheDocument();
  fake.supabase.auth.verifyOtp = () => { db.signInAs(userId); return Promise.resolve({ data: { user: db.user }, error: null }); };
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: db.one('users', { id: userId }).email } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the Terms of Service and Privacy Policy' }));
  fireEvent.click(screen.getByText('Continue with email →'));
  fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '123456' } });
  click('Sign in');
}

async function sendChat(text) {
  const input = await screen.findByPlaceholderText('Type a message...');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

// jsdom has no canvas/image decoding, which PhotoUploadModal uses to compress photos.
function stubImagePipeline() {
  const origImage = global.Image;
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  const origToBlob = HTMLCanvasElement.prototype.toBlob;
  global.Image = class { set src(_v) { this.width = 800; this.height = 600; setTimeout(() => this.onload && this.onload(), 0); } };
  HTMLCanvasElement.prototype.getContext = () => ({ drawImage: () => {} });
  HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new Blob(['jpeg-bytes'], { type: 'image/jpeg' })); };
  return () => {
    global.Image = origImage;
    HTMLCanvasElement.prototype.getContext = origGetContext;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
  };
}
const photo = (name) => new File(['x'], name, { type: 'image/jpeg' });
const addPhoto = (testId, scope) => fireEvent.change(scope.getByTestId(testId), { target: { files: [photo(testId + '.jpg')] } });

describe('A. Parent booking journeys', () => {
  test('A1: Home "Dog walk" → Explore filtered to walks → profile → book: the booking has the sitter, status pending and full price', async () => {
    addBoardingHost();
    await openApp(IDS.ananya);
    await openExploreTile('Dog walk', 'Priya Kapoor');
    expect(screen.getByRole('button', { name: 'Walking' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(KAVITA.name)).toBeNull();

    click('Priya Kapoor');
    expect(await screen.findByRole('heading', { name: /^Priya Kapoor/ })).toBeInTheDocument();
    click('Book now');
    expect(await screen.findByText(/^Priya Kapoor · /)).toBeInTheDocument();
    await onScheduleStep();
    pickOpenDay();
    fireEvent.click(screen.getByText('7:00 AM'));
    await petsAndReview(['Bruno']);
    expect(screen.getByText('Review booking').parentElement).toHaveTextContent('Request a walker');
    expect(total()).toMatch(/Rs\.400$/);
    await requestBooking();

    const rows = db.rows('bookings', { pet_parent_id: IDS.ananya, status: 'pending' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sitter_id: IDS.priya, service_type: 'walk30', pet_id: IDS.bruno, city_id: IDS.gurgaon, gross_amount_paise: 40000, sitter_payout_paise: 40000 });
    expect(window.alert).not.toHaveBeenCalled();

    click('Back to home 🐾');
    expect(await screen.findByText('Top sitters near you')).toBeInTheDocument();
    nav('Bookings');
    expect(await screen.findByText('Waiting for Priya Kapoor to accept')).toBeInTheDocument();
  }, 60000);

  test('A1: the Explore service chip carries into checkout; switching to "All" asks for the service again', async () => {
    await openApp(IDS.ananya);
    await openExploreTile('Daycare', 'No sitters found');
    expect(screen.getByRole('button', { name: 'Daycare' })).toHaveAttribute('aria-pressed', 'true');
    click('All');
    fireEvent.click(within(exploreCard('राम सिंह')).getByRole('button', { name: 'Request booking' }));
    expect(await screen.findByText('What do you need?')).toBeInTheDocument();
    expect(screen.getByText(/^राम सिंह · /)).toBeInTheDocument();
  }, 60000);

  test('A2: Home "Boarding" → boarding host → 2 nights with two dogs: price equals priceFor and the booking has end_date', async () => {
    const rules = { weekend_pct: 20, extra_dog_pct: 25 };
    addBoardingHost({ pricing_rules: rules });
    db.insert('pet_profiles', { id: 'pet-luna', user_id: IDS.ananya, name: 'Luna', breed: 'Beagle', age_years: 1 });
    await openApp(IDS.ananya);
    await openExploreTile('Boarding', KAVITA.name);
    expect(screen.getByRole('button', { name: 'Boarding' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Priya Kapoor')).toBeInTheDocument();
    expect(screen.queryByText('सुनीता देवी')).toBeNull();
    expect(screen.queryByText('राम सिंह')).toBeNull();

    fireEvent.click(within(exploreCard(KAVITA.name)).getByRole('button', { name: 'Request booking' }));
    await onScheduleStep();
    const fri = [1, 2, 3, 4, 5, 6, 7].find(n => dayFrom(n).getDay() === 5);
    fireEvent.click(tiles(dayFrom(fri))[0]);
    await settle();
    fireEvent.click(tiles(dayFrom(fri + 2))[1]);
    fireEvent.click(screen.getByText('7:00 AM'));
    await petsAndReview(['Bruno', 'Luna']);

    const expected = priceFor({ service: 'boarding', basePriceRupees: 1000, startDate: dayFrom(fri), nights: 2, dogs: 2, rules }).total;
    expect(expected).toBe(4200);
    expect(screen.getByText('Weekend nights (+20%)').parentElement).toHaveTextContent('Rs.400');
    expect(screen.getByText('Extra dogs × 1 (25% off each)')).toBeInTheDocument();
    expect(total()).toMatch(new RegExp('Rs\\.' + expected + '$'));
    await requestBooking();

    const [row] = db.rows('bookings', { sitter_id: KAVITA.id });
    expect(row).toMatchObject({
      pet_parent_id: IDS.ananya, service_type: 'boarding', status: 'pending', pet_ids: [IDS.bruno, 'pet-luna'],
      booking_date: toISODate(dayFrom(fri)), end_date: toISODate(dayFrom(fri + 2)), gross_amount_paise: expected * 100, sitter_payout_paise: expected * 100,
    });
  }, 60000);

  test('A3: promo banner "Book now" → choose a sitter → the code is applied; the parent pays the discount, the sitter payout stays full', async () => {
    db.one('users', { id: IDS.ananya }).email = TEST_EMAIL;
    await openApp(IDS.ananya);
    fireEvent.click(await screen.findByRole('button', { name: 'Book now' }, SLOW));
    expect(await screen.findByRole('heading', { name: 'Sitters near you' })).toBeInTheDocument();
    await screen.findByText('सुनीता देवी', {}, SLOW);
    fireEvent.click(within(exploreCard('सुनीता देवी')).getByRole('button', { name: 'Request booking' }));
    fireEvent.click(await screen.findByText('Request a walker'));
    next();
    await onScheduleStep();
    pickOpenDay();
    fireEvent.click(screen.getByText('7:00 AM'));
    await petsAndReview(['Bruno']);
    expect(await screen.findByText('WELCOME100 applied')).toBeInTheDocument();
    expect(total()).toMatch(/Rs\.200$/);

    fireEvent.click(screen.getByText('Request booking 🐾'));
    click(await screen.findByRole('button', { name: 'Pay Rs.200 (test payment)' }));
    const [row] = db.rows('bookings', { pet_parent_id: IDS.ananya, sitter_id: IDS.sunita, status: 'pending' });
    await waitFor(() => expect(db.one('bookings', { id: row.id }).payment_status).toBe('authorized'));
    expect(db.one('bookings', { id: row.id })).toMatchObject({ gross_amount_paise: 20000, sitter_payout_paise: 30000 });
    expect(db.rows('promo_usage', { user_id: IDS.ananya, booking_id: row.id })).toHaveLength(1);
  }, 60000);

  test('A4: a visitor taps Book now on a profile opened from Explore, signs in, and checkout resumes for that sitter and service', async () => {
    await openApp(null);
    await openExploreTile('Dog walk', 'Priya Kapoor');
    click('Priya Kapoor');
    click(await screen.findByRole('button', { name: 'Book now' }));
    await signInThroughLoginScreen(IDS.ananya);

    expect(await screen.findByText(/^Priya Kapoor · /, {}, SLOW)).toBeInTheDocument();
    await onScheduleStep();
    pickOpenDay();
    fireEvent.click(screen.getByText('7:00 AM'));
    await petsAndReview(['Bruno']);
    await requestBooking();
    expect(db.rows('bookings', { pet_parent_id: IDS.ananya, status: 'pending' })).toEqual([
      expect.objectContaining({ sitter_id: IDS.priya, service_type: 'walk30', gross_amount_paise: 40000 }),
    ]);
  }, 60000);

  test('A6: a Mon/Wed/Fri walk plan from Explore makes one series and N bookings, paid in one checkout', async () => {
    db.one('users', { id: IDS.ananya }).email = TEST_EMAIL;
    await openApp(IDS.ananya);
    await openExploreTile('Dog walk', 'सुनीता देवी');
    fireEvent.click(within(exploreCard('सुनीता देवी')).getByRole('button', { name: 'Request booking' }));
    await onScheduleStep();
    const start = [1, 2, 3, 4, 5, 6, 7].find(n => [1, 3, 5].includes(dayFrom(n).getDay()));
    fireEvent.click(tiles(dayFrom(start))[0]);
    fireEvent.click(screen.getByText('7:00 AM'));
    fireEvent.click(screen.getByRole('switch', { name: 'Repeat weekly' }));
    const group = within(screen.getByRole('group', { name: 'On these days' }));
    ['Mon', 'Wed', 'Fri'].filter(d => d !== DAYS[dayFrom(start).getDay()]).forEach(d => fireEvent.click(group.getByRole('button', { name: d })));
    fireEvent.change(screen.getByLabelText('Until'), { target: { value: toISODate(dayFrom(start + 20)) } });
    const dates = [];
    for (let n = start; n <= start + 20; n++) if ([1, 3, 5].includes(dayFrom(n).getDay())) dates.push(toISODate(dayFrom(n)));
    expect(screen.getByText(dates.length + ' visits.', { exact: false })).toBeInTheDocument();
    await petsAndReview(['Bruno']);
    expect(total()).toMatch(new RegExp('Rs\\.' + dates.length * 300 + '$'));

    fireEvent.click(screen.getByText('Request booking 🐾'));
    click(await screen.findByRole('button', { name: 'Pay Rs.' + dates.length * 300 + ' (test payment)' }));
    const [series] = db.rows('booking_series', { pet_parent_id: IDS.ananya });
    expect(series).toMatchObject({ sitter_id: IDS.sunita, service_type: 'walk30', status: 'active' });
    expect([...series.weekdays].sort()).toEqual([1, 3, 5]);
    const rows = db.rows('bookings', { series_id: series.id });
    expect(rows.map(r => r.booking_date).sort()).toEqual(dates);
    expect(createOrders()).toHaveLength(1);
    expect([...createOrders()[0].booking_ids].sort()).toEqual(rows.map(r => r.id).sort());
    await waitFor(() => expect(db.rows('bookings', { series_id: series.id, payment_status: 'authorized' })).toHaveLength(dates.length));
  }, 60000);

  test('A7: a meet & greet booked from a Home profile is free, has no payment step, and "Back to home" goes home', async () => {
    db.one('users', { id: IDS.ananya }).email = TEST_EMAIL;
    await openApp(IDS.ananya);
    click('Priya Kapoor', within(await screen.findByRole('group', { name: 'Priya Kapoor' }, SLOW)));
    click(await screen.findByRole('button', { name: 'Book now' }));
    fireEvent.click(await screen.findByText('Meet & greet'));
    next();
    await onScheduleStep();
    pickOpenDay();
    fireEvent.click(screen.getByText('5:00 PM'));
    await petsAndReview(['Bruno']);
    expect(screen.queryByText('Total')).toBeNull();
    fireEvent.click(screen.getByText('Request meet & greet'));
    await screen.findByText('Booking requested!');

    expect(db.rows('bookings', { pet_parent_id: IDS.ananya, service_type: 'meet_greet' })).toEqual([
      expect.objectContaining({ sitter_id: IDS.priya, is_meet_greet: true, gross_amount_paise: 0, status: 'pending' }),
    ]);
    expect(createOrders()).toHaveLength(0);
    expect(screen.queryByText(/test payment/)).toBeNull();
    click('Back to home 🐾');
    expect(await screen.findByText('Top sitters near you')).toBeInTheDocument();
  }, 60000);

  test("A8: from a Home \"Book\" button, the sitter's weekend and blocked days can't be picked", async () => {
    const blocked = [1, 2, 3, 4, 5, 6, 7].find(n => ![0, 6].includes(dayFrom(n).getDay()));
    db.insert('sitter_availability', { sitter_id: IDS.priya, date: toISODate(dayFrom(blocked)), is_available: false });
    await openApp(IDS.ananya);
    click('Book', within(await screen.findByRole('group', { name: 'Priya Kapoor' }, SLOW)));
    fireEvent.click(await screen.findByText('Request a walker'));
    next();
    await onScheduleStep();

    const sat = [1, 2, 3, 4, 5, 6, 7].find(n => dayFrom(n).getDay() === 6);
    for (const n of [sat, blocked]) {
      const tile = tiles(dayFrom(n))[0];
      expect(tile).toHaveAttribute('aria-disabled', 'true');
      expect(tile).toHaveAccessibleName(/ · Off$/);
      fireEvent.click(tile);
      expect(tile).toHaveAttribute('aria-pressed', 'false');
    }
    fireEvent.click(screen.getByText('7:00 AM'));
    next();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Which pet?')).toBeNull();
  }, 60000);

  test('A8: a full boarding night is crossed out and a stay across it cannot be booked', async () => {
    addBoardingHost({ home_details: { max_dogs: 1 } });
    db.insert('bookings', { id: 'bk-host', sitter_id: KAVITA.id, pet_parent_id: IDS.rohit, service_type: 'boarding', status: 'confirmed', booking_date: toISODate(dayFrom(3)), end_date: toISODate(dayFrom(5)), pet_ids: [IDS.coco] });
    await openApp(IDS.ananya);
    await openExploreTile('Boarding', KAVITA.name);
    fireEvent.click(within(exploreCard(KAVITA.name)).getByRole('button', { name: 'Request booking' }));
    await onScheduleStep();
    await waitFor(() => expect(tiles(dayFrom(3))[0]).toHaveAttribute('aria-disabled', 'true'));
    expect(tiles(dayFrom(3))[0]).toHaveAccessibleName(/Full$/);
    expect(tiles(dayFrom(4))[0]).toHaveAttribute('aria-disabled', 'true');

    fireEvent.click(tiles(dayFrom(2))[0]);
    await settle();
    expect(tiles(dayFrom(3))[1]).not.toHaveAttribute('aria-disabled');
    expect(tiles(dayFrom(4))[1]).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(tiles(dayFrom(4))[1]);
    expect(tiles(dayFrom(4))[1]).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByText('7:00 AM'));
    next();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Which pet?')).toBeNull();
  }, 60000);

  test('A9: with a saved address in a closed zone, booking from Explore is blocked and the waitlist is offered', async () => {
    db.insert('service_zones', { city_id: IDS.gurgaon, name: 'Sector 50–57', pincodes: ['122011'], is_open: false });
    db.insert('user_addresses', { id: 'addr-home', user_id: IDS.ananya, label: 'Home', flat: 'B-1203', area: 'Sector 56', pincode: '122011', city_id: IDS.gurgaon, lat: 28.4237, lng: 77.0981, is_default: true });
    await openApp(IDS.ananya);
    await openExploreTile('Dog walk', 'Priya Kapoor');
    fireEvent.click(within(exploreCard('Priya Kapoor')).getByRole('button', { name: 'Request booking' }));
    await onScheduleStep();
    pickOpenDay();
    fireEvent.click(screen.getByText('7:00 AM'));
    next();
    fireEvent.click(await screen.findByText('Bruno'));
    fireEvent.click(screen.getByRole('checkbox'));
    expect(await screen.findByText("We're not in Sector 56 yet")).toBeInTheDocument();
    next();
    expect(screen.getByRole('alert')).toHaveTextContent("We don't serve this area yet");
    expect(screen.queryByText('Review booking')).toBeNull();

    click('Join the waitlist');
    await waitFor(() => expect(db.rows('zone_waitlist')).toHaveLength(1));
    expect(db.rows('zone_waitlist')[0]).toMatchObject({ user_id: IDS.ananya, city_id: IDS.gurgaon, area: 'Sector 56', pincode: '122011' });
    expect(db.rows('bookings', { pet_parent_id: IDS.ananya, status: 'pending' })).toHaveLength(0);
  }, 60000);
});

describe('F. Sitter journey', () => {
  test('F1: the sitter accepts from Jobs; the parent sees Confirmed; chat works both ways', async () => {
    const pending = db.one('bookings', { id: 'bk-pending' });
    let view = await openSitterJobs(IDS.sunitaUser);
    fireEvent.click(within(cardFor(pending)).getByRole('button', { name: /Accept/ }));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-pending' }).status).toBe('confirmed'));
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.meera, type: 'booking_accepted' })).toHaveLength(1));
    click('Upcoming');
    fireEvent.click(within(cardFor(pending)).getByRole('button', { name: /Message/ }));
    await sendChat('नमस्ते! मैं शाम 5 बजे आऊँगी।');
    await waitFor(() => expect(db.rows('messages', { booking_id: 'bk-pending' })).toHaveLength(1));
    expect(db.one('messages', { booking_id: 'bk-pending' })).toMatchObject({ sender_id: IDS.sunitaUser, sender_type: 'sitter' });
    view.unmount();

    view = await openParentBookings(IDS.meera);
    const card = cardFor(pending);
    expect(within(card).getByText('Confirmed')).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: /Message/ }));
    expect(await screen.findByText('नमस्ते! मैं शाम 5 बजे आऊँगी।')).toBeInTheDocument();
    await sendChat('Great, Sheru will be ready.');
    await waitFor(() => expect(db.rows('messages', { booking_id: 'bk-pending' })).toHaveLength(2));
    view.unmount();

    await openSitterJobs(IDS.sunitaUser);
    nav('Messages');
    fireEvent.click(await screen.findByText('Great, Sheru will be ready.'));
    expect(await screen.findAllByText('Great, Sheru will be ready.')).not.toHaveLength(0);
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
  }, 60000);

  test('F2: start with the code → complete → photo report → both sides review; the parent confirms the photos', async () => {
    const restore = stubImagePipeline();
    try {
      const mid = db.one('bookings', { id: 'bk-mid' });
      mid.start_otp = '4321';
      let view = await openParentBookings(IDS.ananya);
      expect(within(cardFor(mid)).getByText('4321')).toBeInTheDocument();
      view.unmount();

      view = await openSitterJobs(IDS.sunitaUser);
      click('Upcoming');
      fireEvent.change(within(cardFor(mid)).getByPlaceholderText('0000'), { target: { value: '4321' } });
      click('Start', within(cardFor(mid)));
      await waitFor(() => expect(db.one('bookings', { id: 'bk-mid' }).status).toBe('active'));
      click('Active');
      fireEvent.click(within(await waitFor(() => cardFor(mid))).getByRole('button', { name: 'Complete walk ✓' }));
      await waitFor(() => expect(db.one('bookings', { id: 'bk-mid' }).status).toBe('completed'));
      click('Past');
      fireEvent.click(within(await waitFor(() => cardFor(mid))).getByRole('button', { name: '📸 Upload walk photos' }));
      fireEvent.change(document.body.querySelector('input[type="file"][multiple]'), { target: { files: [photo('a.jpg'), photo('b.jpg')] } });
      await waitFor(() => expect(document.body.querySelectorAll('img[alt]').length).toBeGreaterThanOrEqual(2));
      click('Upload photos');
      await waitFor(() => expect(db.rows('walk_photo_reports', { booking_id: 'bk-mid' })).toHaveLength(1));
      expect(db.one('walk_photo_reports', { booking_id: 'bk-mid' })).toMatchObject({ sitter_id: IDS.sunita, pet_parent_id: IDS.ananya, photo_count: 2 });

      const rate = await waitFor(() => within(cardFor(mid)).getByRole('button', { name: 'Rate this booking' }));
      fireEvent.click(rate);
      const form = screen.getByRole('region', { name: 'Rate this booking' });
      click('5 stars', within(form));
      click('Save rating', within(form));
      await waitFor(() => expect(db.rows('parent_reviews', { booking_id: 'bk-mid' })).toHaveLength(1));
      expect(db.one('parent_reviews', { booking_id: 'bk-mid' })).toMatchObject({ sitter_id: IDS.sunita, pet_parent_id: IDS.ananya, rating: 5 });
      view.unmount();

      await openParentBookings(IDS.ananya);
      click(/^Past/);
      fireEvent.click(within(cardFor(mid)).getByText(mid.booking_date));
      click('📸 View walk proof', within(cardFor(mid)));
      click(await screen.findByRole('button', { name: 'Confirm photos' }));
      await waitFor(() => expect(db.one('bookings', { id: 'bk-mid' }).parent_confirmed_photos).toBe(true));
      expect(db.one('walk_photo_reports', { booking_id: 'bk-mid' }).parent_confirmed).toBe(true);

      click('Review', within(cardFor(mid)));
      const textarea = screen.getByPlaceholderText(/Tell other pet parents/);
      fireEvent.click(within(textarea.parentElement).getAllByRole('button')[5]);
      fireEvent.change(textarea, { target: { value: 'Sunita ji was on time and Bruno came back happy.' } });
      click('Submit review', within(textarea.parentElement));
      await waitFor(() => expect(db.rows('reviews', { booking_id: 'bk-mid' })).toHaveLength(1));
      expect(db.one('reviews', { booking_id: 'bk-mid' })).toMatchObject({ sitter_id: IDS.sunita, reviewer_id: IDS.ananya, rating: 5 });
    } finally {
      restore();
    }
  }, 60000);

  test("F3: boarding check-in, a daily update and check-out each appear on the parent's stay timeline", async () => {
    const stay = db.insert('bookings', {
      id: 'bk-stay', booking_ref: 'FUR-STAY', city_id: IDS.gurgaon, service_type: 'boarding', pet_parent_id: IDS.ananya, sitter_id: IDS.priya, pet_id: IDS.bruno,
      status: 'confirmed', payment_status: 'paid', gross_amount_paise: 240000, sitter_payout_paise: 240000,
      booking_date: toISODate(dayFrom(1)), end_date: toISODate(dayFrom(3)), time_slot: '10:00 AM',
    });
    let view = await openSitterJobs(IDS.priyaUser);
    click('Upcoming');
    const stayCard = () => screen.getAllByText('Home boarding')[0].closest('div[style*="border-radius: 20px"]');
    click('Start check-in', within(stayCard()));
    const checkIn = within(screen.getByRole('region', { name: 'Check in Bruno' }));
    fireEvent.change(checkIn.getByLabelText('Food and amounts'), { target: { value: '2 cups at 8 am and 7 pm' } });
    addPhoto('handover-photo-input', checkIn);
    await checkIn.findByAltText('Photo 1');
    click('Confirm check-in', checkIn);
    await waitFor(() => expect(db.one('bookings', { id: 'bk-stay' }).status).toBe('active'));

    click(await screen.findByRole('button', { name: /Post today's update for Bruno/ }));
    const update = within(await screen.findByRole('region', { name: "Post today's update" }));
    addPhoto('stay-update-photo-input', update);
    await update.findByAltText('Photo 1');
    click('Happy', update);
    fireEvent.change(update.getByLabelText('Short note'), { target: { value: 'Long walk, ate everything' } });
    click('Post update', update);
    await update.findByText(/Today's update sent at/);
    view.unmount();

    view = await openParentBookings(IDS.ananya);
    click(/^Active/);
    const live = await screen.findByRole('region', { name: 'Stay timeline' });
    expect(await within(live).findByText('Long walk, ate everything')).toBeInTheDocument();
    expect(within(live).getByText('2 cups at 8 am and 7 pm')).toBeInTheDocument();
    view.unmount();

    view = await openSitterJobs(IDS.priyaUser);
    click('Active');
    click('Check out', within(await waitFor(() => cardFor(stay))));
    const out = within(screen.getByRole('region', { name: 'Check out Bruno' }));
    addPhoto('pickup-photo-input', out);
    await out.findByAltText('Photo 1');
    fireEvent.change(out.getByLabelText('Note for the parent'), { target: { value: 'Lovely guest, come again' } });
    click('Confirm check-out', out);
    await waitFor(() => expect(db.one('bookings', { id: 'bk-stay' }).status).toBe('completed'));
    view.unmount();

    await openParentBookings(IDS.ananya);
    click(/^Past/);
    fireEvent.click(within(cardFor(stay)).getByText(stay.booking_date));
    const timeline = await screen.findByRole('region', { name: 'Stay timeline' });
    await within(timeline).findByText('Long walk, ate everything');
    expect(within(timeline).getAllByRole('listitem').map(li => li.querySelector('span[style*="font-weight: 600"]').textContent)).toEqual(['Checked in', 'Daily update', 'Checked out']);
    expect(within(timeline).getByText('Lovely guest, come again')).toBeInTheDocument();
  }, 60000);
});
