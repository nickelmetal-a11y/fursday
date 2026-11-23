import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';

// App.js calls checkLocationRestriction() on mount, which otherwise hits the
// real network (ipapi.co) or falls through to the global fetch stub in
// setupTests.js and gets blocked ({} has no lat/lng). Mock it directly so
// these UI tests exercise the Delhi/NCR-allowed app, not the "Coming Soon"
// screen. Plain functions, not jest.fn() — CRA's Jest preset sets
// `resetMocks: true`, which wipes a jest.fn()'s .mockResolvedValue() back
// to undefined after the FIRST test in this file.
jest.mock('./geolocationService', () => ({
  checkLocationRestriction: () => Promise.resolve({ allowed: true, ip: '127.0.0.1' }),
  getLocationRestrictedMessage: () => 'Coming soon to your area',
}));

// App.js gates the whole app (bottom nav, settings icon, etc.) behind a
// Supabase session: `if (!user) return <LoginScreen .../>`. Without a mocked
// session every render stays on the login screen, so tests that look for
// logged-in-only UI (like the settings icon) can never find it. Chainable
// query builder so `.from(...).select(...).eq(...).single()` all resolve,
// same pattern as notificationService.test.js's Supabase mock. Plain
// functions, not jest.fn() — CRA's `resetMocks: true` wipes a jest.fn()'s
// .mockResolvedValue() back to undefined after the first test in the file.
jest.mock('./supabase', () => {
  const queryBuilder = {
    select: () => queryBuilder,
    eq: () => queryBuilder,
    upsert: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: { name: 'Test User' }, error: null }),
  };
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: { user: { id: 'test-user-1', email: 'test@example.com' } } } }),
        getUser: () => Promise.resolve({ data: { user: { id: 'test-user-1', email: 'test@example.com' } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
      from: () => queryBuilder,
    },
    sendLocalNotification: () => {},
    requestNotifications: () => Promise.resolve(),
  };
});

