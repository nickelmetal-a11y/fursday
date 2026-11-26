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
