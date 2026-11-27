// Boarding (and sitting) as a real side business: the boarding earnings
// estimate at signup, pricing tools, cancellation policy and booking options,
// check-in / daily updates / check-out for stays, hosts rating parents and
// dogs, the yearly earnings statement, Hindi, and running before migration 038.
// Played against the in-memory database (src/testing/fakeSupabase.js).
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildPuneSeed, IDS, PUNE } from '../testing/seed';
import SitterOnboarding from '../SitterOnboarding';
import SitterEditProfile from '../SitterEditProfile';
import SitterDashboard from '../SitterDashboard';
import SitterEarningsDashboard, { fyStatement, statementCsv } from '../SitterEarningsDashboard';
import SitterRequestsFeed from '../SitterRequestsFeed';
import StayTimeline from '../StayTimeline';
import LanguageToggle from '../LanguageToggle';
import { stayPrice, upcomingHolidays, nextFriday } from '../HostSettings';
import { dogHistory } from '../ParentReviews';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../compressImage', () => ({ compressImage: (file) => Promise.resolve(file) }));

const fake = require('../testing/fakeSupabase');
const DAY = 24 * 60 * 60 * 1000;
const HOST = { user: 'u-kavita', id: 'sp-kavita' };

function addHost(extra = {}) {
  db.table('users').push({ id: HOST.user, name: 'Kavita Rane', email: 'kavita@test.example', phone: '9860000005', city_id: IDS.pune });
  db.table('sitter_profiles').push({
    id: HOST.id, user_id: HOST.user, city_id: IDS.pune, status: 'active', provider_type: 'boarding',
    bio: 'I work from home in Wakad and host at most two dogs at a time, with a fenced garden and walks twice a day.',
    headline: 'Home boarding in Wakad', base_area: 'Wakad', service_radius_km: 5, languages: ['English'],
    home_details: { home_type: 'villa', rules: 'Dogs sleep indoors. No sofa.' }, home_photos: [], ...extra,
  });
  db.table('sitter_services').push({ id: 'svc-kavita', sitter_id: HOST.id, service_type: 'boarding', price_paise: 95000, is_active: true });
}
const hostRow = () => db.one('sitter_profiles', { id: HOST.id });

function addStay(id, extra = {}) {
  return db.insert('bookings', {
    id, booking_ref: 'FUR-' + id.slice(-4).toUpperCase(), city_id: IDS.gurgaon, service_type: 'boarding', pet_parent_id: IDS.ananya, sitter_id: IDS.priya,
    pet_id: IDS.bruno, status: 'confirmed', payment_status: 'held', gross_amount_paise: 360000, sitter_payout_paise: 360000,
    booking_date: new Date(Date.now() + DAY).toISOString().slice(0, 10), time_slot: '10:00 AM', ...extra,
  });
}

function setLanguage(l) {
  const view = render(<LanguageToggle />);
  fireEvent.click(screen.getByText(l === 'hi' ? 'हिं' : 'EN'));
  view.unmount();
}

const click = (name, container = screen) => fireEvent.click(container.getByRole('button', { name }));
const photo = (testId, name = 'p.jpg', container = screen) =>
  fireEvent.change(container.getByTestId(testId), { target: { files: [new File(['x'], name, { type: 'image/jpeg' })] } });

async function openDashboard(userId = IDS.priyaUser) {
  db.signInAs(userId);
  const view = render(<SitterDashboard city="Gurgaon" onBack={jest.fn()} />);
  await waitFor(() => expect(screen.queryByText('Loading your jobs...')).toBeNull());
  return view;
}
const cardFor = async (petOrParent) => {
  const matches = await screen.findAllByText(petOrParent);
  return matches[0].closest('div[style*="border-radius: 20px"]');
};

