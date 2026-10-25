// IP-based geolocation restriction service
// Restricts Fursday to Delhi/NCR region only

const DELHI_NCR_IP_RANGES = [
  // Delhi & NCR ISP ranges (approximate)
  // Airtel Delhi: 49.43.0.0 - 49.43.255.255
  // Jio Delhi: 106.0.0.0 - 106.255.255.255
  // BSNL Delhi: 180.151.0.0 - 180.151.255.255
  // Major Indian ISPs that serve Delhi/NCR
];

const DELHI_NCR_COORDINATES = {
  lat: [28.4, 28.9],
  lng: [76.8, 77.5],
};

export async function checkLocationRestriction() {
  try {
    // Method 1: Check IP geolocation via free API
    const response = await fetch('https://ipapi.co/json/', {
      timeout: 5000,
    });

    if (!response.ok) throw new Error('IP lookup failed');

    const data = await response.json();

    // Check if location is in Delhi/NCR region
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);

    const isInDelhiNCR =
      lat >= DELHI_NCR_COORDINATES.lat[0] &&
      lat <= DELHI_NCR_COORDINATES.lat[1] &&
      lng >= DELHI_NCR_COORDINATES.lng[0] &&
      lng <= DELHI_NCR_COORDINATES.lng[1];

    return {
      allowed: isInDelhiNCR,
      location: data.city || 'Unknown',
      region: data.region || 'Unknown',
      country: data.country_name || 'Unknown',
      ip: data.ip,
      latitude: lat,
      longitude: lng,
    };
  } catch (error) {
    console.error('Geolocation check failed:', error);
    // Fallback: if API fails, use GPS for verification
    return await verifyGPSLocation();
  }
}

async function verifyGPSLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        allowed: false,
        error: 'Geolocation not available',
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        const isInDelhiNCR =
          lat >= DELHI_NCR_COORDINATES.lat[0] &&
          lat <= DELHI_NCR_COORDINATES.lat[1] &&
          lng >= DELHI_NCR_COORDINATES.lng[0] &&
          lng <= DELHI_NCR_COORDINATES.lng[1];

        resolve({
          allowed: isInDelhiNCR,
          location: 'GPS verified',
          latitude: lat,
          longitude: lng,
        });
      },
      (error) => {
        console.error('GPS check failed:', error);
        resolve({
          allowed: false,
          error: 'GPS verification failed',
        });
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
