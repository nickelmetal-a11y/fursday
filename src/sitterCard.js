import { translate } from './i18n';

export const SITTER_CARD_SELECT = '*, users(name), sitter_services(service_type, price_paise)';

// A sitter's rating is only shown once someone has reviewed them. The
// sitter_profiles defaults (avg_rating 5.00, rating 0) would otherwise show a
// made-up score on every new sitter.
export function sitterRating(row) {
  const count = Number(row?.review_count) || 0;
  const avg = Number(row?.avg_rating ?? row?.rating);
  return count > 0 && avg > 0 ? { rating: Math.round(avg * 10) / 10, count } : { rating: null, count };
}

const tr = (key, vars) => Object.keys(vars || {}).reduce((str, k) => str.replace('{' + k + '}', vars[k]), translate(key));

// The shape Home, Explore and the public profile pass around for one sitter.
export function toSitterCard(s, city) {
  const services = s.sitter_services || [];
  const boarding = services.find(sv => sv.service_type === 'boarding');
  const { rating, count } = sitterRating(s);
  return {
    id: s.id,
    user_id: s.user_id,
    name: s.users?.name || translate('sitterProfile_nameFallback'),
    city, area: s.base_area || city,
    headline: s.headline ?? null, highlights: s.highlights || [],
    base_area: s.base_area || null, service_radius_km: s.service_radius_km ?? null,
    rating, reviewCount: count,
    walks: s.total_bookings || 0,
    provider_type: s.provider_type || 'sitter', home_details: s.home_details || {}, home_photos: s.home_photos || [],
    services,
    price: s.provider_type === 'boarding' && boarding
      ? tr('boardingProfile_pricePerNight', { n: Math.round(boarding.price_paise / 100) })
      : tr('home_pricePerWalk', { n: services[0] ? Math.round(services[0].price_paise / 100) : 299 }),
    tags: services.map(sv => sv.service_type),
    verified: s.aadhaar_verified || false,
    emoji: (s.users?.name || 'S')[0].toUpperCase(),
    isTopSitter: s.is_top_sitter || false,
    profilePhoto: s.profile_photo_url || null,
    share_slug: s.share_slug || null,
    city_id: s.city_id || null,
    lat: s.lat || null,
    lng: s.lng || null,
  };
}
