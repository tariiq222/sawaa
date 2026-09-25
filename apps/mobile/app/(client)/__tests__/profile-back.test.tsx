import React from 'react';
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', setThemeMode: jest.fn(), isRTL: true, language: 'ar' }),
}));
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
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
jest.mock('@/hooks/queries', () => ({ useSummary: () => ({ data: null }), useBranding: () => ({ data: null }) }));
jest.mock('@/constants/config', () => ({ PRIVACY_POLICY_URL: 'https://example.com' }));
jest.mock('@/components/features/settings/DeleteAccountButton', () => ({ DeleteAccountButton: () => null }));

import ProfileScreen from '../profile';

describe('client profile screen escape route', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exposes a back control that returns to the previous screen', () => {
    const screen = render(<ProfileScreen />);
    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
