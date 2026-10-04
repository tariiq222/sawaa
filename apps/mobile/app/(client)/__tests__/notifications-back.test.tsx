import React from 'react';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: false, language: 'en' }) }));
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
const mockBack = jest.fn();
const mockPush = jest.fn();
const mockMarkAsRead = jest.fn();
let mockNotifications: import('@/types/models').Notification[] = [];
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'ar', isRTL: true, row: 'row-reverse', textAlign: 'right' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => {
  const { View } = require('react-native');
  return { ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: View };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').Pressable }));
jest.mock('@/hooks/use-notifications', () => ({
  useNotifications: () => ({
    notifications: mockNotifications, unreadCount: mockNotifications.filter((n) => !n.isRead).length, refreshing: false, refresh: jest.fn(), loadMore: jest.fn(),
    hasMore: false, loadingMore: false, loadError: false, markAsRead: mockMarkAsRead, markAllAsRead: jest.fn(),
  }),
}));
jest.mock('@/utils/notification-deeplink', () => ({ resolveNotificationHref: () => '/(client)/appointment/booking-1' }));

import NotificationsScreen from '../notifications';

describe('notifications screen escape route', () => {
  beforeEach(() => { jest.clearAllMocks(); mockNotifications = []; });

  it('shows notification content and marks the selected notification read before navigation', () => {
    mockNotifications = [{
      id: 'n1', userId: 'u1', type: 'booking_confirmed',
      titleAr: 'تم تأكيد الموعد', titleEn: 'Appointment confirmed',
      bodyAr: 'موعدك غداً', bodyEn: 'Your appointment is tomorrow',
      isRead: false, createdAt: new Date().toISOString(), metadata: { bookingId: 'booking-1' },
    }];
    const screen = render(<NotificationsScreen />);
    expect(screen.getByText('تم تأكيد الموعد')).toBeTruthy();
    expect(screen.getByText('موعدك غداً')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/تم تأكيد الموعد\. موعدك غداً/));
    expect(mockMarkAsRead).toHaveBeenCalledWith('n1');
    expect(mockPush).toHaveBeenCalledWith('/(client)/appointment/booking-1');
  });

  it('exposes a back control that returns to the previous screen', () => {
    const screen = render(<NotificationsScreen />);
    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
