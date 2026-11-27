// The same end-to-end flows as the NCR (Gurgaon) suites, run in Pune, plus
// checks that the two cities never mix. World: src/testing/seed.js buildPuneSeed().
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildPuneSeed, IDS, PUNE } from '../testing/seed';
import ExploreScreen from '../ExploreScreen';
import BookingFlow from '../BookingFlow';
import BookingsDashboard from '../BookingsDashboard';
import SitterDashboard from '../SitterDashboard';
import ChatScreen from '../ChatScreen';
import ReviewModal from '../ReviewModal';
import DisputeForm from '../DisputeForm';
import AdminPanel from '../AdminPanel';
import AdminBroadcast from '../AdminBroadcast';
import BroadcastRequest from '../BroadcastRequest';
import InboxScreen from '../InboxScreen';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));

beforeEach(() => {
  localStorage.clear();
  db.reset(buildPuneSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn(() => 'Photo of Aadhaar is unclear');
  window.open = jest.fn();
});

const notesFor = (userId, type) => db.rows('notifications', { user_id: userId, ...(type ? { type } : {}) });
const LOADING = /Loading your jobs|Loading your bookings|Loading messages/;
const settle = async (r) => { await waitFor(() => expect(within(r.container).queryByText(LOADING)).toBeNull()); return r; };
const cardFor = (r, booking) => within(r.container).getByText(booking.booking_date).closest('div[style*="border-radius: 20px"][style*="margin-bottom: 12px"]');
function cardOf(el, buttonName) {
  let node = el;
  while (node && !within(node).queryAllByRole('button', { name: buttonName }).length) node = node.parentElement;
  return node;
}

describe('Pune: discovery and city separation', () => {
  test('P1: a Pune parent sees only active Pune sitters — no NCR sitters, no pending sitter', async () => {
    db.signInAs(PUNE.aditi);
    render(<ExploreScreen city="Pune" onBack={jest.fn()} onNav={jest.fn()} />);
    expect(await screen.findByText('Omkar Joshi')).toBeInTheDocument();
    expect(screen.getByText('सविता पवार')).toBeInTheDocument();
    expect(screen.getByText('गणेश मोरे')).toBeInTheDocument();
    expect(screen.queryByText('Pooja Shinde')).toBeNull();
    expect(screen.queryByText('Priya Kapoor')).toBeNull();
    expect(screen.queryByText('सुनीता देवी')).toBeNull();
  });

  test('P2: an NCR parent never sees Pune sitters', async () => {
    db.signInAs(IDS.ananya);
    render(<ExploreScreen city="Gurgaon" onBack={jest.fn()} onNav={jest.fn()} />);
    expect(await screen.findByText('Priya Kapoor')).toBeInTheDocument();
    expect(screen.queryByText('Omkar Joshi')).toBeNull();
    expect(screen.queryByText('सविता पवार')).toBeNull();
  });
});

describe('Pune: booking and money', () => {
  test('P3: booking Omkar charges his own Pune price and stores the booking in Pune', async () => {
    db.signInAs(PUNE.aditi);
    render(<BookingFlow city="Pune" onBack={jest.fn()} sitter={{ id: PUNE.omkar, name: 'Omkar Joshi', area: 'Pune' }} />);
    expect(await screen.findByText('Rs.450')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Request a walker'));
    fireEvent.click(screen.getByText('Continue →'));
    await screen.findByText('Pick a time');
    const d = new Date(); d.setDate(d.getDate() + 1);
    fireEvent.click(screen.getAllByText(String(d.getDate()))[0]);
    fireEvent.click(screen.getByText('7:00 AM'));
    fireEvent.click(screen.getByText('Continue →'));
    fireEvent.click(await screen.findByText('Simba'));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByText('Continue →'));
    await screen.findByText('Review booking');
    fireEvent.click(screen.getByText(/Request booking/));
    await waitFor(() => expect(db.rows('bookings', { pet_parent_id: PUNE.aditi, pet_id: PUNE.simba, status: 'pending' })).toHaveLength(1));
    const row = db.rows('bookings', { pet_parent_id: PUNE.aditi, status: 'pending' })[0];
    expect(row).toMatchObject({ sitter_id: PUNE.omkar, city_id: IDS.pune, gross_amount_paise: 45000, sitter_payout_paise: 45000 });
  });

  async function cancel(userId, sitterName, bookingId) {
    db.signInAs(userId);
    render(<BookingsDashboard city="Pune" onNav={jest.fn()} onPayNow={jest.fn()} />);
    await waitFor(() => expect(screen.queryByText('Loading your bookings...')).toBeNull());
    fireEvent.click(await screen.findByText('with ' + sitterName));
    fireEvent.click(screen.getByText('✕ Cancel this booking'));
    const sheet = screen.getByText('Cancellation Policy').parentElement.parentElement;
    fireEvent.click(within(sheet).getByText('Cancel booking'));
    fireEvent.click(screen.getByText('Change of plans'));
    fireEvent.click(screen.getByText('Yes, cancel this booking'));
    await waitFor(() => expect(db.one('bookings', { id: bookingId }).status).toBe('cancelled'));
    return db.one('bookings', { id: bookingId });
  }

  test('P4: cancelling 6 days out refunds 100% of Rs.450', async () => {
    const row = await cancel(PUNE.aditi, 'Omkar Joshi', 'pn-far');
    expect(row).toMatchObject({ refund_percentage: 100, refund_amount_paise: 45000 });
    await waitFor(() => expect(notesFor(PUNE.omkarUser, 'booking_cancelled')).toHaveLength(1));
  });

  test('P5: cancelling 2 days out refunds 75% of Rs.320', async () => {
    const row = await cancel(PUNE.aditi, 'सविता पवार', 'pn-mid');
    expect(row).toMatchObject({ refund_percentage: 75, refund_amount_paise: 24000 });
  });
});

describe('Pune: sitter jobs', () => {
  test('P6: Savita accepts the pending request and the Pune parent is told', async () => {
    db.signInAs(PUNE.savitaUser);
    const r = await settle(render(<SitterDashboard city="Pune" onBack={() => {}} />));
    const pending = db.one('bookings', { id: 'pn-pending' });
    fireEvent.click(within(cardFor(r, pending)).getByRole('button', { name: /^Accept/ }));
    await waitFor(() => expect(db.one('bookings', { id: 'pn-pending' }).status).toBe('confirmed'));
    await waitFor(() => expect(notesFor(PUNE.sneha, 'booking_accepted')).toHaveLength(1));
  });

  test('P7: Ganesh\'s wrong start code is refused; the right one starts the walk', async () => {
    db.one('bookings', { id: 'pn-soon' }).start_otp = '2468';
    db.signInAs(PUNE.ganeshUser);
    const r = await settle(render(<SitterDashboard city="Pune" onBack={() => {}} />));
    fireEvent.click(within(r.container).getByRole('button', { name: 'Upcoming' }));
    const soon = db.one('bookings', { id: 'pn-soon' });
    fireEvent.change(within(cardFor(r, soon)).getByPlaceholderText('0000'), { target: { value: '1111' } });
    fireEvent.click(within(cardFor(r, soon)).getByRole('button', { name: 'Start' }));
    expect(await within(r.container).findByText(/^Wrong code/)).toBeInTheDocument();
    expect(db.one('bookings', { id: 'pn-soon' }).status).toBe('confirmed');
    fireEvent.change(within(cardFor(r, soon)).getByPlaceholderText('0000'), { target: { value: '2468' } });
    fireEvent.click(within(cardFor(r, soon)).getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(db.one('bookings', { id: 'pn-soon' }).status).toBe('active'));
    await waitFor(() => expect(notesFor(PUNE.rahul, 'walk_started')).toHaveLength(1));
  });

  test('P8: a Pune sitter does not see an NCR open request, but does see a Pune one', async () => {
    db.insert('broadcast_requests', { id: 'req-ncr', pet_parent_id: IDS.meera, city_id: IDS.gurgaon, service_type: 'walk30', status: 'open' });
    db.signInAs(PUNE.omkarUser);
    const r = await settle(render(<SitterDashboard city="Pune" onBack={() => {}} />));
    expect(within(r.container).queryByText('1 open request near you')).toBeNull();
    r.unmount();
    db.insert('broadcast_requests', { id: 'req-pune', pet_parent_id: PUNE.sneha, city_id: IDS.pune, service_type: 'walk30', status: 'open' });
    db.insert('broadcast_recipients', { request_id: 'req-pune', sitter_id: PUNE.omkar, wave: 1 });
    const r2 = await settle(render(<SitterDashboard city="Pune" onBack={() => {}} />));
    expect(await within(r2.container).findByText('1 open request near you')).toBeInTheDocument();
  });

  test('P9: Sneha posts an open request in Pune; it is stored in Pune with a Pune area', async () => {
    db.signInAs(PUNE.sneha);
    render(<BroadcastRequest city="Pune" onBack={jest.fn()} onSitterAccepted={jest.fn()} />);
    fireEvent.click(screen.getByText('Request a walker'));
    fireEvent.click(screen.getByText('Continue →'));
    fireEvent.click(screen.getByText('7:00 AM'));
    fireEvent.click(screen.getByText('Continue →'));
    await screen.findByText('Moti');
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'DLF' } });
    expect(screen.queryByRole('option', { name: /DLF Phase 1/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: 'Baner' } });
    fireEvent.click(screen.getByRole('option', { name: /Baner/ }));
    fireEvent.click(screen.getByText('Continue →'));
    fireEvent.click(screen.getByText('Send to nearby carers'));
    await waitFor(() => expect(db.rows('broadcast_requests', { pet_parent_id: PUNE.sneha })).toHaveLength(1));
    expect(db.rows('broadcast_requests', { pet_parent_id: PUNE.sneha })[0]).toMatchObject({ city_id: IDS.pune, area: 'Baner', address_pincode: '411045' });
  });
});

