// Booking feels professional for parents: capacity-safe boarding, several pets,
// host pricing rules, 60 days ahead, weekly walk plans, free meet & greets,
// host requirements, instant book, questions before booking, pet health details.
import React, { useEffect } from 'react';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { db, supabase } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import { toISODate } from '../AvailabilityCalendar';
import { useLanguage } from '../i18n';
import BookingFlow from '../BookingFlow';
import BookingsDashboard from '../BookingsDashboard';
import ConversationScreen from '../ConversationScreen';
import InboxScreen from '../InboxScreen';
import PetProfile from '../PetProfile';
import PetCareCard from '../PetCareCard';
import { createOrder } from '../paymentsClient';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../paymentsClient', () => {
  const actual = jest.requireActual('../paymentsClient');
  return { ...actual, createOrder: jest.fn(), cancelBooking: jest.fn() };
});

const HOST = { id: 'sp-host', user: 'u-host', name: 'Kavita Rane' };
const SUNITA = { id: IDS.sunita, name: 'सुनीता देवी', area: 'Gurgaon' };
const PRIYA = { id: IDS.priya, name: 'Priya Kapoor', area: 'Gurgaon' };
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dayFrom = (n) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); };
const label = (d) => DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
const tiles = (d) => screen.getAllByRole('button', { name: new RegExp('^' + label(d)) });
const next = () => fireEvent.click(screen.getByText('Continue →'));
const settle = () => act(() => new Promise(r => setTimeout(r, 40)));

function addHost(extra = {}) {
  db.insert('users', { id: HOST.user, name: HOST.name, email: 'kavita@test.example' });
  db.insert('sitter_profiles', { id: HOST.id, user_id: HOST.user, city_id: IDS.gurgaon, status: 'active', provider_type: 'boarding', ...extra });
  db.insert('sitter_services', { id: 'svc-host', sitter_id: HOST.id, service_type: 'boarding', price_paise: 100000, is_active: true });
}
const addLuna = (extra = {}) => db.insert('pet_profiles', { id: 'pet-luna', user_id: IDS.ananya, name: 'Luna', breed: 'Beagle', age_years: 1, ...extra });

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  db.signInAs(IDS.ananya);
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  createOrder.mockReset();
  createOrder.mockResolvedValue({ ok: true, mode: 'off' });
});

