// Columns added by migration 035. Until it runs on production, PostgREST rejects
// a write that names any of them ("Could not find the 'headline' column ...
// in the schema cache"); we then save the rest instead of failing the save.
export const SITTER_035_COLUMNS = ['headline', 'highlights', 'base_area', 'base_pincode', 'service_radius_km', 'profile_updated_at'];

export async function writeWithFallback(write, row, optionalColumns = SITTER_035_COLUMNS) {
  const res = await write(row);
  const msg = res?.error?.message || '';
  if (res?.error && /column|schema cache/i.test(msg) && optionalColumns.some(c => msg.includes(c))) {
    const trimmed = { ...row };
    optionalColumns.forEach(c => { delete trimmed[c]; });
    return write(trimmed);
  }
  return res;
}
