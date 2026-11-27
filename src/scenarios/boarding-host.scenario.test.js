// Boarding-only hosts: a shorter signup with a "Your home" step, the home
// editor in Edit profile, the public "Their home" section, the Explore home
// line, and saving before migration 037 has run. Played against the
// in-memory database (src/testing/fakeSupabase.js).
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildPuneSeed, IDS, PUNE } from '../testing/seed';
import SitterOnboarding from '../SitterOnboarding';
import SitterEditProfile from '../SitterEditProfile';
import SitterProfile from '../SitterProfile';
import ExploreScreen from '../ExploreScreen';
import LanguageToggle from '../LanguageToggle';
import { homeStrength } from '../BoardingHomeEditor';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
// jsdom can't decode images, so photos upload as picked.
jest.mock('../compressImage', () => ({ compressImage: (file) => Promise.resolve(file) }));

const fake = require('../testing/fakeSupabase');

const HOST = { user: 'u-kavita', id: 'sp-kavita' };
const FULL_HOME = {
  home_type: 'independent_house', outdoor: ['garden', 'park_nearby'], someone_home: 'all_day', kids: 'older', other_pets: 'dogs',
  sleeping: 'own_bed', ac: true, max_dogs: 2, sizes: ['small', 'medium'], vet_km: 1.5, updates: 'photos_twice',
  rules: 'Dogs sleep indoors, not on the sofa. Walks at 7 am and 6 pm.',
};

function addHost(extra = {}) {
  db.table('users').push({ id: HOST.user, name: 'Kavita Rane', email: 'kavita@test.example', phone: '9860000005', city_id: IDS.pune });
  db.table('sitter_profiles').push({
    id: HOST.id, user_id: HOST.user, city_id: IDS.pune, status: 'active', provider_type: 'boarding',
    bio: 'I work from home in Wakad and host at most two dogs at a time, with a fenced garden and walks twice a day in the park nearby.',
    headline: 'Home boarding in Wakad', highlights: ['Night stays'], experience_text: '5+ years', base_area: 'Wakad', service_radius_km: 5,
    profile_photo_url: 'https://storage.test/kavita.jpg', languages: ['English', 'Marathi'], aadhaar_verified: true, rating: 4.9, total_bookings: 7,
    home_details: { home_type: 'villa', outdoor: ['terrace'] }, home_photos: [], ...extra,
  });
  db.table('sitter_services').push({ id: 'svc-kavita', sitter_id: HOST.id, service_type: 'boarding', price_paise: 95000, is_active: true });
  db.table('sitter_profile_photos').push({ id: 'ph-kavita', sitter_id: HOST.id, photo_url: 'https://storage.test/k-dog.jpg', display_order: 0 });
  db.table('sitter_pii').push({ id: 'pii-kavita', sitter_id: HOST.id, aadhaar_number: '333344445555', upi_id: 'kavita@okicici' });
}
const hostRow = () => db.one('sitter_profiles', { user_id: HOST.user });

function setLanguage(l) {
  const view = render(<LanguageToggle />);
  fireEvent.click(screen.getByText(l === 'hi' ? 'हिं' : 'EN'));
  view.unmount();
}

// Production before migration 037: any sitter_profiles write naming its columns fails.
function without037() {
  const realFrom = fake.supabase.from;
  const refuse = () => {
    const r = { select: () => r, single: () => r, maybeSingle: () => r, eq: () => r };
    r.then = (ok, fail) => Promise.resolve({ data: null, error: { message: "Could not find the 'home_details' column of 'sitter_profiles' in the schema cache" } }).then(ok, fail);
    return r;
  };
  fake.supabase.from = (t) => {
    const b = realFrom(t);
    if (t !== 'sitter_profiles') return b;
    ['insert', 'upsert', 'update'].forEach(m => {
      const orig = b[m];
      b[m] = (row, ...rest) => (row && ['provider_type', 'home_details', 'home_photos'].some(c => c in row) ? refuse() : orig(row, ...rest));
    });
    return b;
  };
  return () => { fake.supabase.from = realFrom; };
}

const realGeo = navigator.geolocation;
beforeEach(() => {
  localStorage.clear();
  db.reset(buildPuneSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok, fail) => fail && fail({ code: 1 }) } });
});
afterAll(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: realGeo }));

const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
const pressed = (name) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

