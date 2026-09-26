import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockCatalog = {
  departments: [],
  categories: [
    { id: 'clinic-1', kind: 'CLINIC', bookingMode: 'DIRECT', nameAr: 'عيادة الرشد', nameEn: 'Growth Clinic', isActive: true },
    { id: 'clinic-2', kind: 'CLINIC', bookingMode: 'SERVICES', nameAr: 'عيادة أخرى', nameEn: 'Other Clinic', isActive: true },
  ],
  services: [
    { id: 'direct-service', categoryId: 'clinic-1', nameAr: 'خدمة داخلية سرية', nameEn: 'Hidden internal service', price: 0, currency: 'SAR', isHidden: true, isActive: true },
    { id: 'other-service', categoryId: 'clinic-2', nameAr: 'جلسة غير مختارة', nameEn: 'Wrong service', price: 25000, currency: 'SAR', isActive: true },
    { id: 'supporting-service', categoryId: null, nameAr: 'خدمة مساندة', nameEn: 'Supporting service', price: 12000, currency: 'SAR', isActive: true },
  ],
};
let mockRouteParams: {
  clinicId?: string;
  serviceId: string;
  employeeId: string;
  branchId: string;
  deliveryType: 'in_person';
  scheduledAt: string;
  chargedPrice?: string;
  currency: string;
} = {
  clinicId: 'clinic-1', serviceId: 'direct-service', employeeId: 'employee-1',
  branchId: 'branch-1', deliveryType: 'in_person', scheduledAt: '2026-10-01T10:00:00.000Z',
  chargedPrice: '45000', currency: 'SAR',
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockRouteParams,
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
  return { Calendar: NativeView, ChevronLeft: NativeView, ChevronRight: NativeView, Clock: NativeView, Video: NativeView };
});
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => false }));
jest.mock('@/hooks/queries', () => ({
  useCatalogDepartments: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
  usePublicCatalog: () => ({ data: mockCatalog, isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: { colors: { primaryForeground: '#fff' } } }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/theme/sawaa', () => {
  const { View: NativeView, Pressable, Text } = require('react-native') as typeof import('react-native');
  const actual = jest.requireActual('@/theme/sawaa');
  return {
    ...actual,
    AquaBackground: ({ children }: { children: React.ReactNode }) => <NativeView>{children}</NativeView>,
    sawaaRadius: { ...actual.sawaaRadius, xl: 24 }, sawaaSpacing: { ...actual.sawaaSpacing, md: 12 },
    withAlpha: (color: string) => color,
    PrimaryButton: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) =>
      <Pressable onPress={onPress} disabled={disabled}><Text>{label}</Text></Pressable>,
  };
});
jest.mock('@/theme/components/Glass', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { Glass: ({ children }: { children: React.ReactNode }) => <NativeView>{children}</NativeView> };
});
jest.mock('@/components/features/booking/BookingStepHeader', () => ({ BookingStepHeader: () => null }));
jest.mock('@/components/ui/EmptyState', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return { EmptyState: ({ title }: { title: string }) => <Text>{title}</Text> };
});
jest.mock('@/components/ui/FloatingActionBar', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { FloatingActionBar: ({ children }: { children: React.ReactNode }) => <NativeView>{children}</NativeView> };
});
jest.mock('@/components/ui/Skeleton', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { Skeleton: NativeView };
});
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/lib/navigation', () => ({ goBackOrHome: jest.fn() }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' } }));

import BookingConfirmScreen from '../confirm';

describe('BookingConfirmScreen direct clinic service', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockRouteParams = {
      clinicId: 'clinic-1', serviceId: 'direct-service', employeeId: 'employee-1',
      branchId: 'branch-1', deliveryType: 'in_person', scheduledAt: '2026-10-01T10:00:00.000Z',
      chargedPrice: '45000', currency: 'SAR',
    };
  });

  it('confirms the clinic context and practitioner price without exposing the hidden service label', () => {
    const screen = render(<BookingConfirmScreen />);

    expect(screen.getByText('Growth Clinic')).toBeTruthy();
    expect(screen.queryByText('Hidden internal service')).toBeNull();
    expect(screen.queryByText('Wrong service')).toBeNull();
    expect(screen.getAllByText(/450/).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByText('Sign in or register to continue'));

    const destination = mockPush.mock.calls[0][0] as { pathname: string; params: { booking: string } };
    expect(destination.pathname).toBe('/(auth)/login');
    expect(JSON.parse(destination.params.booking)).toMatchObject({
      clinicId: 'clinic-1', serviceId: 'direct-service', employeeId: 'employee-1', amount: '45000', currency: 'SAR',
    });
  });

  it('does not substitute a service from another clinic when the scoped service is invalid', () => {
    mockRouteParams = { ...mockRouteParams, serviceId: 'other-service' };
    const screen = render(<BookingConfirmScreen />);

    expect(screen.getByText('Service unavailable')).toBeTruthy();
    expect(screen.queryByText('Wrong service')).toBeNull();
    fireEvent.press(screen.getByText('Sign in or register to continue'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('resolves a visible category-less supporting service from raw public catalog data', () => {
    mockRouteParams = { ...mockRouteParams, clinicId: undefined, serviceId: 'supporting-service', chargedPrice: undefined };
    const screen = render(<BookingConfirmScreen />);

    expect(screen.getByText('Supporting service')).toBeTruthy();
    expect(screen.queryByText('Service unavailable')).toBeNull();
    fireEvent.press(screen.getByText('Sign in or register to continue'));
    const destination = mockPush.mock.calls[0][0] as { params: { booking: string } };
    expect(JSON.parse(destination.params.booking)).toMatchObject({ serviceId: 'supporting-service', amount: '12000' });
  });
});
