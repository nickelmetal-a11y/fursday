import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));

import { db, supabase } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import SitterDashboard from '../SitterDashboard';
import ChatScreen from '../ChatScreen';
import BookingsDashboard from '../BookingsDashboard';
import SitterEarningsDashboard from '../SitterEarningsDashboard';
import LanguageToggle from '../LanguageToggle';

// i18n keeps the active language in a module-level variable, so flip it the
// same way a user does (via the global toggle) rather than reloading modules —
// isolateModules would also give us a second copy of the fake database.
function setLanguage(l) {
  const r = render(<LanguageToggle />);
  fireEvent.click(r.getByText(l === 'hi' ? 'हिं' : 'EN'));
  r.unmount();
}

const LOADING = /Loading your jobs|आपके काम लोड|Loading your bookings|आपकी बुकिंग लोड|Loading messages|संदेश लोड|Loading earnings/;

async function settle(r) {
  await waitFor(() => expect(within(r.container).queryByText(LOADING)).toBeNull());
  return r;
}

async function renderSitterDashboard(userId, props = {}) {
  db.signInAs(userId);
  return settle(render(<SitterDashboard city="Gurgaon" onBack={() => {}} {...props} />));
}

async function renderParentBookings(userId, props = {}) {
  db.signInAs(userId);
  return settle(render(<BookingsDashboard city="Gurgaon" onBack={() => {}} onNav={() => {}} {...props} />));
}

async function renderChat(userId, booking, userType) {
  db.signInAs(userId);
  return settle(render(<ChatScreen city="Gurgaon" onBack={() => {}} booking={booking} userType={userType} />));
}

// Same mappings App.js uses when it opens ChatScreen from each dashboard.
const sitterChatProps = (b) => ({ id: b.id, service: b.service_type, parentName: b.users?.name || 'Pet parent', otherPhone: b.users?.phone || '', fromSitter: true, date: b.booking_date, time: b.time_slot, price: b.gross_amount_paise, recipientUserId: b.pet_parent_id });
const parentChatProps = (b, sitterName, sitterPhone, sitterUserId) => ({ id: b.id, service: b.service_type, sitterName, otherPhone: sitterPhone, date: b.booking_date, time: b.time_slot, price: b.gross_amount_paise, recipientUserId: sitterUserId });

// A booking card on either dashboard is the white 20px-radius block; its date
// line is unique per booking in the seed, so it identifies the card.
function cardFor(r, booking) {
  const dateEl = within(r.container).getByText(booking.booking_date);
  return dateEl.closest('div[style*="border-radius: 20px"][style*="margin-bottom: 12px"]');
}

function clickTab(r, label) {
  fireEvent.click(within(r.container).getByRole('button', { name: label }));
}

