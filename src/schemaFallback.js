// Columns added by migrations 035 and 037. Until a migration runs on production,
// PostgREST rejects a write that names any of its columns ("Could not find the
// 'headline' column ... in the schema cache"); we then drop that migration's
// columns and save the rest instead of failing the save.
export const SITTER_035_COLUMNS = ['headline', 'highlights', 'base_area', 'base_pincode', 'service_radius_km', 'profile_updated_at'];
export const SITTER_037_COLUMNS = ['provider_type', 'home_details', 'home_photos'];
export const SITTER_OPTIONAL_GROUPS = [SITTER_035_COLUMNS, SITTER_037_COLUMNS];

export async function writeWithFallback(write, row, groups = SITTER_OPTIONAL_GROUPS) {
  const pending = typeof groups[0] === 'string' ? [groups] : [...groups];
  let current = row;
  let res = await write(current);
  while (res?.error && /column|schema cache/i.test(res.error.message || '')) {
    const msg = res.error.message || '';
    const i = pending.findIndex(g => g.some(c => msg.includes(c)));
    if (i < 0) break;
    const [group] = pending.splice(i, 1);
    current = Object.fromEntries(Object.entries(current).filter(([k]) => !group.includes(k)));
    res = await write(current);
  }
  return res;
}
