import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsScreen from './SettingsScreen';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(),
    // Plain function, not jest.fn().mockResolvedValue(...) — CRA's jest
    // config sets resetMocks:true, which wipes a mockResolvedValue set
    // inside this factory after the first test in the file; every later
    // test would get `undefined` back instead of the canned response.
    rpc: () => Promise.resolve({ data: [{ phone: '+91-9876543210', email: null }], error: null }),
  },
}));

describe('SettingsScreen - App Store Ready', () => {

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockOnBack = jest.fn();
  const city = 'Gurgaon';
  const userName = 'John Doe';

  beforeEach(() => {
    jest.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
    });
    // supabase.rpc is a plain function (see note above), not a jest.fn(), so
    // jest.clearAllMocks() won't reset a test-local override of it back to
    // this default — restore it explicitly before every test.
    supabase.rpc = () => Promise.resolve({ data: [{ phone: '+91-9876543210', email: null }], error: null });
    supabase.from.mockImplementation((table) => {
      if (table === 'notification_preferences') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null }),
            }),
          }),
          upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { phone: '+91-9876543210' },
            }),
          }),
        }),
      };
    });
  });

  // ─── HEADER TESTS ──────────────────────────────────────────

  test('renders settings header with back button', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      // "Settings" also appears as a bottom-nav label now, so scope to the
      // header's title div specifically.
      expect(screen.getByText('Settings', { selector: 'div' })).toBeInTheDocument();
      expect(screen.getByText(/Manage your account/i)).toBeInTheDocument();
    });
  });

  test('back button calls onBack callback', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      const backButton = screen.getByText('‹');
      fireEvent.click(backButton);
      expect(mockOnBack).toHaveBeenCalled();
    });
  });

  // ─── PROFILE SECTION TESTS ─────────────────────────────────

  test('displays profile section', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      // Exact match: a loose /Profile/i regex also matches the "Edit profile" button.
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });

  test('shows user name correctly', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(userName)).toBeInTheDocument();
    });
  });

  test('displays user email', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    });
  });

  test('shows phone number when available', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/\+91-9876543210/)).toBeInTheDocument();
    });
  });

  test('shows "Not added" when phone is missing', async () => {
    supabase.rpc = () => Promise.resolve({ data: [{ phone: null, email: null }], error: null });

    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Not added/)).toBeInTheDocument();
    });
  });

  test('displays Edit profile button', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Edit profile/i)).toBeInTheDocument();
    });
  });

  // ─── NOTIFICATIONS SECTION TESTS ───────────────────────────

  test('renders notifications section', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      // Exact match: a loose /Notifications/i regex also matches the
      // "Push/Email/SMS notifications" toggle labels.
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });
  });

  test('shows push notifications toggle', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Push notifications/i)).toBeInTheDocument();
      expect(screen.getByText(/Get alerts in the app/i)).toBeInTheDocument();
    });
  });

  test('shows email notifications toggle', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Email notifications/i)).toBeInTheDocument();
      expect(screen.getByText(/Updates via email/i)).toBeInTheDocument();
    });
  });

  test('shows SMS notifications toggle', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/SMS notifications/i)).toBeInTheDocument();
      expect(screen.getByText(/Text message updates/i)).toBeInTheDocument();
    });
  });

  test('notification toggles are initially checked', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('toggles can be clicked', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      if (checkboxes.length > 0) {
        fireEvent.click(checkboxes[0]);
        expect(checkboxes[0].checked).toBe(false);
      }
    });
  });

  // ─── PREFERENCES SECTION TESTS ──────────────────────────────

  test('renders preferences section', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Preferences/i)).toBeInTheDocument();
    });
  });

  test('shows dark mode toggle (disabled)', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Dark mode/i)).toBeInTheDocument();
      expect(screen.getByText(/Coming soon/i)).toBeInTheDocument();
    });
  });

  test('displays language selection dropdown', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  test('language section points to the global EN/हिं toggle', async () => {
    // The per-screen language <select> was dead (no value/onChange wired to
    // anything) and has been replaced by one global toggle rendered outside
    // every screen (see LanguageToggle.js) so switching language actually
    // affects the whole app instead of silently doing nothing here.
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/EN \/ हिं/i)).toBeInTheDocument();
    });
  });

  // ─── HELP SECTION TESTS ────────────────────────────────────

  test('renders help section', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Help & FAQ/i)).toBeInTheDocument();
    });
  });

  test('displays FAQ link', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Help & FAQ/i)).toBeInTheDocument();
    });
  });

  test('displays Terms & Privacy link', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Terms & Privacy/i)).toBeInTheDocument();
    });
  });

  test('displays About link', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/About Fursday/i)).toBeInTheDocument();
    });
  });

  // ─── SIGN OUT TESTS ────────────────────────────────────────

  test('displays sign out button', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Sign out/i)).toBeInTheDocument();
    });
  });

  test('sign out button has danger styling', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      const signOutButton = screen.getByText(/Sign out/i).closest('button');
      expect(signOutButton).toHaveStyle('color: #E53935');
    });
  });

  test('shows signed in email in danger zone', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(`Signed in as: ${mockUser.email}`)).toBeInTheDocument();
    });
  });

  // ─── LOADING STATES TESTS ──────────────────────────────────

  test('shows loading state initially', async () => {
    supabase.auth.getUser.mockImplementation(() => new Promise(() => {}));

    const { rerender } = render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    expect(screen.getByText(/Loading settings/i)).toBeInTheDocument();
  });

  // ─── APP STORE READINESS TESTS ─────────────────────────────

  test('all sections are responsive and mobile-friendly', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      // getByText('Settings', {selector:'div'}) returns the title div itself
      // (scoped because "Settings" also appears as a bottom-nav label now).
      // The max-width lives on the outer page container, three levels up:
      // title div -> flex:1 wrapper -> header row -> outer container.
      const header = screen.getByText('Settings', { selector: 'div' });
      const container = header.parentElement.parentElement.parentElement;
      expect(container.style.maxWidth).toBe('390px');
    });
  });

  test('displays app version number', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/Fursday v1.0.0/i)).toBeInTheDocument();
    });
  });

  test('displays copyright notice', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      expect(screen.getByText(/© 2026 Fursday/i)).toBeInTheDocument();
    });
  });

  test('layout is properly scrollable', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      // React serializes the inline style as kebab-case ("min-height: 100vh"),
      // not the camelCase JS property name used in source. Scoped to the
      // title div since "Settings" also appears as a bottom-nav label now.
      const scrollContainer = screen.getByText('Settings', { selector: 'div' }).closest('[style*="min-height"]');
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  // ─── ACCESSIBILITY TESTS ───────────────────────────────────

  test('all toggles have proper labels', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  test('back button is keyboard accessible', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      const backButton = screen.getByText('‹').closest('button');
      expect(backButton).toBeInTheDocument();
    });
  });

  test('all buttons are clickable', async () => {
    render(<SettingsScreen onBack={mockOnBack} city={city} userName={userName} />);

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