async function sendChatText(r, text) {
  const input = r.container.querySelector('input:not([type])');
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

// jsdom has no canvas/image decoding, which both ChatScreen and
// PhotoUploadModal use to compress photos before upload.
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

const photoFile = (name = 'walk.jpg') => new File(['fake-image-bytes'], name, { type: 'image/jpeg' });

beforeEach(() => {
  db.reset(buildSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  window.open = jest.fn();
  localStorage.clear();
  setLanguage('en');
});

// ─── S3 ───────────────────────────────────────────────────────────────────
describe('S3: high review requested', () => {
  async function sitterAsksForReview() {
    const done = db.one('bookings', { id: 'bk-done' });
    let opened = null;
    const dash = await renderSitterDashboard(IDS.priyaUser, { onMessage: (b) => { opened = b; } });
    clickTab(dash, 'Past');
    fireEvent.click(within(cardFor(dash, done)).getByRole('button', { name: /Message/ }));
    expect(opened.id).toBe('bk-done');
    dash.unmount();

    const chat = await renderChat(IDS.priyaUser, sitterChatProps(opened), 'sitter');
    await sendChatText(chat, 'Please leave me a 5-star review!');
    await waitFor(() => expect(db.rows('messages', { booking_id: 'bk-done' })).toHaveLength(1));
    await waitFor(() => expect(within(chat.container).getByText('Please leave me a 5-star review!')).toBeInTheDocument());
    chat.unmount();
  }

  test('S3: sitter review request reaches parent and her 5-star review is saved', async () => {
    await sitterAsksForReview();
    const msg = db.one('messages', { booking_id: 'bk-done' });
    expect(msg).toMatchObject({ sender_id: IDS.priyaUser, sender_type: 'sitter', message: 'Please leave me a 5-star review!' });
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.ananya, type: 'message_received' })).toHaveLength(1));

    // Parent opens the same thread from her bookings list
    let parentArgs = null;
    const bookings = await renderParentBookings(IDS.ananya, { onMessage: (...a) => { parentArgs = a; } });
    clickTab(bookings, /Past/);
    const done = db.one('bookings', { id: 'bk-done' });
    fireEvent.click(within(cardFor(bookings, done)).getByRole('button', { name: /Message/ }));
    expect(parentArgs[1]).toBe('Priya Kapoor');
    expect(parentArgs[3]).toBe(IDS.priyaUser);
    bookings.unmount();

    const parentChat = await renderChat(IDS.ananya, parentChatProps(...parentArgs), 'parent');
    expect(within(parentChat.container).getByText('Please leave me a 5-star review!')).toBeInTheDocument();
    parentChat.unmount();

    // Parent leaves a 5-star review
    const b2 = await renderParentBookings(IDS.ananya);
    clickTab(b2, /Past/);
    const card = cardFor(b2, done);
    fireEvent.click(within(card).getByText(done.booking_date));
    fireEvent.click(within(cardFor(b2, done)).getByRole('button', { name: 'Review' }));
    const textarea = within(b2.container).getByPlaceholderText(/Tell other pet parents/);
    const modal = textarea.parentElement;
    const stars = within(modal).getAllByRole('button').slice(1, 6);
    fireEvent.click(stars[4]);
    fireEvent.change(textarea, { target: { value: 'Priya was wonderful with Bruno, highly recommend!' } });
    fireEvent.click(within(modal).getByRole('button', { name: 'Submit review' }));

    await waitFor(() => expect(db.rows('reviews')).toHaveLength(1));
    expect(db.one('reviews')).toMatchObject({ booking_id: 'bk-done', sitter_id: IDS.priya, reviewer_id: IDS.ananya, rating: 5, review_text: 'Priya was wonderful with Bruno, highly recommend!' });
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.priyaUser, type: 'review_received' })).toHaveLength(1));
  });

  test('S3: review modal names the sitter being reviewed', async () => {
    const done = db.one('bookings', { id: 'bk-done' });
    const r = await renderParentBookings(IDS.ananya);
    clickTab(r, /Past/);
    fireEvent.click(within(cardFor(r, done)).getByText(done.booking_date));
    fireEvent.click(within(cardFor(r, done)).getByRole('button', { name: 'Review' }));
    expect(within(r.container).queryByText(/experience with undefined/)).toBeNull();
    expect(within(r.container).getByText('How was your experience with Priya Kapoor?')).toBeInTheDocument();
  });

  test("S3: a new review updates the sitter's avg_rating and review_count", async () => {
    const done = db.one('bookings', { id: 'bk-done' });
    const r = await renderParentBookings(IDS.ananya);
    clickTab(r, /Past/);
    fireEvent.click(within(cardFor(r, done)).getByText(done.booking_date));
    fireEvent.click(within(cardFor(r, done)).getByRole('button', { name: 'Review' }));
    const textarea = within(r.container).getByPlaceholderText(/Tell other pet parents/);
    fireEvent.click(within(textarea.parentElement).getAllByRole('button')[5]);
    fireEvent.change(textarea, { target: { value: 'Five stars, lovely walk.' } });
    fireEvent.click(within(textarea.parentElement).getByRole('button', { name: 'Submit review' }));
    await waitFor(() => expect(db.rows('reviews')).toHaveLength(1));
    await waitFor(() => expect(db.rows('notifications', { type: 'review_received' })).toHaveLength(1));

    const priya = db.one('sitter_profiles', { id: IDS.priya });
    // Migration 032's trigger recomputes both from the reviews table.
    const priyaReviews = db.rows('reviews', { sitter_id: IDS.priya });
    expect(priya.review_count).toBe(priyaReviews.length);
    expect(priya.avg_rating).toBeCloseTo(priyaReviews.reduce((a, r) => a + r.rating, 0) / priyaReviews.length, 2);
  });
});

