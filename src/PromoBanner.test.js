import { render, screen, fireEvent } from '@testing-library/react';
import PromoBanner from './PromoBanner';

test('renders a flat-amount promo with its code and banner text', () => {
  render(<PromoBanner promo={{ code: 'WELCOME100', discount_amount: 100, description: 'on your first booking' }} onUse={() => {}} />);
  expect(screen.getByText(/Get ₹100 off/)).toBeInTheDocument();
  expect(screen.getByText('on your first booking')).toBeInTheDocument();
  expect(screen.getByText(/WELCOME100/)).toBeInTheDocument();
});

test('renders a percent promo when there is no flat amount', () => {
  render(<PromoBanner promo={{ code: 'DIWALI20', discount_amount: null, discount_percent: 20 }} onUse={() => {}} />);
  expect(screen.getByText(/Get 20% off/)).toBeInTheDocument();
});

test('"Book now" hands control back to the caller, and tapping the code copies it', () => {
  const onUse = jest.fn();
  const writeText = jest.fn();
  Object.assign(navigator, { clipboard: { writeText } });
  render(<PromoBanner promo={{ code: 'WELCOME100', discount_amount: 100 }} onUse={onUse} />);

  fireEvent.click(screen.getByText('Book now'));
  expect(onUse).toHaveBeenCalled();

  fireEvent.click(screen.getByLabelText('Copy WELCOME100'));
  expect(writeText).toHaveBeenCalledWith('WELCOME100');
  expect(screen.getByText(/Copied!/)).toBeInTheDocument();
});
