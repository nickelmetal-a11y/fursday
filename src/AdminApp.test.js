import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('./AdminPanel', () => (props) => <div>Admin dashboard {props.onSignOut ? 'with sign-out' : ''}</div>);

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: global.__session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOtp: (args) => { global.__otpCalls.push(args); return Promise.resolve({ error: global.__otpError || null }); },
      verifyOtp: () => Promise.resolve({ error: null }),
      signOut: () => Promise.resolve({}),
    },
  },
}));

const AdminApp = require('./AdminApp').default;

beforeEach(() => { global.__session = null; global.__otpCalls = []; global.__otpError = null; });

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

test('signed in: shows the dashboard with a sign-out handler', async () => {
  global.__session = { user: { id: 'admin-1' } };
  render(<AdminApp />);
  expect(await screen.findByText(/Admin dashboard with sign-out/)).toBeInTheDocument();
});
