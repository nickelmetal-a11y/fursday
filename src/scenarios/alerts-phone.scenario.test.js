// Alerts that reach a closed phone, phone verification, tips and host
// cancellation policies, played through the real screens.
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db, supabase } from '../testing/fakeSupabase';
import { payments } from '../testing/fakePayments';
import { buildSeed, IDS } from '../testing/seed';
import SettingsScreen from '../SettingsScreen';
import { PendingQueue } from '../AdminSitters';
import PhoneVerify, { PhoneVerifyStep } from '../PhoneVerify';
import TipSheet from '../TipSheet';
import CancellationPolicyModal from '../CancellationPolicyModal';
import LanguageToggle from '../LanguageToggle';
import { createNotification } from '../notificationService';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../paymentsClient', () => require('../testing/fakePayments'));

const realAuth = { ...supabase.auth };

beforeEach(() => {
  db.reset(buildSeed());
  payments.reset();
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
});

afterEach(() => {
  Object.keys(supabase.auth).forEach(k => { if (!(k in realAuth)) delete supabase.auth[k]; });
  Object.assign(supabase.auth, realAuth);
  setLanguage('en');
});

function setLanguage(l) {
  const view = render(<LanguageToggle />);
  fireEvent.click(screen.getByText(l === 'hi' ? 'हिं' : 'EN'));
  view.unmount();
}

const hoursFromNow = (h) => new Date(Date.now() + h * 3600e3).toISOString();

