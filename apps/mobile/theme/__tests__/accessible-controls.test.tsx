import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ThemedButton } from '../components/ThemedButton';
import { ThemedCard } from '../components/ThemedCard';
import { PrimaryButton } from '../sawaa/PrimaryButton';
import { NotificationItem } from '../../components/features/NotificationItem';

jest.mock('../useTheme', () => ({
  useTheme: () => ({
    language: 'en',
    scheme: 'light',
    theme: require('../tokens').buildTheme(),
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      'notifications.unread': 'Unread',
      'notifications.read': 'Read',
      'notifications.minutesAgo': '1m ago',
    })[key] ?? key,
  }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const notification = {
  id: 'notification-1',
  type: 'booking_confirmed',
  titleAr: 'تأكيد الموعد',
  titleEn: 'Booking confirmed',
  bodyAr: 'تم تأكيد موعدك',
  bodyEn: 'Your booking is confirmed',
  isRead: false,
  createdAt: new Date().toISOString(),
} as never;

describe('shared control accessibility', () => {
  it('exposes disabled state on the primary button', () => {
    render(<PrimaryButton label="Continue" disabled onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('exposes disabled and busy states while a themed button is loading', () => {
    render(<ThemedButton onPress={jest.fn()} loading>Continue</ThemedButton>);

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Continue' }).props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it('exposes selected state on an interactive themed card', () => {
    render(<ThemedCard onPress={jest.fn()} selected>Selected appointment</ThemedCard>);

    expect(screen.getByRole('button').props.accessibilityState).toEqual({ selected: true });
  });

  it('includes read status in the notification button label', () => {
    render(
      <NotificationItem
        notification={notification}
        onPress={jest.fn()}
        language="en"
      />,
    );

    expect(screen.getByRole('button', { name: /Booking confirmed.*Your booking is confirmed.*Unread/ })).toBeTruthy();
  });
});