// ─── S4 ───────────────────────────────────────────────────────────────────
describe('S4: change time in English', () => {
  async function proposeNewTime() {
    const far = db.one('bookings', { id: 'bk-far' });
    const newDate = new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0];
    const chat = await renderChat(IDS.ananya, parentChatProps(far, 'Priya Kapoor', '', IDS.priyaUser), 'parent');
    fireEvent.click(within(chat.container).getByTitle('Propose a date & time'));
    fireEvent.change(chat.container.querySelector('input[type="date"]'), { target: { value: newDate } });
    fireEvent.change(chat.container.querySelector('input[type="time"]'), { target: { value: '18:30' } });
    fireEvent.click(within(chat.container).getByRole('button', { name: 'Send proposal' }));
    await waitFor(() => expect(db.rows('messages', { booking_id: 'bk-far' })).toHaveLength(1));
    await waitFor(() => expect(within(chat.container).getByText('Proposed schedule')).toBeInTheDocument());
    expect(within(chat.container).getByText('📅 ' + newDate)).toBeInTheDocument();
    expect(within(chat.container).getByText('🕐 18:30')).toBeInTheDocument();
    chat.unmount();
    return { far, newDate };
  }

  test('S4: parent proposal renders as a schedule card for both parent and sitter', async () => {
    const { far, newDate } = await proposeNewTime();
    const msg = db.one('messages', { booking_id: 'bk-far' });
    expect(msg.sender_id).toBe(IDS.ananya);
    expect(msg.message.startsWith('FURSDAY_SCHEDULE::')).toBe(true);
    expect(JSON.parse(msg.message.slice('FURSDAY_SCHEDULE::'.length))).toEqual({ service: 'walk30', date: newDate, time: '18:30', price: 40000 });
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.priyaUser, type: 'schedule_proposed' })).toHaveLength(1));

    const sitterChat = await renderChat(IDS.priyaUser, sitterChatProps({ ...far, users: { name: 'Ananya Sharma' } }), 'sitter');
    expect(within(sitterChat.container).getByText('Proposed schedule')).toBeInTheDocument();
    expect(within(sitterChat.container).getByText('📅 ' + newDate)).toBeInTheDocument();
    expect(within(sitterChat.container).getByText('🕐 18:30')).toBeInTheDocument();
    expect(within(sitterChat.container).getByText('30-min walk')).toBeInTheDocument();
    expect(within(sitterChat.container).getByText('Rs.400')).toBeInTheDocument();
    expect(within(sitterChat.container).queryByText(/FURSDAY_SCHEDULE/)).toBeNull();
  });

  test('S4: sitter can accept the proposed time and the booking date/time change', async () => {
    const { far, newDate } = await proposeNewTime();
    const sitterChat = await renderChat(IDS.priyaUser, sitterChatProps(far), 'sitter');
    const card = within(sitterChat.container).getByText('Proposed schedule').closest('div[style*="min-width"]');
    const accept = within(card).queryByRole('button', { name: /accept|confirm|स्वीकार/i });
    expect(accept).not.toBeNull();
    fireEvent.click(accept);
    await waitFor(() => expect(db.one('bookings', { id: 'bk-far' }).booking_date).toBe(newDate));
    expect(db.one('bookings', { id: 'bk-far' }).time_slot).toMatch(/^(18:30|0?6:30 PM)$/);
  });
});

// ─── S5 ───────────────────────────────────────────────────────────────────
describe('S5: Hindi sitter + parent cancellation', () => {
  async function assertSunitaHindiDashboardAfterCancel() {
    setLanguage('hi');
    const dash = await renderSitterDashboard(IDS.sunitaUser);
    const pending = db.one('bookings', { id: 'bk-pending' });
    expect(within(dash.container).getByRole('button', { name: 'नई (0)' })).toBeInTheDocument();
    expect(within(dash.container).getByText('कोई नई रिक्वेस्ट नहीं')).toBeInTheDocument();
    expect(within(dash.container).queryByText(pending.booking_date)).toBeNull();
    clickTab(dash, 'जारी');
    expect(within(dash.container).queryByText(pending.booking_date)).toBeNull();
    clickTab(dash, 'आगामी');
    expect(within(dash.container).queryByText(pending.booking_date)).toBeNull();
    expect(within(dash.container).getByText(/नमस्ते/)).toBeInTheDocument();
    expect(within(dash.container).getByText('मेरे काम')).toBeInTheDocument();
    expect(within(dash.container).queryByText('My Jobs')).toBeNull();
    dash.unmount();
  }

  test('S5: parent cancels via the policy modal; sitter is notified and the job leaves her Hindi dashboard', async () => {
    const pending = db.one('bookings', { id: 'bk-pending' });
    const r = await renderParentBookings(IDS.meera);
    fireEvent.click(within(cardFor(r, pending)).getByText(pending.booking_date));
    fireEvent.click(within(cardFor(r, pending)).getByRole('button', { name: '✕ Cancel this booking' }));
    const policyTitle = within(r.container).getByText('Keep booking', { exact: false }).closest('div[style*="border-radius: 24px"]');
    fireEvent.click(within(policyTitle).getByRole('button', { name: 'Cancel booking' }));
    fireEvent.click(within(r.container).getByRole('button', { name: 'Change of plans' }));
    fireEvent.click(within(r.container).getByRole('button', { name: 'Yes, cancel this booking' }));

    await waitFor(() => expect(db.one('bookings', { id: 'bk-pending' }).status).toBe('cancelled'));
    expect(db.one('bookings', { id: 'bk-pending' })).toMatchObject({ cancellation_reason: 'Change of plans', refund_percentage: 100 });
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.sunitaUser, type: 'booking_cancelled' })).toHaveLength(1));
    r.unmount();

    await assertSunitaHindiDashboardAfterCancel();
  });

  test('S5: parent cancels via the quick "Cancel booking" button; sitter is still notified', async () => {
    const pending = db.one('bookings', { id: 'bk-pending' });
    const r = await renderParentBookings(IDS.meera);
    fireEvent.click(within(cardFor(r, pending)).getByRole('button', { name: 'Cancel booking' }));
    // The quick button opens the refund-policy sheet, so it notifies like the detailed path.
    const sheet = within(r.container).getByText('Keep booking', { exact: false }).closest('div[style*="border-radius: 24px"]');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel booking' }));
    fireEvent.click(within(r.container).getByRole('button', { name: 'Change of plans' }));
    fireEvent.click(within(r.container).getByRole('button', { name: 'Yes, cancel this booking' }));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-pending' }).status).toBe('cancelled'));
    r.unmount();

    await assertSunitaHindiDashboardAfterCancel();
    expect(db.rows('notifications', { user_id: IDS.sunitaUser, type: 'booking_cancelled' })).toHaveLength(1);
  });

  test("S5: the parent's own cancellation notice does not claim the sitter cancelled", async () => {
    const pending = db.one('bookings', { id: 'bk-pending' });
    const r = await renderParentBookings(IDS.meera);
    fireEvent.click(within(cardFor(r, pending)).getByText(pending.booking_date));
    fireEvent.click(within(cardFor(r, pending)).getByRole('button', { name: '✕ Cancel this booking' }));
    const sheet = within(r.container).getByText('Keep booking', { exact: false }).closest('div[style*="border-radius: 24px"]');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Cancel booking' }));
    fireEvent.click(within(r.container).getByRole('button', { name: 'Change of plans' }));
    fireEvent.click(within(r.container).getByRole('button', { name: 'Yes, cancel this booking' }));
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.sunitaUser })).toHaveLength(1));

    const meeraNotes = db.rows('notifications', { user_id: IDS.meera, type: 'booking_cancelled' });
    expect(meeraNotes).toHaveLength(1);
    expect(meeraNotes[0].title).not.toMatch(/सुनीता देवी cancelled/);
  });
});