describe('phone verification', () => {
  test('no SMS provider yet: the parent is told honestly that verification is being set up', async () => {
    db.signInAs(IDS.ananya);
    supabase.auth.updateUser = jest.fn(() => Promise.resolve({ data: null, error: { message: 'Unsupported phone provider', status: 400 } }));
    render(<PhoneVerify phone="9810000001" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Verify' }));
    expect(screen.getByLabelText('Mobile number')).toHaveValue('9810000001');
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Phone verification is being set up. Please try again in a few days.')).toBeInTheDocument();
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ phone: '+919810000001' });
    expect(screen.getByText('Not verified')).toBeInTheDocument();
  });

  test('a bad number is caught before any SMS; a wrong code is refused; the right code verifies', async () => {
    db.signInAs(IDS.ananya);
    supabase.auth.updateUser = jest.fn(() => Promise.resolve({ data: {}, error: null }));
    supabase.auth.verifyOtp = jest.fn(({ token }) => Promise.resolve(token === '123456'
      ? { data: { user: { id: IDS.ananya, phone: '919810000002', phone_confirmed_at: new Date().toISOString() } }, error: null }
      : { data: null, error: { message: 'Token has expired or is invalid' } }));
    const onVerified = jest.fn();
    render(<PhoneVerify phone="" onVerified={onVerified} />);
    expect(await screen.findByText('Not added')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Verify' }));

    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('Enter a 10-digit Indian mobile number.')).toBeInTheDocument();
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '98100 00002' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText('We sent a code by SMS to +91 98100 00002.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New code in \d+s/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    expect(await screen.findByText(/That code is not right/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(supabase.auth.verifyOtp).toHaveBeenLastCalledWith({ phone: '+919810000002', token: '123456', type: 'phone_change' });
    expect(onVerified).toHaveBeenCalledWith('+919810000002');
    expect(screen.getByText('+91 98100 00002')).toBeInTheDocument();
  });

  test('Settings shows a green Verified badge from users.phone_verified_at, in English and Hindi', async () => {
    db.one('users', { id: IDS.ananya }).phone_verified_at = new Date().toISOString();
    db.signInAs(IDS.ananya);
    render(<SettingsScreen city="Gurgaon" userName="Ananya Sharma" onBack={jest.fn()} onNav={jest.fn()} />);
    expect(await screen.findByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('+91 98100 00001')).toBeInTheDocument();
    expect(screen.queryByText('Not verified')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Verify' })).toBeNull();
    setLanguage('hi');
    expect(await screen.findByText('सत्यापित')).toBeInTheDocument();
  });

  test('a number edited after verifying is shown as not verified', async () => {
    db.one('users', { id: IDS.ananya }).phone_verified_at = new Date().toISOString();
    db.signInAs(IDS.ananya);
    supabase.auth.getUser = () => Promise.resolve({ data: { user: { id: IDS.ananya, email: 'ananya@test.example', phone: '919999999999' } }, error: null });
    render(<PhoneVerify phone="9810000001" />);
    expect(await screen.findByText('Not verified')).toBeInTheDocument();
  });

  test('the signup step variant continues once verified, or can be skipped', async () => {
    db.signInAs(IDS.priyaUser);
    const onSkip = jest.fn();
    const { unmount } = render(<PhoneVerifyStep initialPhone="9820000001" onDone={jest.fn()} onSkip={onSkip} />);
    expect(await screen.findByText('Verify your phone')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Do this later' }));
    expect(onSkip).toHaveBeenCalled();
    unmount();

    db.one('users', { id: IDS.priyaUser }).phone_verified_at = new Date().toISOString();
    const onDone = jest.fn();
    render(<PhoneVerifyStep initialPhone="9820000001" onDone={onDone} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledWith('9820000001');
  });

  test('admin: the pending queue warns about an unverified phone without blocking approval', async () => {
    db.signInAs(IDS.admin);
    const pending = db.rows('sitter_profiles', { id: IDS.vikram }).map(s => ({ ...s, users: { name: 'Vikram' }, aadhaar_number: '123412341234' }));
    const view = render(<PendingQueue sitters={pending} actions={{ approve: jest.fn(), requestChanges: jest.fn(), reject: jest.fn() }} />);
    expect(await screen.findByText(/Phone not verified yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve/ })).toBeEnabled();
    view.unmount();

    db.one('users', { id: IDS.vikramUser }).phone_verified_at = new Date().toISOString();
    render(<PendingQueue sitters={pending} actions={{ approve: jest.fn(), requestChanges: jest.fn(), reject: jest.fn() }} />);
    expect(await screen.findByText('Phone verified')).toBeInTheDocument();
    expect(screen.queryByText(/Phone not verified yet/)).toBeNull();
  });
});

describe('alerts outside the app', () => {
  test('a notification made in the app is handed to /api/notify for email and push', async () => {
    db.signInAs(IDS.ananya);
    supabase.auth.getSession = () => Promise.resolve({ data: { session: { access_token: 'session-token', user: db.user } }, error: null });
    const row = await createNotification(IDS.priyaUser, 'booking_request', 'New request', 'Please reply', null, 'bk-done');
    expect(db.one('notifications', { id: row.id })).toMatchObject({ user_id: IDS.priyaUser, type: 'booking_request' });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('https://fursday.vercel.app/api/notify', expect.objectContaining({ method: 'POST' })));
    const [, opts] = global.fetch.mock.calls.find(([u]) => u.endsWith('/api/notify'));
    expect(JSON.parse(opts.body)).toEqual({ notification_id: row.id });
    expect(opts.headers.Authorization).toBe('Bearer session-token');
  });
});

describe('tips', () => {
  const doneBooking = () => ({ ...db.one('bookings', { id: 'bk-done' }), sitterName: 'Priya Kapoor' });

  test('a test parent tips Rs.100 with a simulated payment: all of it goes to the sitter', async () => {
    db.one('users', { id: IDS.ananya }).email = 'fursday.test.ananya@example.com';
    db.signInAs(IDS.ananya);
    const before = db.one('bookings', { id: 'bk-done' }).sitter_payout_paise || 0;
    const onDone = jest.fn();
    render(<TipSheet booking={doneBooking()} onDone={onDone} />);
    expect(screen.getByRole('heading', { name: 'Tip Priya Kapoor' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rs.200' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rs.100' }));
    expect(screen.getByRole('button', { name: 'Rs.100' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Tip Rs\.100/ }));

    expect(await screen.findByText('Thank you!')).toBeInTheDocument();
    expect(screen.getByText('Rs.100 goes to Priya Kapoor in full, with their payout.')).toBeInTheDocument();
    const b = db.one('bookings', { id: 'bk-done' });
    expect(b.tip_paise).toBe(10000);
    expect(b.sitter_payout_paise).toBe(before + 10000);
    expect(db.rows('payment_events', { booking_id: 'bk-done', kind: 'tipped' })).toHaveLength(1);
    expect(db.rows('notifications', { user_id: IDS.priyaUser, type: 'tip_received' })).toHaveLength(1);
    expect(payments.calls.map(c => c.action)).toEqual(['tip', 'simulate']);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ tip_paise: 10000 }));
  });

  test('custom amounts outside Rs.20 to Rs.2000 cannot be sent; real customers see tips are not open yet', async () => {
    db.signInAs(IDS.ananya);
    render(<TipSheet booking={doneBooking()} onDone={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Other amount (Rs.)'), { target: { value: '5' } });
    expect(screen.getByRole('button', { name: /Tip Rs\./ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Other amount (Rs.)'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: /Tip Rs\.150/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tips open soon');
    expect(db.one('bookings', { id: 'bk-done' }).tip_paise || 0).toBe(0);
  });
});

describe('host cancellation policy in the cancel sheet', () => {
  const strictBooking = (h) => ({ id: 'bk-far', pet_parent_id: IDS.ananya, sitter_id: IDS.priya, gross_amount_paise: 40000, payment_status: 'held', booking_date: hoursFromNow(h), cancellation_policy: 'strict' });

  test('shows the strict tiers and the estimate, in English and Hindi', () => {
    render(<CancellationPolicyModal booking={strictBooking(100)} onClose={jest.fn()} />);
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Strict policy')).toBeInTheDocument();
    expect(within(sheet).getByText('Cancel 7+ days before')).toBeInTheDocument();
    expect(within(sheet).getByText('Cancel 2-7 days before')).toBeInTheDocument();
    expect(within(sheet).getByText('Cancel under 2 days before')).toBeInTheDocument();
    expect(within(sheet).getByText('₹200')).toBeInTheDocument();
    expect(within(sheet).getAllByText('50% refund')).toHaveLength(2);
    setLanguage('hi');
    expect(within(sheet).getByText('सख़्त नीति')).toBeInTheDocument();
    expect(within(sheet).getByText('2-7 दिन पहले रद्द करें')).toBeInTheDocument();
    expect(within(sheet).getByText('आपका रिफंड')).toBeInTheDocument();
    expect(within(sheet).getAllByText('50% रिफंड')).toHaveLength(2);
  });

  test('flexible falls back from the sitter when the booking has none', () => {
    render(<CancellationPolicyModal booking={{ ...strictBooking(30), cancellation_policy: null, sitter_profiles: { cancellation_policy: 'flexible' } }} onClose={jest.fn()} />);
    expect(screen.getByText('Flexible policy')).toBeInTheDocument();
    expect(screen.getByText('₹400')).toBeInTheDocument();
    expect(screen.getByText('Full refund (100%)')).toBeInTheDocument();
  });

  test('after cancelling, the parent sees the refund the server actually made', async () => {
    Object.assign(db.one('bookings', { id: 'bk-far' }), { cancellation_policy: 'strict', payment_status: 'held', payment_mode: 'simulated', payment_id: 'sim_far' });
    db.one('bookings', { id: 'bk-far' }).booking_date = new Date(Date.now() + 100 * 3600e3 + 5.5 * 3600e3).toISOString().slice(0, 10);
    db.one('bookings', { id: 'bk-far' }).time_slot = new Date(Date.now() + 100 * 3600e3 + 5.5 * 3600e3).toISOString().slice(11, 16);
    db.signInAs(IDS.ananya);
    const onCancelled = jest.fn();
    render(<CancellationPolicyModal booking={db.one('bookings', { id: 'bk-far' })} onClose={jest.fn()} onCancelled={onCancelled} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel booking' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change of plans' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel this booking' }));
    expect(await screen.findByText('Booking cancelled')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('₹200 (50%) is on its way back');
    expect(db.one('bookings', { id: 'bk-far' })).toMatchObject({ status: 'cancelled', refund_percentage: 50, refunded_amount_paise: 20000 });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onCancelled).toHaveBeenCalled();
  });
});
