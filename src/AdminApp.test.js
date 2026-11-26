import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('./AdminPanel', () => (props) => <div>Admin dashboard {props.onSignOut ? 'with sign-out' : ''}</div>);

process.env.REACT_APP_ADMIN_REQUIRE_2FA = 'true';

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: global.__session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOtp: (args) => { global.__otpCalls.push(args); return Promise.resolve({ error: global.__otpError || null }); },
      verifyOtp: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve({}),
      mfa: {
        getAuthenticatorAssuranceLevel: () => Promise.resolve({ data: { currentLevel: global.__aal } }),
        listFactors: () => Promise.resolve({ data: { totp: global.__factors, all: global.__factors } }),
        enroll: () => Promise.resolve({ data: { id: 'f-new', totp: { qr_code: 'data:image/svg+xml,qr', secret: 'SECRET123' } } }),
        unenroll: () => Promise.resolve({}),
        challengeAndVerify: ({ code }) => { global.__verified.push(code); return Promise.resolve({ error: code === '123456' ? null : { message: 'bad' } }); },
      },
    },
    rpc: (fn) => Promise.resolve({ data: fn === 'is_admin_account' ? global.__isAdmin : null, error: null }),
    from: () => ({ insert: (row) => { (global.__audit = global.__audit || []).push(row); return Promise.resolve({ error: null }); } }),
  },
}));

const AdminApp = require('./AdminApp').default;

beforeEach(() => { global.__session = null; global.__otpCalls = []; global.__otpError = null; global.__aal = 'aal1'; global.__factors = []; global.__isAdmin = true; global.__verified = []; });

test('signed out: shows the admin email login', async () => {
  render(<AdminApp />);
  expect(await screen.findByLabelText('Admin email')).toBeInTheDocument();
});

test('sending a code never creates a new account', async () => {
  render(<AdminApp />);
  fireEvent.change(await screen.findByLabelText('Admin email'), { target: { value: 'admin@test.com' } });
  fireEvent.click(screen.getByText('Send code'));
  await waitFor(() => expect(global.__otpCalls).toHaveLength(1));
  expect(global.__otpCalls[0]).toEqual({ email: 'admin@test.com', options: { shouldCreateUser: false } });
  expect(await screen.findByLabelText('Code')).toBeInTheDocument();
});

test('unknown email gets a clear error', async () => {
  global.__otpError = { message: 'Signups not allowed for otp' };
  render(<AdminApp />);
  fireEvent.change(await screen.findByLabelText('Admin email'), { target: { value: 'nobody@test.com' } });
  fireEvent.click(screen.getByText('Send code'));
  expect(await screen.findByText('No Fursday account uses this email.')).toBeInTheDocument();
});

test('signed in with email only: an admin must set up two-step sign-in first', async () => {
  global.__session = { user: { id: 'admin-1' } };
  render(<AdminApp />);
  expect(await screen.findByText('Set up two-step sign-in')).toBeInTheDocument();
  expect(screen.getByAltText(/QR code/)).toBeInTheDocument();
  expect(screen.getByText('SECRET123')).toBeInTheDocument();
  expect(screen.queryByText(/Admin dashboard/)).toBeNull();
});

test('an admin with an authenticator is asked for its code; a wrong code is refused', async () => {
  global.__session = { user: { id: 'admin-1' } };
  global.__factors = [{ id: 'f-1', status: 'verified' }];
  render(<AdminApp />);
  fireEvent.change(await screen.findByLabelText('Authenticator code'), { target: { value: '999999' } });
  fireEvent.click(screen.getByText('Verify'));
  expect(await screen.findByText(/did not match/)).toBeInTheDocument();
  expect(screen.queryByText(/Admin dashboard/)).toBeNull();
});

test('a non-admin is never asked to enrol two-step', async () => {
  global.__session = { user: { id: 'u-1' } };
  global.__isAdmin = false;
  render(<AdminApp />);
  expect(await screen.findByText(/Admin dashboard/)).toBeInTheDocument();
  expect(screen.queryByText(/two-step/i)).toBeNull();
});

test('signed in with two-step: shows the dashboard with a sign-out handler', async () => {
  global.__session = { user: { id: 'admin-1' } };
  global.__aal = 'aal2';
  render(<AdminApp />);
  expect(await screen.findByText(/Admin dashboard with sign-out/)).toBeInTheDocument();
});
