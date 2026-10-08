import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockHeaderProps: unknown;
let mockIsRTL = false;
let mockOptions = [
  { deliveryType: 'IN_PERSON', durationOptionId: 'd1', durationMins: 45, price: 30000, currency: 'SAR', label: null },
  { deliveryType: 'ONLINE', durationOptionId: 'd2', durationMins: 30, price: 20000, currency: 'SAR', label: 'Video' },
];

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ clinicId: 'c1', serviceId: 's1', employeeId: 'e1', steps: '4' }),
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  const chain = { delay: () => chain, duration: () => chain, easing: () => chain };
  return { __esModule: true, default: { View: NativeView }, FadeInDown: chain, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('lucide-react-native', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { Building2: NativeView, Check: NativeView, ChevronLeft: NativeView, ChevronRight: NativeView, Video: NativeView };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: { count?: string }) => (key === 'booking.minutes' ? `${vars?.count} min` : key),
  }),
}));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ locale: mockIsRTL ? 'ar' : 'en', isRTL: mockIsRTL, row: 'row', textAlign: 'left', writingDirection: 'ltr' }),
}));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => true }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/lib/navigation', () => ({ goBackOrHome: jest.fn() }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/theme/sawaa', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  const actual = jest.requireActual('@/theme/sawaa');
  return { ...actual, AquaBackground: ({ children }: { children: React.ReactNode }) => <NativeView>{children}</NativeView>, withAlpha: (c: string) => c };
});
jest.mock('@/theme/components/Glass', () => {
  const { Pressable } = require('react-native') as typeof import('react-native');
  return { Glass: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => <Pressable onPress={onPress}>{children}</Pressable> };
});
jest.mock('@/components/ui/SectionHeader', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return { SectionHeader: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/components/ui/EmptyState', () => ({ EmptyState: () => null }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/features/booking/BookingStepHeader', () => ({
  BookingStepHeader: (props: unknown) => { mockHeaderProps = props; return null; },
}));
jest.mock('@/components/features/booking/DaySelector', () => ({ DaySelector: () => null }));
jest.mock('@/components/features/booking/TimeSlotsGrid', () => ({ TimeSlotsGrid: () => null }));
jest.mock('@/components/features/booking/BookingCta', () => {
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  return { BookingCta: ({ onConfirm }: { onConfirm: () => void }) => <Pressable onPress={onConfirm}><Text>go</Text></Pressable> };
});
jest.mock('@/features/booking/booking-options', () => ({
  getPractitionerBookingOptions: () => Promise.resolve({ options: mockOptions }),
  toMobileDeliveryType: (type: string) => (type === 'ONLINE' ? 'online' : 'in_person'),
}));
jest.mock('@/features/booking/use-booking-slots', () => ({
  useBookingSlots: () => ({
    days: [], dayIdx: 0, availabilityByDate: { a: true }, setDayIdx: jest.fn(), daysLoading: false, daysError: null,
    handleRetryDays: jest.fn(), loading: false, error: null, slots: [], slotIdx: 0, setSlotIdx: jest.fn(),
    handleRetry: jest.fn(), clearSelection: jest.fn(), selectedDay: null, branchId: 'b1',
    selectedSlot: { startTime: '2026-10-02T10:00:00.000Z' },
  }),
}));

import BookingTypeScreen from '../[serviceId]';

describe('BookingTypeScreen', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockIsRTL = false;
    mockOptions = [
      { deliveryType: 'IN_PERSON', durationOptionId: 'd1', durationMins: 45, price: 30000, currency: 'SAR', label: null },
      { deliveryType: 'ONLINE', durationOptionId: 'd2', durationMins: 30, price: 20000, currency: 'SAR', label: 'Video' },
    ];
  });

  it('titles options by visit type with localized minutes and the backend label', async () => {
    const screen = render(<BookingTypeScreen />);
    await waitFor(() => expect(screen.getByText('booking.inPerson')).toBeTruthy());
    expect(screen.getByText('45 min')).toBeTruthy();
    expect(screen.getByText('booking.online')).toBeTruthy();
    expect(screen.getByText('30 min · Video')).toBeTruthy();
    expect(mockHeaderProps).toMatchObject({ step: 3, total: 4, title: 'booking.chooseAppointment' });
  });

  it('uses Arabic-Indic digits for minutes in RTL', async () => {
    mockIsRTL = true;
    const screen = render(<BookingTypeScreen />);
    await waitFor(() => expect(screen.getByText('٤٥ min')).toBeTruthy());
  });

  it('forwards steps to the confirm route', async () => {
    const screen = render(<BookingTypeScreen />);
    await waitFor(() => expect(screen.getByText('booking.inPerson')).toBeTruthy());
    fireEvent.press(screen.getByText('booking.inPerson'));
    fireEvent.press(screen.getByText('go'));
    expect(mockPush.mock.calls[0][0].params).toMatchObject({ steps: '4', clinicId: 'c1' });
  });

  it('drops a backend label that only repeats the duration, in Latin or Arabic-Indic digits', async () => {
    mockIsRTL = true;
    mockOptions = [
      { deliveryType: 'IN_PERSON', durationOptionId: 'd1', durationMins: 60, price: 30000, currency: 'SAR', label: '60 دقيقة' },
      { deliveryType: 'ONLINE', durationOptionId: 'd2', durationMins: 30, price: 20000, currency: 'SAR', label: '٣٠ دقيقة' },
    ];
    const screen = render(<BookingTypeScreen />);
    await waitFor(() => expect(screen.getByText('٦٠ min')).toBeTruthy());
    expect(screen.getByText('٣٠ min')).toBeTruthy();
    expect(screen.queryByText(/·/)).toBeNull();
  });
});