// ─── S6 ───────────────────────────────────────────────────────────────────
test('S6: English proposal and Devanagari reply round-trip byte-perfect between Ananya and Hindi-UI Sunita', async () => {
  const mid = db.one('bookings', { id: 'bk-mid' });
  const englishText = 'Can we move the walk to 6 pm on the same day?';
  const hindiReply = 'ठीक है, शाम 6 बजे आऊँगी 🐕';

  const parent = await renderChat(IDS.ananya, parentChatProps(mid, 'सुनीता देवी', '', IDS.sunitaUser), 'parent');
  await sendChatText(parent, englishText);
  await waitFor(() => expect(db.rows('messages', { booking_id: 'bk-mid' })).toHaveLength(1));
  fireEvent.click(within(parent.container).getByTitle('Propose a date & time'));
  fireEvent.change(parent.container.querySelector('input[type="time"]'), { target: { value: '18:00' } });
  fireEvent.click(within(parent.container).getByRole('button', { name: 'Send proposal' }));
  await waitFor(() => expect(db.rows('messages', { booking_id: 'bk-mid' })).toHaveLength(2));
  parent.unmount();

  setLanguage('hi');
  const sitter = await renderChat(IDS.sunitaUser, sitterChatProps({ ...mid, users: { name: 'Ananya Sharma' } }), 'sitter');
  expect(within(sitter.container).getByText(englishText).textContent).toBe(englishText);
  expect(within(sitter.container).getByText('प्रस्तावित समय')).toBeInTheDocument();
  expect(within(sitter.container).getByText('🕐 18:00')).toBeInTheDocument();
  expect(within(sitter.container).getByPlaceholderText('संदेश लिखें...')).toBeInTheDocument();
  await sendChatText(sitter, hindiReply);
  await waitFor(() => expect(db.rows('messages', { booking_id: 'bk-mid' })).toHaveLength(3));
  await waitFor(() => expect(within(sitter.container).getByText(hindiReply)).toBeInTheDocument());
  sitter.unmount();

  const stored = db.rows('messages', { booking_id: 'bk-mid' })[2];
  expect(stored.sender_id).toBe(IDS.sunitaUser);
  expect(Buffer.from(stored.message, 'utf8').equals(Buffer.from(hindiReply, 'utf8'))).toBe(true);
  expect(Array.from(stored.message)).toEqual(Array.from(hindiReply));

  setLanguage('en');
  const parentAgain = await renderChat(IDS.ananya, parentChatProps(mid, 'सुनीता देवी', '', IDS.sunitaUser), 'parent');
  const rendered = within(parentAgain.container).getByText(hindiReply);
  expect(Buffer.from(rendered.textContent, 'utf8').equals(Buffer.from(hindiReply, 'utf8'))).toBe(true);
  expect(within(parentAgain.container).getByText(englishText)).toBeInTheDocument();
});

