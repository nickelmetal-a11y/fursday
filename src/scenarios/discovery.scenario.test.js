// Visitors and discovery: browsing without an account, signing in only when
// it matters (and landing back where they were), real reviews with a "New"
// badge for unreviewed sitters, shareable /s/<slug> links, Explore filters and
// the map view. Played against the in-memory database (src/testing/fakeSupabase.js).
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import App from '../App';
import ExploreScreen from '../ExploreScreen';
import SitterProfile from '../SitterProfile';
import ShareProfileCard, { makeShareSlug, slugFromPath } from '../ShareProfileCard';
import { toSitterCard } from '../sitterCard';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../geolocationService', () => ({
  checkLocationRestriction: () => Promise.resolve({ allowed: true, ip: '127.0.0.1' }),
  getLocationRestrictedMessage: () => 'Coming soon to your area',
}));
jest.mock('../ConversationScreen', () => function ConversationStub({ sitter }) {
  return require('react').createElement('div', null, 'Conversation with ' + sitter.name);
});

const mockMarkers = [];
jest.mock('leaflet', () => {
  const map = { setView: () => map, fitBounds: () => map, invalidateSize: () => {}, remove: () => {} };
  return {
    __esModule: true,
    default: {
      map: () => map,
      tileLayer: () => ({ addTo: () => {} }),
      layerGroup: () => { const g = { addTo: () => g, clearLayers: () => { mockMarkers.length = 0; } }; return g; },
      divIcon: (o) => o,
      marker: (latlng, opts) => {
        const m = { latlng, opts, handlers: {}, on(ev, fn) { m.handlers[ev] = fn; return m; }, addTo() { mockMarkers.push(m); return m; } };
        return m;
      },
    },
  };
});
jest.mock('leaflet/dist/leaflet.css', () => ({}));

const fake = require('../testing/fakeSupabase');
const SLOW = { timeout: 8000 };
const realVerify = fake.supabase.auth.verifyOtp;
const realShare = navigator.share;

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  mockMarkers.length = 0;
  window.history.replaceState(null, '', '/');
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
});
afterEach(() => {
  fake.supabase.auth.verifyOtp = realVerify;
  Object.defineProperty(navigator, 'share', { configurable: true, value: realShare });
});

const placeSitters = () => {
  Object.assign(db.one('sitter_profiles', { id: IDS.priya }), { base_area: 'DLF Phase 3', service_radius_km: 10 });
  Object.assign(db.one('sitter_profiles', { id: IDS.sunita }), { base_area: 'Golf Course Road', service_radius_km: 5 });
};

// Signs in through the real login screen; verifying the code signs Ananya in.
async function signInThroughLoginScreen(userId = IDS.ananya) {
  expect(await screen.findByText("Sign in to continue. We'll bring you right back.")).toBeInTheDocument();
  fake.supabase.auth.verifyOtp = () => { db.signInAs(userId); return Promise.resolve({ data: { user: db.user }, error: null }); };
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value: 'ananya@test.example' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'I agree to the Terms of Service and Privacy Policy' }));
  fireEvent.click(screen.getByText('Continue with email →'));
  fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

const homeRow = (name) => screen.findByRole('group', { name }, SLOW);