// Production before migration 038: its columns and tables don't exist yet.
function without038() {
  const realFrom = fake.supabase.from;
  const refuse = (message) => {
    const r = {};
    ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'limit', 'single', 'maybeSingle'].forEach(m => { r[m] = () => r; });
    r.then = (ok, fail) => Promise.resolve({ data: null, error: { message } }).then(ok, fail);
    return r;
  };
  const columns = {
    sitter_profiles: ['pricing_rules', 'cancellation_policy', 'instant_book', 'requires_vaccination'],
    bookings: ['checked_in_at', 'checked_out_at', 'handover'],
  };
  fake.supabase.from = (t) => {
    if (t === 'stay_updates' || t === 'parent_reviews') return refuse('relation "public.' + t + '" does not exist');
    const b = realFrom(t);
    if (!columns[t]) return b;
    ['insert', 'upsert', 'update'].forEach(m => {
      const orig = b[m];
      b[m] = (row, ...rest) => {
        const bad = row && columns[t].find(c => c in row);
        return bad ? refuse("Could not find the '" + bad + "' column of '" + t + "' in the schema cache") : orig(row, ...rest);
      };
    });
    return b;
  };
  return () => { fake.supabase.from = realFrom; };
}

beforeEach(() => {
  localStorage.clear();
  setLanguage('en');
  db.reset(buildPuneSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  window.print = jest.fn();
});

describe('Boarding earnings estimate at signup', () => {
  test('HP1: boarding-only shows dogs × nights at the city price, with steppers; walkers keep the walk estimate', async () => {
    db.table('users').push({ id: 'u-new', name: 'n@test.example', email: 'n@test.example' });
    db.signInAs('u-new');
    render(<SitterOnboarding city="Pune" onDone={jest.fn()} />);
    await screen.findByText('How do you want to help?');
    expect(screen.getByText('Rs.19,000')).toBeInTheDocument();
    expect(screen.queryByTestId('boarding-estimate')).toBeNull();

    click(/Home boarding only/);
    expect(screen.queryByText('Rs.19,000')).toBeNull();
    expect(screen.getByText('Host 2 dogs × 8 nights a month')).toBeInTheDocument();
    expect(screen.getByTestId('boarding-estimate').textContent).toMatch(/Rs\.12,800/);
    expect(screen.getByText(/At Rs\.800 a night, a typical price in Pune/)).toBeInTheDocument();
    click('More dogs');
    click('Fewer nights');
    expect(screen.getByText('Host 3 dogs × 7 nights a month')).toBeInTheDocument();
    expect(screen.getByTestId('boarding-estimate').textContent).toMatch(/Rs\.16,800/);
    click('Fewer dogs'); click('Fewer dogs');
    expect(screen.getByText('Host 1 dog × 7 nights a month')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fewer dogs' })).toBeDisabled();

    click(/^Both/);
    expect(screen.getByText('Rs.19,000')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Plus home boarding' })).toBeInTheDocument();
  });

  test("HP2: a resumed draft estimates with the host's own nightly price", async () => {
    db.table('users').push({ id: 'u-new', name: 'Kavya', email: 'k@test.example' });
    db.table('sitter_profiles').push({ id: 'sp-new', user_id: 'u-new', city_id: IDS.pune, status: 'draft', onboarding_step: 1, provider_type: 'boarding' });
    db.table('sitter_services').push({ id: 'svc-new', sitter_id: 'sp-new', service_type: 'boarding', price_paise: 120000, is_active: true });
    db.signInAs('u-new');
    render(<SitterOnboarding city="Pune" onDone={jest.fn()} />);
    await screen.findByRole('button', { name: 'Back' });
    click('Back');
    await screen.findByText('How do you want to help?');
    expect(screen.getByTestId('boarding-estimate').textContent).toMatch(/Rs\.19,200/);
    expect(screen.getByText(/At your price of Rs\.1200 a night/)).toBeInTheDocument();
  });
});

describe('Host settings', () => {
  test('HP3: stayPrice follows the documented rules', () => {
    const rules = { weekend_pct: 20, holiday_pct: 50, holidays: ['2027-01-01'], extra_dog_pct: 25, long_stay_nights: 3, long_stay_pct: 10, puppy_extra_rupees: 200, pickup_fee_rupees: 300 };
    // Fri 1 Jan 2027 is both weekend and holiday: the larger 50% applies, not 70%.
    expect(stayPrice({ nightly: 1000, rules, checkIn: '2027-01-01', nights: 3, dogs: 2, puppies: 1, pickup: true })).toEqual({
      base: 3000, surcharge: 700, extraDogs: 2775, longStay: 648, puppy: 200, pickup: 300, weekendNights: 2, holidayNights: 1, total: 6328,
    });
    expect(stayPrice({ nightly: 800, checkIn: '2027-01-04', nights: 4, dogs: 2 }).total).toBe(6400);
    expect(stayPrice({ nightly: 1000, rules: { long_stay_nights: 7, long_stay_pct: 10 }, checkIn: '2027-01-04', nights: 6 }).longStay).toBe(0);
    const h = upcomingHolidays(new Date(2026, 10, 27));
    expect(h).toEqual(expect.arrayContaining(['2026-12-25', '2027-01-26', '2027-08-15', '2027-10-29']));
    expect(h.every(d => d >= '2026-11-27' && d < '2027-11-27')).toBe(true);
  });

  test('HP4: pricing rules, policy and booking options save, with a live example and a change list', async () => {
    addHost();
    db.signInAs(HOST.user);
    render(<SitterEditProfile city="Pune" onBack={jest.fn()} />);
    await screen.findByText('Kavita Rane');
    click('Services');
    const holidays = upcomingHolidays();
    expect(within(screen.getByRole('list', { name: 'Holiday dates' })).getAllByRole('listitem')).toHaveLength(holidays.length);
    expect(screen.getByTestId('host-example-total').textContent).toBe('Rs.' + stayPrice({ nightly: 950, rules: { holidays }, checkIn: nextFriday(), nights: 3, dogs: 2 }).total.toLocaleString('en-IN'));

    const set = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
    set('Weekend surcharge', '20');
    set('Holiday surcharge', '50');
    set('Long stay from', '7');
    set('Long-stay discount', '10');
    set('Second-dog discount', '25');
    set('Puppy extra', '200');
    set('Pick-up and drop fee', '300');
    set('Weekend surcharge', '250');
    expect(screen.getByLabelText('Weekend surcharge').value).toBe('100');
    set('Weekend surcharge', '20');
    fireEvent.click(screen.getAllByRole('button', { name: /^Remove / })[0]);
    set('Add a holiday', '2027-06-01');
    click('Add');
    const rules = { weekend_pct: 20, holiday_pct: 50, long_stay_nights: 7, long_stay_pct: 10, extra_dog_pct: 25, puppy_extra_rupees: 200, pickup_fee_rupees: 300, holidays: [...holidays.slice(1), '2027-06-01'].sort() };
    const expected = stayPrice({ nightly: 950, rules, checkIn: nextFriday(), nights: 3, dogs: 2, pickup: true });
    expect(screen.getByTestId('host-example-total').textContent).toBe('Rs.' + expected.total.toLocaleString('en-IN'));
    expect(within(screen.getByRole('status', { name: 'Example' })).getByText('Pick-up and drop')).toBeInTheDocument();

    expect(screen.getByText('Dogs sleep indoors. No sofa.')).toBeInTheDocument();
    expect(screen.getByText('Parents must accept these before booking')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Moderate/ })).toHaveAttribute('aria-pressed', 'true');
    click(/^Strict/);
    fireEvent.click(screen.getByRole('switch', { name: 'Instant book' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Require vaccination proof' }));
    expect(screen.getByRole('switch', { name: 'Instant book' })).toHaveAttribute('aria-checked', 'true');
    click('Save changes');

    await waitFor(() => expect(hostRow().cancellation_policy).toBe('strict'));
    expect(hostRow()).toEqual(expect.objectContaining({ instant_book: true, requires_vaccination: true, pricing_rules: rules }));
    const changes = within(screen.getByRole('status', { name: 'What changed' })).getAllByRole('listitem').map(li => li.textContent);
    expect(changes).toEqual(expect.arrayContaining([
      'Weekend surcharge: (empty) → 20%', 'Puppy extra: (empty) → Rs.200', 'Long stay from: (empty) → 7 nights',
      'Cancellation policy: Moderate → Strict', 'Instant book: Off → On', 'Require vaccination proof: Off → On',
    ]));
    expect(changes.find(c => c.startsWith('Holiday dates:'))).toMatch(/added 1 Jun 2027; removed/);

    click('Your home');
    expect(screen.getByText('Parents must accept these before booking')).toBeInTheDocument();
  });

  test('HP5: walkers get the policy and booking options but no boarding pricing tools', async () => {
    db.signInAs(PUNE.omkarUser);
    render(<SitterEditProfile city="Pune" onBack={jest.fn()} />);
    await screen.findByText('Omkar Joshi');
    click('Services');
    expect(screen.getByRole('heading', { name: 'Cancellation policy' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pricing tools' })).toBeNull();
    click(/^Flexible/);
    click('Save changes');
    await waitFor(() => expect(db.one('sitter_profiles', { id: PUNE.omkar }).cancellation_policy).toBe('flexible'));
  });
});

describe('Stays: check-in, daily updates, check-out', () => {
  test('HP6: a boarding stay is checked in with a checklist, updated daily and checked out; walks keep the start code', async () => {
    addStay('bk-stay');
    await openDashboard();
    click('Upcoming');
    expect(screen.getAllByPlaceholderText('0000')).toHaveLength(2);
    const stay = await cardFor('Home boarding');
    expect(within(stay).queryByPlaceholderText('0000')).toBeNull();
    click('Start check-in', within(stay));
    const form = screen.getByRole('region', { name: 'Check in Bruno' });
    click('Confirm check-in', within(form));
    expect(within(form).getByRole('alert')).toHaveTextContent('Add what the dog eats before you check in.');
    fireEvent.change(within(form).getByLabelText('Food and amounts'), { target: { value: '2 cups at 8 am and 7 pm' } });
    fireEvent.change(within(form).getByLabelText('Medicines and schedule'), { target: { value: 'Tick tablet on Sunday' } });
    click('Collar', within(form));
    click('Leash', within(form));
    expect(within(form).getByRole('button', { name: 'Collar' })).toHaveAttribute('aria-pressed', 'true');
    photo('handover-photo-input', 'drop.jpg', within(form));
    await within(form).findByAltText('Photo 1');
    fireEvent.change(within(form).getByLabelText('Notes'), { target: { value: 'Scared of fireworks' } });
    click('Confirm check-in', within(form));

    await waitFor(() => expect(db.one('bookings', { id: 'bk-stay' }).status).toBe('active'));
    const row = db.one('bookings', { id: 'bk-stay' });
    expect(row.checked_in_at).toEqual(expect.any(String));
    expect(row.handover).toEqual({ food: '2 cups at 8 am and 7 pm', meds: 'Tick tablet on Sunday', belongings: ['collar', 'leash'], photos: [expect.stringMatching(/^https:\/\/storage\.test\/walk-photos\/stay-u-priya-/)], notes: 'Scared of fireworks' });
    expect(db.one('notifications', { user_id: IDS.ananya, type: 'stay_checked_in' })).toEqual(expect.objectContaining({ title: 'Priya Kapoor checked in Bruno', booking_id: 'bk-stay' }));

    expect(await screen.findByRole('button', { name: /Post today's update for Bruno/ })).toBeInTheDocument();
    click(/Post today's update for Bruno/);
    const update = await screen.findByRole('region', { name: "Post today's update" });
    expect(within(update).getByText('No update today yet. Ananya Sharma is waiting to hear how Bruno is doing.')).toBeInTheDocument();
    click('Post update', within(update));
    expect(within(update).getByRole('alert')).toHaveTextContent('Add at least one photo.');
    photo('stay-update-photo-input', 'park.jpg', within(update));
    await within(update).findByAltText('Photo 1');
    click('Happy', within(update));
    fireEvent.change(within(update).getByLabelText('Short note'), { target: { value: 'Long walk, ate everything' } });
    click('Post update', within(update));
    await within(update).findByText(/Today's update sent at/);
    expect(db.rows('stay_updates', { booking_id: 'bk-stay' })).toEqual([expect.objectContaining({ sitter_id: IDS.priya, mood: 'happy', note: 'Long walk, ate everything', photo_urls: [expect.any(String)] })]);
    expect(db.one('notifications', { user_id: IDS.ananya, type: 'stay_update' })).toEqual(expect.objectContaining({ title: 'Bruno update from Priya Kapoor', body: 'Happy · Long walk, ate everything' }));
    expect(screen.queryByRole('button', { name: /Post today's update for Bruno/ })).toBeNull();

    click('Check out');
    const out = screen.getByRole('region', { name: 'Check out Bruno' });
    photo('pickup-photo-input', 'home.jpg', within(out));
    await within(out).findByAltText('Photo 1');
    fireEvent.change(within(out).getByLabelText('Note for the parent'), { target: { value: 'Lovely guest, come again' } });
    click('Confirm check-out', within(out));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-stay' }).status).toBe('completed'));
    const done = db.one('bookings', { id: 'bk-stay' });
    expect(done.checked_out_at).toEqual(expect.any(String));
    expect(done.handover).toEqual(expect.objectContaining({ food: '2 cups at 8 am and 7 pm', pickup_note: 'Lovely guest, come again', pickup_photos: [expect.any(String)] }));
    expect(db.one('notifications', { user_id: IDS.ananya, type: 'stay_checked_out' })).toEqual(expect.objectContaining({ title: 'Bruno is checked out', body: 'Lovely guest, come again' }));
  });

  test('HP7: the nudge shows when the last update was yesterday, and the parent sees the whole stay timeline', async () => {
    const stay = addStay('bk-stay', { status: 'active', checked_in_at: new Date(Date.now() - 2 * DAY).toISOString(),
      handover: { food: 'Royal Canin twice a day', meds: '', belongings: ['bed'], photos: ['https://storage.test/h.jpg'], notes: '' } });
    db.insert('stay_updates', { booking_id: 'bk-stay', sitter_id: IDS.priya, photo_urls: ['https://storage.test/u1.jpg'], mood: 'settled', note: 'Settling in well', created_at: new Date(Date.now() - DAY - 60000).toISOString() });
    await openDashboard();
    expect(screen.getByRole('button', { name: /Post today's update for Bruno/ })).toBeInTheDocument();
    click('Active');
    expect(screen.getByText(/No update today yet/)).toBeInTheDocument();
    expect(screen.getByText('1 updates so far')).toBeInTheDocument();

    db.signInAs(IDS.ananya);
    render(<StayTimeline booking={{ ...stay, checked_out_at: new Date().toISOString(), handover: { ...stay.handover, pickup_note: 'Bye Bruno', pickup_photos: [] } }} />);
    const timeline = await screen.findByRole('region', { name: 'Stay timeline' });
    await within(timeline).findByText('Settling in well');
    expect(within(timeline).getAllByRole('listitem').map(li => li.querySelector('span[style*="font-weight: 600"]').textContent)).toEqual(['Checked in', 'Daily update', 'Checked out']);
    expect(within(timeline).getByText('Royal Canin twice a day')).toBeInTheDocument();
    expect(within(timeline).getByText('Bed')).toBeInTheDocument();
    expect(within(timeline).getByText('Settled')).toBeInTheDocument();
    expect(within(timeline).getByText('Bye Bruno')).toBeInTheDocument();
    expect(within(timeline).getAllByRole('img')).toHaveLength(2);
  });
});

describe('Hosts review parents and dogs', () => {
  test('HP8: a completed booking can be rated once, with stars, behaviour and a note', async () => {
    await openDashboard();
    click('Past');
    const past = await cardFor('Request a walker');
    click('Rate this booking', within(past));
    const form = screen.getByRole('region', { name: 'Rate this booking' });
    click('Save rating', within(form));
    expect(within(form).getByRole('alert')).toHaveTextContent('Pick a star rating first.');
    click('4 stars', within(form));
    expect(within(form).getByRole('button', { name: '4 stars' })).toHaveAttribute('aria-pressed', 'true');
    click('Calm', within(form));
    fireEvent.change(within(form).getByLabelText('Note for other hosts'), { target: { value: 'x'.repeat(520) } });
    expect(within(form).getByText('500/500')).toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText('Note for other hosts'), { target: { value: 'Sweet boy, pulls near cats' } });
    click('Save rating', within(form));
    expect(await screen.findByText('You rated this booking 4 of 5.')).toBeInTheDocument();
    expect(db.rows('parent_reviews')).toEqual([expect.objectContaining({ booking_id: 'bk-done', sitter_id: IDS.priya, pet_parent_id: IDS.ananya, pet_id: IDS.bruno, rating: 4, dog_behaviour: 'calm', note: 'Sweet boy, pulls near cats' })]);
  });

  test('HP9: booking requests and nearby requests show the dog history line', async () => {
    [[IDS.sunita, 5, 'calm', IDS.bruno], [IDS.ram, 5, 'playful', null], [PUNE.omkar, 4, 'calm', IDS.bruno]].forEach(([sitter, rating, beh, pet], i) =>
      db.insert('parent_reviews', { booking_id: 'old-' + i, sitter_id: sitter, pet_parent_id: IDS.ananya, pet_id: pet, rating, dog_behaviour: beh }));
    expect(dogHistory(db.rows('parent_reviews'), IDS.bruno)).toEqual({ rating: 4.7, hosts: 3, behaviour: 'calm' });
    addStay('bk-ask', { status: 'pending' });
    await openDashboard();
    const req = await cardFor('Home boarding');
    expect(within(req).getByText('4.7 from 3 hosts · usually calm')).toBeInTheDocument();

    db.insert('broadcast_requests', { id: 'br-1', pet_parent_id: IDS.ananya, city_id: IDS.gurgaon, service_type: 'walk30', status: 'open', area: 'DLF Phase 3',
      pet_summary: { id: IDS.bruno, name: 'Bruno', breed: 'Labrador' }, expires_at: new Date(Date.now() + DAY).toISOString() });
    db.insert('broadcast_recipients', { request_id: 'br-1', sitter_id: IDS.priya });
    render(<SitterRequestsFeed profile={db.one('sitter_profiles', { id: IDS.priya })} />);
    const article = await screen.findByRole('article', { name: /DLF Phase 3/ });
    expect(await within(article).findByText('4.7 from 3 hosts · usually calm')).toBeInTheDocument();
  });
});

describe('Yearly earnings statement', () => {
  const add = (id, completedAt, paise, extra = {}) => db.insert('bookings', { id, booking_ref: 'FUR-' + id.toUpperCase(), city_id: IDS.gurgaon, pet_parent_id: IDS.rohit, sitter_id: IDS.priya, pet_id: IDS.coco,
    service_type: 'boarding', status: 'completed', payment_status: 'paid', gross_amount_paise: paise, sitter_payout_paise: paise, booking_date: completedAt.slice(0, 10), completed_at: completedAt, ...extra });

  test('HP10: picks an April–March year, totals gross, fee, net and months, and downloads CSV or prints', async () => {
    add('fy1', '2025-04-02T10:00:00.000Z', 120000);
    add('fy2', '2025-04-20T10:00:00.000Z', 80000);
    add('fy3', '2026-03-30T10:00:00.000Z', 100000);
    add('fy4', '2025-03-30T10:00:00.000Z', 50000);
    db.signInAs(IDS.priyaUser);
    render(<SitterEarningsDashboard city="Gurgaon" onBack={jest.fn()} />);
    const section = await screen.findByRole('region', { name: 'Yearly statement' });
    click('FY 2025–26', within(section));
    const totals = within(section).getAllByRole('definition').map(d => d.textContent);
    expect(totals).toEqual(['Rs. 3000.00', 'Rs. 450.00', 'Rs. 2550.00', '3', '2']);
    expect(within(section).getByText('Keep this for your income tax return.')).toBeInTheDocument();
    click('FY 2024–25', within(section));
    expect(within(section).getAllByRole('definition').map(d => d.textContent)).toEqual(['Rs. 500.00', 'Rs. 75.00', 'Rs. 425.00', '1', '1']);

    URL.createObjectURL = jest.fn(() => 'blob:statement');
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { clickSpy.download = this.download; });
    click('Download CSV', within(section));
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickSpy.download).toBe('fursday-statement-FY2024-25.csv');
    clickSpy.mockRestore();

    click('Printable statement', within(section));
    const dialog = screen.getByRole('dialog', { name: 'Fursday earnings statement' });
    expect(within(dialog).getByText('For Priya Kapoor')).toBeInTheDocument();
    expect(within(dialog).getByText('March 2025')).toBeInTheDocument();
    click('Print', within(dialog));
    expect(window.print).toHaveBeenCalled();
  });

  test('HP11: the CSV lists every booking and the totals', () => {
    const when = (s) => new Date(s);
    const rows = [
      { completed: true, when: when('2025-05-01T10:00:00Z'), ref: 'FUR-A', service: 'boarding', bookingRs: 1000, earnedRs: 850 },
      { completed: true, when: when('2025-06-01T10:00:00Z'), ref: 'FUR-B', service: 'walk30', bookingRs: 400, earnedRs: 340 },
      { completed: false, when: when('2025-06-02T10:00:00Z'), ref: 'FUR-C', service: 'walk30', bookingRs: 400, earnedRs: 340 },
    ];
    const csv = statementCsv(fyStatement(rows, 2025)).split('\n');
    expect(csv[0]).toBe('Date,Booking ref,Service,Booking value (Rs),Fursday fee (Rs),You earned (Rs)');
    expect(csv[1]).toBe('2025-05-01,FUR-A,boarding,1000.00,150.00,850.00');
    expect(csv[2]).toBe('2025-06-01,FUR-B,walk30,400.00,60.00,340.00');
    expect(csv[4]).toBe('Total FY 2025-26,,,1400.00,210.00,1190.00');
    expect(csv).toHaveLength(6);
  });
});

describe('Hindi', () => {
  test('HP12: the new host screens read in Hindi', async () => {
    setLanguage('hi');
    db.table('users').push({ id: 'u-new', name: 'n@test.example', email: 'n@test.example' });
    db.signInAs('u-new');
    const { unmount: closeSignup } = render(<SitterOnboarding city="Pune" onDone={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /सिर्फ़ घर पर बोर्डिंग/ }));
    expect(screen.getByText('महीने में 2 डॉग × 8 रातें होस्ट करें')).toBeInTheDocument();
    closeSignup();

    addHost();
    db.signInAs(HOST.user);
    const { unmount: closeEdit } = render(<SitterEditProfile city="Pune" onBack={jest.fn()} />);
    await screen.findByText('Kavita Rane');
    fireEvent.click(screen.getByRole('button', { name: 'सेवाएं' }));
    ['कीमत के नियम', 'कैंसल करने की नीति', 'बुकिंग के विकल्प'].forEach(t => expect(screen.getByRole('heading', { name: t })).toBeInTheDocument());
    expect(screen.getByRole('switch', { name: 'तुरंत बुकिंग' })).toBeInTheDocument();
    closeEdit();

    addStay('bk-stay', { status: 'active' });
    db.signInAs(IDS.priyaUser);
    render(<SitterDashboard city="Gurgaon" onBack={jest.fn()} />);
    expect(await screen.findByRole('button', { name: /Bruno का आज का अपडेट भेजें/ })).toBeInTheDocument();
  });
});

describe('Before migration 038 runs', () => {
  test('HP13: edit profile, check-in/out, daily updates and ratings all keep working', async () => {
    const restore = without038();
    try {
      addHost();
      db.signInAs(HOST.user);
      const { unmount: closeEdit } = render(<SitterEditProfile city="Pune" onBack={jest.fn()} />);
      await screen.findByText('Kavita Rane');
      fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Quiet home in Wakad' } });
      click('Services');
      fireEvent.click(screen.getByRole('switch', { name: 'Instant book' }));
      click('Save changes');
      await waitFor(() => expect(hostRow().headline).toBe('Quiet home in Wakad'));
      expect(hostRow().instant_book).toBeUndefined();
      expect(window.alert).not.toHaveBeenCalled();
      closeEdit();

      addStay('bk-stay');
      await openDashboard();
      click('Upcoming');
      click('Start check-in', within(await cardFor('Home boarding')));
      const form = screen.getByRole('region', { name: 'Check in Bruno' });
      fireEvent.change(within(form).getByLabelText('Food and amounts'), { target: { value: 'Rice and chicken' } });
      click('Confirm check-in', within(form));
      await waitFor(() => expect(db.one('bookings', { id: 'bk-stay' }).status).toBe('active'));
      expect(db.one('bookings', { id: 'bk-stay' }).handover).toBeUndefined();

      await waitFor(() => expect(screen.queryByText('Loading your jobs...')).toBeNull());
      click('Active');
      const update = await screen.findByRole('region', { name: "Post today's update" });
      photo('stay-update-photo-input', 'p.jpg', within(update));
      await within(update).findByAltText('Photo 1');
      click('Post update', within(update));
      await within(update).findByText('Update sent to Ananya Sharma.');
      expect(db.one('notifications', { user_id: IDS.ananya, type: 'stay_update' })).toBeTruthy();

      click('Check out');
      click('Confirm check-out', within(screen.getByRole('region', { name: 'Check out Bruno' })));
      await waitFor(() => expect(db.one('bookings', { id: 'bk-stay' }).status).toBe('completed'));
      expect(db.one('bookings', { id: 'bk-stay' }).checked_out_at).toBeUndefined();

      click('Past');
      const past = (await screen.findAllByText('Home boarding'))[0].closest('div[style*="border-radius: 20px"]');
      click('Rate this booking', within(past));
      click('5 stars', within(past));
      click('Save rating', within(past));
      expect(await within(past).findByText('Ratings are not open yet. Please try again later.')).toBeInTheDocument();
    } finally { restore(); }
  });
});
