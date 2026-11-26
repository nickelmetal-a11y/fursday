// Location helpers shared by Home, Explore, BookingFlow, addresses and admin zones.
// Pure functions only, so they are easy to test.
import { LOCALITIES } from './data/localities';

export const distanceKm = (a, b) => {
  if (!a || !b || a.lat == null || b.lat == null || a.lng == null || b.lng == null) return null;
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const formatKm = (km) => (km == null ? '' : km < 1 ? '<1 km' : (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km');

// Nearest named locality to a GPS point, within 4 km (else null).
export function nearestLocality(lat, lng, city) {
  let best = null, bestD = Infinity;
  for (const l of LOCALITIES) {
    if (city && l.city !== city) continue;
    const d = distanceKm({ lat, lng }, l);
    if (d != null && d < bestD) { best = l; bestD = d; }
  }
  return best && bestD <= 4 ? best : null;
}

// Search suggestions: matches name, district or pincode; names starting with
// the query come first.
export function searchLocalities(query, city, limit = 8) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return LOCALITIES
    .filter(l => (!city || l.city === city) && (l.name.toLowerCase().includes(q) || l.district.toLowerCase().includes(q) || l.pincode.startsWith(q)))
    .sort((a, b) => (b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export const localityByPincode = (pincode, city) => LOCALITIES.find(l => l.pincode === String(pincode || '').trim() && (!city || l.city === city)) || null;

// Best-known point for an address: its own pin, else its locality, else its pincode.
export function pointFor(address) {
  if (!address) return null;
  if (address.lat != null && address.lng != null) return { lat: address.lat, lng: address.lng };
  const byName = address.area && LOCALITIES.find(l => l.name.toLowerCase() === String(address.area).toLowerCase());
  const loc = byName || localityByPincode(address.pincode);
  return loc ? { lat: loc.lat, lng: loc.lng } : null;
}

// Is this address inside an open zone? A city with no zones configured is
// fully open, so the app works before the admin sets any zones up.
export function serviceability(address, zones, cityId) {
  const cityZones = (zones || []).filter(z => !cityId || z.city_id === cityId);
  if (cityZones.length === 0) return { serviceable: true, zone: null, reason: 'no_zones' };
  const pin = String(address?.pincode || '').trim();
  const point = pointFor(address);
  const matches = cityZones.filter(z =>
    (pin && (z.pincodes || []).includes(pin)) ||
    (point && z.center_lat != null && z.radius_km && distanceKm(point, { lat: z.center_lat, lng: z.center_lng }) <= Number(z.radius_km)));
  // Overlapping zones: any open one wins over a closed one.
  const match = matches.find(z => z.is_open) || matches[0];
  if (!match) return { serviceable: false, zone: null, reason: 'outside' };
  if (!match.is_open) return { serviceable: false, zone: match, reason: 'closed' };
  return { serviceable: true, zone: match, reason: 'open' };
}

// Does a sitter travel to this point? Unknown locations are allowed, so
// sitters who haven't set a base yet still appear.
export function sitterCovers(sitter, point) {
  const base = sitter?.lat != null ? { lat: sitter.lat, lng: sitter.lng } : pointFor({ area: sitter?.base_area, pincode: sitter?.base_pincode });
  const d = distanceKm(base, point);
  if (d == null) return { covers: true, km: null };
  return { covers: d <= Number(sitter.service_radius_km || 5), km: d };
}
