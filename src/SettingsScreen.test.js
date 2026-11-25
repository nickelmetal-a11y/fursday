import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { db } from './testing/fakeSupabase';
import { buildSeed, IDS } from './testing/seed';
import SettingsScreen, { maskAadhaar, maskUpi, durationSince } from './SettingsScreen';

jest.mock('./supabase', () => require('./testing/fakeSupabase'));

const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(d.getDate() - 1); return d.toISOString(); };

beforeEach(() => {
  db.reset(buildSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
});

const renderAs = async (userId, name) => {
  db.signInAs(userId);
  const r = render(<SettingsScreen onBack={jest.fn()} city="Gurgaon" userName={name} onNav={jest.fn()} />);
  await screen.findByText('Manage your account');
  return r;
};

describe('helpers', () => {
  test('Aadhaar shows only the last 3 digits', () => {
    expect(maskAadhaar('111122223333')).toBe('XXXX XXXX X333');
    expect(maskAadhaar(null)).toBeNull();
  });
  test('UPI hides most of the handle', () => {
    expect(maskUpi('priya@okaxis')).toBe('pr•••@okaxis');
  });
  test('durations read naturally in both languages', () => {
    expect(durationSince(monthsAgo(14), false)).toBe('1 year 2 months');
    expect(durationSince(monthsAgo(3), false)).toBe('3 months');
    expect(durationSince(monthsAgo(3), true)).toBe('3 महीने');
    expect(durationSince(new Date(Date.now() - 5 * 86400000).toISOString(), false)).toBe('5 days');
  });
});

describe('pet parent profile', () => {
  test('private view shows contact, how long they have been a member, pets and booking counts', async () => {
    db.one('users', { id: IDS.ananya }).created_at = monthsAgo(4);
    await renderAs(IDS.ananya, 'Ananya Sharma');
    expect(screen.getByText('ananya@test.example')).toBeInTheDocument();
    expect(screen.getByText('9810000001')).toBeInTheDocument();
    expect(screen.getByText(/· 4 months$/)).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
    expect(screen.getByText('Bookings completed').nextSibling.textContent).toBe('1');
  });

  test('public view hides contact details and shows a shortened name', async () => {
    await renderAs(IDS.ananya, 'Ananya Sharma');
    fireEvent.click(screen.getByRole('tab', { name: /Public/ }));
    expect(screen.getByText('Ananya S.')).toBeInTheDocument();
    expect(screen.queryByText('ananya@test.example')).toBeNull();
    expect(screen.queryByText('9810000001')).toBeNull();
    expect(screen.getByText(/never public/)).toBeInTheDocument();
  });

  test('an invalid phone number is rejected on save', async () => {
    await renderAs(IDS.ananya, 'Ananya Sharma');
    fireEvent.click(screen.getByText('Edit profile'));
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '12345' } });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByText(/10-digit Indian mobile/)).toBeInTheDocument();
    expect(db.one('users', { id: IDS.ananya }).phone).toBe('9810000001');
  });

  test('a valid edit is saved', async () => {
    await renderAs(IDS.ananya, 'Ananya Sharma');
    fireEvent.click(screen.getByText('Edit profile'));
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Ananya Sharma Rao' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(db.one('users', { id: IDS.ananya }).name).toBe('Ananya Sharma Rao'));
    expect(await screen.findByText(/Profile saved/)).toBeInTheDocument();
  });
});

