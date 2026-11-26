import { render, screen, fireEvent } from '@testing-library/react';
import { TestData } from './AdminUsers';

jest.mock('./supabase', () => ({ supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) } } }));

test('Create Pune test accounts calls the seeder with the admin token and lists the report', async () => {
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, json: async () => ({ step: 'pune', report: ['Created Omkar Joshi (TEST) (sitter), Koregaon Park, 6 km'], notes: ['Run migration 035 to save headline, highlights, base area and radius.'] }) };
  };
  render(<TestData />);
  fireEvent.click(screen.getByText('Create Pune test accounts'));
  expect(await screen.findByText(/Created Omkar Joshi/)).toBeInTheDocument();
  expect(screen.getByText(/Run migration 035/)).toBeInTheDocument();
  expect(calls[0].url).toMatch(/\/api\/seed-test-data$/);
  expect(calls[0].opts.headers.Authorization).toBe('Bearer tok');
  expect(JSON.parse(calls[0].opts.body)).toEqual({ step: 'pune' });
});

test('shows the server error', async () => {
  global.fetch = async () => ({ ok: false, json: async () => ({ error: 'Admins only' }) });
  render(<TestData />);
  fireEvent.click(screen.getByText('Complete test sitter profiles'));
  expect(await screen.findByText('Admins only')).toBeInTheDocument();
});
