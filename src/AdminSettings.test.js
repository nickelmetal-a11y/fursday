import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => Promise.resolve({ data: [{ key: 'support_phone', value: '919315578325' }, { key: 'support_whatsapp', value: 'YOUR_REAL_NUMBER' }] }),
      upsert: (rows, opts) => { global.__upserts.push({ rows, opts }); return Promise.resolve({ error: null }); },
    }),
  },
}));

const { default: AdminSettings, normalizeIndianNumber } = require('./AdminSettings');

beforeEach(() => { global.__upserts = []; });

test('normalizes Indian numbers to country code + digits', () => {
  expect(normalizeIndianNumber('98765 43210')).toBe('919876543210');
  expect(normalizeIndianNumber('+91-98765-43210')).toBe('919876543210');
  expect(normalizeIndianNumber('YOUR_REAL_NUMBER')).toBeNull();
  expect(normalizeIndianNumber('12345')).toBeNull();
});

test('refuses to save an invalid number', async () => {
  render(<AdminSettings />);
  fireEvent.click(await screen.findByText('Save'));
  expect(await screen.findByText(/Support WhatsApp must be a 10-digit/)).toBeInTheDocument();
  expect(global.__upserts).toHaveLength(0);
});

test('saves both numbers normalized', async () => {
  render(<AdminSettings />);
  fireEvent.change(await screen.findByLabelText('Support WhatsApp'), { target: { value: '98111 22233' } });
  fireEvent.click(screen.getByText('Save'));
  await waitFor(() => expect(global.__upserts).toHaveLength(1));
  expect(global.__upserts[0].opts).toEqual({ onConflict: 'key' });
  expect(global.__upserts[0].rows.map(r => [r.key, r.value])).toEqual([['support_phone', '919315578325'], ['support_whatsapp', '919811122233']]);
  expect(await screen.findByText(/Saved/)).toBeInTheDocument();
});
