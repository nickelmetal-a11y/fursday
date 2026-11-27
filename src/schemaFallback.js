// Columns added by migrations 035 and 037. Until a migration runs on production,
// PostgREST rejects a write that names any of its columns ("Could not find the
// 'headline' column ... in the schema cache"); we then drop that migration's
// columns and save the rest instead of failing the save.
export const SITTER_035_COLUMNS = ['headline', 'highlights', 'base_area', 'base_pincode', 'service_radius_km', 'profile_updated_at'];
export const SITTER_037_COLUMNS = ['provider_type', 'home_details', 'home_photos'];
export const SITTER_038_COLUMNS = ['pricing_rules', 'cancellation_policy', 'instant_book', 'requires_vaccination', 'share_slug'];
export const SITTER_OPTIONAL_GROUPS = [SITTER_035_COLUMNS, SITTER_037_COLUMNS, SITTER_038_COLUMNS];
export const BOOKING_035_COLUMNS = ['address_area', 'address_pincode', 'address_lat', 'address_lng'];
export const BOOKING_038_COLUMNS = ['pet_ids', 'series_id', 'is_meet_greet', 'tip_paise', 'house_rules_accepted_at', 'cancellation_policy'];
export const BOOKING_OPTIONAL_GROUPS = [BOOKING_035_COLUMNS, BOOKING_038_COLUMNS];

// row may also be an array of rows (one multi-row insert).
export async function writeWithFallback(write, row, groups = SITTER_OPTIONAL_GROUPS) {
  const pending = typeof groups[0] === 'string' ? [groups] : [...groups];
  let current = row;
  let res = await write(current);
  while (res?.error && /column|schema cache/i.test(res.error.message || '')) {
    const msg = res.error.message || '';
    const i = pending.findIndex(g => g.some(c => msg.includes(c)));
    if (i < 0) break;
    const [group] = pending.splice(i, 1);
    const drop = (r) => Object.fromEntries(Object.entries(r).filter(([k]) => !group.includes(k)));
    current = Array.isArray(current) ? current.map(drop) : drop(current);
    res = await write(current);
  }
  return res;
}
