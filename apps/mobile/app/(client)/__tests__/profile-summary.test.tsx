import React from 'react';
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', setThemeMode: jest.fn(), isRTL: true, language: 'ar' }),
}));
import { render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => {
  const { View } = require('react-native');
  return { ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: View };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: () => ({ firstName: 'نورة', lastName: 'ا', email: 'n@example.com' }),
}));
jest.mock('@/services/auth', () => ({ authService: { logout: jest.fn() } }));
jest.mock('@/constants/config', () => ({ PRIVACY_POLICY_URL: 'https://example.com' }));
jest.mock('@/components/features/settings/DeleteAccountButton', () => ({ DeleteAccountButton: () => null }));

const summary = {
  totalBookings: 7,
  lastVisit: '2026-04-01T00:00:00.000Z',
  // Integer halalas on the wire: 12000 halalas === 120.00 SAR.
  outstandingBalance: 12000,
};
jest.mock('@/hooks/queries', () => ({
  useSummary: () => ({ data: summary, refetch: jest.fn() }),
  useBranding: () => ({ data: null }),
}));

import ProfileScreen from '../profile';
import { formatCurrencyAmount } from '@/lib/currency-display';

describe('client profile summary stats', () => {
  it('renders the outstanding balance as SAR, not raw halalas', () => {
    const screen = render(<ProfileScreen />);

    // 12000 halalas must never surface as "12,000".
    expect(screen.queryByText(/12,000/)).toBeNull();

    const balance = screen.getByText(/ر\.س/);
    const text = Array.isArray(balance.props.children)
      ? balance.props.children.join('')
      : String(balance.props.children);
    // The rendered figure is the SAR-major amount (120), never the raw 12000.
    expect(text).toBe(formatCurrencyAmount(12000, 'SAR', true));
  });
});