describe('Pune: chat, review, complaint', () => {
  test('P10: a Marathi message reaches the sitter exactly as typed', async () => {
    const text = 'उद्या सकाळी ७ वाजता येतो 🐕 सिंबाला पाणी द्या';
    const far = db.one('bookings', { id: 'pn-far' });
    db.signInAs(PUNE.aditi);
    const r = await settle(render(<ChatScreen city="Pune" onBack={() => {}} userType="parent"
      booking={{ id: far.id, service: far.service_type, sitterName: 'Omkar Joshi', date: far.booking_date, time: far.time_slot, price: far.gross_amount_paise, recipientUserId: PUNE.omkarUser }} />));
    const input = r.container.querySelector('input:not([type])');
    fireEvent.change(input, { target: { value: text } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(db.rows('messages', { booking_id: 'pn-far' })).toHaveLength(1));
    expect(Buffer.from(db.rows('messages', { booking_id: 'pn-far' })[0].message)).toEqual(Buffer.from(text));
  });

  test('P11: a 5-star review on a Pune booking is saved and updates the sitter rating', async () => {
    db.signInAs(PUNE.aditi);
    const done = db.one('bookings', { id: 'pn-done' });
    render(<ReviewModal booking={{ ...done, sitter_name: 'Omkar Joshi' }} onClose={jest.fn()} onSubmitted={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rate 5 out of 5' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Simba loved his walk with Omkar!' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit/ }));
    await waitFor(() => expect(db.rows('reviews', { booking_id: 'pn-done' })).toHaveLength(1));
    expect(db.one('sitter_profiles', { id: PUNE.omkar })).toMatchObject({ review_count: 1, avg_rating: 5 });
  });

  test('P12: a dispute on a Pune booking reaches the sitter\'s real account', async () => {
    db.signInAs(PUNE.aditi);
    render(<DisputeForm booking={db.one('bookings', { id: 'pn-done' })} sitterName="Omkar Joshi" onClose={jest.fn()} />);
    fireEvent.click(screen.getByText(/No Show/));
    fireEvent.change(screen.getByPlaceholderText(/title/i), { target: { value: 'Late by an hour' } });
    fireEvent.change(screen.getByPlaceholderText(/describe/i), { target: { value: 'Omkar arrived very late.' } });
    fireEvent.click(screen.getByRole('button', { name: /File dispute/i }));
    await waitFor(() => expect(db.rows('disputes', { booking_id: 'pn-done' })).toHaveLength(1));
    expect(db.rows('disputes', { booking_id: 'pn-done' })[0]).toMatchObject({ reported_by: PUNE.aditi, reported_user_id: PUNE.omkarUser });
  });

  test('P13: Omkar\'s Messages inbox lists his Pune booking chat', async () => {
    db.insert('messages', { booking_id: 'pn-far', sender_id: PUNE.aditi, sender_type: 'parent', message: 'Gate code is 4521' });
    db.signInAs(PUNE.omkarUser);
    render(<InboxScreen role="sitter" onOpenChat={jest.fn()} />);
    expect(await screen.findByText('Aditi Kulkarni')).toBeInTheDocument();
    expect(screen.getByText('Gate code is 4521')).toBeInTheDocument();
  });
});

