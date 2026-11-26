/**
 * Unit tests for geolocationService.js
 * Covers UT-GEO-01..13 from TEST_SCENARIOS.md
 */

import { checkLocationRestriction, getLocationRestrictedMessage } from './geolocationService';

function mockFetchOnce(json, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(json),
  });
}

function mockGeolocation(implementation) {
  Object.defineProperty(global.navigator, 'geolocation', {
    value: implementation,
    configurable: true,
  });
}

describe('geolocationService', () => {
  afterEach(() => {
    delete global.navigator.geolocation;
  });

  // UT-GEO-01
  test('allows a coordinate inside Delhi/NCR', async () => {
    mockFetchOnce({ latitude: 28.6, longitude: 77.2, city: 'Delhi', ip: '1.1.1.1' });
    const result = await checkLocationRestriction();
    expect(result.allowed).toBe(true);
  });

  // UT-GEO-02
  test('allows Gurgaon and Noida coordinates', async () => {
    mockFetchOnce({ latitude: 28.46, longitude: 77.03, ip: '1.1.1.1' });
    expect((await checkLocationRestriction()).allowed).toBe(true);

    mockFetchOnce({ latitude: 28.57, longitude: 77.32, ip: '1.1.1.1' });
    expect((await checkLocationRestriction()).allowed).toBe(true);
  });

  // UT-GEO-03
  // Indian mobile IPs often geolocate to a distant hub, so an Indian IP is
  // never hard-blocked; it is only flagged as outside the service area.
  test('an Indian IP that looks like Mumbai or Bangalore is not blocked, only flagged', async () => {
    mockFetchOnce({ latitude: 19.07, longitude: 72.87, country_code: 'IN', ip: '1.1.1.1' }); // Mumbai (e.g. a Pune Jio user)
    let r = await checkLocationRestriction();
    expect(r.allowed).toBe(true);
    expect(r.inServiceArea).toBe(false);

    mockFetchOnce({ latitude: 12.97, longitude: 77.59, country_code: 'IN', ip: '1.1.1.1' }); // Bangalore
    r = await checkLocationRestriction();
    expect(r.allowed).toBe(true);
    expect(r.inServiceArea).toBe(false);
  });

  test('an IP outside India is blocked', async () => {
    mockFetchOnce({ latitude: 51.5, longitude: -0.12, country_code: 'GB', ip: '1.1.1.1' });
    expect((await checkLocationRestriction()).allowed).toBe(false);
  });

  test('Pune and wider NCR (Ghaziabad, Pimpri-Chinchwad, Hinjewadi) are in the service area', async () => {
    for (const [latitude, longitude] of [[18.52, 73.86], [18.63, 73.80], [18.59, 73.74], [28.67, 77.45], [28.41, 77.32]]) {
      mockFetchOnce({ latitude, longitude, country_code: 'IN', ip: '1.1.1.1' });
      expect((await checkLocationRestriction()).inServiceArea).toBe(true);
    }
  });

  // UT-GEO-04
  test('boundary values are inclusive', async () => {
    const corners = [
      [28.4, 76.8], [28.4, 77.5], [28.9, 76.8], [28.9, 77.5],
    ];
    for (const [latitude, longitude] of corners) {
      mockFetchOnce({ latitude, longitude, ip: '1.1.1.1' });
      expect((await checkLocationRestriction()).allowed).toBe(true);
    }
  });

  // UT-GEO-05
  test('just outside the NCR boundary is flagged as outside the service area', async () => {
    mockFetchOnce({ latitude: 28.15, longitude: 77.75, country_code: 'IN', ip: '1.1.1.1' });
    expect((await checkLocationRestriction()).inServiceArea).toBe(false);
  });

  // UT-GEO-06
  test('falls back to GPS when ipapi.co returns a non-200', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    mockGeolocation({
      getCurrentPosition: (success) => success({ coords: { latitude: 28.6, longitude: 77.2 } }),
    });
    const result = await checkLocationRestriction();
    expect(result.location).toBe('GPS verified');
    expect(result.allowed).toBe(true);
  });

  // UT-GEO-07
  test('falls back to GPS when the fetch throws (network down)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    mockGeolocation({
      getCurrentPosition: (success) => success({ coords: { latitude: 28.6, longitude: 77.2 } }),
    });
    const result = await checkLocationRestriction();
    expect(result.location).toBe('GPS verified');
    expect(result.allowed).toBe(true);
  });

  // UT-GEO-08
  test('missing/NaN lat/lng from the API does not crash and is outside the service area', async () => {
    mockFetchOnce({ city: 'Unknown', country_code: 'IN', ip: '1.1.1.1' }); // no latitude/longitude at all
    const result = await checkLocationRestriction();
    expect(result.allowed).toBe(true);
    expect(result.inServiceArea).toBe(false);
  });

  // UT-GEO-09
  test('GPS fallback inside the region is allowed', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    mockGeolocation({
      getCurrentPosition: (success) => success({ coords: { latitude: 28.7, longitude: 77.1 } }),
    });
    expect((await checkLocationRestriction()).allowed).toBe(true);
  });

  // UT-GEO-10 — this is a soft regional nudge, not a security boundary: when
  // both the IP lookup AND GPS fail/are denied, fail open rather than
  // locking out a real user over a transient or third-party failure.
  test('GPS permission denied fails open (unverified, not blocked), never throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    mockGeolocation({
      getCurrentPosition: (_success, error) => error({ code: 1, message: 'User denied' }),
    });
    const result = await checkLocationRestriction();
    expect(result.allowed).toBe(true);
    expect(result.location).toBe('Unverified');
  });

  // UT-GEO-11
  test('no navigator.geolocation at all fails open, not a crash', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    delete global.navigator.geolocation; // explicitly absent
    const result = await checkLocationRestriction();
    expect(result.allowed).toBe(true);
    expect(result.location).toBe('Unverified');
  });

  // UT-GEO-12 — the real bug: fetch's `timeout` option does nothing in
  // browsers. Verifies the fix (AbortController) actually aborts a hung
  // request instead of waiting forever.
  test('a hanging IP lookup is aborted instead of hanging forever', async () => {
    jest.useFakeTimers();
    let abortedSignal;
    global.fetch = jest.fn((_url, options) => {
      abortedSignal = options.signal;
      return new Promise((_resolve, reject) => {
        abortedSignal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });
    mockGeolocation({
      getCurrentPosition: (success) => success({ coords: { latitude: 28.6, longitude: 77.2 } }),
    });

    const promise = checkLocationRestriction();
    jest.advanceTimersByTime(5000); // fires the setTimeout that calls controller.abort()
    const result = await promise;

    expect(abortedSignal.aborted).toBe(true);
    expect(result.location).toBe('GPS verified'); // fell back to GPS after the abort
    jest.useRealTimers();
  });

  // UT-GEO-13
  test('the ip address is included for the blocked screen to show', async () => {
    mockFetchOnce({ latitude: 19.07, longitude: 72.87, ip: '203.0.113.42' });
    const result = await checkLocationRestriction();
    expect(result.ip).toBe('203.0.113.42');
  });

  test('getLocationRestrictedMessage returns a title, message and icon', () => {
    const msg = getLocationRestrictedMessage();
    expect(msg.title).toBeDefined();
    expect(msg.message).toMatch(/Delhi NCR and Pune/);
    expect(msg.icon).toBeDefined();
  });
});
