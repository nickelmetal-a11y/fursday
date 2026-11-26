import { makeReferralCode, isReferralCode, ensureReferralCode } from './ReferralScreen';

jest.mock('./supabase', () => ({ supabase: {} }));

// Minimal client: referrals.select(...).eq().is() and insert().select().single().
function clientWith({ existing = [], insertResults = [] }) {
  const inserts = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ is: () => Promise.resolve({ data: existing, error: null }) }) }),
      insert: (row) => {
        inserts.push(row);
        const result = insertResults[inserts.length - 1] || { data: row, error: null };
        return { select: () => ({ single: () => Promise.resolve(result) }) };
      },
    }),
  };
  return { client, inserts };
}

describe('referral codes', () => {
  test('format is FUR + 5 uppercase letters or digits', () => {
    for (let i = 0; i < 50; i++) expect(makeReferralCode()).toMatch(/^FUR[A-Z0-9]{5}$/);
    expect(makeReferralCode(() => 0)).toBe('FURAAAAA');
    expect(isReferralCode('FURAB123')).toBe(true);
    expect(isReferralCode('FURAB123-u-ana')).toBe(false);
  });

  test('reuses an existing code instead of creating another', async () => {
    const { client, inserts } = clientWith({ existing: [{ referral_code: 'FURKEEP1', referred_user_id: null }] });
    await expect(ensureReferralCode(client, 'u-1')).resolves.toBe('FURKEEP1');
    expect(inserts).toHaveLength(0);
  });

  test('creates a code on first open', async () => {
    const { client, inserts } = clientWith({});
    const code = await ensureReferralCode(client, 'u-1');
    expect(code).toMatch(/^FUR[A-Z0-9]{5}$/);
    expect(inserts).toEqual([{ referrer_id: 'u-1', referral_code: code, status: 'active' }]);
  });

  test('rolls a new code when the first one clashes with the unique constraint', async () => {
    const { client, inserts } = clientWith({ insertResults: [{ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }] });
    const code = await ensureReferralCode(client, 'u-1');
    expect(inserts).toHaveLength(2);
    expect(code).toBe(inserts[1].referral_code);
  });

  test('any other insert error is thrown, not retried', async () => {
    const { client, inserts } = clientWith({ insertResults: [{ data: null, error: { code: '42501', message: 'permission denied' } }] });
    await expect(ensureReferralCode(client, 'u-1')).rejects.toEqual(expect.objectContaining({ code: '42501' }));
    expect(inserts).toHaveLength(1);
  });
});