// ─── S9 ───────────────────────────────────────────────────────────────────
test('S9: sitter can cancel a confirmed booking and the parent is notified', async () => {
  const far = db.one('bookings', { id: 'bk-far' });
  window.prompt = jest.fn(() => 'Family emergency');
  const dash = await renderSitterDashboard(IDS.priyaUser);
  clickTab(dash, 'Upcoming');
  const card = cardFor(dash, far);
  fireEvent.click(within(card).getByText(far.booking_date));
  const cancelBtn = within(cardFor(dash, far)).queryByRole('button', { name: 'Cancel this job' });
  expect(cancelBtn).not.toBeNull();
  fireEvent.click(cancelBtn);
  await waitFor(() => expect(db.one('bookings', { id: 'bk-far' }).status).toBe('cancelled'));
  await waitFor(() => expect(db.rows('notifications', { user_id: IDS.ananya, type: 'booking_cancelled' })).toHaveLength(1));
  expect(db.one('bookings', { id: 'bk-far' })).toMatchObject({ refund_percentage: 100, refund_amount_paise: 40000 });
});

// ─── S13 / S14 ──────────────────────────────────────────────────────────────
test('S13: sitter declines the pending request; booking is cancelled and the parent is told', async () => {
  const pending = db.one('bookings', { id: 'bk-pending' });
  const dash = await renderSitterDashboard(IDS.sunitaUser);
  const card = cardFor(dash, pending);
  expect(within(card).getByText('Meera Iyer')).toBeInTheDocument();
  fireEvent.click(within(card).getByRole('button', { name: 'Decline' }));
  await waitFor(() => expect(db.one('bookings', { id: 'bk-pending' }).status).toBe('cancelled'));
  await waitFor(() => expect(within(dash.container).getByRole('button', { name: 'New (0)' })).toBeInTheDocument());

  const notes = db.rows('notifications', { user_id: IDS.meera });
  expect(notes.length).toBeGreaterThanOrEqual(1);
});

test('S14: sitter accepts the pending request; booking is confirmed and the parent is notified', async () => {
  const pending = db.one('bookings', { id: 'bk-pending' });
  const dash = await renderSitterDashboard(IDS.sunitaUser);
  fireEvent.click(within(cardFor(dash, pending)).getByRole('button', { name: /Accept/ }));
  await waitFor(() => expect(db.one('bookings', { id: 'bk-pending' }).status).toBe('confirmed'));
  await waitFor(() => expect(within(dash.container).getByRole('button', { name: 'New (0)' })).toBeInTheDocument());
  clickTab(dash, 'Upcoming');
  expect(within(dash.container).getByText(pending.booking_date)).toBeInTheDocument();
  dash.unmount();

  const parent = await renderParentBookings(IDS.meera);
  expect(within(cardFor(parent, pending)).getByText('Confirmed')).toBeInTheDocument();

  expect(db.rows('notifications', { user_id: IDS.meera }).length).toBeGreaterThanOrEqual(1);
});

// ─── S15 / S16 ──────────────────────────────────────────────────────────────
test('S15: wrong start OTP is refused and the booking stays confirmed', async () => {
  const mid = db.one('bookings', { id: 'bk-mid' });
  mid.start_otp = '4321';
  const dash = await renderSitterDashboard(IDS.sunitaUser);
  clickTab(dash, 'Upcoming');
  fireEvent.change(within(cardFor(dash, mid)).getByPlaceholderText('0000'), { target: { value: '1234' } });
  fireEvent.click(within(cardFor(dash, mid)).getByRole('button', { name: 'Start' }));
  await waitFor(() => expect(within(dash.container).getByText(/^Wrong code/)).toBeInTheDocument());
  const after = db.one('bookings', { id: 'bk-mid' });
  expect(after.status).toBe('confirmed');
  expect(after.start_verified_at).toBeUndefined();
  expect(db.rows('notifications', { type: 'walk_started' })).toHaveLength(0);
});

