import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NotificationItem } from '../features/NotificationItem';
import type { Notification } from '@/types/models';

let mockLanguage = 'ar';
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ language: mockLanguage, isRTL: mockLanguage === 'ar', theme: require('@/theme/tokens').buildTheme() }),
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));

const notification: Notification = {
  id: 'n1', userId: 'u1', type: 'system_alert', isRead: false,
  titleAr: 'تفاصيل مهمة بشأن موعد الاستشارة الأسرية المقبل', titleEn: 'Important appointment details',
  bodyAr: 'راجع تفاصيل الموعد ورابط Zoom الساعة 10:30 قبل الانضمام. '.repeat(10),
  bodyEn: 'Review the appointment details and Zoom link before joining. '.repeat(10),
  createdAt: new Date().toISOString(),
};

it.each(['ar', 'en'] as const)('mirrors the %s row and does not truncate notification content', (language) => {
  mockLanguage = language;
  const onPress = jest.fn();
  render(<NotificationItem notification={notification} language={language} onPress={onPress} />);
  const button = screen.getByRole('button');
  expect(button).toHaveStyle({ flexDirection: language === 'ar' ? 'row-reverse' : 'row' });
  for (const text of language === 'ar' ? [notification.titleAr, notification.bodyAr] : [notification.titleEn, notification.bodyEn]) {
    expect(screen.getByText(text).props.numberOfLines).toBeUndefined();
    expect(screen.getByText(text)).toHaveStyle({ writingDirection: language === 'ar' ? 'rtl' : 'ltr' });
  }
  fireEvent.press(button);
  expect(onPress).toHaveBeenCalledWith(notification.id);
});
