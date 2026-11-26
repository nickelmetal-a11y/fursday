// Saved addresses, service zones and sitter travel radius, played end to end
// against the in-memory database. World: src/testing/seed.js buildPuneSeed().
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildPuneSeed, IDS } from '../testing/seed';
import { distanceKm, formatKm } from '../geo';
import AddressBook from '../AddressBook';
import BookingFlow from '../BookingFlow';
import ExploreScreen from '../ExploreScreen';
import App from '../App';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../geolocationService', () => ({
  checkLocationRestriction: () => Promise.resolve({ allowed: true, ip: '127.0.0.1' }),
  getLocationRestrictedMessage: () => 'Coming soon to your area',
}));

const SECTOR_56 = { lat: 28.4237, lng: 77.0981 };
const PRIYA = { id: IDS.priya, name: 'Priya Kapoor', area: 'Gurgaon' };
const SITTER_NAMES = /^(Priya Kapoor|सुनीता देवी|राम सिंह)$/;

const realGeo = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
function mockGps(coords) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true, writable: true,
    value: { getCurrentPosition: (ok) => ok({ coords: { latitude: coords.lat, longitude: coords.lng } }) },
  });
}

beforeEach(() => {
  localStorage.clear();
  db.reset(buildPuneSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
});

afterEach(() => {
  if (realGeo) Object.defineProperty(navigator, 'geolocation', realGeo);
  else delete navigator.geolocation;
});

const home = (extra) => db.insert('user_addresses', {
  id: 'addr-home', user_id: IDS.ananya, label: 'Home', flat: 'B-1203', building: 'Tower 4', society: 'Ireo Victory Valley',
  area: 'Sector 56', pincode: '122011', city_id: IDS.gurgaon, lat: SECTOR_56.lat, lng: SECTOR_56.lng, is_default: true,
  created_at: '2026-11-01T00:00:00Z', ...extra,
});
const work = (extra) => db.insert('user_addresses', {
  id: 'addr-work', user_id: IDS.ananya, label: 'Work', flat: '7th floor', building: 'Building 10', society: 'DLF Cyber City',
  area: 'Cyber City', pincode: '122002', city_id: IDS.gurgaon, lat: 28.4950, lng: 77.0890, is_default: false,
  created_at: '2026-11-02T00:00:00Z', ...extra,
});
const setSitter = (id, fields) => Object.assign(db.one('sitter_profiles', { id }), fields);
const shownOrder = () => screen.getAllByText(SITTER_NAMES).map(el => el.textContent);

async function walkToPetStep() {
  fireEvent.click(await screen.findByText('Request a walker'));
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Pick a time');
  await new Promise(r => setTimeout(r, 30)); // let the sitter's calendar load
  const d = new Date(); d.setDate(d.getDate() + 1);
  const tileFor = (date) => screen.getAllByText(String(date.getDate()))[0].closest('[role="button"]');
  while (tileFor(d).getAttribute('aria-disabled') === 'true') d.setDate(d.getDate() + 1); // Priya works Mon–Fri
  fireEvent.click(tileFor(d));
  fireEvent.click(screen.getByText('7:00 AM'));
  fireEvent.click(screen.getByText('Continue →'));
  fireEvent.click(await screen.findByText('Bruno'));
  fireEvent.click(screen.getByRole('checkbox'));
}

async function requestBooking() {
  fireEvent.click(screen.getByText('Continue →'));
  await screen.findByText('Review booking');
  fireEvent.click(screen.getByText(/Request booking/));
  await screen.findByText('Booking requested!');
  const rows = db.rows('bookings', { pet_parent_id: IDS.ananya, status: 'pending' });
  expect(rows).toHaveLength(1);
  return rows[0];
}

describe('Address book', () => {
  test('A1: adding an address via area autocomplete stores area, pincode, city and the locality pin', async () => {
    db.signInAs(IDS.ananya);
    render(<AddressBook city="Gurgaon" onBack={jest.fn()} />);
    expect(await screen.findByText(/No saved addresses yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add new address/ }));

    fireEvent.change(screen.getByLabelText('Flat / House no.'), { target: { value: 'B-1203' } });
    fireEvent.change(screen.getByLabelText('Society / Colony'), { target: { value: 'Ireo Victory Valley' } });
    fireEvent.change(screen.getByPlaceholderText('Search your area or pincode'), { target: { value: 'sector 5' } });
    const option = await screen.findByRole('option', { name: /Sector 56/ });
    expect(option).toHaveTextContent('Gurugram · 122011');
    expect(screen.queryByRole('option', { name: /Baner/ })).toBeNull(); // only this city's areas
    fireEvent.click(option);
    expect(screen.queryByRole('option')).toBeNull();
    expect(screen.getByLabelText('Pincode')).toHaveValue('122011');

    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(db.rows('user_addresses', { user_id: IDS.ananya })).toHaveLength(1));
    expect(db.rows('user_addresses', { user_id: IDS.ananya })[0]).toMatchObject({
      label: 'Home', flat: 'B-1203', society: 'Ireo Victory Valley', area: 'Sector 56', pincode: '122011',
      city_id: IDS.gurgaon, lat: SECTOR_56.lat, lng: SECTOR_56.lng, is_default: true,
    });
    expect(await screen.findByText('B-1203, Ireo Victory Valley, Sector 56, 122011')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  test('A2: set default, edit and delete keep exactly one default address', async () => {
    home(); work();
    db.signInAs(IDS.ananya);
    render(<AddressBook city="Gurgaon" onBack={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Make Work my default address' }));
    await waitFor(() => expect(db.one('user_addresses', { id: 'addr-work' }).is_default).toBe(true));
    expect(db.one('user_addresses', { id: 'addr-home' }).is_default).toBe(false);

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Home address' }));
    fireEvent.click(screen.getByRole('button', { name: 'Other' }));
    fireEvent.change(screen.getByLabelText('Flat / House no.'), { target: { value: 'C-44' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(db.one('user_addresses', { id: 'addr-home' })).toMatchObject({ label: 'Other', flat: 'C-44', area: 'Sector 56', is_default: false }));

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Work address' }));
    await waitFor(() => expect(db.one('user_addresses', { id: 'addr-work' })).toBeUndefined());
    await waitFor(() => expect(db.one('user_addresses', { id: 'addr-home' }).is_default).toBe(true));
  });

  test('A3: "Use my current location" fills the nearest named area from GPS', async () => {
    mockGps({ lat: 18.5600, lng: 73.7870 });
    db.signInAs(IDS.ananya);
    render(<AddressBook city="Pune" onBack={jest.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Add new address/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use my current location' }));
    expect(screen.getByPlaceholderText('Search your area or pincode')).toHaveValue('Baner');
    expect(screen.getByLabelText('Pincode')).toHaveValue('411045');
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(db.rows('user_addresses', { user_id: IDS.ananya })).toHaveLength(1));
    expect(db.rows('user_addresses', { user_id: IDS.ananya })[0]).toMatchObject({ area: 'Baner', pincode: '411045', city_id: IDS.pune, lat: 18.56, lng: 73.787 });
  });
});

describe('Booking with addresses and zones', () => {
  test('A4: booking with a saved address copies flat, building, society, area, pincode and pin onto the booking', async () => {
    home();
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA} city="Gurgaon" />);
    await walkToPetStep();
    expect(await screen.findByRole('button', { name: /Home.*Sector 56/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByLabelText('Flat / Unit')).toBeNull();
    fireEvent.click(screen.getByText('Continue →'));
    const summary = (await screen.findByText('Review booking')).parentElement.textContent;
    expect(summary).toContain('B-1203, Tower 4, Ireo Victory Valley, Sector 56, 122011');
    fireEvent.click(screen.getByText(/Request booking/));
    await screen.findByText('Booking requested!');
    expect(db.rows('bookings', { pet_parent_id: IDS.ananya, status: 'pending' })[0]).toMatchObject({
      address_flat: 'B-1203', address_tower: 'Tower 4', address_society: 'Ireo Victory Valley',
      address_area: 'Sector 56', address_pincode: '122011', address_lat: SECTOR_56.lat, address_lng: SECTOR_56.lng,
    });
  });

  test('A5: an address in a closed zone is blocked and "Join the waitlist" writes a waitlist row', async () => {
    db.insert('service_zones', { city_id: IDS.gurgaon, name: 'Sector 50–57', pincodes: ['122011'], is_open: false });
    home();
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA} city="Gurgaon" />);
    await walkToPetStep();
    expect(await screen.findByText("We're not in Sector 56 yet")).toBeInTheDocument();
    fireEvent.click(screen.getByText('Continue →'));
    expect(screen.getByText("We don't serve this area yet")).toBeInTheDocument();
    expect(screen.getByText('Which pet?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Join the waitlist' }));
    await waitFor(() => expect(db.rows('zone_waitlist')).toHaveLength(1));
    expect(db.rows('zone_waitlist')[0]).toMatchObject({ user_id: IDS.ananya, city_id: IDS.gurgaon, area: 'Sector 56', pincode: '122011' });
    expect(await screen.findByText(/You're on the waitlist for Sector 56/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Continue →'));
    expect(screen.queryByText('Review booking')).toBeNull();
    expect(db.rows('bookings', { pet_parent_id: IDS.ananya, status: 'pending' })).toHaveLength(0);
  });

  test('A6: outside every zone is blocked too; switching to an address in an open zone books', async () => {
    db.insert('service_zones', { city_id: IDS.gurgaon, name: 'Cyber hub', pincodes: ['122002'], is_open: true });
    home(); work();
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA} city="Gurgaon" />);
    await walkToPetStep();
    expect(await screen.findByText("We're not in Sector 56 yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Work.*Cyber City/ }));
    expect(screen.queryByText(/We're not in/)).toBeNull();
    const row = await requestBooking();
    expect(row).toMatchObject({ address_area: 'Cyber City', address_pincode: '122002', address_society: 'DLF Cyber City' });
  });

  test('A7: no zones means open — a typed address with an autocompleted area books, and other cities\' zones don\'t matter', async () => {
    db.insert('service_zones', { city_id: IDS.pune, name: 'Baner', pincodes: ['411045'], is_open: false });
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA} city="Gurgaon" />);
    await walkToPetStep();
    fireEvent.change(screen.getByPlaceholderText('Search your area or pincode'), { target: { value: 'DLF Phase 1' } });
    fireEvent.click(await screen.findByRole('option', { name: /DLF Phase 1/ }));
    fireEvent.change(screen.getByLabelText('Flat / Unit'), { target: { value: 'A-401' } });
    fireEvent.change(screen.getByLabelText('Society / Building name'), { target: { value: 'Belvedere Towers' } });
    expect(screen.queryByText(/We're not in/)).toBeNull();
    const row = await requestBooking();
    expect(row).toMatchObject({ address_flat: 'A-401', address_society: 'Belvedere Towers', address_area: 'DLF Phase 1', address_pincode: '122002', address_lat: 28.4722, address_lng: 77.0981 });
    expect(db.rows('zone_waitlist')).toHaveLength(0);
  });

  test('A8: "Add new address" in the booking flow reuses the address form, saves it and selects it', async () => {
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA} city="Gurgaon" />);
    await walkToPetStep();
    fireEvent.click(screen.getByRole('button', { name: /Add new address/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Work' }));
    fireEvent.change(screen.getAllByPlaceholderText('Search your area or pincode')[0], { target: { value: 'Sector 45' } });
    fireEvent.click(await screen.findByRole('option', { name: /Sector 45/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByRole('button', { name: /Work.*Sector 45/ })).toHaveAttribute('aria-pressed', 'true');
    expect(db.rows('user_addresses', { user_id: IDS.ananya })[0]).toMatchObject({ label: 'Work', area: 'Sector 45', pincode: '122003', is_default: true });
    const row = await requestBooking();
    expect(row).toMatchObject({ address_area: 'Sector 45', address_pincode: '122003' });
  });

  test('A9: a sitter who doesn\'t travel that far is flagged with a "choose another sitter" option, but booking still works', async () => {
    setSitter(IDS.priya, { base_area: 'DLF Phase 3', service_radius_km: 3 });
    home();
    const onChooseSitter = jest.fn();
    db.signInAs(IDS.ananya);
    render(<BookingFlow onBack={jest.fn()} sitter={PRIYA} city="Gurgaon" onChooseSitter={onChooseSitter} />);
    await walkToPetStep();
    expect(await screen.findByText('Priya Kapoor may not travel this far')).toBeInTheDocument();
    expect(screen.getByText(/they usually cover 3 km/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose another sitter' }));
    expect(onChooseSitter).toHaveBeenCalledTimes(1);
    const row = await requestBooking();
    expect(row).toMatchObject({ sitter_id: IDS.priya, address_area: 'Sector 56' });
  });
});

describe('Explore by distance', () => {
  const placeSitters = (priyaRadius = 10) => {
    setSitter(IDS.priya, { base_area: 'DLF Phase 3', service_radius_km: priyaRadius });
    setSitter(IDS.sunita, { lat: 28.4320, lng: 77.1024, service_radius_km: 5 });
    setSitter(IDS.ram, { base_area: 'Golf Course Road', service_radius_km: 5 });
  };
  const away = (point) => formatKm(distanceKm(SECTOR_56, point)) + ' away';

  test('A10: from the default address, Nearest is the default sort with km on each card; Top rated reorders', async () => {
    placeSitters();
    home();
    db.signInAs(IDS.ananya);
    render(<ExploreScreen city="Gurgaon" onBack={jest.fn()} onNav={jest.fn()} />);
    expect(await screen.findByText('Home · Sector 56')).toBeInTheDocument();
    expect(screen.getByText('Sitters near you')).toBeInTheDocument();
    await waitFor(() => expect(shownOrder()).toEqual(['सुनीता देवी', 'राम सिंह', 'Priya Kapoor']));
    expect(screen.getByRole('button', { name: 'Nearest' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(away({ lat: 28.4320, lng: 77.1024 }))).toBeInTheDocument();
    expect(screen.getByText(away({ lat: 28.4520, lng: 77.0990 }))).toBeInTheDocument();
    expect(screen.getByText(away({ lat: 28.4925, lng: 77.0955 }))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Top rated' }));
    expect(shownOrder()).toEqual(['Priya Kapoor', 'सुनीता देवी', 'राम सिंह']);
    fireEvent.click(screen.getByRole('button', { name: 'Lowest price' }));
    expect(shownOrder()).toEqual(['सुनीता देवी', 'राम सिंह', 'Priya Kapoor']);
  });

  test('A11: with no saved address GPS is the reference; with neither, Top rated is the default and no km is shown', async () => {
    placeSitters();
    db.signInAs(IDS.ananya);
    const r = render(<ExploreScreen city="Gurgaon" userLocation={SECTOR_56} onBack={jest.fn()} onNav={jest.fn()} />);
    await waitFor(() => expect(shownOrder()).toEqual(['सुनीता देवी', 'राम सिंह', 'Priya Kapoor']));
    expect(screen.getByText('Sector 56')).toBeInTheDocument();
    r.unmount();

    render(<ExploreScreen city="Gurgaon" onBack={jest.fn()} onNav={jest.fn()} />);
    await waitFor(() => expect(shownOrder()).toEqual(['Priya Kapoor', 'सुनीता देवी', 'राम सिंह']));
    expect(screen.getByRole('button', { name: 'Top rated' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/ away$/)).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  test('A12: "Only sitters who come to my area" (on by default) hides a far sitter; sitters without a base stay', async () => {
    placeSitters(3);
    setSitter(IDS.ram, { base_area: null, lat: null, lng: null });
    home();
    db.signInAs(IDS.ananya);
    render(<ExploreScreen city="Gurgaon" onBack={jest.fn()} onNav={jest.fn()} />);
    const toggle = await screen.findByRole('switch', { name: 'Only sitters who come to my area' });
    await waitFor(() => expect(shownOrder()).toEqual(['सुनीता देवी', 'राम सिंह']));
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    expect(shownOrder()).toContain('Priya Kapoor');
    expect(screen.getByText(away({ lat: 28.4925, lng: 77.0955 }))).toBeInTheDocument();
  });
});

describe('Home location', () => {
  // App boots splash → session → home, which can be slow when the whole suite runs in parallel.
  const SLOW = { timeout: 8000 };
  const locationButton = () => screen.findByRole('button', { name: /^Change city: / }, SLOW);
  const showsPlace = (place) => waitFor(() => expect(screen.getByRole('button', { name: 'Change city: ' + place })).toBeInTheDocument(), SLOW);

  test('A13: the home location line shows the default saved area; picking another saved address makes it default', async () => {
    home(); work();
    db.signInAs(IDS.ananya);
    render(<App />);
    await showsPlace('Sector 56');
    fireEvent.click(await locationButton());
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Your saved addresses')).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: /Work.*Cyber City/ }));
    await waitFor(() => expect(db.one('user_addresses', { id: 'addr-work' }).is_default).toBe(true), SLOW);
    expect(db.one('user_addresses', { id: 'addr-home' }).is_default).toBe(false);
    await showsPlace('Cyber City');

    fireEvent.click(await locationButton());
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Manage addresses' }));
    expect(await screen.findByRole('heading', { name: 'Saved addresses' }, SLOW)).toBeInTheDocument();
    expect(await screen.findByText(/7th floor, Building 10/, {}, SLOW)).toBeInTheDocument();
  }, 30000);

  test('A14: with no saved address the home location is the real GPS neighbourhood', async () => {
    mockGps(SECTOR_56);
    db.signInAs(IDS.ananya);
    render(<App />);
    await showsPlace('Sector 56');
  }, 20000);

  test('A15: GPS far from any named area falls back to the city name', async () => {
    mockGps({ lat: 28.80, lng: 77.60 });
    db.signInAs(IDS.ananya);
    render(<App />);
    await showsPlace('Delhi NCR');
  }, 20000);
});
