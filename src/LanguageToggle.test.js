import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LanguageToggle from './LanguageToggle';
import { useLanguage } from './i18n';

beforeEach(() => {
  localStorage.clear();
});

function Consumer() {
  const { t } = useLanguage();
  return <div data-testid="consumer">{t('welcome')}</div>;
}

test('renders both language buttons', () => {
  render(<LanguageToggle />);
  expect(screen.getByText('EN')).toBeInTheDocument();
  expect(screen.getByText('हिं')).toBeInTheDocument();
});

test('switching language updates every other mounted consumer immediately', () => {
  // This is the real bug being guarded against: useLanguage() used to seed
  // its state from localStorage once and only resync on the cross-tab
  // `storage` event, which never fires in the tab that made the change.
  // Two independently-mounted consumers (the toggle + whichever screen is
  // showing) would silently go out of sync the instant you tapped the
  // toggle. Both must react to the same click without a remount.
  render(
    <>
      <LanguageToggle />
      <Consumer />
    </>
  );

  expect(screen.getByTestId('consumer')).toHaveTextContent('Welcome to Fursday');

  fireEvent.click(screen.getByText('हिं'));

  expect(screen.getByTestId('consumer')).toHaveTextContent('फर्सडे में आपका स्वागत है');
});

test('language choice persists to localStorage', () => {
  render(<LanguageToggle />);
  fireEvent.click(screen.getByText('हिं'));
  expect(localStorage.getItem('fursday_lang')).toBe('hi');
});