async function startBoardingSignup() {
  db.table('users').push({ id: 'u-new', name: 'kavya@test.example', email: 'kavya@test.example' });
  db.signInAs('u-new');
  const view = render(<SitterOnboarding city="Pune" onDone={jest.fn()} />);
  await screen.findByText('How do you want to help?');
  click(/Home boarding only/);
  fireEvent.click(screen.getByRole('switch', { name: /Also offer daycare at my home/ }));
  click(/I want to earn this/);
  fireEvent.change(screen.getByLabelText('Your full name...'), { target: { value: 'Kavya Nair' } });
  click('Send');
  fireEvent.change(screen.getByLabelText('WhatsApp number'), { target: { value: '9870000009' } });
  click('Next');
  await screen.findByRole('heading', { name: 'Your home' });
  return view;
}

describe('Boarding-only signup', () => {
  test('BH1: skips walk services, adds a home step, and saves type, home details and photos', async () => {
    await startBoardingSignup();
    expect(screen.getByText('Step 2 of 8')).toBeInTheDocument();
    expect(screen.queryByText('What will you offer?')).toBeNull();
    expect(screen.getByText('Add a photo of where dogs sleep (+15%)')).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Home profile strength' })).toHaveAttribute('aria-valuenow', '0');

    click('Independent house');
    click('Garden');
    click('Yes, AC');
    click('Medium (10–25 kg)');
    click('2');
    expect(pressed('Independent house')).toBe('true');
    fireEvent.change(screen.getByTestId('home-photo-input'), { target: { files: [new File(['x'], 'bed.jpg', { type: 'image/jpeg' })] } });
    expect(await screen.findByAltText('Home photo 1')).toBeInTheDocument();
    expect(screen.queryByText('Add a photo of where dogs sleep (+15%)')).toBeNull();
    expect(screen.getByRole('meter', { name: 'Home profile strength' })).toHaveAttribute('aria-valuenow', '45');
    fireEvent.change(screen.getByLabelText('House rules'), { target: { value: 'x'.repeat(320) } });
    expect(screen.getByText('300/300')).toBeInTheDocument();

    click('Continue');
    expect(await screen.findByText('Step 3 of 8')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Home boarding' })).toBeInTheDocument();
    click('Next service');
    expect(screen.getByRole('heading', { name: 'Doggy daycare' })).toBeInTheDocument();
    click('Done with pricing');
    await screen.findByText('About you');
    click('Continue');
    await screen.findByText('Your availability');
    expect(screen.queryByText('Available time slots')).toBeNull();
    expect(screen.queryByText('Max dogs at one time')).toBeNull();
    click('Continue');
    await screen.findByText('ID Verification');
    fireEvent.change(screen.getByLabelText('Aadhaar number'), { target: { value: '123412341234' } });
    fireEvent.change(screen.getByLabelText('UPI ID for payouts'), { target: { value: 'kavya@ybl' } });
    click('Continue');
    await screen.findByText('Your responsibilities');
    expect(screen.queryByText('Carry your full kit')).toBeNull();
    expect(screen.queryByText('Submit walk report')).toBeNull();
    expect(screen.getByText('Keep your home escape-proof')).toBeInTheDocument();
    click('I accept these responsibilities');
    await screen.findByText('Review & go live');
    expect(screen.getByText('Step 8 of 8')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    click(/Go live on Fursday/);
    await screen.findByText(/You're live,/);

    const row = db.one('sitter_profiles', { user_id: 'u-new' });
    expect(row).toEqual(expect.objectContaining({ status: 'pending', provider_type: 'boarding', max_dogs: 2 }));
    expect(row.home_details).toEqual(expect.objectContaining({ home_type: 'independent_house', outdoor: ['garden'], ac: true, sizes: ['medium'], max_dogs: 2 }));
    expect(row.home_details.rules).toHaveLength(300);
    expect(row.home_photos).toEqual([expect.stringMatching(/^https:\/\/storage\.test\/sitter-photos\/u-new\/home\/.+\.jpg$/)]);
    expect(db.rows('sitter_services', { sitter_id: row.id }).map(s => s.service_type).sort()).toEqual(['boarding', 'daycare']);
    expect(db.one('sitter_pii', { sitter_id: row.id })).toEqual(expect.objectContaining({ aadhaar_number: '123412341234', upi_id: 'kavya@ybl' }));
  });

  test('BH2: walkers keep the 8-step flow with no home step', async () => {
    db.table('users').push({ id: 'u-walker', name: 'w@test.example', email: 'w@test.example' });
    db.signInAs('u-walker');
    render(<SitterOnboarding city="Pune" onDone={jest.fn()} />);
    await screen.findByText('How do you want to help?');
    expect(pressed(/Walks and sitting/)).toBe('true');
    click(/I want to earn this/);
    fireEvent.change(screen.getByLabelText('Your full name...'), { target: { value: 'Walker' } });
    click('Send');
    fireEvent.change(screen.getByLabelText('WhatsApp number'), { target: { value: '9870000008' } });
    click('Next');
    expect(await screen.findByText('What will you offer?')).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 8')).toBeInTheDocument();
    await waitFor(() => expect(db.one('sitter_profiles', { user_id: 'u-walker' })?.provider_type).toBe('sitter'));
  });

  test('BH3: "Both" adds the home step after services, making 9 steps', async () => {
    db.table('users').push({ id: 'u-both', name: 'b@test.example', email: 'b@test.example' });
    db.signInAs('u-both');
    render(<SitterOnboarding city="Pune" onDone={jest.fn()} />);
    await screen.findByText('How do you want to help?');
    click(/^Both/);
    click(/I want to earn this/);
    fireEvent.change(screen.getByLabelText('Your full name...'), { target: { value: 'Both Ways' } });
    click('Send');
    fireEvent.change(screen.getByLabelText('WhatsApp number'), { target: { value: '9870000007' } });
    click('Next');
    await screen.findByText('What will you offer?');
    expect(screen.getByText('Step 2 of 9')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request a walker/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Home boarding/ })).toHaveAttribute('aria-pressed', 'true');
    click('Set my prices');
    expect(await screen.findByRole('heading', { name: 'Your home' })).toBeInTheDocument();
    expect(screen.getByText('Step 3 of 9')).toBeInTheDocument();
  });

  test('BH4: resuming a draft returns to the home step with everything restored', async () => {
    db.table('users').push({ id: 'u-new', name: 'Kavya Nair', email: 'kavya@test.example', phone: '+919870000009' });
    db.table('sitter_profiles').push({ id: 'sp-new', user_id: 'u-new', city_id: IDS.pune, status: 'draft', onboarding_step: 10, provider_type: 'boarding',
      home_details: { home_type: 'villa', outdoor: ['terrace'], rules: 'No sofa.' }, home_photos: ['https://storage.test/sitter-photos/u-new/home/a.jpg'] });
    db.table('sitter_services').push({ id: 'svc-new', sitter_id: 'sp-new', service_type: 'boarding', price_paise: 90000, is_active: true });
    db.signInAs('u-new');
    render(<SitterOnboarding city="Pune" onDone={jest.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Your home' })).toBeInTheDocument();
    expect(screen.getByText('Step 2 of 8')).toBeInTheDocument();
    expect(pressed('Villa')).toBe('true');
    expect(pressed('Terrace')).toBe('true');
    expect(screen.getByLabelText('House rules').value).toBe('No sofa.');
    expect(screen.getByAltText('Home photo 1')).toHaveAttribute('src', 'https://storage.test/sitter-photos/u-new/home/a.jpg');
    click('Back');
    expect(await screen.findByText('Step 1 of 8')).toBeInTheDocument();
  });
});

describe('Edit profile for boarding hosts', () => {
  const changeList = () => within(screen.getByRole('status', { name: 'What changed' })).getAllByRole('listitem').map(li => li.textContent);

  test('BH5: home strength is folded into the profile meter, with tips that open the home tab', async () => {
    addHost();
    db.signInAs(HOST.user);
    render(<SitterEditProfile city="Pune" onBack={jest.fn()} />);
    await screen.findByText('Kavita Rane');
    // Sitter part is complete (100); home has type and outdoor only (20). Boarding-only: 50/50.
    expect(screen.getByRole('meter', { name: 'Profile strength' })).toHaveAttribute('aria-valuenow', '60');
    const missing = within(screen.getByRole('list', { name: /^Still missing/ })).getAllByRole('button').map(b => b.textContent);
    expect(missing).toEqual(['Home photo', '3 home photos', 'Who is home', 'Children and pets', 'Sleeping and AC', 'Dog sizes', 'House rules', 'Vet and updates']);
    fireEvent.click(within(screen.getByRole('list', { name: /^Still missing/ })).getByRole('button', { name: 'Home photo' }));
    expect(screen.getByRole('meter', { name: 'Home profile strength' })).toHaveAttribute('aria-valuenow', '20');
    expect(screen.getByText('Add a photo of where dogs sleep (+15%)')).toBeInTheDocument();
  });

  test('BH6: editing the home saves home_details and lists each change', async () => {
    addHost();
    db.signInAs(HOST.user);
    render(<SitterEditProfile city="Pune" onBack={jest.fn()} />);
    await screen.findByText('Kavita Rane');
    click('Your home');
    click('Farmhouse');
    click('Garden');
    click('Yes, AC');
    click('Large (25–40 kg)');
    fireEvent.change(screen.getByLabelText('Nearest vet (km)'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('House rules'), { target: { value: 'No dogs on the sofa please.' } });
    fireEvent.change(screen.getByTestId('home-photo-input'), { target: { files: [new File(['x'], 'garden.jpg', { type: 'image/jpeg' })] } });
    await screen.findByAltText('Home photo 1');
    click('Save changes');
    await waitFor(() => expect(hostRow().home_details.home_type).toBe('farmhouse'));
    expect(hostRow().home_details).toEqual(expect.objectContaining({ outdoor: ['terrace', 'garden'], ac: true, sizes: ['large'], vet_km: 2, rules: 'No dogs on the sofa please.' }));
    expect(hostRow().home_photos).toHaveLength(1);
    expect(changeList()).toEqual([
      'Type of home: Villa → Farmhouse',
      'Outdoor space: added Garden',
      'Air conditioning: (empty) → Yes, AC',
      'Dog sizes you take: added Large (25–40 kg)',
      'Nearest vet (km): (empty) → 2 km',
      "House rules: (empty) → 'No dogs on the sofa please.'",
      'Home photos: (empty) → 1',
    ]);
  });

  test('BH7: a walker switches to boarding-only; walking is dropped and the home tab appears', async () => {
    db.signInAs(IDS.priyaUser);
    render(<SitterEditProfile city="Gurgaon" onBack={jest.fn()} />);
    await screen.findByText('Priya Kapoor');
    expect(screen.queryByRole('button', { name: 'Your home' })).toBeNull();
    click('Services');
    click('Home boarding only');
    expect(screen.queryByRole('switch', { name: 'Request a walker toggle' })).toBeNull();
    expect(screen.getByRole('switch', { name: 'Home boarding toggle' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Your home' })).toBeInTheDocument();
    click('Save changes');
    await waitFor(() => expect(db.one('sitter_profiles', { id: IDS.priya }).provider_type).toBe('boarding'));
    expect(db.rows('sitter_services', { sitter_id: IDS.priya }).map(s => s.service_type)).toEqual(['boarding']);
    expect(changeList()).toEqual(expect.arrayContaining(['How you help: Walks and sitting → Home boarding only', 'Request a walker: Rs.400 → Off']));
  });
});

describe('Public profile and Explore', () => {
  test('BH8: parents see "Their home" with photos, key facts and house rules, and no walk copy', async () => {
    addHost({ home_details: FULL_HOME, home_photos: ['https://storage.test/h1.jpg', 'https://storage.test/h2.jpg'] });
    db.signInAs(PUNE.aditi);
    render(<SitterProfile sitter={{ id: HOST.id, name: 'Kavita Rane', rating: 4.9, headline: 'Home boarding in Wakad', service_radius_km: 5 }} city="Pune" onBack={jest.fn()} onBook={jest.fn()} />);
    const home = await screen.findByRole('region', { name: 'Their home' });
    expect(within(home).getAllByRole('img')).toHaveLength(2);
    expect(within(home).getByAltText("Kavita Rane's home, photo 1")).toBeInTheDocument();
    ['Independent house', 'Garden, Park nearby', 'All day', '10 and older', 'Own dog bed', 'Yes, AC', 'Up to 2 at a time',
      'Small (under 10 kg), Medium (10–25 kg)', '1.5 km away', 'Photos twice a day', FULL_HOME.rules].forEach(text => expect(within(home).getByText(text)).toBeInTheDocument());
    expect(screen.getByText('Dogs stay at their home')).toBeInTheDocument();
    expect(screen.queryByText(/Travels up to/)).toBeNull();
    expect(screen.queryByText('Walks done')).toBeNull();
    expect(screen.getAllByText('Rs.950/night')).toHaveLength(2);
  });

  test('BH9: the home section reads in Hindi, and walkers have none', async () => {
    addHost({ home_details: FULL_HOME });
    setLanguage('hi');
    const { unmount } = render(<SitterProfile sitter={{ id: HOST.id, name: 'Kavita Rane' }} city="Pune" onBack={jest.fn()} onBook={jest.fn()} />);
    const home = await screen.findByRole('region', { name: 'इनका घर' });
    expect(within(home).getByText('अलग मकान')).toBeInTheDocument();
    expect(within(home).getByText('हाँ, AC है')).toBeInTheDocument();
    unmount();
    setLanguage('en');
    render(<SitterProfile sitter={{ id: IDS.priya, name: 'Priya Kapoor' }} city="Gurgaon" onBack={jest.fn()} onBook={jest.fn()} />);
    expect(await screen.findByText('Walks done')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Dogs stay at their home')).toBeNull());
    expect(screen.queryByRole('region', { name: 'Their home' })).toBeNull();
  });

  test('BH10: Explore shows a compact home line on boarding hosts', async () => {
    addHost({ home_details: FULL_HOME });
    db.signInAs(PUNE.aditi);
    render(<ExploreScreen city="Pune" onBack={jest.fn()} onBook={jest.fn()} onNav={jest.fn()} />);
    expect(await screen.findByText('Home: Independent house · Garden · Park nearby')).toBeInTheDocument();
    click('Boarding');
    expect(screen.getByText('Home: Independent house · Garden · Park nearby')).toBeInTheDocument();
    expect(screen.getAllByText(/^Home: /)).toHaveLength(1);
  });
});

describe('Before migration 037 runs', () => {
  test('BH11: Edit profile still saves everything else', async () => {
    const restore = without037();
    try {
      db.signInAs(IDS.priyaUser);
      render(<SitterEditProfile city="Gurgaon" onBack={jest.fn()} />);
      await screen.findByText('Priya Kapoor');
      fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Calm walker' } });
      click('Services');
      click('Both');
      click('Save changes');
      await waitFor(() => expect(db.one('sitter_profiles', { id: IDS.priya }).headline).toBe('Calm walker'));
      expect(db.one('sitter_profiles', { id: IDS.priya }).provider_type).toBeUndefined();
      expect(window.alert).not.toHaveBeenCalled();
    } finally { restore(); }
  });

  test('BH12: a boarding draft saved without the columns resumes on the boarding flow', async () => {
    const restore = without037();
    let view;
    try {
      view = await startBoardingSignup();
      click('Villa');
      click('Continue');
      await screen.findByText('Step 3 of 8');
      const row = db.one('sitter_profiles', { user_id: 'u-new' });
      expect(row).toEqual(expect.objectContaining({ status: 'draft', onboarding_step: 3 }));
      expect(row.provider_type).toBeUndefined();
      expect(db.rows('sitter_services', { sitter_id: row.id }).map(s => s.service_type).sort()).toEqual(['boarding', 'daycare']);
      expect(window.alert).not.toHaveBeenCalled();
    } finally { restore(); }
    view.unmount();
    render(<SitterOnboarding city="Pune" onDone={jest.fn()} />);
    expect(await screen.findByText('Step 3 of 8')).toBeInTheDocument();
    click('Back');
    expect(await screen.findByRole('heading', { name: 'Your home' })).toBeInTheDocument();
  });
});

test('homeStrength: weights add to 100 and the biggest win comes first', () => {
  expect(homeStrength({}, [])).toEqual({ pct: 0, missing: expect.any(Array) });
  expect(homeStrength({}, []).missing.map(m => [m.id, m.points])).toEqual([
    ['photos1', 15], ['photos3', 10], ['home_type', 10], ['outdoor', 10], ['someone_home', 10],
    ['household', 10], ['sleeping', 10], ['dogs', 10], ['rules', 10], ['care', 5],
  ]);
  expect(homeStrength(FULL_HOME, ['a', 'b', 'c'])).toEqual({ pct: 100, missing: [] });
  expect(homeStrength({ ...FULL_HOME, ac: undefined, rules: 'short' }, ['a']).missing.map(m => m.id)).toEqual(['photos3', 'sleeping', 'rules']);
  expect(homeStrength({ ...FULL_HOME, vet_km: 0 }, ['a', 'b', 'c']).pct).toBe(100);
});

