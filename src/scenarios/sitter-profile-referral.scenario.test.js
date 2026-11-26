// Sitter service area, availability calendar, richer profile and the referral
// programme, played against the in-memory database (src/testing/fakeSupabase.js).
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, buildPuneSeed, IDS } from '../testing/seed';
import SitterEditProfile from '../SitterEditProfile';
import SitterOnboarding from '../SitterOnboarding';
import SitterProfile from '../SitterProfile';
import SettingsScreen from '../SettingsScreen';
import ReferralScreen from '../ReferralScreen';
import { isSitterAvailable, toISODate } from '../AvailabilityCalendar';
import LanguageToggle from '../LanguageToggle';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));

// Flip the language the way a user does (see sitter-chat.scenario.test.js).
function setLanguage(l) {
  const r = render(<LanguageToggle />);
  fireEvent.click(r.getByText(l === 'hi' ? 'हिं' : 'EN'));
  r.unmount();
}

const realGeo = navigator.geolocation;
const setGps = (coords) => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: (ok, fail) => (coords ? ok({ coords }) : fail && fail({ code: 1 })) },
  });
};

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  window.open = jest.fn();
  setGps(null);
});
afterAll(() => Object.defineProperty(navigator, 'geolocation', { configurable: true, value: realGeo }));

const priyaRow = () => db.one('sitter_profiles', { id: IDS.priya });
async function openPriyaProfile() {
  db.signInAs(IDS.priyaUser);
  render(<SitterEditProfile city="Gurgaon" onBack={jest.fn()} />);
  await screen.findByText('Priya Kapoor');
}
// The bottom Save button reads "✓ Changes saved!" for a moment after each save.
const clickSave = () => fireEvent.click(screen.getByText(/^(Save changes|✓ Changes saved!)$/));
const changeList = () => within(screen.getByRole('status', { name: 'What changed' })).getAllByRole('listitem').map(li => li.textContent);

describe('Service area', () => {
  test('SA1: a sitter searches for their base area, sets a radius, and both are saved', async () => {
    await openPriyaProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    fireEvent.change(screen.getByLabelText('Search area, sector or pincode'), { target: { value: 'sector 5' } });
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /^Sector 56/ }));
    expect(screen.getByText('Parents within 5 km of Sector 56 can book you.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('I cover up to'), { target: { value: '8' } });
    expect(screen.getByText('Parents within 8 km of Sector 56 can book you.')).toBeInTheDocument();

    clickSave();
    await waitFor(() => expect(priyaRow().base_area).toBe('Sector 56'));
    expect(priyaRow()).toEqual(expect.objectContaining({ base_pincode: '122011', lat: 28.4237, lng: 77.0981, service_radius_km: 8 }));
    expect(priyaRow().profile_updated_at).toEqual(expect.any(String));
    expect(changeList()).toEqual(expect.arrayContaining(["Base area: (empty) → 'Sector 56'", 'Travel radius: 5 km → 8 km']));
  });

  test('SA2: searching by pincode and using a radius chip work too', async () => {
    await openPriyaProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    fireEvent.change(screen.getByLabelText('Search area, sector or pincode'), { target: { value: '122011' } });
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options.length).toBeGreaterThan(0);
    options.forEach(o => expect(o.textContent).toContain('122011'));
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /^Sector 54/ }));
    fireEvent.click(screen.getByRole('button', { name: '12 km' }));
    clickSave();
    await waitFor(() => expect(priyaRow()).toEqual(expect.objectContaining({ base_area: 'Sector 54', service_radius_km: 12 })));
  });

  test('SA3: "use my current location" picks the nearest area; GPS outside any area explains why', async () => {
    await openPriyaProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    setGps({ latitude: 19.07, longitude: 72.87 }); // Mumbai: no Fursday area within 4 km
    fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText(/couldn't match your location/)).toBeInTheDocument();
    setGps({ latitude: 28.4240, longitude: 77.0985 });
    fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
    expect(await screen.findByText('Sector 56')).toBeInTheDocument();
  });

  test('SA4: onboarding pre-fills the area from GPS and saves it with the draft (Pune)', async () => {
    db.reset(buildPuneSeed());
    db.table('users').push({ id: 'u-newbie', name: 'Kavya Nair', email: 'kavya@test.example', phone: '+919870000009' });
    db.table('sitter_profiles').push({ id: 'sp-newbie', user_id: 'u-newbie', city_id: IDS.pune, status: 'draft', onboarding_step: 5, bio: 'Love dogs', languages: ['English'] });
    setGps({ latitude: 18.5592, longitude: 73.7870 });
    db.signInAs('u-newbie');
    render(<SitterOnboarding city="Pune" onDone={jest.fn()} />);
    expect(await screen.findByText('Where you work')).toBeInTheDocument();
    expect(screen.getByText('Baner')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '8 km' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(db.one('sitter_profiles', { id: 'sp-newbie' }).onboarding_step).toBe(6));
    expect(db.one('sitter_profiles', { id: 'sp-newbie' })).toEqual(expect.objectContaining({ base_area: 'Baner', base_pincode: '411045', service_radius_km: 8, status: 'draft' }));
  });
});

