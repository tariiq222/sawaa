import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { getFontName, getHeadingFont, fontAssets } from '../fonts';
import { ThemedText } from '../components/ThemedText';

let mockLanguage = 'ar';

jest.mock('../useTheme', () => ({
  useTheme: () => ({
    language: mockLanguage, isRTL: mockLanguage === 'ar',
    theme: { colors: { textPrimary: '#000', textSecondary: '#333' } },
  }),
}));

beforeEach(() => { mockLanguage = 'ar'; });

it('registers the IBM Arabic weights used by body text and headings', () => {
  for (const weight of ['300', '400', '500', '600', '700']) {
    const family = getFontName('ar', weight);
    expect(family).toMatch(/^IBMPlexSansArabic_/);
    expect(fontAssets).toHaveProperty(family);
  }
  expect(getHeadingFont()).toBe('IBMPlexSansArabic_700Bold');
});

it('updates alignment when changing language without changing the native layout basis', () => {
  const { rerender } = render(<ThemedText>موعد</ThemedText>);
  expect(screen.getByText('موعد')).toHaveStyle({ textAlign: 'right', writingDirection: 'rtl' });
  mockLanguage = 'en';
  rerender(<ThemedText>Appointment</ThemedText>);
  expect(screen.getByText('Appointment')).toHaveStyle({ textAlign: 'left', writingDirection: 'ltr' });
  mockLanguage = 'ar';
  rerender(<ThemedText>موعد</ThemedText>);
  expect(screen.getByText('موعد')).toHaveStyle({ textAlign: 'right', writingDirection: 'rtl' });
});

it('renders Arabic body copy with the loaded IBM font and right alignment', () => {
  render(<ThemedText>الإرشاد الأسري</ThemedText>);
  expect(screen.getByText('الإرشاد الأسري')).toHaveStyle({
    fontFamily: 'IBMPlexSansArabic_400Regular',
    textAlign: 'right', writingDirection: 'rtl',
  });
});

it.each(['bodySm', 'label'] as const)('honors explicit %s color', variant => {
  const view = render(<ThemedText variant={variant} color="rebeccapurple">Explicit</ThemedText>);
  expect(view.getByText('Explicit')).toHaveStyle({ color: 'rebeccapurple' });
});
it('forwards native announcement semantics', () => {
  const view = render(<ThemedText accessibilityRole="alert" accessibilityLiveRegion="polite">Offline</ThemedText>);
  expect(view.getByRole('alert').props.accessibilityLiveRegion).toBe('polite');
});
it('gives caller style color precedence over explicit color', () => {
  const view = render(<ThemedText color="red" style={{ color: 'blue' }}>Styled</ThemedText>);
  expect(view.getByText('Styled')).toHaveStyle({ color: 'blue' });
});
