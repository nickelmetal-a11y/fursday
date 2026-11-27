// A brand-new parent signs up in one screen (no documents), and anyone signed in
// can send feedback from the bulb tab on the screen edge. World: buildSeed().
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { db } from '../testing/fakeSupabase';
import { buildSeed, IDS } from '../testing/seed';
import App from '../App';
import AdminFeedback from '../AdminFeedback';

jest.mock('../supabase', () => require('../testing/fakeSupabase'));
jest.mock('../SitterOnboarding', () => function SitterOnboardingStub() { return require('react').createElement('div', null, 'Sitter signup screen'); });
jest.mock('../geolocationService', () => ({
  checkLocationRestriction: () => Promise.resolve({ allowed: true, ip: '127.0.0.1' }),
  getLocationRestrictedMessage: () => 'Coming soon to your area',
}));

const NEW_USER = { id: 'u-newbie', email: 'newbie@example.com', name: 'newbie@example.com' };

beforeEach(() => {
  localStorage.clear();
  db.reset(buildSeed());
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
});

const tab = () => screen.findByRole('button', { name: 'Share an idea or feedback' });

describe('one-screen parent signup', () => {
  test('a new parent gives a name and a dog name and lands on Home, with no ID asked', async () => {
    db.insert('users', NEW_USER);
    db.signInAs(NEW_USER.id);
    render(<App />);
    fireEvent.change(await screen.findByLabelText('What should we call you?'), { target: { value: 'Kavya Rao' } });
    expect(screen.queryByText(/aadhaar/i)).toBeNull();
    expect(screen.getByText(/Pet parents only need an email/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your pet's name (optional)"), { target: { value: 'Bruno' } });
    fireEvent.click(screen.getByText('Get started →'));
    await tab();
    expect(db.one('users', { id: NEW_USER.id }).name).toBe('Kavya Rao');
    expect(db.rows('pet_profiles', { user_id: NEW_USER.id }).map(p => p.name)).toEqual(['Bruno']);
    expect(screen.queryByText('Required')).toBeNull();
  });

  test('choosing "Offer pet care" goes straight to sitter signup and skips the pet field', async () => {
    db.insert('users', NEW_USER);
    db.signInAs(NEW_USER.id);
    render(<App />);
    fireEvent.change(await screen.findByLabelText('What should we call you?'), { target: { value: 'Kavya Rao' } });
    fireEvent.click(screen.getByRole('radio', { name: /Offer pet care and earn/ }));
    expect(screen.queryByLabelText("Your pet's name (optional)")).toBeNull();
    expect(screen.getByText(/Only they need documents/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Continue to sitter signup →'));
    expect(await screen.findByText('Sitter signup screen')).toBeInTheDocument();
    expect(db.rows('pet_profiles', { user_id: NEW_USER.id })).toHaveLength(0);
  });
});

describe('feedback tab', () => {
  test('a parent sends a problem report from Home; the screen and role are recorded', async () => {
    db.signInAs(IDS.ananya);
    render(<App />);
    fireEvent.click(await tab());
    expect(screen.getByRole('dialog', { name: 'Help us build Fursday' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Something's off/ }));
    fireEvent.change(screen.getByLabelText('Your note'), { target: { value: 'The time chips are tiny on my phone' } });
    fireEvent.click(screen.getByText('Send note'));
    expect(await screen.findByText(/Thank you, Ananya!/)).toBeInTheDocument();
    const [row] = db.rows('app_feedback', { user_id: IDS.ananya });
    expect(row).toMatchObject({ kind: 'problem', screen: 'home', role: 'parent', lang: 'en', platform: 'web', message: 'The time chips are tiny on my phone' });
    fireEvent.click(screen.getByText('Done'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await tab()).toBeInTheDocument();
  });

  test('an empty note is not sent', async () => {
    db.signInAs(IDS.ananya);
    render(<App />);
    fireEvent.click(await tab());
    fireEvent.click(screen.getByText('Send note'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Please write a few words first.');
    expect(db.rows('app_feedback')).toHaveLength(0);
  });

  test('the sheet speaks Hindi and "Hide for today" removes the tab', async () => {
    db.signInAs(IDS.ananya);
    render(<App />);
    await tab();
    fireEvent.click(screen.getByText('हिं'));
    fireEvent.click(await screen.findByRole('button', { name: 'कोई सुझाव या राय दें' }));
    expect(screen.getByText('Fursday को बेहतर बनाने में मदद करें')).toBeInTheDocument();
    fireEvent.click(screen.getByText('आज के लिए छुपाएँ'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'कोई सुझाव या राय दें' })).toBeNull());
    expect(Number(localStorage.getItem('fursday_feedback_hidden_until'))).toBeGreaterThan(Date.now());
    fireEvent.click(screen.getByText('EN'));
  });

});

describe('admin feedback inbox', () => {
  test('lists open notes, filters by kind and saves a status with a private note', async () => {
    db.insert('app_feedback', { user_id: IDS.ananya, kind: 'idea', message: 'Let me book two dogs at once', screen: 'booking', role: 'parent', status: 'new', created_at: '2026-11-27T09:00:00Z' });
    db.insert('app_feedback', { user_id: IDS.ananya, kind: 'problem', message: 'Map pin was wrong', screen: 'explore', role: 'parent', status: 'new', created_at: '2026-11-27T10:00:00Z' });
    db.insert('app_feedback', { user_id: IDS.ananya, kind: 'love', message: 'Great walkers', screen: 'home', status: 'done', created_at: '2026-11-26T10:00:00Z' });
    const showMsg = jest.fn();
    render(<AdminFeedback showMsg={showMsg} />);
    expect(await screen.findByText('Let me book two dogs at once')).toBeInTheDocument();
    expect(screen.getByText('Map pin was wrong')).toBeInTheDocument();
    expect(screen.queryByText('Great walkers')).toBeNull();
    expect(screen.getByText(/Most problem reports: Explore \(1\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ideas' }));
    expect(screen.queryByText('Map pin was wrong')).toBeNull();

    const idea = db.one('app_feedback', { kind: 'idea' });
    fireEvent.change(screen.getByLabelText('Status', { selector: 'select' }), { target: { value: 'planned' } });
    fireEvent.change(screen.getByLabelText('Private note'), { target: { value: 'December release' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(db.one('app_feedback', { id: idea.id })).toMatchObject({ status: 'planned', admin_note: 'December release' }));
    expect(showMsg).toHaveBeenCalledWith('Feedback updated');
  });
});