describe('visitors browse without an account', () => {
  test('D1: Home works signed out, with a Sign in button and no account-only parts', async () => {
    render(<App />);
    expect(await screen.findByText('Top sitters near you', {}, SLOW)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Priya Kapoor' }, SLOW)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Notifications' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share an idea or feedback' })).toBeNull();
    expect(screen.queryByText('Welcome to Fursday')).toBeNull();
  }, 20000);

  test('D2: booking from Home asks the visitor to sign in, then returns them to booking that sitter', async () => {
    render(<App />);
    fireEvent.click(within(await homeRow('Priya Kapoor')).getByRole('button', { name: 'Book' }));
    await signInThroughLoginScreen();
    expect(await screen.findByText(/^Priya Kapoor · /, {}, SLOW)).toBeInTheDocument();
    expect(screen.queryByText('Welcome to Fursday')).toBeNull();
  }, 20000);

  test('D3: "Look around first" closes the login screen without losing the profile', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Priya Kapoor' }, SLOW));
    fireEvent.click(await screen.findByRole('button', { name: 'Book now' }));
    expect(await screen.findByText('Welcome to Fursday')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Look around first' }));
    expect(await screen.findByRole('heading', { name: /^Priya Kapoor/ })).toBeInTheDocument();
  }, 20000);

  test('D4: account tabs show a sign-in prompt; signing in from it opens that tab', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'My Pets' }, SLOW));
    expect(screen.getByText('Add your pets')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bookings' }));
    expect(screen.getByText('Your bookings will show here')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in or sign up' }));
    await signInThroughLoginScreen();
    const nav = await screen.findByRole('navigation', { name: 'Main' }, SLOW);
    expect(screen.queryByText('Your bookings will show here')).toBeNull();
    expect(within(nav).getByRole('button', { name: 'Bookings' })).toHaveAttribute('aria-current', 'page');
  }, 20000);

  test('D5: favouriting in Explore as a visitor signs in, saves the favourite and comes back to Explore', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Explore' }, SLOW));
    await screen.findByText('Priya Kapoor');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to favourites' })[0]);
    await signInThroughLoginScreen();
    await waitFor(() => expect(db.rows('favorites', { pet_parent_id: IDS.ananya })).toHaveLength(1), SLOW);
    expect(await screen.findByRole('heading', { name: 'Sitters near you' }, SLOW)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Remove from favourites' })).toHaveAttribute('aria-pressed', 'true');
  }, 20000);

  test('D6: "Ask a question" as a visitor signs in first, then opens the conversation', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Priya Kapoor' }, SLOW));
    fireEvent.click(await screen.findByRole('button', { name: 'Ask a question' }));
    await signInThroughLoginScreen();
    expect(await screen.findByText('Conversation with Priya Kapoor', {}, SLOW)).toBeInTheDocument();
  }, 20000);
});

describe('honest ratings and real reviews', () => {
  const addReviews = (n) => {
    const parents = [IDS.ananya, IDS.rohit, IDS.meera];
    for (let i = 0; i < n; i++) {
      db.insert('reviews', { booking_id: 'bk-r' + i, sitter_id: IDS.priya, reviewer_id: parents[i % 3], rating: i === 0 ? 4 : 5,
        review_text: 'Review number ' + i + ', lovely care.', created_at: new Date(Date.UTC(2026, 10, 1 + i)).toISOString() });
    }
  };

  test('R1: the profile shows the average, count, newest five and "Show all", with first names only', async () => {
    addReviews(6);
    render(<SitterProfile sitter={toSitterCard({ ...db.one('sitter_profiles', { id: IDS.priya }), users: { name: 'Priya Kapoor' } }, 'Gurgaon')} city="Gurgaon" onBack={jest.fn()} onBook={jest.fn()} />);
    const section = await screen.findByRole('region', { name: 'Reviews' });
    expect(await within(section).findByText('6 reviews')).toBeInTheDocument();
    expect(within(section).getByText('4.8')).toBeInTheDocument();
    expect(within(section).getAllByRole('listitem')).toHaveLength(5);
    expect(within(section).getAllByRole('listitem')[0]).toHaveTextContent('Review number 5');
    expect(within(section).queryByText('Review number 0, lovely care.')).toBeNull();
    expect(within(section).queryByText(/Sharma|Verma|Iyer/)).toBeNull();
    expect(within(section).getAllByText('Ananya').length).toBeGreaterThan(0);
    fireEvent.click(within(section).getByRole('button', { name: 'Show all 6 reviews' }));
    expect(within(section).getAllByRole('listitem')).toHaveLength(6);
    expect(within(section).getByText('Review number 0, lovely care.')).toBeInTheDocument();
  });

  test('R2: a sitter nobody has reviewed shows "New", not a made-up 5.0, on Home, Explore and the profile', async () => {
    Object.assign(db.one('sitter_profiles', { id: IDS.ram }), { review_count: 0, avg_rating: 5, rating: 0 });
    const view = render(<ExploreScreen city="Gurgaon" onBack={jest.fn()} onBook={jest.fn()} />);
    await screen.findByText('राम सिंह');
    expect(screen.getAllByLabelText('New on Fursday, no reviews yet')).toHaveLength(1);
    expect(screen.getByLabelText('Rated 4.9 out of 5 from 12 reviews')).toBeInTheDocument();
    view.unmount();

    render(<App />);
    const ramRow = await homeRow('राम सिंह');
    expect(within(ramRow).getByText('New')).toBeInTheDocument();
    expect(within(ramRow).queryByText('5.0')).toBeNull();
    fireEvent.click(within(ramRow).getByRole('button', { name: 'राम सिंह' }));
    const reviews = await screen.findByRole('region', { name: 'Reviews' });
    expect(await within(reviews).findByText('No reviews yet')).toBeInTheDocument();
    expect(screen.getAllByText('New').length).toBeGreaterThan(0);
  }, 20000);

  test('R3: if reviews can\'t be read yet (before migration 038), the section is hidden instead of claiming none', async () => {
    const realFrom = fake.supabase.from;
    fake.supabase.from = (t) => {
      if (t !== 'reviews') return realFrom(t);
      const r = { select: () => r, eq: () => r, order: () => r };
      r.then = (ok, fail) => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied for table reviews' } }).then(ok, fail);
      return r;
    };
    try {
      render(<SitterProfile sitter={{ id: IDS.priya, name: 'Priya Kapoor', rating: 4.9, reviewCount: 12 }} city="Gurgaon" onBack={jest.fn()} onBook={jest.fn()} />);
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Reviews' })).toBeNull());
      expect(screen.getByLabelText('Rated 4.9 out of 5 from 12 reviews')).toBeInTheDocument();
    } finally {
      fake.supabase.from = realFrom;
    }
  });
});