async function openFlow(props, serviceName) {
  render(<BookingFlow onBack={jest.fn()} city="Gurgaon" {...props} />);
  fireEvent.click(await screen.findByText(serviceName));
  next();
  await settle();
}
// First open day from tomorrow (skips Priya's weekends).
function pickFirstOpenDay(from = 1) {
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
const total = () => screen.getByText('Total').parentElement.textContent;

describe('Boarding capacity', () => {
  test('PP1: nights already full at the host are crossed out, and a stay cannot run across them', async () => {
    addHost({ home_details: { max_dogs: 1 } });
    db.insert('bookings', { id: 'bk-host', sitter_id: HOST.id, pet_parent_id: IDS.rohit, service_type: 'boarding', status: 'confirmed', booking_date: toISODate(dayFrom(3)), end_date: toISODate(dayFrom(5)), pet_ids: [IDS.coco] });
    await openFlow({ sitter: { id: HOST.id, name: HOST.name } }, 'Home boarding');
    await waitFor(() => expect(tiles(dayFrom(3))[0]).toHaveAttribute('aria-disabled', 'true'));
    expect(tiles(dayFrom(3))[0]).toHaveAccessibleName(/Full$/);
    expect(tiles(dayFrom(4))[0]).toHaveAttribute('aria-disabled', 'true');
    expect(tiles(dayFrom(5))[0]).not.toHaveAttribute('aria-disabled');
    expect(screen.getByText(/already full at Kavita Rane's home/)).toBeInTheDocument();

    fireEvent.click(tiles(dayFrom(1))[0]);
    // Check-out on day 3 is fine (nights 1 and 2); later check-outs would cross the full night.
    await waitFor(() => expect(tiles(dayFrom(3))[1]).not.toHaveAttribute('aria-disabled'));
    expect(tiles(dayFrom(4))[1]).toHaveAttribute('aria-disabled', 'true');
    expect(tiles(dayFrom(6))[1]).toHaveAttribute('aria-disabled', 'true');
  });

  test('PP2: the host takes as many dogs as there is room for that stay', async () => {
    addHost({ home_details: { max_dogs: 2 } });
    addLuna();
    db.insert('bookings', { id: 'bk-host', sitter_id: HOST.id, pet_parent_id: IDS.rohit, service_type: 'boarding', status: 'pending', booking_date: toISODate(dayFrom(2)), end_date: toISODate(dayFrom(3)), pet_ids: [IDS.coco] });
    await openFlow({ sitter: { id: HOST.id, name: HOST.name } }, 'Home boarding');
    fireEvent.click(tiles(dayFrom(1))[0]);
    await settle();
    fireEvent.click(tiles(dayFrom(3))[1]);
    fireEvent.click(screen.getByText('7:00 AM'));
    next();
    fireEvent.click(await screen.findByText('Bruno'));
    fireEvent.click(screen.getByText('Luna'));
    expect(screen.getByRole('alert')).toHaveTextContent('Kavita Rane has room for 1 more dog(s) on these dates.');
    expect(screen.getByText('Luna').closest('button')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Several pets and pricing', () => {
  test('PP3: two pets on one walk: both stored, price follows the host rules, breakdown shown', async () => {
    addLuna({ is_puppy: true });
    Object.assign(db.one('sitter_profiles', { id: IDS.sunita }), { pricing_rules: { extra_dog_pct: 25, puppy_extra_rupees: 50 } });
    await openFlow({ sitter: SUNITA }, 'Request a walker');
    pickFirstOpenDay();
    fireEvent.click(screen.getByText('7:00 AM'));
    await petsAndReview(['Bruno', 'Luna']);
    // Rs.300 + second dog at 25% off (Rs.225) + puppy Rs.50.
    expect(screen.getByText('Extra dogs × 1 (25% off each)').parentElement).toHaveTextContent('Rs.225');
    expect(screen.getByText('Puppy care × 1').parentElement).toHaveTextContent('Rs.50');
    expect(total()).toMatch(/Rs\.575/);
    expect(screen.getByText('Bruno, Luna')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Request booking 🐾'));
    await screen.findByText('Booking requested!');
    const [row] = db.rows('bookings', { pet_parent_id: IDS.ananya, sitter_id: IDS.sunita, status: 'pending' });
    expect(row).toMatchObject({ pet_id: IDS.bruno, pet_ids: [IDS.bruno, 'pet-luna'], gross_amount_paise: 57500, sitter_payout_paise: 57500, is_meet_greet: false });
    expect(createOrder).toHaveBeenCalledWith(row.id);
  });

  test('PP4: boarding nights add the weekend surcharge from the host rules', async () => {
    addHost({ pricing_rules: { weekend_pct: 20 } });
    await openFlow({ sitter: { id: HOST.id, name: HOST.name } }, 'Home boarding');
    // Book a Fri→Sun stay: both nights are weekend nights.
    const fri = [1, 2, 3, 4, 5, 6, 7].find(n => dayFrom(n).getDay() === 5);
    fireEvent.click(tiles(dayFrom(fri))[0]);
    await settle();
    fireEvent.click(tiles(dayFrom(fri + 2))[1]);
    fireEvent.click(screen.getByText('7:00 AM'));
    await petsAndReview(['Bruno']);
    expect(screen.getByText('2 nights × Rs.1000').parentElement).toHaveTextContent('Rs.2000');
    expect(screen.getByText('Weekend nights (+20%)').parentElement).toHaveTextContent('Rs.400');
    expect(total()).toMatch(/Rs\.2400/);
  });

  test('PP5: dates up to 60 days ahead can be booked, and a prefilled far date is kept', async () => {
    const far = dayFrom(45);
    render(<BookingFlow onBack={jest.fn()} city="Gurgaon" sitter={SUNITA} initialService="walk30" initialDate={toISODate(far)} />);
    await screen.findByText('Pick a time');
    await settle();
    expect(screen.getByText('Book up to 60 days ahead')).toBeInTheDocument();
    expect(tiles(far)[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(tiles(dayFrom(59))[0]);
    expect(tiles(dayFrom(59))[0]).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryAllByRole('button', { name: new RegExp('^' + label(dayFrom(60))) })).toHaveLength(0);
  });
});

describe('Weekly walk plans', () => {
  test('PP6: repeat weekly creates a series, one booking per visit and one checkout for all', async () => {
    createOrder.mockResolvedValue({ ok: true, mode: 'off' });
    await openFlow({ sitter: SUNITA }, 'Request a walker');
    fireEvent.click(tiles(dayFrom(1))[0]);
    fireEvent.click(screen.getByText('7:00 AM'));
    fireEvent.click(screen.getByRole('switch', { name: 'Repeat weekly' }));
    const start = dayFrom(1);
    // Two weekdays for three weeks.
    const other = (start.getDay() + 2) % 7;
    fireEvent.click(within(screen.getByRole('group', { name: 'On these days' })).getByRole('button', { name: DAYS[other] }));
    fireEvent.change(screen.getByLabelText('Until'), { target: { value: toISODate(dayFrom(1 + 20)) } });
    expect(screen.getByRole('status')).toHaveTextContent('6 visits.');
    await petsAndReview(['Bruno']);
    expect(screen.getByText('Plan').parentElement).toHaveTextContent('6 visits until');
    expect(screen.getByText('× 6 visits').parentElement).toHaveTextContent('Rs.1800');
    expect(total()).toMatch(/Rs\.1800/);
    fireEvent.click(screen.getByText('Request booking 🐾'));
    await screen.findByText('Booking requested!');
    expect(screen.getByText(/6 visits booked in one plan/)).toBeInTheDocument();

    const [series] = db.rows('booking_series', { pet_parent_id: IDS.ananya });
    expect(series).toMatchObject({ sitter_id: IDS.sunita, service_type: 'walk30', status: 'active', time_slot: '7:00 AM' });
    expect(series.weekdays.sort()).toEqual([start.getDay(), other].sort());
    const rows = db.rows('bookings', { series_id: series.id });
    expect(rows).toHaveLength(6);
    rows.forEach(r => expect(r).toMatchObject({ gross_amount_paise: 30000, pet_ids: [IDS.bruno], status: 'pending', time_slot: '7:00 AM' }));
    expect(new Set(rows.map(r => r.booking_ref)).size).toBe(6);
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(createOrder.mock.calls[0][0].sort()).toEqual(rows.map(r => r.id).sort());
  });

  test("PP7: a plan skips the sitter's days off (Priya works Mon–Fri)", async () => {
    await openFlow({ sitter: PRIYA }, 'Request a walker');
    const n = pickFirstOpenDay();
    fireEvent.click(screen.getByText('7:00 AM'));
    fireEvent.click(screen.getByRole('switch', { name: 'Repeat weekly' }));
    const group = within(screen.getByRole('group', { name: 'On these days' }));
    ['Sat', 'Sun'].forEach(d => fireEvent.click(group.getByRole('button', { name: d })));
    fireEvent.change(screen.getByLabelText('Until'), { target: { value: toISODate(dayFrom(n + 13)) } });
    // Two weeks of the start weekday only; the weekend days never fit.
    expect(screen.getByRole('status')).toHaveTextContent('2 visits.');
  });

  test('PP8: the plan shows as one card; pause tells the sitter, cancel remaining cancels every visit', async () => {
    db.insert('booking_series', { id: 'ser-1', pet_parent_id: IDS.ananya, sitter_id: IDS.priya, service_type: 'walk30', weekdays: [1, 3], time_slot: '7:00 AM', status: 'active' });
    [3, 5, 10].forEach((n, i) => db.insert('bookings', { id: 'sb-' + i, booking_ref: 'FUR-S' + i, series_id: 'ser-1', pet_parent_id: IDS.ananya, sitter_id: IDS.priya, pet_id: IDS.bruno, service_type: 'walk30', status: 'pending', booking_date: toISODate(dayFrom(n)), time_slot: '7:00 AM', gross_amount_paise: 40000, payment_status: 'unpaid' }));
    render(<BookingsDashboard city="Gurgaon" onBack={jest.fn()} onNav={jest.fn()} />);
    const card = await screen.findByRole('region', { name: /with Priya Kapoor/ });
    expect(card).toHaveTextContent('3 left');
    expect(card).toHaveTextContent('Rs.1200 for the remaining visits');
    expect(screen.queryByText('FUR-S1')).toBeNull();

    fireEvent.click(within(card).getByRole('button', { name: /Pause plan/ }));
    await waitFor(() => expect(db.one('booking_series', { id: 'ser-1' }).status).toBe('paused'));
    expect(await within(card).findByText(/has been told the plan is paused/)).toBeInTheDocument();
    expect(db.rows('notifications', { user_id: IDS.priyaUser, type: 'series_update' })).toHaveLength(1);

    fireEvent.click(within(card).getByRole('button', { name: 'Cancel remaining' }));
    await waitFor(() => expect(db.rows('bookings', { series_id: 'ser-1', status: 'cancelled' })).toHaveLength(3));
    expect(db.one('booking_series', { id: 'ser-1' }).status).toBe('ended');
  });
});

describe('Meet & greet, host requirements, instant book', () => {
  test('PP9: a meet & greet is free and skips payment', async () => {
    await openFlow({ sitter: SUNITA }, 'Meet & greet');
    fireEvent.click(tiles(dayFrom(1))[0]);
    fireEvent.click(screen.getByText('5:00 PM'));
    await petsAndReview(['Bruno']);
    expect(screen.queryByText('Total')).toBeNull();
    fireEvent.click(screen.getByText('Request meet & greet'));
    await screen.findByText('Booking requested!');
    const [row] = db.rows('bookings', { pet_parent_id: IDS.ananya, service_type: 'meet_greet' });
    expect(row).toMatchObject({ is_meet_greet: true, gross_amount_paise: 0, status: 'pending' });
    expect(createOrder).not.toHaveBeenCalled();
    expect(screen.getByText(/A meet & greet is free/)).toBeInTheDocument();
  });

  test('PP10: a host who needs vaccination blocks dogs without a valid certificate', async () => {
    addHost({ requires_vaccination: true });
    addLuna({ vaccination_cert_url: 'https://storage.test/pet-photos/u-ananya/vaccination/1.pdf', vaccinated_until: toISODate(dayFrom(200)) });
    const onAddCertificate = jest.fn();
    await openFlow({ sitter: { id: HOST.id, name: HOST.name }, onAddCertificate }, 'Home boarding');
    fireEvent.click(tiles(dayFrom(1))[0]);
    await settle();
    fireEvent.click(tiles(dayFrom(2))[1]);
    fireEvent.click(screen.getByText('7:00 AM'));
    next();
    fireEvent.click(await screen.findByText('Bruno'));
    expect(screen.getByText('Kavita Rane needs a valid vaccination certificate')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    next();
    expect(screen.getByRole('alert')).toHaveTextContent('Add a valid vaccination certificate to continue');
    fireEvent.click(screen.getByText('Add certificate'));
    expect(onAddCertificate).toHaveBeenCalledWith(expect.objectContaining({ id: IDS.bruno }));
    fireEvent.click(screen.getByText('Bruno'));
    fireEvent.click(screen.getByText('Luna'));
    expect(screen.queryByText('Kavita Rane needs a valid vaccination certificate')).toBeNull();
    next();
    expect(await screen.findByText('Review booking')).toBeInTheDocument();
  });

  test('PP11: house rules must be accepted; the time and the host policy are stored', async () => {
    addHost({ home_details: { rules: 'No dogs on the sofa.\nPick up by 7 PM.' }, cancellation_policy: 'strict' });
    await openFlow({ sitter: { id: HOST.id, name: HOST.name } }, 'Home boarding');
    fireEvent.click(tiles(dayFrom(1))[0]);
    await settle();
    fireEvent.click(tiles(dayFrom(2))[1]);
    fireEvent.click(screen.getByText('7:00 AM'));
    await petsAndReview(['Bruno']);
    expect(screen.getByText(/No dogs on the sofa/)).toBeInTheDocument();
    expect(screen.getByText('Cancellation').parentElement).toHaveTextContent('Strict');
    fireEvent.click(screen.getByText('Request booking 🐾'));
    expect(screen.getByRole('alert')).toHaveTextContent('Please accept the house rules to continue');
    expect(db.rows('bookings', { sitter_id: HOST.id })).toHaveLength(0);
    fireEvent.click(screen.getByRole('checkbox', { name: 'I accept the house rules' }));
    fireEvent.click(screen.getByText('Request booking 🐾'));
    await screen.findByText('Booking requested!');
    const [row] = db.rows('bookings', { sitter_id: HOST.id });
    expect(row.house_rules_accepted_at).toBeTruthy();
    expect(row).toMatchObject({ cancellation_policy: 'strict', end_date: toISODate(dayFrom(2)), gross_amount_paise: 100000 });
  });

  test('PP12: instant book confirms straight away for a parent the sitter has looked after', async () => {
    Object.assign(db.one('sitter_profiles', { id: IDS.priya }), { instant_book: true });
    await openFlow({ sitter: PRIYA }, 'Request a walker');
    pickFirstOpenDay();
    fireEvent.click(screen.getByText('7:00 AM'));
    await petsAndReview(['Bruno']);
    expect(screen.getByText(/Instant book: you've booked Priya Kapoor before/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Request booking 🐾'));
    expect(await screen.findByText('Booking confirmed!')).toBeInTheDocument();
    expect(db.rows('bookings', { pet_parent_id: IDS.ananya, sitter_id: IDS.priya, status: 'confirmed' }).filter(b => b.id !== 'bk-far')).toHaveLength(1);
  });

  test('PP13: instant book does not apply to a first-time parent', async () => {
    Object.assign(db.one('sitter_profiles', { id: IDS.priya }), { instant_book: true });
    db.signInAs(IDS.meera);
    await openFlow({ sitter: PRIYA }, 'Request a walker');
    pickFirstOpenDay();
    fireEvent.click(screen.getByText('7:00 AM'));
    await petsAndReview(['Sheru']);
    expect(screen.queryByText(/Instant book/)).toBeNull();
    fireEvent.click(screen.getByText('Request booking 🐾'));
    await screen.findByText('Booking requested!');
    expect(db.rows('bookings', { pet_parent_id: IDS.meera, sitter_id: IDS.priya })[0].status).toBe('pending');
  });
});

describe('Questions before booking', () => {
  test('PP14: parent asks, sitter is notified, sees it in the inbox and replies live', async () => {
    const onBookNow = jest.fn();
    const parent = render(<ConversationScreen sitter={PRIYA} city="Gurgaon" onBack={jest.fn()} onBookNow={onBookNow} />);
    expect(await screen.findByText(/Ask Priya Kapoor about walks/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Write a message'), { target: { value: 'Do you walk big dogs?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('Do you walk big dogs?');
    const [conv] = db.rows('conversations', { pet_parent_id: IDS.ananya, sitter_id: IDS.priya });
    expect(db.rows('conversation_messages', { conversation_id: conv.id })).toHaveLength(1);
    const [note] = db.rows('notifications', { user_id: IDS.priyaUser, type: 'conversation_message' });
    expect(note).toMatchObject({ title: 'New message from Ananya Sharma', body: 'Do you walk big dogs?' });
    fireEvent.click(screen.getByRole('button', { name: 'Book now' }));
    expect(onBookNow).toHaveBeenCalledWith(PRIYA);

    db.signInAs(IDS.priyaUser);
    const onOpenConversation = jest.fn();
    const inbox = render(<InboxScreen role="sitter" onOpenChat={jest.fn()} onOpenConversation={onOpenConversation} />);
    const row = await within(inbox.container).findByText('Do you walk big dogs?');
    expect(row.closest('button')).toHaveTextContent('Before booking');
    expect(row.closest('button')).toHaveTextContent('1 new');
    fireEvent.click(row.closest('button'));
    expect(onOpenConversation).toHaveBeenCalledWith(expect.objectContaining({ id: conv.id }), 'Ananya Sharma');
    inbox.unmount();

    render(<ConversationScreen role="sitter" conversation={{ ...conv, parentName: 'Ananya Sharma' }} onBack={jest.fn()} />);
    await waitFor(() => expect(db.rows('conversation_messages', { conversation_id: conv.id })[0].read_at).toBeTruthy());
    const inputs = screen.getAllByLabelText('Write a message');
    fireEvent.change(inputs[inputs.length - 1], { target: { value: 'Yes, up to 40 kg.' } });
    const sends = screen.getAllByRole('button', { name: 'Send' });
    fireEvent.click(sends[sends.length - 1]);
    // The parent's open screen receives it over realtime.
    expect(await within(parent.container).findByText('Yes, up to 40 kg.')).toBeInTheDocument();
    expect(db.rows('notifications', { user_id: IDS.ananya, type: 'conversation_message' })).toHaveLength(1);
  });

  test('PP15: the parent inbox lists questions next to booking chats', async () => {
    const conv = db.insert('conversations', { pet_parent_id: IDS.ananya, sitter_id: IDS.sunita });
    db.insert('conversation_messages', { conversation_id: conv.id, sender_id: IDS.sunitaUser, body: 'हाँ, शाम को खाली हूँ।' });
    render(<InboxScreen role="parent" onOpenChat={jest.fn()} onOpenConversation={jest.fn()} />);
    const row = await screen.findByText('हाँ, शाम को खाली हूँ।');
    expect(row.closest('button')).toHaveTextContent('सुनीता देवी');
    expect(screen.getAllByText(/FUR-/).length).toBeGreaterThan(0);
  });
});

describe('Pet health details', () => {
  test('PP16: size, puppy, certificate, vet, food, medicines and vet consent are saved and shown to the sitter', async () => {
    render(<PetProfile petId={IDS.bruno} city="Gurgaon" onBack={jest.fn()} onSave={jest.fn()} />);
    await waitFor(() => expect(screen.getByLabelText(/Pet name/)).toHaveValue('Bruno'));
    fireEvent.click(screen.getByRole('button', { name: 'Large' }));
    fireEvent.click(screen.getByRole('button', { name: /Male/ }));
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByText('Continue'));
    fireEvent.click(screen.getByRole('button', { name: 'Upload certificate' }));
    const file = new File(['%PDF-1.4'], 'vaccine.pdf', { type: 'application/pdf' });
    await act(async () => { fireEvent.change(screen.getByTestId('pet-cert-input'), { target: { files: [file] } }); });
    expect(await screen.findByText('View certificate')).toBeInTheDocument();
    const upload = db.rows('_storage', { bucket: 'pet-photos' })[0];
    expect(upload.path).toMatch(/^u-ananya\/vaccination\/\d+\.pdf$/);
    fireEvent.change(screen.getByLabelText('Valid until'), { target: { value: toISODate(dayFrom(300)) } });
    fireEvent.change(screen.getByLabelText('Vet name'), { target: { value: 'Dr. Mehta' } });
    fireEvent.change(screen.getByLabelText('Vet phone'), { target: { value: '9811111111' } });
    fireEvent.change(screen.getByLabelText('Feeding'), { target: { value: '2 cups at 8 AM' } });
    fireEvent.change(screen.getByLabelText('Medicines'), { target: { value: 'None' } });
    fireEvent.click(screen.getByRole('checkbox', { name: /take my dog to a vet/ }));
    fireEvent.click(screen.getByText('Save pet profile 🐾'));
    await waitFor(() => expect(db.one('pet_profiles', { id: IDS.bruno }).vet_name).toBe('Dr. Mehta'));
    expect(db.one('pet_profiles', { id: IDS.bruno })).toMatchObject({
      size: 'large', vaccination_cert_url: 'https://storage.test/pet-photos/' + upload.path, vaccinated_until: toISODate(dayFrom(300)),
      vet_phone: '9811111111', feeding_notes: '2 cups at 8 AM', medication_notes: 'None', emergency_vet_consent: true, is_puppy: false,
    });

    const card = within(render(<PetCareCard petIds={[IDS.bruno]} />).container);
    expect(await card.findByText(/Vaccinated, valid until/)).toBeInTheDocument();
    expect(card.getByText('2 cups at 8 AM')).toBeInTheDocument();
    expect(card.getByRole('link', { name: 'Call vet Dr. Mehta' })).toHaveAttribute('href', 'tel:9811111111');
    expect(card.getByText(/You may take this dog to a vet in an emergency/)).toBeInTheDocument();
  });
});

describe('Hindi and before migration 038', () => {
  function Hindi() { const { setLang } = useLanguage(); useEffect(() => { setLang('hi'); return () => setLang('en'); }, []); return null; } // eslint-disable-line react-hooks/exhaustive-deps

  test('PP17: the new booking options read in Hindi', async () => {
    render(<><Hindi /><BookingFlow onBack={jest.fn()} city="Gurgaon" sitter={SUNITA} /></>);
    fireEvent.click(await screen.findByText('मिलना-जुलना'));
    expect(screen.getByText('मुफ़्त')).toBeInTheDocument();
    fireEvent.click(screen.getByText('वॉकर बुलाएं'));
    fireEvent.click(screen.getByText('जारी रखें →'));
    await settle();
    expect(screen.getByText('60 दिन आगे तक बुक करें')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /,/ })[1]);
    expect(screen.getByRole('switch', { name: 'हर हफ़्ते दोहराएं' })).toBeInTheDocument();
  });

  test('PP18: without the 038 tables and columns, booking, pets and questions still work', async () => {
    const realFrom = supabase.from;
    const missing = (msg) => { const r = { data: null, error: { message: msg } }; const c = { select: () => c, eq: () => c, in: () => c, order: () => c, single: () => c, maybeSingle: () => c, insert: () => c, update: () => c, then: (res, rej) => Promise.resolve(r).then(res, rej) }; return c; };
    const spy = jest.spyOn(supabase, 'from').mockImplementation((t) => {
      if (['booking_series', 'conversations', 'conversation_messages'].includes(t)) return missing("Could not find the table 'public." + t + "' in the schema cache");
      const b = realFrom(t);
      const reject = (cols, table) => (r) => {
        const bad = [].concat(r).flatMap(x => Object.keys(x)).find(k => cols.includes(k));
        return bad ? missing("Could not find the '" + bad + "' column of '" + table + "' in the schema cache") : null;
      };
      if (t === 'bookings') { const ins = b.insert; b.insert = (r) => reject(['pet_ids', 'is_meet_greet', 'series_id', 'house_rules_accepted_at', 'cancellation_policy'], t)(r) || ins(r); }
      if (t === 'pet_profiles') { const up = b.update; b.update = (r) => reject(['size', 'vet_name', 'is_puppy', 'emergency_vet_consent'], t)(r) || up(r); }
      return b;
    });
    try {
      await openFlow({ sitter: SUNITA }, 'Request a walker');
      fireEvent.click(tiles(dayFrom(1))[0]);
      fireEvent.click(screen.getByText('7:00 AM'));
      fireEvent.click(screen.getByRole('switch', { name: 'Repeat weekly' }));
      fireEvent.change(screen.getByLabelText('Until'), { target: { value: toISODate(dayFrom(8)) } });
      await petsAndReview(['Bruno']);
      fireEvent.click(screen.getByText('Request booking 🐾'));
      await screen.findByText('Booking requested!');
      const rows = db.rows('bookings', { pet_parent_id: IDS.ananya, sitter_id: IDS.sunita, status: 'pending' });
      expect(rows).toHaveLength(2);
      rows.forEach(r => { expect(r.pet_ids).toBeUndefined(); expect(r.series_id).toBeUndefined(); expect(r.pet_id).toBe(IDS.bruno); });
      expect(createOrder.mock.calls[0][0]).toHaveLength(2);
    } finally { spy.mockRestore(); }
  });

  test('PP19: before 038 a pet still saves without the health fields, and questions show "coming soon"', async () => {
    const realFrom = supabase.from;
    const spy = jest.spyOn(supabase, 'from').mockImplementation((t) => {
      const b = realFrom(t);
      const fail = (msg) => { const r = { data: null, error: { message: msg, code: 'PGRST205' } }; const c = { select: () => c, eq: () => c, maybeSingle: () => c, single: () => c, then: (res, rej) => Promise.resolve(r).then(res, rej) }; return c; };
      if (t === 'conversations') return fail("Could not find the table 'public.conversations' in the schema cache");
      if (t === 'pet_profiles') { const up = b.update; b.update = (r) => ('vet_name' in r ? fail("Could not find the 'vet_name' column of 'pet_profiles' in the schema cache") : up(r)); }
      return b;
    });
    try {
      render(<ConversationScreen sitter={PRIYA} city="Gurgaon" onBack={jest.fn()} onBookNow={jest.fn()} />);
      expect(await screen.findByText('Messaging before booking is coming soon')).toBeInTheDocument();
      expect(screen.queryByLabelText('Write a message')).toBeNull();

      const onSave = jest.fn();
      render(<PetProfile petId={IDS.bruno} city="Gurgaon" onBack={jest.fn()} onSave={onSave} />);
      await waitFor(() => expect(screen.getByLabelText(/Pet name/)).toHaveValue('Bruno'));
      fireEvent.change(screen.getByLabelText(/Pet name/), { target: { value: 'Bruno Jr' } });
      fireEvent.click(screen.getByRole('button', { name: /Male/ }));
      fireEvent.click(screen.getByText('Continue'));
      fireEvent.click(screen.getByText('Continue'));
      fireEvent.change(screen.getByLabelText('Vet name'), { target: { value: 'Dr. X' } });
      fireEvent.click(screen.getByText('Save pet profile 🐾'));
      await waitFor(() => expect(onSave).toHaveBeenCalled());
      expect(db.one('pet_profiles', { id: IDS.bruno })).toMatchObject({ name: 'Bruno Jr' });
      expect(db.one('pet_profiles', { id: IDS.bruno }).vet_name).toBeUndefined();
      expect(window.alert).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });
});
