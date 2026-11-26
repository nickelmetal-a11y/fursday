/**
 * Unit tests for AdminPromotions.js — the AdminPanel tab that lets an admin
 * declare a promo code and feature it on the app's home-screen banner.
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AdminPromotions from './AdminPromotions';

jest.mock('./supabase', () => {
  const listChain = {
    select: () => listChain,
    order: () => Promise.resolve({ data: global.__promos }),
  };
  const updateChain = {
    eq: (col, val) => { global.__updateCalls.push({ col, val }); return Promise.resolve({ error: null }); },
  };
  const deleteChain = {
    eq: (col, val) => { global.__deleteCalls.push({ col, val }); return Promise.resolve({ error: null }); },
  };
  const promoCodesTable = {
    select: () => listChain,
    update: (fields) => { global.__updateFieldsCalls.push(fields); return updateChain; },
    insert: (fields) => { global.__insertCalls.push(fields); return Promise.resolve({ error: global.__insertError }); },
    delete: () => deleteChain,
  };
  return {
    supabase: {
      from: (table) => {
        if (table === 'promo_codes') return promoCodesTable;
        throw new Error('unexpected table: ' + table);
      },
    },
  };
});

beforeEach(() => {
  global.__promos = [
    { id: 'promo-1', code: 'WELCOME100', discount_amount: 100, discount_percent: 0, max_discount_amount: null, min_booking_amount: 0, status: 'active', featured_home: true, times_used: 3, valid_until: new Date(Date.now() + 86400000).toISOString(), description: 'First booking credit' },
    { id: 'promo-2', code: 'DIWALI20', discount_amount: null, discount_percent: 20, max_discount_amount: 200, min_booking_amount: 300, status: 'paused', featured_home: false, times_used: 0, valid_until: new Date(Date.now() + 86400000).toISOString(), description: null },
  ];
  global.__updateCalls = [];
  global.__updateFieldsCalls = [];
  global.__deleteCalls = [];
  global.__insertCalls = [];
  global.__insertError = null;
});

test('lists existing promo codes with discount summary and home-page badge', async () => {
  render(<AdminPromotions />);
  expect(await screen.findByText('WELCOME100')).toBeInTheDocument();
  expect(screen.getByText('DIWALI20')).toBeInTheDocument();
  expect(screen.getByText(/Rs\.100 off/)).toBeInTheDocument();
  expect(screen.getByText(/20% off/)).toBeInTheDocument();
  expect(screen.getByText('ON HOME PAGE')).toBeInTheDocument();
});

test('shows an empty state when there are no promotions', async () => {
  global.__promos = [];
  render(<AdminPromotions />);
  expect(await screen.findByText('No promotions yet.')).toBeInTheDocument();
});

test('creating a promotion with no code shows a validation error and does not insert', async () => {
  render(<AdminPromotions />);
  await screen.findByText('WELCOME100');
  fireEvent.click(screen.getByText('+ New promotion'));
  fireEvent.click(screen.getByText('Create promotion'));
  expect(await screen.findByText('Enter a code')).toBeInTheDocument();
  expect(global.__insertCalls).toHaveLength(0);
});

test('creating a flat-amount promotion inserts the expected row and un-features the old one first', async () => {
  render(<AdminPromotions />);
  await screen.findByText('WELCOME100');
  fireEvent.click(screen.getByText('+ New promotion'));
  fireEvent.change(screen.getByPlaceholderText('e.g. DIWALI2026'), { target: { value: 'holi50' } });
  fireEvent.change(screen.getByPlaceholderText('e.g. 100'), { target: { value: '50' } });
  fireEvent.click(screen.getByText('Create promotion'));

  await waitFor(() => expect(global.__insertCalls).toHaveLength(1));
  expect(global.__insertCalls[0]).toMatchObject({
    code: 'HOLI50',
    discount_amount: 50,
    discount_percent: 0,
    featured_home: true,
  });
  // featuredHome defaults to checked, so the old featured promo is cleared first.
  expect(global.__updateFieldsCalls[0]).toEqual({ featured_home: false });
});

test('"Show on home" un-features every other promo before featuring this one', async () => {
  render(<AdminPromotions />);
  await screen.findByText('DIWALI20');
  const showOnHomeButtons = screen.getAllByText('Show on home');
  fireEvent.click(showOnHomeButtons[0]); // DIWALI20 is the non-featured one

  await waitFor(() => expect(global.__updateFieldsCalls).toContainEqual({ featured_home: true }));
  expect(global.__updateFieldsCalls[0]).toEqual({ featured_home: false });
});

// Delete confirms in an in-page dialog (was window.confirm).
test('deleting a promo asks for confirmation and issues a delete', async () => {
  render(<AdminPromotions />);
  await screen.findByText('WELCOME100');
  fireEvent.click(screen.getAllByText('Delete')[0]);
  const dialog = screen.getByRole('alertdialog', { name: 'Delete WELCOME100?' });
  expect(global.__deleteCalls).toHaveLength(0);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete promo' }));
  await waitFor(() => expect(global.__deleteCalls).toContainEqual({ col: 'id', val: 'promo-1' }));
});

test('deleting is skipped if the confirmation is declined', async () => {
  render(<AdminPromotions />);
  await screen.findByText('WELCOME100');
  fireEvent.click(screen.getAllByText('Delete')[0]);
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(global.__deleteCalls).toHaveLength(0);
});