test('S16: correct start OTP on a paid booking starts the walk', async () => {
  const mid = db.one('bookings', { id: 'bk-mid' });
  mid.start_otp = '4321';
  const dash = await renderSitterDashboard(IDS.sunitaUser);
  clickTab(dash, 'Upcoming');
  fireEvent.change(within(cardFor(dash, mid)).getByPlaceholderText('0000'), { target: { value: '4321' } });
  fireEvent.click(within(cardFor(dash, mid)).getByRole('button', { name: 'Start' }));
  await waitFor(() => expect(db.one('bookings', { id: 'bk-mid' }).status).toBe('active'));
  expect(db.one('bookings', { id: 'bk-mid' }).start_verified_at).toEqual(expect.any(String));
  await waitFor(() => expect(db.rows('notifications', { user_id: IDS.ananya, type: 'walk_started' })).toHaveLength(1));
  clickTab(dash, 'Active');
  await waitFor(() => expect(within(cardFor(dash, mid)).getByText('Walk in progress')).toBeInTheDocument());
  dash.unmount();

  const parent = await renderParentBookings(IDS.ananya);
  clickTab(parent, /Active/);
  expect(within(cardFor(parent, mid)).getByText('In progress')).toBeInTheDocument();
});

// ─── S17 ──────────────────────────────────────────────────────────────────
test('S17: sitter completes walk and uploads photos; parent confirms them', async () => {
  const restore = stubImagePipeline();
  try {
    const far = db.one('bookings', { id: 'bk-far' });
    far.start_otp = '2468';
    const dash = await renderSitterDashboard(IDS.priyaUser);
    clickTab(dash, 'Upcoming');
    fireEvent.change(within(cardFor(dash, far)).getByPlaceholderText('0000'), { target: { value: '2468' } });
    fireEvent.click(within(cardFor(dash, far)).getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-far' }).status).toBe('active'));

    clickTab(dash, 'Active');
    await waitFor(() => expect(within(dash.container).getByText(far.booking_date)).toBeInTheDocument());
    fireEvent.click(within(cardFor(dash, far)).getByRole('button', { name: 'Complete walk ✓' }));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-far' }).status).toBe('completed'));
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.ananya, type: 'walk_completed' })).toHaveLength(1));

    clickTab(dash, 'Past');
    await waitFor(() => expect(within(dash.container).getByText(far.booking_date)).toBeInTheDocument());
    fireEvent.click(within(cardFor(dash, far)).getByRole('button', { name: '📸 Upload walk photos' }));
    const fileInput = document.body.querySelector('input[type="file"][multiple]');
    fireEvent.change(fileInput, { target: { files: [photoFile('a.jpg'), photoFile('b.jpg')] } });
    await waitFor(() => expect(document.body.querySelectorAll('img[alt]').length).toBeGreaterThanOrEqual(2));
    fireEvent.click(within(document.body).getByRole('button', { name: 'Upload photos' }));

    await waitFor(() => expect(db.rows('walk_photo_reports', { booking_id: 'bk-far' })).toHaveLength(1));
    const report = db.one('walk_photo_reports', { booking_id: 'bk-far' });
    expect(report).toMatchObject({ sitter_id: IDS.priya, pet_parent_id: IDS.ananya, photo_count: 2 });
    expect(report.photo_urls).toHaveLength(2);
    report.photo_urls.forEach(u => expect(u).toMatch(/^https:\/\/storage\.test\/walk-photos\//));
    expect(db.rows('_storage', { bucket: 'walk-photos' })).toHaveLength(2);
    expect(db.one('bookings', { id: 'bk-far' }).sitter_uploaded_photos).toBe(true);
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.ananya, type: 'walk_proof' })).toHaveLength(1));
    await waitFor(() => expect(within(dash.container).getByText('✅ Photos uploaded')).toBeInTheDocument(), { timeout: 3000 });
    dash.unmount();

    const parent = await renderParentBookings(IDS.ananya);
    clickTab(parent, /Past/);
    fireEvent.click(within(cardFor(parent, far)).getByText(far.booking_date));
    fireEvent.click(within(cardFor(parent, far)).getByRole('button', { name: '📸 View walk proof' }));
    await waitFor(() => expect(within(parent.container).getAllByAltText(/./).length).toBeGreaterThanOrEqual(2));
    fireEvent.click(within(parent.container).getByRole('button', { name: 'Confirm photos' }));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-far' }).parent_confirmed_photos).toBe(true));
    expect(db.one('walk_photo_reports', { booking_id: 'bk-far' }).parent_confirmed).toBe(true);
  } finally {
    restore();
  }
});

// ─── S26 / S27 ──────────────────────────────────────────────────────────────
test("S26: a parent message appears live in the sitter's open chat without reload", async () => {
  const mid = db.one('bookings', { id: 'bk-mid' });
  const text = 'नमस्ते सुनीता जी 🐶 Bruno को आज शाम 6 बजे ले जाना 🙏🏽';
  const sitter = await renderChat(IDS.sunitaUser, sitterChatProps({ ...mid, users: { name: 'Ananya Sharma' } }), 'sitter');
  expect(within(sitter.container).getByText('No messages yet')).toBeInTheDocument();

  const parent = await renderChat(IDS.ananya, parentChatProps(mid, 'सुनीता देवी', '', IDS.sunitaUser), 'parent');
  await sendChatText(parent, text);

  await waitFor(() => expect(within(sitter.container).getByText(text)).toBeInTheDocument());
  expect(within(sitter.container).getByText(text).textContent).toBe(text);
  expect(within(sitter.container).getAllByText(text)).toHaveLength(1);
  expect(within(parent.container).getAllByText(text)).toHaveLength(1);
  expect(db.one('messages', { booking_id: 'bk-mid' })).toMatchObject({ sender_id: IDS.ananya, sender_type: 'parent', message: text });
});

