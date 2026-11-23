// IP-based geolocation restriction service
// Restricts Fursday to its currently served cities

// Must stay in sync with CITY_CONFIG bounds in src/App.js — every city
// Fursday actually serves needs an entry here or its users get hard-blocked.
const ALLOWED_REGIONS = [
  { lat: [28.3, 28.9], lng: [76.8, 77.5] }, // Gurgaon / Delhi NCR
  { lat: [18.4, 18.7], lng: [73.7, 74.1] }, // Pune
];

const isInAllowedRegion = (lat, lng) =>
  ALLOWED_REGIONS.some(r => lat >= r.lat[0] && lat <= r.lat[1] && lng >= r.lng[0] && lng <= r.lng[1]);

export async function checkLocationRestriction() {
  try {
    // Method 1: Check IP geolocation via free API.
    // NOTE: fetch's `timeout` option does not exist and is silently
    // ignored by every browser — a slow/hanging ipapi.co would otherwise
    // block this check forever. AbortController is the real way to time out.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let response;
    try {
      response = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) throw new Error('IP lookup failed');

    const data = await response.json();

    // Check if location is in Delhi/NCR region
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);

    return {
      allowed: isInAllowedRegion(lat, lng),
      location: data.city || 'Unknown',
      region: data.region || 'Unknown',
      country: data.country_name || 'Unknown',
      ip: data.ip,
      latitude: lat,
      longitude: lng,
    };
  } catch (error) {
    console.error('Geolocation check failed:', error);
    // Fallback: if the IP API is unreachable/rate-limited, use GPS for verification
    return await verifyGPSLocation();
  }
}

async function verifyGPSLocation() {
  return new Promise((resolve) => {
    // No browser GPS support, or the user declines the permission prompt: both
    // the IP check and GPS have now failed. This is a soft regional nudge, not
    // a security boundary — fail open rather than locking out a real user over
    // a transient/third-party failure.
    if (!navigator.geolocation) {
      resolve({ allowed: true, location: 'Unverified' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        resolve({
          allowed: isInAllowedRegion(lat, lng),
          location: 'GPS verified',
          latitude: lat,
          longitude: lng,
        });
      },
      (error) => {
        console.error('GPS check failed:', error);
        resolve({ allowed: true, location: 'Unverified' });
      },
      { timeout: 10000 }
    );
  });
}

export function getLocationRestrictedMessage() {
  return {
    title: 'Not Available in Your Region',
    message: 'Fursday is currently available only in Delhi/NCR region. We are expanding to your area soon!',
    icon: '🗺️',
  };
}