describe('shareable sitter links', () => {
  test('S1: slugs are first name + area + id start; non-Latin names fall back to "sitter"', () => {
    expect(makeShareSlug('Priya Kapoor', 'DLF Phase 3', 'a1b2c3d4-0000')).toBe('priya-dlf-phase-3-a1b2c3');
    expect(makeShareSlug('सुनीता देवी', null, 'f7218ef4-05f7')).toBe('sitter-f7218e');
    expect(slugFromPath('/s/priya-dlf-phase-3-a1b2c3')).toBe('priya-dlf-phase-3-a1b2c3');
    expect(slugFromPath('/explore')).toBeNull();
  });

  test('S2: a visitor opening /s/<slug> lands on that sitter\'s public profile (before 038 via the id part)', async () => {
    window.history.replaceState(null, '', '/s/priya-sppriy');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /^Priya Kapoor/ }, SLOW)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(window.location.pathname).toBe('/');
    expect(await screen.findByText('Top sitters near you')).toBeInTheDocument();
  }, 20000);

  test('S3: a saved share_slug opens the right sitter, and the profile shares its link', async () => {
    db.one('sitter_profiles', { id: IDS.sunita }).share_slug = 'sunita-golf-course-road-spsuni';
    window.history.replaceState(null, '', '/s/sunita-golf-course-road-spsuni');
    render(<App />);
    expect(await screen.findByRole('heading', { name: /^सुनीता देवी/ }, SLOW)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share profile' }));
    const sheet = await screen.findByRole('dialog', { name: 'Share link' });
    expect(within(sheet).getByText('https://fursday.vercel.app/s/sunita-golf-course-road-spsuni')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Send on WhatsApp' }).getAttribute('href')).toContain(encodeURIComponent('https://fursday.vercel.app/s/sunita-golf-course-road-spsuni'));
  }, 20000);

  test('S4: "Share my profile" saves a slug the first time and uses the browser share sheet when there is one', async () => {
    placeSitters();
    const shared = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: (p) => { shared.push(p); return Promise.resolve(); } });
    db.signInAs(IDS.priyaUser);
    render(<ShareProfileCard />);
    expect(await screen.findByText('https://fursday.vercel.app/s/priya-dlf-phase-3-sppriy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Share my profile' }));
    await waitFor(() => expect(shared).toHaveLength(1));
    expect(shared[0].url).toBe('https://fursday.vercel.app/s/priya-dlf-phase-3-sppriy');
    expect(db.one('sitter_profiles', { id: IDS.priya }).share_slug).toBe('priya-dlf-phase-3-sppriy');
  });

  test('S5: a sitter who is not approved yet can\'t share', async () => {
    db.signInAs(IDS.vikramUser);
    render(<ShareProfileCard />);
    expect(await screen.findByText('You can share your page once your profile is approved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share my profile' })).toBeDisabled();
  });
});