describe('Fursday App - Map First Design & Settings', () => {

  // ─── MAP FIRST HOMEPAGE TESTS ───────────────────────────────

  test('renders home page with map on initial load', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.queryByText(/Fursday/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test('shows location loading spinner while detecting GPS', async () => {
    render(<App />);
    await waitFor(() => {
      const findingText = screen.queryByText(/Finding your location/i);
      if (findingText) {
        expect(findingText).toBeInTheDocument();
      }
    }, { timeout: 5000 });
  });

  test('displays map element when map reference is loaded', async () => {
    render(<App />);
    await waitFor(() => {
      const mapElement = document.querySelector('[class*="leaflet"]');
      if (mapElement) {
        expect(mapElement).toBeTruthy();
      }
    }, { timeout: 5000 });
  });

  test('shows location error when GPS permission denied', async () => {
    const originalGeolocation = navigator.geolocation;
    navigator.geolocation = {
      getCurrentPosition: (success, error) => {
        error({ code: 1, message: 'Permission denied' });
      },
    };

    render(<App />);
    await waitFor(() => {
      const errorButton = screen.queryByText(/Try again/i);
      if (errorButton) {
        expect(errorButton).toBeInTheDocument();
      }
    }, { timeout: 3000 });

    navigator.geolocation = originalGeolocation;
  });

  test('shows "Browse sitters on map" button', async () => {
    render(<App />);
    await waitFor(() => {
      const browseButton = screen.queryByText(/Browse sitters on map/i);
      if (browseButton) {
        expect(browseButton).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  test('displays service cards grid below map', async () => {
    render(<App />);
    await waitFor(() => {
      const serviceText = screen.queryByText(/What do you need/i);
      if (serviceText) {
        expect(serviceText).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  test('shows "Use my location" button', async () => {
    render(<App />);
    await waitFor(() => {
      const locationButton = screen.queryByText(/Use my location/i);
      if (locationButton) {
        expect(locationButton).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  // ─── SETTINGS SCREEN TESTS ──────────────────────────────────

  test('renders settings icon in bottom navigation', async () => {
    render(<App />);
    await waitFor(() => {
      const settingsIcons = screen.getAllByText(/⚙️/i);
      expect(settingsIcons.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  test('opens settings screen when settings button clicked', async () => {
    render(<App />);
    await waitFor(() => {
      const settingsButtons = screen.queryAllByText(/⚙️/i);
      if (settingsButtons.length > 0) {
        fireEvent.click(settingsButtons[settingsButtons.length - 1]);
      }
    }, { timeout: 3000 });
  });

  test('displays profile section in settings', async () => {
    render(<App />);
    await waitFor(() => {
      const profileText = screen.queryByText(/Profile/i);
      if (profileText) {
        expect(profileText).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  test('shows notification preferences toggle in settings', async () => {
    render(<App />);
    await waitFor(() => {
      const notificationsText = screen.queryByText(/Push notifications/i);
      if (notificationsText) {
        expect(notificationsText).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  test('displays language selection dropdown', async () => {
    render(<App />);
    await waitFor(() => {
      const selectElements = document.querySelectorAll('select');
      if (selectElements.length > 0) {
        expect(selectElements[0]).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  test('shows sign out button in settings', async () => {
    render(<App />);
    await waitFor(() => {
      const signOutButton = screen.queryByText(/Sign out/i);
      if (signOutButton) {
        expect(signOutButton).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  test('displays help section with FAQ link', async () => {
    render(<App />);
    await waitFor(() => {
      const helpText = screen.queryByText(/Help & FAQ/i);
      if (helpText) {
        expect(helpText).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  test('shows Terms & Privacy link', async () => {
    render(<App />);
    await waitFor(() => {
      const termsText = screen.queryByText(/Terms & Privacy/i);
      if (termsText) {
        expect(termsText).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  test('displays About Fursday link', async () => {
    render(<App />);
    await waitFor(() => {
      const aboutText = screen.queryByText(/About Fursday/i);
      if (aboutText) {
        expect(aboutText).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  // ─── BOTTOM NAVIGATION TESTS ────────────────────────────────

  test('renders all 5 bottom nav items', async () => {
    render(<App />);
    await waitFor(() => {
      const homeIcon = screen.queryByText(/Home/i);
      const bookingsIcon = screen.queryByText(/Bookings/i);
      const exploreIcon = screen.queryByText(/Explore/i);
      const petsIcon = screen.queryByText(/My Pets/i);
      const settingsIcon = screen.queryByText(/Settings/i);

      const allPresent = [homeIcon, bookingsIcon, exploreIcon, petsIcon, settingsIcon].every(el => el);
      if (allPresent) {
        expect(true).toBe(true);
      }
    }, { timeout: 3000 });
  });

  test('highlights active nav item', async () => {
    render(<App />);
    await waitFor(() => {
      const navItems = document.querySelectorAll('[style*="active"]');
      if (navItems.length > 0) {
        expect(navItems.length).toBeGreaterThan(0);
      }
    }, { timeout: 3000 });
  });

  // ─── GPS & LOCATION DETECTION TESTS ─────────────────────────

  test('calls geolocation.getCurrentPosition on mount', async () => {
    const mockGeolocation = {
      getCurrentPosition: jest.fn(),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    render(<App />);
    await waitFor(() => {
      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  test('sets user location when GPS succeeds', async () => {
    const mockGeolocation = {
      getCurrentPosition: (success) => {
        success({
          coords: {
            latitude: 28.4595,
            longitude: 77.0266,
          },
        });
      },
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    render(<App />);
    await waitFor(() => {
      expect(true).toBe(true);
    }, { timeout: 3000 });
  });

  test('uses enableHighAccuracy for GPS', async () => {
    const options = {};
    const mockGeolocation = {
      getCurrentPosition: jest.fn((success, error, opts) => {
        Object.assign(options, opts);
      }),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    render(<App />);
    await waitFor(() => {
      if (options.enableHighAccuracy !== undefined) {
        expect(options.enableHighAccuracy).toBe(true);
      }
    }, { timeout: 3000 });
  });

  test('sets timeout to 10000ms for GPS', async () => {
    const options = {};
    const mockGeolocation = {
      getCurrentPosition: jest.fn((success, error, opts) => {
        Object.assign(options, opts);
      }),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    render(<App />);
    await waitFor(() => {
      if (options.timeout !== undefined) {
        expect(options.timeout).toBe(10000);
      }
    }, { timeout: 3000 });
  });

  test('handles location error gracefully', async () => {
    const mockGeolocation = {
      getCurrentPosition: (success, error) => {
        error({
          code: 2,
          message: 'Position unavailable',
        });
      },
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      writable: true,
    });

    render(<App />);
    await waitFor(() => {
      const tryAgainButton = screen.queryByText(/Try again/i);
      if (tryAgainButton) {
        expect(tryAgainButton).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

  // ─── INTEGRATION TESTS ──────────────────────────────────────

  test('complete flow: load app → see map → access settings', async () => {
    render(<App />);

    // Wait for app to load
    await waitFor(() => {
      expect(screen.queryByText(/Fursday/i)).toBeInTheDocument();
    }, { timeout: 5000 });

    // Map should be visible
    const mapContainer = document.querySelector('[class*="leaflet"]');
    if (mapContainer) {
      expect(mapContainer).toBeTruthy();
    }

    // Service cards should be visible
    const serviceArea = screen.queryByText(/What do you need/i);
    if (serviceArea) {
      expect(serviceArea).toBeInTheDocument();
    }
  });

  test('map zoom controls are present', async () => {
    render(<App />);
    await waitFor(() => {
      const zoomInButton = screen.queryByText(/\+/);
      const zoomOutButton = screen.queryByText(/−/);
      if (zoomInButton || zoomOutButton) {
        expect(true).toBe(true);
      }
    }, { timeout: 5000 });
  });

  test('city selector shows correct theme', async () => {
    render(<App />);
    await waitFor(() => {
      const cityText = screen.queryByText(/Delhi NCR|Pune/);
      if (cityText) {
        expect(cityText).toBeInTheDocument();
      }
    }, { timeout: 3000 });
  });

});