test('S27: chat photo is uploaded to storage and sent as a message both sides see as an image', async () => {
  const restore = stubImagePipeline();
  // The fake's public URLs don't use Supabase's real /storage/v1/object/public/
  // shape, which ChatScreen keys off to render a message as an image.
  const origFrom = supabase.storage.from;
  supabase.storage.from = (bucket) => ({
    ...origFrom(bucket),
    getPublicUrl: (path) => ({ data: { publicUrl: 'https://proj.supabase.co/storage/v1/object/public/' + bucket + '/' + path } }),
  });
  try {
    const far = db.one('bookings', { id: 'bk-far' });
    const parent = await renderChat(IDS.ananya, parentChatProps(far, 'Priya Kapoor', '', IDS.priyaUser), 'parent');
    fireEvent.change(parent.container.querySelector('input[type="file"]'), { target: { files: [photoFile('bruno.jpg')] } });
    await waitFor(() => expect(db.rows('messages', { booking_id: 'bk-far' })).toHaveLength(1));

    const uploads = db.rows('_storage', { bucket: 'chat-photos' });
    expect(uploads).toHaveLength(1);
    const msg = db.one('messages', { booking_id: 'bk-far' });
    expect(msg).toMatchObject({ sender_id: IDS.ananya, sender_type: 'parent' });
    expect(msg.message).toBe('https://proj.supabase.co/storage/v1/object/public/chat-photos/' + uploads[0].path);
    await waitFor(() => expect(within(parent.container).getByAltText('Shared')).toHaveAttribute('src', msg.message));
    await waitFor(() => expect(db.rows('notifications', { user_id: IDS.priyaUser, type: 'message_received' })).toHaveLength(1));
    parent.unmount();

    const sitter = await renderChat(IDS.priyaUser, sitterChatProps(far), 'sitter');
    expect(within(sitter.container).getByAltText('Shared')).toHaveAttribute('src', msg.message);
  } finally {
    supabase.storage.from = origFrom;
    restore();
  }
});