describe('Pune: admin', () => {
  async function openAdmin() {
    db.signInAs(IDS.admin);
    render(<AdminPanel />);
    await screen.findByText(/^Sitters \([1-9]\d*\)$/);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
  }

  test('P14: a Pune sitter without Aadhaar cannot be approved and can be sent back for changes', async () => {
    await openAdmin();
    const card = cardOf(screen.getByText('Pooja Shinde'), /Approve/);
    expect(within(card).getByRole('button', { name: /Approve/ })).toBeDisabled();
    fireEvent.click(within(card).getByRole('button', { name: 'Needs changes' }));
    await screen.findByText('Sent back for changes');
    expect(db.one('sitter_profiles', { id: PUNE.pooja })).toMatchObject({ status: 'needs_changes', review_notes: 'Photo of Aadhaar is unclear' });
    expect(notesFor(PUNE.poojaUser, 'sitter_needs_changes')).toHaveLength(1);
  });

  test('P15: Pune payouts — Omkar gets 85%, Founding Sitter Savita gets 100%', async () => {
    await openAdmin();
    fireEvent.click(screen.getByText(/^Payouts \(/));
    const omkarCard = cardOf(screen.getByText('PUN-DONE'), 'Mark paid');
    expect(within(omkarCard).getByText('Sitter gets: Rs.383')).toBeInTheDocument();
    const savitaCard = cardOf(screen.getByText('PUN-NE-2'), 'Mark paid');
    expect(within(savitaCard).getByText('Sitter gets: Rs.320 (Founding — 0% commission)')).toBeInTheDocument();
    fireEvent.click(within(omkarCard).getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => expect(db.one('bookings', { id: 'pn-done' }).payout_status).toBe('paid'));
  });

  test('P16: an announcement to Pune sitters reaches only Pune sitters', async () => {
    render(<AdminBroadcast />);
    await screen.findByRole('option', { name: 'Pune' });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: IDS.pune } });
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Ganesh Chaturthi week' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Expect more boarding requests in Pune.' } });
    fireEvent.click(screen.getByText('Review and send'));
    fireEvent.click(screen.getByText('Yes, send'));
    expect(await screen.findByText('Sent to 3 people.')).toBeInTheDocument();
    expect(db.rows('notifications', { type: 'announcement' }).map(n => n.user_id).sort()).toEqual([PUNE.ganeshUser, PUNE.omkarUser, PUNE.savitaUser].sort());
  });
});
