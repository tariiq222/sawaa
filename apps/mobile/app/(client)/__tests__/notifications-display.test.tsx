import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { DirContext, buildDirState, type Locale } from '@/hooks/useDir';
import type { Notification } from '@/types/models';
import ar from '@/i18n/ar.json';
import en from '@/i18n/en.json';

jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: true, language: 'ar' }) }));
jest.mock('@/theme/sawaa', () => ({ ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: require('react-native').View }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').Pressable }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }), useFocusEffect: jest.fn() }));
const mockLoadMore = jest.fn();
const mockMarkAllRead = jest.fn();
let mockState = {
  notifications: [] as Notification[], unreadCount: 0, loading: false, refreshing: false,
  refresh: jest.fn(), loadMore: mockLoadMore, hasMore: false, loadingMore: false,
  loadError: false, markAsRead: jest.fn(), markAllAsRead: mockMarkAllRead,
};
jest.mock('@/hooks/use-notifications', () => ({ useNotifications: () => mockState }));

import NotificationsScreen from '../notifications';

const notification: Notification = {
  id: 'n1', userId: 'u1', type: 'system_alert', isRead: false,
  titleAr: 'تحديث مهم بشأن موعد الاستشارة الأسرية المقبل ورابط الانضمام',
  bodyAr: 'راجع تفاصيل موعدك يوم الثلاثاء الساعة 10:30 عبر Zoom. '.repeat(8),
  titleEn: 'An important update about your next consultation appointment',
  bodyEn: 'Review the appointment details for Tuesday at 10:30 via Zoom. '.repeat(8),
  createdAt: '2026-09-28T10:00:00Z',
};

async function renderScreen(locale: Locale = 'ar') {
  const i18n = createInstance();
  await i18n.use(initReactI18next).init({
    resources: { ar: { translation: ar }, en: { translation: en } },
    lng: locale, fallbackLng: 'en', interpolation: { escapeValue: false },
  });
  return render(
    <I18nextProvider i18n={i18n}>
      <DirContext.Provider value={buildDirState(locale)}><NotificationsScreen /></DirContext.Provider>
    </I18nextProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = { ...mockState, notifications: [], unreadCount: 0, loading: false, refreshing: false, loadError: false, hasMore: false };
});

it.each(['ar', 'en'] as const)('keeps complete long %s notification text in the correct writing direction', async (locale) => {
  mockState.notifications = [notification];
  mockState.unreadCount = 1;
  await renderScreen(locale);
  const title = locale === 'ar' ? notification.titleAr : notification.titleEn;
  const body = locale === 'ar' ? notification.bodyAr : notification.bodyEn;
  for (const text of [title, body]) {
    expect(screen.getByText(text)).toHaveStyle({ textAlign: locale === 'ar' ? 'right' : 'left', writingDirection: locale === 'ar' ? 'rtl' : 'ltr' });
    expect(screen.getByText(text).props.numberOfLines).toBeUndefined();
  }
  expect(screen.getByLabelText(new RegExp(`^${title}.*${locale === 'ar' ? 'غير مقروء' : 'Unread'}$`))).toBeTruthy();
});

it('shows loading rather than an empty inbox during the initial request', async () => {
  mockState.loading = true;
  await renderScreen();
  expect(screen.getByText(ar.common.loading)).toBeTruthy();
  expect(screen.queryByText(ar.notifications.noNotifications)).toBeNull();
  expect(screen.queryByText('لا توجد إشعارات لعرضها')).toBeNull();
});

it('shows a recoverable load error without claiming that the inbox is empty', async () => {
  mockState.loadError = true;
  await renderScreen();
  expect(screen.getByText(ar.notifications.loadError)).toHaveStyle({ writingDirection: 'rtl' });
  expect(screen.queryByText(ar.notifications.noNotifications)).toBeNull();
  expect(screen.queryByText('لا توجد إشعارات لعرضها')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: ar.common.retry }));
  expect(mockLoadMore).toHaveBeenCalledTimes(1);
});

it.each([
  [0, 'لا إشعارات جديدة'], [1, 'إشعار جديد واحد'], [2, 'إشعاران جديدان'],
  [3, '3 إشعارات جديدة'], [11, '11 إشعارًا جديدًا'], [100, '100 إشعار جديد'],
])('uses the Arabic unread count form for %s', async (count, label) => {
  mockState.unreadCount = count as number;
  await renderScreen();
  expect(screen.getByText(label as string)).toBeTruthy();
});

it('distinguishes an empty unread filter from an empty inbox', async () => {
  mockState.notifications = [{ ...notification, isRead: true }];
  await renderScreen();
  fireEvent.press(screen.getByRole('tab', { name: ar.notifications.unreadFilter }));
  expect(screen.getByText(ar.notifications.noUnread)).toBeTruthy();
  expect(screen.queryByText(notification.titleAr)).toBeNull();
  fireEvent.press(screen.getByRole('tab', { name: ar.notifications.all }));
  expect(screen.getByText(notification.titleAr)).toBeTruthy();
});

it('retains loaded notifications when the next page fails', async () => {
  mockState.notifications = [notification];
  mockState.loadError = true;
  await renderScreen();
  expect(screen.getByText(notification.titleAr)).toBeTruthy();
  expect(screen.getByText(ar.notifications.loadError)).toBeTruthy();
});

it.each([[0, 'الآن'], [5, 'منذ 5 د'], [120, 'منذ 2 س'], [2880, 'منذ 2 ي']])(
  'localizes a notification timestamp %s minutes ago', async (minutes, label) => {
    mockState.notifications = [{ ...notification, createdAt: new Date(Date.now() - (minutes as number) * 60_000).toISOString() }];
    await renderScreen();
    expect(screen.getByText(label as string)).toHaveStyle({ writingDirection: 'rtl' });
  },
);

it('labels the mark-all action clearly and calls it once', async () => {
  mockState.unreadCount = 2;
  await renderScreen();
  fireEvent.press(screen.getByRole('button', { name: ar.notifications.markAllRead }));
  expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
});