describe('Explore filters and map', () => {
  const names = () => ['Priya Kapoor', 'सुनीता देवी', 'राम सिंह', 'Kavita Rane'].filter(n => screen.queryByText(n));
  const openFilters = () => fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  const sheet = () => screen.getByRole('dialog', { name: 'Filter sitters' });

  const addBoardingHost = () => {
    db.table('users').push({ id: 'u-kavita', name: 'Kavita Rane', email: 'kavita@test.example' });
    db.table('sitter_profiles').push({ id: 'sp-kavita', user_id: 'u-kavita', city_id: IDS.gurgaon, status: 'active', provider_type: 'boarding', languages: ['Marathi'],
      base_area: 'Sector 56', home_details: { home_type: 'independent_house', outdoor: ['garden'], sizes: ['small'] } });
    db.table('sitter_services').push({ id: 'svc-kavita', sitter_id: 'sp-kavita', service_type: 'boarding', price_paise: 90000, is_active: true });
  };

  test('F1: price, language, dog size and home filters narrow the list, show chips and clear', async () => {
    addBoardingHost();
    render(<ExploreScreen city="Gurgaon" onBack={jest.fn()} onBook={jest.fn()} />);
    await screen.findByText('Priya Kapoor');
    expect(names()).toHaveLength(4);

    openFilters();
    fireEvent.change(within(sheet()).getByLabelText('Max'), { target: { value: '320' } });
    expect(within(sheet()).getByRole('button', { name: 'Show 1 sitter' })).toBeInTheDocument();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Show 1 sitter' }));
    expect(names()).toEqual(['सुनीता देवी']);
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Up to Rs.320' }));
    expect(names()).toHaveLength(4);

    openFilters();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'English' }));
    expect(within(sheet()).getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }));
    expect(names()).toEqual(['Priya Kapoor']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(names()).toHaveLength(4);

    openFilters();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Large (25–40 kg)' }));
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }));
    expect(names()).not.toContain('Kavita Rane');
    expect(names()).toContain('Priya Kapoor');
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    openFilters();
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Independent house' }));
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }));
    expect(names()).toEqual(['Kavita Rane']);
  });

  test('F2: "Free on" uses each sitter\'s calendar: a day off hides that sitter', async () => {
    const day = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    const iso = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0') + '-' + String(day.getDate()).padStart(2, '0');
    db.insert('sitter_availability', { sitter_id: IDS.sunita, date: iso, is_available: false });
    db.insert('sitter_availability', { sitter_id: IDS.priya, date: iso, is_available: true, time_slots: ['morning'] });
    render(<ExploreScreen city="Gurgaon" onBack={jest.fn()} onBook={jest.fn()} />);
    await screen.findByText('सुनीता देवी');
    openFilters();
    fireEvent.change(within(sheet()).getByLabelText('From'), { target: { value: iso } });
    fireEvent.click(within(sheet()).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText('सुनीता देवी')).toBeNull());
    expect(screen.getByText('Priya Kapoor')).toBeInTheDocument();
    expect(screen.getByText('राम सिंह')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Remove filter: Free / })).toBeInTheDocument();
  });

  test('F3: the map view pins sitters at their area and a pin opens a card, then the profile', async () => {
    placeSitters();
    const onViewProfile = jest.fn();
    render(<ExploreScreen city="Gurgaon" onBack={jest.fn()} onBook={jest.fn()} onViewProfile={onViewProfile} />);
    await screen.findByText('Priya Kapoor');
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Map of sitters' })).toBeInTheDocument();
    await waitFor(() => expect(mockMarkers).toHaveLength(2));
    expect(screen.getByText(/1 without a set area are only in the list/)).toBeInTheDocument();
    const priyaPin = mockMarkers.find(m => m.opts.title === 'Priya Kapoor');
    expect(priyaPin.latlng).toEqual([28.4925, 77.0955]);
    act(() => priyaPin.handlers.click());
    const card = await screen.findByRole('dialog', { name: 'Priya Kapoor' });
    fireEvent.click(within(card).getByRole('button', { name: 'View profile' }));
    expect(onViewProfile).toHaveBeenCalledWith(expect.objectContaining({ id: IDS.priya }));
  });

  test('F4: in the app, a profile opened from the map comes back to Explore with the map still on', async () => {
    placeSitters();
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Explore' }, SLOW));
    await screen.findByText('Priya Kapoor');
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    await waitFor(() => expect(mockMarkers.length).toBeGreaterThan(0));
    act(() => mockMarkers.find(m => m.opts.title === 'Priya Kapoor').handlers.click());
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Priya Kapoor' })).getByRole('button', { name: 'View profile' }));
    expect(await screen.findByRole('heading', { name: /^Priya Kapoor/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
  }, 20000);
});