describe('sitter profile', () => {
  test('private view shows masked Aadhaar, masked UPI, approval date and how long ago', async () => {
    Object.assign(db.one('sitter_profiles', { id: IDS.priya }), { approved_at: monthsAgo(2), aadhaar_verified_at: monthsAgo(2) });
    await renderAs(IDS.priyaUser, 'Priya Kapoor');
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Approved as sitter').nextSibling.textContent).toMatch(/· 2 months$/);
    expect(screen.getByText('Aadhaar').nextSibling.textContent).toMatch(/^XXXX XXXX X333/);
    expect(screen.queryByText(/111122223333/)).toBeNull();
    expect(screen.getByText('pr•••@okaxis')).toBeInTheDocument();
    expect(screen.getByText('15% per booking')).toBeInTheDocument();
  });

  test('a Founding Sitter sees 0% commission and the public badge', async () => {
    await renderAs(IDS.sunitaUser, 'सुनीता देवी');
    expect(screen.getByText('0% (Founding Sitter)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Public/ }));
    expect(screen.getByText('Founding Sitter')).toBeInTheDocument();
    expect(screen.getByText('Aadhaar verified')).toBeInTheDocument();
  });

  test('a sitter under review sees the status and what is missing', async () => {
    await renderAs(IDS.vikramUser, 'Vikram Rao');
    expect(screen.getByText('Under review')).toBeInTheDocument();
    expect(screen.getByText(/Still missing:.*Aadhaar/)).toBeInTheDocument();
  });
});

describe('help, safety and account', () => {
  test('Help & FAQ opens a real FAQ, not just WhatsApp', async () => {
    await renderAs(IDS.ananya, 'Ananya Sharma');
    fireEvent.click(screen.getByText(/Help & FAQ/));
    expect(await screen.findByText('What is the refund policy if I cancel?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'commission' } });
    expect(screen.getByText('How much does Fursday take?')).toBeInTheDocument();
  });

  test('SOS opens the emergency sheet with support, 112 and nearest vet', async () => {
    await renderAs(IDS.ananya, 'Ananya Sharma');
    fireEvent.click(screen.getByText(/SOS — Emergency help/));
    const sheet = within(await screen.findByRole('dialog', { name: 'SOS' }));
    expect(await sheet.findByText('Call Fursday support')).toBeInTheDocument();
    expect(sheet.getByText('WhatsApp support with my location')).toBeInTheDocument();
    expect(sheet.getByText('Call 112').closest('a')).toHaveAttribute('href', 'tel:112');
    expect(sheet.getByText('Nearest vet hospital')).toBeInTheDocument();
  });

  test('SOS hides support options when the configured number is not a real one', async () => {
    db.table('app_settings').forEach(r => { r.value = 'YOUR_REAL_NUMBER'; });
    await renderAs(IDS.ananya, 'Ananya Sharma');
    fireEvent.click(screen.getByText(/SOS — Emergency help/));
    expect(await screen.findByText(/support number is not available/)).toBeInTheDocument();
    expect(screen.queryByText('Call Fursday support')).toBeNull();
    expect(screen.getByText('Call 112')).toBeInTheDocument();
  });

  test('Privacy Policy and Terms open their own screens', async () => {
    await renderAs(IDS.ananya, 'Ananya Sharma');
    fireEvent.click(screen.getByText(/Privacy Policy/));
    expect(await screen.findByText(/Digital Personal Data Protection Act/)).toBeInTheDocument();
  });

  test('requesting account deletion records it and can be undone', async () => {
    await renderAs(IDS.rohit, 'Rohit Verma');
    fireEvent.click(screen.getByText(/Delete my account/));
    fireEvent.change(screen.getByLabelText(/Tell us why/), { target: { value: 'Moving abroad' } });
    fireEvent.click(screen.getByText('Request deletion'));
    expect(await screen.findByText(/Deletion requested on/)).toBeInTheDocument();
    expect(db.rows('account_deletion_requests', { user_id: IDS.rohit })[0]).toMatchObject({ reason: 'Moving abroad' });
    fireEvent.click(screen.getByText('Keep my account'));
    await waitFor(() => expect(db.rows('account_deletion_requests', { user_id: IDS.rohit })[0].status).toBe('cancelled'));
  });

  test('turning email off is saved', async () => {
    await renderAs(IDS.ananya, 'Ananya Sharma');
    fireEvent.click(screen.getByLabelText(/Email notifications/));
    await waitFor(() => expect(db.one('notification_preferences', { user_id: IDS.ananya })).toMatchObject({ email_enabled: false, push_enabled: true }));
  });

  test('sign out asks first', async () => {
    await renderAs(IDS.ananya, 'Ananya Sharma');
    window.confirm = jest.fn(() => false);
    fireEvent.click(screen.getByText('Sign out'));
    expect(window.confirm).toHaveBeenCalled();
    expect(db.user).not.toBeNull();
  });
});
