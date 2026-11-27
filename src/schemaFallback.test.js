import { writeWithFallback } from './schemaFallback';

test('retries without migration-035 columns when production lacks them', async () => {
  const calls = [];
  const write = async (row) => {
    calls.push(row);
    return 'headline' in row ? { error: { message: "Could not find the 'headline' column of 'sitter_profiles' in the schema cache" } } : { data: { id: 1 }, error: null };
  };
  const res = await writeWithFallback(write, { bio: 'Hi', headline: 'Calm walker', service_radius_km: 5 });
  expect(res.error).toBeNull();
  expect(calls[1]).toEqual({ bio: 'Hi' });
});

test('does not retry other errors', async () => {
  const write = jest.fn(async () => ({ error: { message: 'new row violates row-level security policy' } }));
  const res = await writeWithFallback(write, { bio: 'Hi', headline: 'x' });
  expect(write).toHaveBeenCalledTimes(1);
  expect(res.error.message).toMatch(/row-level/);
});

test('drops only the migration-037 columns when 035 is present', async () => {
  const calls = [];
  const write = async (row) => {
    calls.push(row);
    return 'home_details' in row ? { error: { message: "Could not find the 'home_details' column of 'sitter_profiles' in the schema cache" } } : { data: { id: 1 }, error: null };
  };
  const res = await writeWithFallback(write, { bio: 'Hi', headline: 'Host', provider_type: 'boarding', home_details: { ac: true }, home_photos: [] });
  expect(res.error).toBeNull();
  expect(calls).toHaveLength(2);
  expect(calls[1]).toEqual({ bio: 'Hi', headline: 'Host' });
});

test('drops both groups in turn when neither migration has run', async () => {
  const calls = [];
  const write = async (row) => {
    calls.push(row);
    if ('provider_type' in row) return { error: { message: "Could not find the 'provider_type' column of 'sitter_profiles' in the schema cache" } };
    if ('headline' in row) return { error: { message: "Could not find the 'headline' column of 'sitter_profiles' in the schema cache" } };
    return { data: { id: 1 }, error: null };
  };
  const res = await writeWithFallback(write, { bio: 'Hi', headline: 'Host', provider_type: 'both' });
  expect(res.error).toBeNull();
  expect(calls).toHaveLength(3);
  expect(calls[2]).toEqual({ bio: 'Hi' });
});
