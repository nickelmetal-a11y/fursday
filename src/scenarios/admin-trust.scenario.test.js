import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import AdminPanel from '../AdminPanel';
import AdminApp from '../AdminApp';
import SitterEditProfile from '../SitterEditProfile';
import SitterDashboard from '../SitterDashboard';
import ExploreScreen from '../ExploreScreen';
import SettingsScreen from '../SettingsScreen';
import BroadcastRequest from '../BroadcastRequest';
import DisputeForm from '../DisputeForm';
import * as emailService from '../emailService';
import { notifyBookingCancelled } from '../notificationService';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../emailService', () => ({
  ...jest.requireActual('../emailService'),
  sendBookingConfirmationEmail: jest.fn(),
  sendReviewReceivedEmail: jest.fn(),
  sendPayoutNotificationEmail: jest.fn(),
  sendCancellationEmail: jest.fn(),
  sendPhotosUploadedEmail: jest.fn(),
}));

beforeEach(() => {
  db.reset(buildSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn(() => 'Aadhaar photo is blurry');
  window.open = jest.fn();
});

// Walk up from a text node to the smallest ancestor that also holds a button
// matching `buttonName` — i.e. the card that row's actions belong to.
function cardOf(el, buttonName) {
  let node = el;
  while (node && !within(node).queryAllByRole('button', { name: buttonName }).length) node = node.parentElement;
  if (!node) throw new Error('No card with button ' + buttonName);
  return node;
}

async function openAdmin() {
  db.signInAs(IDS.admin);
  render(<AdminPanel />);
  await screen.findByText(/^Sitters \([1-9]\d*\)$/);
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
}

async function goTab(labelRegex) {
  fireEvent.click(screen.getByText(labelRegex));
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
}

const notesFor = (userId, type) => db.rows('notifications', { user_id: userId, ...(type ? { type } : {}) });

// ---------------------------------------------------------------------------

describe('Admin trust & safety scenarios', () => {
  test('S7: Sitter verification failed — no Aadhaar blocks approval, admin requests changes, sitter sees reason', async () => {
    await openAdmin();
    const card = cardOf(screen.getByText('Vikram Rao'), /Approve/);
    expect(within(card).getByText(/No Aadhaar submitted/)).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Approve/ })).toBeDisabled();

    fireEvent.click(within(card).getByRole('button', { name: 'Needs changes' }));
    await screen.findByText('Sent back for changes');

    const row = db.one('sitter_profiles', { id: IDS.vikram });
    expect(row.status).toBe('needs_changes');
    expect(row.review_notes).toBe('Aadhaar photo is blurry');
    expect(row.aadhaar_verified).toBe(false);
    const n = notesFor(IDS.vikramUser, 'sitter_needs_changes');
    expect(n).toHaveLength(1);
    expect(n[0].body).toBe('Aadhaar photo is blurry');

    cleanup();
    db.signInAs(IDS.vikramUser);
    render(<SitterEditProfile city="Pune" onBack={jest.fn()} />);
    expect(await screen.findByText('⚠️ Your profile needs a few changes')).toBeInTheDocument();
    expect(screen.getByText('Aadhaar photo is blurry')).toBeInTheDocument();
  });

  test('S7a: "Needs changes" leaves an admin audit-log entry', async () => {
    await openAdmin();
    const card = cardOf(screen.getByText('Vikram Rao'), /Approve/);
    fireEvent.click(within(card).getByRole('button', { name: 'Needs changes' }));
    await screen.findByText('Sent back for changes');
    expect(db.rows('admin_audit_logs', { resource_id: IDS.vikram })).toHaveLength(1);
  });

  test('S7c: a sitter with no Aadhaar cannot be approved from the Sitters tab either', async () => {
    await openAdmin();
    await goTab(/^Sitters \(/);
    const card = cardOf(screen.getByText('Vikram Rao'), /Approve/);
    const approve = within(card).getByRole('button', { name: /Approve/ });
    if (!approve.disabled) {
      fireEvent.click(approve);
      await waitFor(() => expect(window.alert.mock.calls.length + screen.queryAllByText(/approved|Aadhaar/i).length).toBeGreaterThan(0));
    }
    expect(db.one('sitter_profiles', { id: IDS.vikram }).status).toBe('pending');
  });

  test('S7b: Admin rejects a sitter — status rejected, sitter notified, audit row written', async () => {
    await openAdmin();
    const card = cardOf(screen.getByText('Vikram Rao'), /Approve/);
    fireEvent.click(within(card).getByRole('button', { name: 'Reject' }));
    await screen.findByText('Sitter rejected');

    expect(db.one('sitter_profiles', { id: IDS.vikram }).status).toBe('rejected');
    expect(notesFor(IDS.vikramUser, 'sitter_rejected')).toHaveLength(1);
    expect(db.rows('admin_audit_logs', { action: 'reject_sitter', resource_id: IDS.vikram })).toHaveLength(1);
  });

  test('S8: A sitter can raise an issue with Fursday about a booking/parent from the app', async () => {
    db.signInAs(IDS.priyaUser);
    render(<SitterDashboard city="Gurgaon" onBack={jest.fn()} />);
    await screen.findByText(/Priya/);
    // What exists today: a WhatsApp support banner (and SOS only on an active job).
    expect(await screen.findByText('Need help? Chat with Fursday support')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Need help? Chat with Fursday support'));
    expect(window.open).toHaveBeenCalledWith(expect.stringContaining('wa.me/919315578325'), '_blank');

    // Expected: an in-app way to report a parent/booking that reaches admin Disputes.
    fireEvent.click(screen.getByText(/^Past/));
    const expandable = screen.queryAllByText('FUR-DONE');
    if (expandable.length) fireEvent.click(expandable[0]);
    expect(screen.queryAllByText(/report|dispute|raise an issue|complain/i).length).toBeGreaterThan(0);
  });

  // --- payouts ---------------------------------------------------------------
  async function markPayoutsForPriyaAndSunita() {
    db.insert('bookings', {
      id: 'bk-done-su', booking_ref: 'FUR-SUN1', city_id: IDS.gurgaon, service_type: 'walk30', time_slot: '07:00 AM',
      pet_parent_id: IDS.ananya, sitter_id: IDS.sunita, pet_id: IDS.bruno, status: 'completed', payment_status: 'paid',
      gross_amount_paise: 30000, sitter_payout_paise: 30000, booking_date: '2026-11-20',
    });
    await openAdmin();
    await goTab(/^Payouts \(/);

    const priyaCard = cardOf(screen.getByText('FUR-DONE'), 'Mark paid');
    expect(within(priyaCard).getByText('Sitter gets: Rs.340')).toBeInTheDocument();
    const sunitaCard = cardOf(screen.getByText('FUR-SUN1'), 'Mark paid');
    expect(within(sunitaCard).getByText('Sitter gets: Rs.300 (Founding — 0% commission)')).toBeInTheDocument();

    fireEvent.click(within(priyaCard).getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-done' }).payout_status).toBe('paid'));
    await waitFor(() => expect(notesFor(IDS.priyaUser, 'payout_marked')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByText('FUR-DONE')).not.toBeInTheDocument());

    fireEvent.click(within(cardOf(screen.getByText('FUR-SUN1'), 'Mark paid')).getByRole('button', { name: 'Mark paid' }));
    await waitFor(() => expect(db.one('bookings', { id: 'bk-done-su' }).payout_status).toBe('paid'));
    await waitFor(() => expect(notesFor(IDS.sunitaUser, 'payout_marked')).toHaveLength(1));
  }

  test('S28: Payouts — Priya gets 85% of gross, Founding Sitter Sunita gets 100%, bookings marked paid', async () => {
    await markPayoutsForPriyaAndSunita();
    expect(db.one('bookings', { id: 'bk-done' }).payout_status).toBe('paid');
    expect(db.one('bookings', { id: 'bk-done-su' }).payout_status).toBe('paid');
    expect(db.one('bookings', { id: 'bk-done-hi' }).payout_status).toBeUndefined();
    const reasons = db.rows('admin_audit_logs', { action: 'mark_payout_paid' }).map(r => r.reason);
    expect(reasons).toEqual(expect.arrayContaining(['Marked Rs.340 as paid', 'Marked Rs.300 as paid']));
    expect(emailService.sendPayoutNotificationEmail).toHaveBeenCalledWith('priya@test.example', expect.objectContaining({ amount: 340 }));
    expect(emailService.sendPayoutNotificationEmail).toHaveBeenCalledWith('sunita@test.example', expect.objectContaining({ amount: 300 }));
  });

  test('S28b: Payout in-app notification shows the rupee amount the sitter actually receives', async () => {
    await markPayoutsForPriyaAndSunita();
    expect(notesFor(IDS.priyaUser, 'payout_marked')[0].body).toMatch(/Rs\.? ?340\b/);
    expect(notesFor(IDS.sunitaUser, 'payout_marked')[0].body).toMatch(/Rs\.? ?300\b/);
  });

  test('S29: Admin suspends Priya — status suspended, sitter notified, parents no longer see her in Explore', async () => {
    db.signInAs(IDS.ananya);
    render(<ExploreScreen city="Gurgaon" onBack={jest.fn()} onNav={jest.fn()} />);
    expect(await screen.findByText('Priya Kapoor')).toBeInTheDocument();
    cleanup();

    await openAdmin();
    await goTab(/^Sitters \(/);
    const card = cardOf(screen.getByText('Priya Kapoor'), /Suspend/);
    fireEvent.click(within(card).getByRole('button', { name: /Suspend/ }));
    await screen.findByText('Sitter suspended');
    expect(db.one('sitter_profiles', { id: IDS.priya }).status).toBe('suspended');
    expect(notesFor(IDS.priyaUser, 'sitter_suspended')).toHaveLength(1);
    cleanup();

    db.signInAs(IDS.ananya);
    render(<ExploreScreen city="Gurgaon" onBack={jest.fn()} onNav={jest.fn()} />);
    expect(await screen.findByText('सुनीता देवी')).toBeInTheDocument();
    expect(screen.getByText('राम सिंह')).toBeInTheDocument();
    expect(screen.queryByText('Priya Kapoor')).not.toBeInTheDocument();
  });

  test('S30: Vikram submits an Aadhaar later, admin approves — active and aadhaar_verified', async () => {
    db.insert('sitter_pii', { sitter_id: IDS.vikram, aadhaar_number: '123412341234', upi_id: 'vikram@okhdfc' });
    await openAdmin();
    const card = cardOf(screen.getByText('Vikram Rao'), /Approve/);
    expect(within(card).getByText(/Aadhaar: 1234 1234 1234/)).toBeInTheDocument();
    const approve = within(card).getByRole('button', { name: /Approve/ });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    await screen.findByText('Sitter approved ✓');

    const row = db.one('sitter_profiles', { id: IDS.vikram });
    expect(row.status).toBe('active');
    expect(row.aadhaar_verified).toBe(true);
    expect(notesFor(IDS.vikramUser, 'sitter_approved')).toHaveLength(1);
    await waitFor(() => expect(screen.getByText('No pending applications')).toBeInTheDocument());
  });

  test('S31: A pending sitter is invisible in Explore and cannot pick up work', async () => {
    db.signInAs(IDS.rohit);
    render(<ExploreScreen city="Pune" onBack={jest.fn()} onNav={jest.fn()} />);
    expect(await screen.findByText('No sitters found')).toBeInTheDocument();
    expect(screen.queryByText('Vikram Rao')).not.toBeInTheDocument();
    cleanup();

    // A Pune parent broadcasts an open request; pending Vikram opens his dashboard.
    db.insert('broadcast_requests', { pet_parent_id: IDS.rohit, city_id: IDS.pune, service_type: 'walk30', scheduled_date: '2026-11-28', scheduled_time: '7:00 AM', area: 'Baner', status: 'open' });
    db.signInAs(IDS.vikramUser);
    render(<SitterDashboard city="Pune" onBack={jest.fn()} />);
    await screen.findByText(/Vikram/);
    await waitFor(() => expect(screen.queryByText('Loading your jobs...')).not.toBeInTheDocument());
    fireEvent.click(screen.getByText(/^📢 \d+$/));
    const accept = screen.queryByText('Accept this request');
    if (accept) {
      fireEvent.click(accept);
      await waitFor(() => expect(window.alert).toHaveBeenCalled());
    }
    expect(db.rows('broadcast_responses', { sitter_id: IDS.vikram })).toHaveLength(0);
  });

  test('S32: A non-admin signed into AdminApp sees "Not signed in as an admin" and no data', async () => {
    db.signInAs(IDS.ananya);
    render(<AdminApp />);
    expect(await screen.findByText('Not signed in as an admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use a different account' })).toBeInTheDocument();
    expect(screen.queryByText('Vikram Rao')).not.toBeInTheDocument();
    expect(screen.queryByText(/Pending \(/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aadhaar/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use a different account' }));
    expect(await screen.findByLabelText('Admin email')).toBeInTheDocument();
  });

  test('S35: SOS/help use app_settings numbers, and a number changed in AdminSettings applies to a fresh SettingsScreen', async () => {
    const realLocation = window.location;
    delete window.location;
    window.location = { href: '' };
    try {
      const mountSettings = async () => {
        db.signInAs(IDS.ananya);
        render(<SettingsScreen city="Gurgaon" userName="Ananya Sharma" onBack={jest.fn()} onNav={jest.fn()} />);
        await screen.findByText('Manage your account');
      };

      await mountSettings();
      fireEvent.click(screen.getByText(/SOS — Emergency help/));
      fireEvent.click(await screen.findByText('Call Fursday support'));
      expect(window.location.href).toBe('tel:+919315578325');
      fireEvent.click(screen.getByText('WhatsApp support with my location'));
      expect(window.open).toHaveBeenLastCalledWith(expect.stringContaining('https://wa.me/919315578325'), '_blank');
      cleanup();

      await openAdmin();
      await goTab(/^Settings$/);
      fireEvent.change(await screen.findByLabelText('Support phone'), { target: { value: '98765 43210' } });
      fireEvent.change(screen.getByLabelText('Support WhatsApp'), { target: { value: '91234 56789' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(await screen.findByText(/^Saved\./)).toBeInTheDocument();
      expect(db.one('app_settings', { key: 'support_phone' }).value).toBe('919876543210');
      expect(db.one('app_settings', { key: 'support_whatsapp' }).value).toBe('919123456789');
      cleanup();

      window.location.href = '';
      await mountSettings();
      fireEvent.click(screen.getByText(/SOS — Emergency help/));
      fireEvent.click(await screen.findByText('Call Fursday support'));
      expect(window.location.href).toBe('tel:+919876543210');
      fireEvent.click(screen.getByText('WhatsApp support with my location'));
      expect(window.open).toHaveBeenLastCalledWith(expect.stringContaining('https://wa.me/919123456789'), '_blank');
    } finally {
      window.location = realLocation;
    }
  });

  test('S37: Ananya turns email off in Settings; later notifications skip email for her only', async () => {
    db.signInAs(IDS.ananya);
    render(<SettingsScreen city="Gurgaon" userName="Ananya Sharma" onBack={jest.fn()} onNav={jest.fn()} />);
    await screen.findByText('Email notifications');
    const emailToggle = screen.getAllByRole('checkbox')[1];
    expect(emailToggle).toBeChecked();
    fireEvent.click(emailToggle);
    await waitFor(() => expect(db.one('notification_preferences', { user_id: IDS.ananya })?.email_enabled).toBe(false));
    const prefs = db.one('notification_preferences', { user_id: IDS.ananya });
    expect(prefs.push_enabled).toBe(true);
    expect(prefs.sms_enabled).toBe(true);
    expect(db.rows('notification_preferences')).toHaveLength(1);

    await notifyBookingCancelled({ userId: IDS.ananya, userEmail: 'ananya@test.example', otherUserName: 'Priya', reason: 'Sick', refundAmount: 400, refundStatus: 'processed', bookingRef: 'FUR-FAR' });
    expect(emailService.sendCancellationEmail).not.toHaveBeenCalled();
    expect(notesFor(IDS.ananya, 'booking_cancelled')).toHaveLength(1);

    await notifyBookingCancelled({ userId: IDS.rohit, userEmail: 'rohit@test.example', otherUserName: 'Priya', reason: 'Sick', refundAmount: 400, refundStatus: 'processed', bookingRef: 'FUR-PAID' });
    expect(emailService.sendCancellationEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendCancellationEmail).toHaveBeenCalledWith('rohit@test.example', expect.anything());
  });

  // --- broadcast -------------------------------------------------------------
  async function meeraBroadcastsAndGetsTwoOffers() {
    // Two sitters answer the moment the request lands (the component re-polls
    // every 10s; answering at insert time avoids waiting on that timer).
    const realInsert = db.insert;
    db.insert = (name, row) => {
      const r = realInsert(name, row);
      if (name === 'broadcast_requests') {
        realInsert('broadcast_responses', { request_id: r.id, sitter_id: IDS.priya, status: 'accepted', offered_price: 34900 });
        realInsert('broadcast_responses', { request_id: r.id, sitter_id: IDS.sunita, status: 'accepted', offered_price: 29900 });
      }
      return r;
    };
    const onSitterAccepted = jest.fn();
    const onBack = jest.fn();
    db.signInAs(IDS.meera);
    render(<BroadcastRequest city="Gurgaon" onBack={onBack} onSitterAccepted={onSitterAccepted} />);
    try {
      fireEvent.click(screen.getByText('Request a walker'));
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByText('7:00 AM'));
      fireEvent.click(screen.getByText('Continue →'));
      fireEvent.click(screen.getByText('DLF Phase 1'));
      fireEvent.click(screen.getByText('📢 Send to all sitters'));
      await screen.findByText('Priya Kapoor');
      await screen.findByText('सुनीता देवी');
    } finally {
      db.insert = realInsert;
    }
    return { onSitterAccepted, onBack };
  }

  test('S38: Meera broadcasts, two sitters respond, she accepts Priya — Priya is handed to the booking flow', async () => {
    const { onSitterAccepted, onBack } = await meeraBroadcastsAndGetsTwoOffers();
    const req = db.one('broadcast_requests', { pet_parent_id: IDS.meera });
    expect(req).toMatchObject({ city_id: IDS.gurgaon, service_type: 'walk30', scheduled_time: '7:00 AM', area: 'DLF Phase 1', status: 'open' });

    const priyaCard = cardOf(screen.getByText('Priya Kapoor'), 'Book this sitter');
    fireEvent.click(within(priyaCard).getByRole('button', { name: 'Book this sitter' }));
    await waitFor(() => expect(onSitterAccepted).toHaveBeenCalledTimes(1));
    expect(onBack).toHaveBeenCalled();

    expect(db.one('broadcast_requests', { id: req.id })).toMatchObject({ status: 'filled', chosen_sitter_id: IDS.priya });
    expect(db.one('broadcast_responses', { sitter_id: IDS.priya }).status).toBe('chosen');
    expect(db.one('broadcast_responses', { sitter_id: IDS.sunita }).status).toBe('accepted');
    expect(onSitterAccepted.mock.calls[0][0].id).toBe(IDS.priya);
  });

  test('S38b: The sitter object handed to BookingFlow carries the name BookingFlow displays', async () => {
    const { onSitterAccepted } = await meeraBroadcastsAndGetsTwoOffers();
    fireEvent.click(within(cardOf(screen.getByText('Priya Kapoor'), 'Book this sitter')).getByRole('button', { name: 'Book this sitter' }));
    await waitFor(() => expect(onSitterAccepted).toHaveBeenCalled());
    // App.js passes this straight into <BookingFlow sitter={...}>, which reads sitter.name.
    expect(onSitterAccepted.mock.calls[0][0].name).toBe('Priya Kapoor');
  });

  test('S38c: Broadcast offers show the sitter price in rupees', async () => {
    await meeraBroadcastsAndGetsTwoOffers();
    const priyaCard = cardOf(screen.getByText('Priya Kapoor'), 'Book this sitter');
    expect(within(priyaCard).getByText('Rs.349')).toBeInTheDocument();
  });

  // --- disputes ----------------------------------------------------------------
  async function ananyaFilesDisputeOnBkDone() {
    db.signInAs(IDS.ananya);
    const booking = db.one('bookings', { id: 'bk-done' });
    render(<DisputeForm booking={booking} sitterName="Priya Kapoor" onClose={jest.fn()} />);
    fireEvent.click(screen.getByText('💰 Refund Request'));
    fireEvent.change(screen.getByPlaceholderText('Brief title of issue'), { target: { value: 'Walk cut short' } });
    fireEvent.change(screen.getByPlaceholderText('Describe what happened...'), { target: { value: 'Walk lasted 10 minutes, not 30.' } });
    fireEvent.click(screen.getByRole('button', { name: 'File Dispute' }));
    await waitFor(() => expect(db.rows('disputes')).toHaveLength(1));
    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    cleanup();
  }

  async function adminResolvesWithRefund() {
    await openAdmin();
    await goTab(/^Disputes$/);
    fireEvent.click(await screen.findByText(/Walk cut short/));
    fireEvent.click(screen.getByLabelText('Partial Refund'));
    fireEvent.change(screen.getByPlaceholderText('Refund amount (Rs.)'), { target: { value: '200' } });
    fireEvent.change(screen.getByPlaceholderText('Admin notes...'), { target: { value: 'GPS shows a 10 minute walk.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve Dispute' }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Dispute resolved!'));
  }

  test('S39: Admin resolves a dispute on bk-done with a refund — row resolved with refund and notes', async () => {
    await ananyaFilesDisputeOnBkDone();
    const filed = db.rows('disputes')[0];
    expect(filed).toMatchObject({ booking_id: 'bk-done', reported_by: IDS.ananya, status: 'open', dispute_type: 'refund_request' });

    await adminResolvesWithRefund();
    expect(db.rows('disputes')[0]).toMatchObject({ status: 'resolved', resolution: 'refund_partial', refund_amount: 200, admin_notes: 'GPS shows a 10 minute walk.' });
    expect(db.rows('disputes')[0].resolved_at).toBeTruthy();
  });

  test('S39b: The parent who raised the dispute is notified of the resolution', async () => {
    await ananyaFilesDisputeOnBkDone();
    await adminResolvesWithRefund();
    const n = notesFor(IDS.ananya, 'dispute_resolved');
    expect(n).toHaveLength(1);
    expect(n[0].body).toMatch(/200/);
  });

  test('S39c: A dispute records the reported sitter as a real users.id (so the sitter can be notified)', async () => {
    await ananyaFilesDisputeOnBkDone();
    expect(db.rows('disputes')[0].reported_user_id).toBe(IDS.priyaUser);
  });

  test('S40: Approve and suspend write admin_audit_logs rows that show in the Audit tab', async () => {
    db.insert('sitter_pii', { sitter_id: IDS.vikram, aadhaar_number: '123412341234' });
    await openAdmin();
    fireEvent.click(within(cardOf(screen.getByText('Vikram Rao'), /Approve/)).getByRole('button', { name: /Approve/ }));
    await screen.findByText('Sitter approved ✓');
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    await goTab(/^Sitters \(/);
    fireEvent.click(within(cardOf(screen.getByText('Priya Kapoor'), /Suspend/)).getByRole('button', { name: /Suspend/ }));
    await screen.findByText('Sitter suspended');
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    expect(db.rows('admin_audit_logs', { action: 'approve_sitter', resource_id: IDS.vikram, admin_id: IDS.admin, status: 'success' })).toHaveLength(1);
    expect(db.rows('admin_audit_logs', { action: 'suspend_sitter', resource_id: IDS.priya, admin_id: IDS.admin, status: 'success' })).toHaveLength(1);

    await goTab(/^Audit$/);
    await waitFor(() => expect(screen.queryByText('Loading audit logs...')).not.toBeInTheDocument());
    expect(screen.getAllByText('Sitter Approved').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sitter Suspended').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('No audit logs found')).not.toBeInTheDocument();
  });

  test('S41: Promotions tab creates a code and features it — only one promo is featured on the home page', async () => {
    await openAdmin();
    await goTab(/^Promotions$/);
    await screen.findByText('WELCOME100');
    fireEvent.click(screen.getByRole('button', { name: '+ New promotion' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. DIWALI2026'), { target: { value: 'diwali50' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 100'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create promotion' }));
    await screen.findByText('Promotion created');

    const created = db.one('promo_codes', { code: 'DIWALI50' });
    expect(created).toMatchObject({ discount_amount: 50, status: 'active', featured_home: true });
    expect(db.rows('promo_codes', { featured_home: true }).map(p => p.code)).toEqual(['DIWALI50']);
    expect(screen.getAllByText('ON HOME PAGE')).toHaveLength(1);

    const welcomeCard = cardOf(screen.getByText('WELCOME100'), 'Show on home');
    fireEvent.click(within(welcomeCard).getByRole('button', { name: 'Show on home' }));
    await waitFor(() => expect(db.one('promo_codes', { code: 'WELCOME100' }).featured_home).toBe(true));
    expect(db.rows('promo_codes', { featured_home: true }).map(p => p.code)).toEqual(['WELCOME100']);
  });

  const kpi = (label) => {
    const el = screen.getAllByText(label, { exact: true }).find(e => e.nextSibling);
    return el?.nextSibling.textContent;
  };

  test('S42: Admin Overview shows correct counts for the seed', async () => {
    await openAdmin();
    await goTab(/^Overview$/);
    expect(kpi('Pending')).toBe('1');
    expect(kpi('Active sitters')).toBe('3');
    expect(kpi('Bookings')).toBe('7');
    expect(kpi('GMV')).toBe('Rs.800');
    expect(kpi('Payouts due')).toBe('Rs.680');
    expect(screen.getByText('Pending (1)')).toBeInTheDocument();
    expect(screen.getByText('Payouts (2)')).toBeInTheDocument();
  });

  test('S42b: Admin Overview shows a completed-bookings count', async () => {
    await openAdmin();
    await goTab(/^Overview$/);
    const label = screen.queryAllByText(/^completed( bookings)?$/i).find(e => e.nextSibling);
    expect(label).toBeTruthy();
    expect(label.nextSibling.textContent).toBe('2');
  });
});
