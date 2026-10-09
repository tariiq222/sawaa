import React from 'react';
import { act, render } from '@testing-library/react-native';
jest.mock('expo-application', () => ({ nativeApplicationVersion: null, nativeBuildVersion: null }));
jest.mock('expo-constants', () => {
 const actual = jest.requireActual('expo-constants');
 return { ...actual, __esModule: true, default: { ...actual.default, nativeApplicationVersion: null, nativeBuildVersion: null, expoConfig: null, platform: null } };
});
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => undefined }));
jest.mock('@/services/auth', () => ({ authService: { getProfile: jest.fn(), logout: jest.fn() } }));
jest.mock('@/components/features/auth/UnverifiedEmailBanner', () => ({ UnverifiedEmailBanner: () => null }));
jest.mock('@/stores/slices/auth-slice', () => ({ logout: jest.fn(), setUser: jest.fn() }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => ({ firstName: 'Sara', lastName: 'A', email: 'sara@example.com' }), useAppDispatch: () => jest.fn() }));

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
jest.mock('expo-router', () => ({
 useLocalSearchParams: () => ({ id: 'client-1' }), useRouter: () => ({ push: jest.fn(), back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }), router: { back: (...args: unknown[]) => mockBack(...args), replace: (...args: unknown[]) => mockReplace(...args), canGoBack: () => mockCanGoBack },
}));

jest.mock('@/hooks/useA11y', () => ({
  useReduceMotion: () => true,
  useReducedTransparency: () => false,
  useIncreasedContrast: () => false,
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light'), scheme: 'light' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = () => {
    const builder: Record<string, unknown> = {};
    for (const method of ['delay', 'duration', 'easing']) builder[method] = () => builder;
    return builder;
  };
  return {
    __esModule: true,
    default: { View },
    FadeInDown: chain(),
    Easing: { out: () => undefined, cubic: undefined },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: unknown) => value,
    withRepeat: (value: unknown) => value,
  };
});

jest.mock('@/theme/sawaa', () => {
  const actual = jest.requireActual('@/theme/sawaa');
  return {
    ...actual,
    AquaBackground: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});
jest.mock('@/theme/components/Glass', () => {
  const { View } = require('react-native');
  return { Glass: ({ children, ...props }: { children?: React.ReactNode }) => <View {...props}>{children}</View> };
});

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/hooks/queries/usePushPreference', () => ({ usePushPreference: () => ({ query: { data: undefined, isPending: false, isError: false, refetch: jest.fn() }, mutation: { mutateAsync: jest.fn(), isPending: false } }) }));
jest.mock('@/hooks/queries/useClientProfile', () => ({ useUpdateClientProfile: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));





import i18n from '@/i18n';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
const mockApplication = Application as unknown as { nativeApplicationVersion: string | null; nativeBuildVersion: string | null };
const mockConstants = Constants as unknown as { nativeApplicationVersion?: string | null; nativeBuildVersion?: string | null; expoConfig?: { version?: string; ios?: { buildNumber?: string } } | null };
import ProfileScreen from '../profile';
beforeEach(() => {
 mockApplication.nativeApplicationVersion = null; mockApplication.nativeBuildVersion = null;
 delete mockConstants.nativeApplicationVersion; delete mockConstants.nativeBuildVersion; delete mockConstants.expoConfig;
});
it.each(['ar', 'en'])('shows native version/build and localized About in %s', async locale => {
 mockApplication.nativeApplicationVersion = '2.3.4'; mockApplication.nativeBuildVersion = '42';
 await act(async () => { await i18n.changeLanguage(locale); });
 const view = render(<ProfileScreen />);
 expect(view.getByText('2.3.4')).toBeTruthy(); expect(view.getByText('42')).toBeTruthy();
 expect(view.getByText(i18n.t('settings.about'))).toBeTruthy();
 expect(view.getByText(i18n.t('settings.version'))).toBeTruthy();
 expect(view.queryByText(/1\.0\.0/)).toBeNull();
});
it('uses Expo config when native metadata is absent', async () => {
 mockConstants.expoConfig = { version: '2.4.0', ios: { buildNumber: '43' } };
 await act(async () => { await i18n.changeLanguage('en'); });
 const view = render(<ProfileScreen />);
 expect(view.getByText('2.4.0')).toBeTruthy(); expect(view.getByText('43')).toBeTruthy();
 expect(view.queryByText(/1\.0\.0/)).toBeNull();
});
it('shows unknown values when metadata is absent', async () => {
 await act(async () => { await i18n.changeLanguage('en'); });
 const view = render(<ProfileScreen />);
 expect(view.getAllByText('—')).toHaveLength(2); expect(view.queryByText(/1\.0\.0/)).toBeNull();
});