describe('Availability calendar', () => {
  const dayISO = (offset) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + offset); return toISODate(d); };
  const shortLabel = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
  const dayButton = (iso) => screen.getByRole('button', { name: new RegExp('^' + shortLabel(iso) + ':') });
  async function openCalendar() {
    await openPriyaProfile();
    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByText('Availability calendar');
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Loading...' })).toBeNull());
  }
  const showMonthOf = (iso) => {
    if (Number(iso.slice(5, 7)) !== new Date().getMonth() + 1) fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
  };

  test('CAL1: blocking a day writes an unavailable row; resetting deletes it', async () => {
    await openCalendar();
    const today = dayISO(0);
    fireEvent.click(dayButton(today));
    fireEvent.click(screen.getByRole('button', { name: 'Mark unavailable' }));
    await screen.findByText('Blocked. No one can book you that day.');
    expect(db.rows('sitter_availability', { sitter_id: IDS.priya })).toEqual([expect.objectContaining({ date: today, is_available: false, time_slots: [] })]);
    expect(dayButton(today).getAttribute('aria-label')).toMatch(/Unavailable$/);
    expect(isSitterAvailable(priyaRow(), db.table('sitter_availability'), today, 'morning')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Use my weekly schedule again' }));
    await screen.findByText('Back to your weekly schedule for this day.');
    expect(db.rows('sitter_availability', { sitter_id: IDS.priya })).toHaveLength(0);
  });

  test('CAL2: setting slots for a date stores them, and they replace the weekly slots that day', async () => {
    await openCalendar();
    const day = dayISO(3);
    showMonthOf(day);
    fireEvent.click(dayButton(day));
    const panel = screen.getByRole('region');
    fireEvent.click(within(panel).getByRole('button', { name: /^Morning/ }));
    fireEvent.click(within(panel).getByRole('button', { name: /^Afternoon/ }));
    expect(within(panel).getByRole('button', { name: /^Afternoon/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save slots' }));
    await screen.findByText('Saved. Parents can book only these slots that day.');

    const rows = db.rows('sitter_availability', { sitter_id: IDS.priya });
    expect(rows).toEqual([expect.objectContaining({ date: day, is_available: true, time_slots: ['afternoon', 'evening'] })]);
    expect(isSitterAvailable(priyaRow(), rows, day, '07:00 AM')).toBe(false);
    expect(isSitterAvailable(priyaRow(), rows, day, '2:00 PM')).toBe(true);
    expect(dayButton(day).getAttribute('aria-label')).toMatch(/Custom: Afternoon, Evening$/);

    // Saving again updates the same row instead of adding a second one.
    fireEvent.click(within(panel).getByRole('button', { name: /^Evening/ }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Save slots' }));
    await waitFor(() => expect(db.rows('sitter_availability', { sitter_id: IDS.priya })[0].time_slots).toEqual(['afternoon']));
    expect(db.rows('sitter_availability', { sitter_id: IDS.priya })).toHaveLength(1);
  });

  test('CAL3: saved overrides show again when the calendar is reopened; days without a row follow the weekly default', async () => {
    const blocked = dayISO(1);
    db.insert('sitter_availability', { sitter_id: IDS.priya, date: blocked, is_available: false, time_slots: [] });
    await openCalendar();
    showMonthOf(blocked);
    expect(dayButton(blocked).getAttribute('aria-label')).toMatch(/Unavailable$/);
    // A Saturday or Sunday in range is a weekly day off for Priya (Mon–Fri).
    const weekend = [...Array(14)].map((_, i) => dayISO(i + 2)).find(iso => [0, 6].includes(new Date(iso + 'T12:00:00').getDay()));
    showMonthOf(weekend);
    expect(dayButton(weekend).getAttribute('aria-label')).toMatch(/Day off$/);
    expect(isSitterAvailable(priyaRow(), db.table('sitter_availability'), weekend)).toBe(false);
  });
});

describe('Richer sitter profile', () => {
  test('PR1: headline and highlights save, with a detailed "What changed" summary', async () => {
    await openPriyaProfile();
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Calm walker for big dogs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Large breeds' }));
    fireEvent.click(screen.getByRole('button', { name: 'First-aid trained' }));
    fireEvent.click(screen.getByRole('button', { name: '3-5 years' }));
    clickSave();

    await waitFor(() => expect(priyaRow().headline).toBe('Calm walker for big dogs'));
    expect(priyaRow().highlights).toEqual(['Large breeds', 'First-aid trained']);
    expect(changeList()).toEqual([
      "Headline: (empty) → 'Calm walker for big dogs'",
      'Highlights: added Large breeds, First-aid trained',
      'Experience: (empty) → 3-5 years',
    ]);

    // A second save compares against what was just saved, not the original.
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Calm walker for big and senior dogs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Large breeds' }));
    clickSave();
    await waitFor(() => expect(changeList()).toEqual([
      "Headline: 'Calm walker for big dogs' → 'Calm walker for big and senior dogs'",
      'Highlights: removed Large breeds',
    ]));
  });

  test('PR2: at most 4 highlights; headline is capped at 80 characters', async () => {
    await openPriyaProfile();
    ['Large breeds', 'Puppies', 'Senior dogs', 'Medication'].forEach(h => fireEvent.click(screen.getByRole('button', { name: h })));
    expect(screen.getByRole('button', { name: 'Night stays' })).toBeDisabled();
    expect(screen.getByText('4/4')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'x'.repeat(95) } });
    expect(screen.getByLabelText('Headline').value).toHaveLength(80);
  });

  test('PR3: About me shows a live counter and the 120-character hint', async () => {
    await openPriyaProfile();
    const bio = priyaRow().bio;
    expect(screen.getByText(`${120 - bio.length} more characters to reach 120`)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('About me'), { target: { value: 'a'.repeat(130) } });
    expect(screen.getByText('130/600')).toBeInTheDocument();
    expect(screen.getByText('Great, parents read this before booking.')).toBeInTheDocument();
    expect(screen.getByText(/clear, well-lit photo of your face/)).toBeInTheDocument();
    expect(screen.getByText(/up to 3 photos of you with dogs/)).toBeInTheDocument();
  });

  test('PR4: saving with no edits says nothing was different', async () => {
    await openPriyaProfile();
    clickSave();
    expect(await screen.findByText('Saved. Nothing was different from before.')).toBeInTheDocument();
  });

  test('PR5: the parent-facing profile shows headline, highlights and travel radius', async () => {
    Object.assign(priyaRow(), { headline: 'Calm walker for big dogs', highlights: ['Large breeds', 'Puppies'], service_radius_km: 6, base_area: 'Sector 56' });
    db.signInAs(IDS.ananya);
    render(<SitterProfile sitter={{ id: IDS.priya, name: 'Priya Kapoor', rating: 4.9 }} city="Gurgaon" onBack={jest.fn()} onBook={jest.fn()} />);
    expect(await screen.findByText('Calm walker for big dogs')).toBeInTheDocument();
    expect(screen.getByText('Travels up to 6 km')).toBeInTheDocument();
    expect(screen.getByText('Sector 56')).toBeInTheDocument();
    expect(screen.getByText('Large breeds')).toBeInTheDocument();
    expect(screen.getByText('Puppies')).toBeInTheDocument();
  });
});

describe('Profile strength meter', () => {
  test('ST1: lists exactly what is missing and rises as items are filled', async () => {
    await openPriyaProfile();
    const meter = screen.getByRole('meter', { name: 'Profile strength' });
    // Priya has a photo, a service, Aadhaar and UPI; the rest is missing.
    expect(meter).toHaveAttribute('aria-valuenow', '40');
    const missing = () => within(screen.getByRole('list', { name: /^Still missing/ })).getAllByRole('button').map(b => b.textContent);
    expect(missing()).toEqual(['Headline', 'About me (120+ characters)', 'A highlight', 'Photo with dogs', 'Experience', 'Base area']);

    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Calm walker' } });
    fireEvent.click(screen.getByRole('button', { name: 'Puppies' }));
    expect(meter).toHaveAttribute('aria-valuenow', '60');
    expect(missing()).toEqual(['About me (120+ characters)', 'Photo with dogs', 'Experience', 'Base area']);

    // Tapping a missing item jumps to the tab that fixes it.
    fireEvent.click(within(screen.getByRole('list', { name: /^Still missing/ })).getByRole('button', { name: 'Base area' }));
    expect(screen.getByText('Where you work')).toBeInTheDocument();
  });
});

describe('Referral programme', () => {
  test('RF1: first open creates a FUR code once; WhatsApp share carries the code and the admin-set amount', async () => {
    db.table('app_settings').push({ key: 'referral_reward_rs', value: '150' }, { key: 'referral_signup_rs', value: '75' });
    db.signInAs(IDS.ananya);
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<ReferralScreen onBack={jest.fn()} />);
    const codeBox = await screen.findByTestId('referral-code');
    const code = codeBox.textContent;
    expect(code).toMatch(/^FUR[A-Z0-9]{5}$/);
    const ownRows = db.rows('referrals', { referrer_id: IDS.ananya });
    expect(ownRows).toHaveLength(1);
    expect(ownRows[0].referral_code).toBe(code);
    expect(ownRows[0].referred_user_id ?? null).toBeNull();
    expect(screen.getByText('Get Rs.150 for every friend')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Share on WhatsApp' }));
    const url = window.open.mock.calls[0][0];
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    const text = decodeURIComponent(url.split('text=')[1]);
    expect(text).toContain(code);
    expect(text).toContain('Rs.75');

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(writeText).toHaveBeenCalledWith(code);
    expect(await screen.findByText('Copied')).toBeInTheDocument();

    cleanup();
    render(<ReferralScreen onBack={jest.fn()} />);
    expect((await screen.findByTestId('referral-code')).textContent).toBe(code);
    expect(db.rows('referrals', { referrer_id: IDS.ananya })).toHaveLength(1);
  });

  test('RF2: a friend applies the code; both pending credits are created and shown to each side', async () => {
    db.insert('referrals', { referrer_id: IDS.ananya, referral_code: 'FURANA12', status: 'active', referred_user_id: null });
    db.signInAs(IDS.rohit);
    render(<ReferralScreen onBack={jest.fn()} />);
    await screen.findByTestId('referral-code');
    fireEvent.change(screen.getByLabelText(/Friend's code/), { target: { value: ' furana12 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByText('Code applied. Your Rs.50 credit unlocks after your first completed booking.')).toBeInTheDocument();

    expect(db.rows('referral_bonuses', { user_id: IDS.ananya })).toEqual([expect.objectContaining({ amount: 100, type: 'referral_reward', status: 'pending' })]);
    expect(db.rows('referral_bonuses', { user_id: IDS.rohit })).toEqual([expect.objectContaining({ amount: 50, type: 'signup_bonus', status: 'pending' })]);
    expect(await screen.findByText("You joined with a friend's code.")).toBeInTheDocument();
    expect(screen.getByText('Welcome credit')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Friend's code/)).toBeNull();

    cleanup();
    db.signInAs(IDS.ananya);
    render(<ReferralScreen onBack={jest.fn()} />);
    expect((await screen.findByTestId('referral-code')).textContent).toBe('FURANA12');
    expect(screen.getByText('Friends who used your code (1)')).toBeInTheDocument();
    expect(screen.getByText('Rohit V.')).toBeInTheDocument();
    expect(screen.getByText('Friend joined')).toBeInTheDocument();
    expect(screen.getAllByText('Rs.100').length).toBeGreaterThan(0);
  });

  test('RF3: invalid, own and already-used codes each get a clear message and create no credits', async () => {
    db.insert('referrals', { referrer_id: IDS.ananya, referral_code: 'FURANA12', status: 'active', referred_user_id: null });
    const tryCode = async (code, message) => {
      fireEvent.change(screen.getByLabelText(/Friend's code/), { target: { value: code } });
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
    };

    db.signInAs(IDS.rohit);
    render(<ReferralScreen onBack={jest.fn()} />);
    await screen.findByTestId('referral-code');
    await tryCode('FURNOPE9', "That code doesn't exist.");

    cleanup();
    db.signInAs(IDS.ananya);
    render(<ReferralScreen onBack={jest.fn()} />);
    await screen.findByTestId('referral-code');
    await tryCode('FURANA12', "That's your own code.");

    cleanup();
    db.signInAs(IDS.meera);
    render(<ReferralScreen onBack={jest.fn()} />);
    await screen.findByTestId('referral-code');
    // Meera used another friend's code on a different device meanwhile.
    db.insert('referrals', { referrer_id: IDS.rohit, referred_user_id: IDS.meera, referral_code: 'FURROH77-u-meer', status: 'used' });
    await tryCode('FURANA12', "You've already used a friend's code.");

    expect(db.table('referral_bonuses')).toHaveLength(0);
  });

  test('RF4: Settings → Account → "Refer & earn" opens the referral screen and back returns', async () => {
    db.signInAs(IDS.ananya);
    render(<SettingsScreen onBack={jest.fn()} city="Gurgaon" userName="Ananya Sharma" onNav={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Refer & earn' }));
    expect(await screen.findByTestId('referral-code')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Refer & earn' })).toBeInTheDocument();
  });

  test('RF5: Hindi users get the screen and share message in Hindi', async () => {
    setLanguage('hi');
    try {
      db.signInAs(IDS.ananya);
      render(<ReferralScreen onBack={jest.fn()} />);
      await screen.findByTestId('referral-code');
      expect(screen.getByText('रेफ़र करें और कमाएं')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'WhatsApp पर भेजें' }));
      expect(decodeURIComponent(window.open.mock.calls[0][0])).toContain('मेरे कोड');
    } finally { setLanguage('en'); }
  });
});
