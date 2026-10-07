import React from 'react';
import { Alert, View } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }), useFocusEffect: () => undefined }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: () => undefined }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { nativeApplicationVersion: '9.7.3' } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => { const animation = { duration: () => animation, delay: () => animation, easing: () => animation }; return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: () => undefined, cubic: undefined } }; });
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('@/theme/sawaa', () => ({ ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: require('react-native').View }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => require('react').createElement(require('react-native').Pressable, props, children) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
let mockReduced = true;
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => mockReduced }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => ({ id: 'client', firstName: 'Test', lastName: 'User', email: 'test@example.com', emailVerified: true }), useAppDispatch: () => jest.fn() }));
jest.mock('@/stores/slices/auth-slice', () => ({ logout: jest.fn(), setUser: jest.fn() }));
jest.mock('@/services/auth', () => ({ authService: { getProfile: jest.fn(), logout: jest.fn() } }));
jest.mock('@/hooks/queries', () => ({ useBranding: () => ({ data: {} }), useSummary: () => ({ data: { totalBookings: 2, lastVisit: '2026-10-07T09:00:00Z', outstandingBalance: 5000 }, refetch: jest.fn() }) }));
jest.mock('@/components/features/auth/UnverifiedEmailBanner', () => ({ UnverifiedEmailBanner: () => null }));
jest.mock('@/hooks/use-notifications', () => ({ useNotifications: () => ({ notifications: [{ id: 'n1', titleAr: 'تذكير', titleEn: 'Reminder', bodyAr: 'تفاصيل', bodyEn: 'Details', createdAt: '2026-10-07T09:00:00Z', type: 'booking_reminder', isRead: false }], unreadCount: 1, loading: false, refreshing: false, refresh: jest.fn(), loadMore: jest.fn(), hasMore: false, loadingMore: false, loadError: false, markAsRead: jest.fn(), markAllAsRead: jest.fn() }) }));
import i18n from '@/i18n';
import ClientProfile from '../../app/(client)/profile';
import EmployeeProfile from '../../app/(employee)/(tabs)/profile';
import Notifications from '../../app/(client)/notifications';

it.each([['ar', 'جلسات', 'آخر زيارة', 'مبلغ مستحق'], ['en', 'Sessions', 'Last visit', 'Outstanding']])('translates client summary labels in %s', async (locale, sessions, lastVisit, outstanding) => {
  await act(async () => { await i18n.changeLanguage(locale); });
  const screen = render(<ClientProfile />);
  for (const label of [sessions, lastVisit, outstanding]) expect(screen.getByText(label)).toBeTruthy();
});
it.each([['ar', 'عن المركز', 'الإصدار 9.7.3', 'سواء'], ['en', 'About the Center', 'Version 9.7.3', 'Sawaa']])('uses the installed employee app version and translated About dialog in %s', async (locale, about, version, name) => {
  await act(async () => { await i18n.changeLanguage(locale); });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const screen = render(<EmployeeProfile />);
  expect(screen.getByText(version)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: about }));
  expect(alert).toHaveBeenCalledWith(name, version);
  alert.mockRestore();
});
it.each([['client profile', ClientProfile], ['employee profile', EmployeeProfile], ['notifications', Notifications]] as const)('%s omits all entering callbacks for reduced motion', (_name, Component) => {
  mockReduced = true;
  const screen = render(<Component />);
  expect(screen.UNSAFE_getAllByType(View).filter((view) => view.props.entering !== undefined)).toHaveLength(0);
});