// ─── S34 ──────────────────────────────────────────────────────────────────
describe('S34: Hindi sitter dashboard', () => {
  const ENGLISH_CHROME = ['My Jobs', 'Earnings', 'Edit profile', 'New requests', 'Your rating', 'Total walks', 'This month so far', 'Upcoming', 'Active', 'Past', 'Accept ✓', 'Decline', 'Message'];
  const RAW_KEYS = ['greeting', 'jobsNav', 'earningsNav', 'tabNew', 'tabUpcoming', 'newRequests', 'thisMonth', 'accept', 'decline', 'message'];

  test('S34: header, tabs, nav and card buttons render in Hindi', async () => {
    localStorage.setItem('fursday_lang', 'hi');
    setLanguage('hi');
    const dash = await renderSitterDashboard(IDS.sunitaUser);
    const c = within(dash.container);
    expect(c.getByText('नमस्ते, सुनीता 👋')).toBeInTheDocument();
    expect(c.getByText('● आप लाइव हैं')).toBeInTheDocument();
    expect(c.getAllByText('नई रिक्वेस्ट').length).toBeGreaterThan(0);
    ['इस महीने अब तक', 'आपकी रेटिंग', 'कुल वॉक', 'होम', 'मेरे काम', 'कमाई', 'प्रोफ़ाइल बदलें', 'आगामी', 'जारी', 'पुरानी', 'नई बुकिंग रिक्वेस्ट — 1 घंटे के अंदर जवाब दें']
      .forEach(s => expect(c.getByText(s)).toBeInTheDocument());
    expect(c.getByRole('button', { name: 'नई (1)' })).toBeInTheDocument();
    expect(c.getByRole('button', { name: /^स्वीकार करें/ })).toBeInTheDocument();
    expect(c.getByRole('button', { name: 'अस्वीकार करें' })).toBeInTheDocument();
    ENGLISH_CHROME.forEach(s => expect(c.queryByText(s)).toBeNull());
    RAW_KEYS.forEach(k => expect(c.queryByText(k)).toBeNull());
    expect(dash.container.textContent).not.toMatch(/\b(sitter|chat|bookings|tab|nav)_[A-Za-z]+/);
  });

  test('S34: booking card service name and status badge render in Hindi', async () => {
    setLanguage('hi');
    const dash = await renderSitterDashboard(IDS.sunitaUser);
    const pending = db.one('bookings', { id: 'bk-pending' });
    const card = within(cardFor(dash, pending));
    expect(card.queryByText('Request a walker')).toBeNull();
    expect(card.queryByText('New request')).toBeNull();
    clickTab(dash, 'आगामी');
    const mid = db.one('bookings', { id: 'bk-mid' });
    expect(within(cardFor(dash, mid)).queryByText('Confirmed')).toBeNull();
  });

  test('S34: wrong-OTP error is shown in Hindi', async () => {
    setLanguage('hi');
    const mid = db.one('bookings', { id: 'bk-mid' });
    mid.start_otp = '4321';
    const dash = await renderSitterDashboard(IDS.sunitaUser);
    clickTab(dash, 'आगामी');
    fireEvent.change(within(cardFor(dash, mid)).getByPlaceholderText('0000'), { target: { value: '9999' } });
    fireEvent.click(within(cardFor(dash, mid)).getByRole('button', { name: 'शुरू करें' }));
    await waitFor(() => expect(within(cardFor(dash, mid)).getByText(/^गलत कोड/)).toBeInTheDocument());
    expect(db.one('bookings', { id: 'bk-mid' }).status).toBe('confirmed');
    expect(within(dash.container).queryByText(/^Wrong code/)).toBeNull();
  });

  test('S34: sitter chat quick replies are in Hindi', async () => {
    setLanguage('hi');
    const mid = db.one('bookings', { id: 'bk-mid' });
    const chat = await renderChat(IDS.sunitaUser, sitterChatProps({ ...mid, users: { name: 'Ananya Sharma' } }), 'sitter');
    expect(within(chat.container).getByPlaceholderText('संदेश लिखें...')).toBeInTheDocument();
    ['On my way!', 'Running 5 min late', 'Walk completed ✓', 'Is the gate open?']
      .forEach(s => expect(within(chat.container).queryByText(s)).toBeNull());
  });

  test('S34: earnings tab renders in Hindi', async () => {
    setLanguage('hi');
    const dash = await renderSitterDashboard(IDS.sunitaUser);
    fireEvent.click(within(dash.container).getByText('कमाई'));
    await settle(dash);
    expect(within(dash.container).queryByText('My Earnings')).toBeNull();
    expect(within(dash.container).queryByText('Total Earnings (All Time)')).toBeNull();
  });
});

// ─── S36 ──────────────────────────────────────────────────────────────────
describe('S36: sitter earnings', () => {
  test('S36: Priya sees earnings after 15% commission', async () => {
    db.signInAs(IDS.priyaUser);
    const r = await settle(render(<SitterEarningsDashboard city="Gurgaon" onBack={() => {}} />));
    const c = within(r.container);
    const total = c.getByText('Total Earnings (All Time)').nextSibling;
    expect(total.textContent).toBe('Rs. 340.00');
    expect(c.getByText('✓ 1 completed')).toBeInTheDocument();
    expect(c.getByText('Booking: Rs. 400.00')).toBeInTheDocument();
    expect(c.getByText('1 walk · Rs. 340.00 earned')).toBeInTheDocument();
    expect(c.queryByText(/Founding Sitter/)).toBeNull();
  });

  test('S36: Founding Sitter Sunita keeps 100% (0% commission)', async () => {
    db.insert('bookings', { id: 'bk-sunita-done', booking_ref: 'FUR-SDON', city_id: IDS.gurgaon, pet_parent_id: IDS.ananya, sitter_id: IDS.sunita, pet_id: IDS.bruno, service_type: 'walk30', status: 'completed', payment_status: 'paid', gross_amount_paise: 30000, sitter_payout_paise: 30000, booking_date: '2026-11-20', time_slot: '07:00 AM' });
    db.signInAs(IDS.sunitaUser);
    const r = await settle(render(<SitterEarningsDashboard city="Gurgaon" onBack={() => {}} />));
    const c = within(r.container);
    expect(c.getByText(/Founding Sitter — 0% commission/)).toBeInTheDocument();
    expect(c.getByText('Booking: Rs. 300.00')).toBeInTheDocument();
    expect(c.getByText('1 walk · Rs. 300.00 earned')).toBeInTheDocument();
    expect(c.getByText('Total Earnings (All Time)').nextSibling.textContent).toBe('Rs. 300.00');
  });

  test("S36: sitter dashboard header earnings are net of Priya's 15% commission", async () => {
    const dash = await renderSitterDashboard(IDS.priyaUser);
    const label = within(dash.container).getByText('This month so far');
    expect(label.nextSibling.textContent).toBe('Rs.340');
  });
});
