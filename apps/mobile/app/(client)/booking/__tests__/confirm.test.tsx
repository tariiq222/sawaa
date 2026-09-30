import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRetryMethods = jest.fn();
let mockMethodsLoading = false;
let mockMethodsError = false;
let mockCatalogError = false;
let mockPaymentMethods = { moyasarEnabled: true, atClinicEnabled: true };
(globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = false;
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
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  const chain = { delay: () => chain, duration: () => chain, easing: () => chain };
  return { __esModule: true, default: { View: NativeView }, FadeInDown: chain, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('lucide-react-native', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { Calendar: NativeView, ChevronLeft: NativeView, ChevronRight: NativeView, Clock: NativeView, Video: NativeView, CreditCard: NativeView, Apple: NativeView, Banknote: NativeView, Building2: NativeView, Check: NativeView };
});
jest.mock('react-i18next', () => ({
  __esModule: true,
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (key: string) => ({ 'payment.methodsLoading': 'Loading payment methods…', 'payment.methodsError': 'Could not load payment methods', 'payment.methodsUnavailable': 'No payment methods are currently available', 'common.retry': 'Retry' }[key] ?? key) }),
}));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: () => (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn === true }));
jest.mock('@/hooks/queries', () => ({
  useCatalogDepartments: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
  usePublicCatalog: () => ({ data: mockCatalog, isLoading: false, isError: mockCatalogError, refetch: jest.fn() }),
  useBankTransferSettings: () => ({ data: undefined, refetch: jest.fn() }),
  usePublicPaymentMethods: () => ({ data: mockPaymentMethods, isLoading: mockMethodsLoading, isError: mockMethodsError, refetch: mockRetryMethods }),
}));
const mockBookingCreate = jest.fn();
jest.mock('@/services/client/bookings', () => ({
  clientBookingsService: { create: (...args: unknown[]) => mockBookingCreate(...args) },
}));
jest.mock('@/features/booking/payment-resume-state', () => ({
  bookingPaymentDraft: () => ({ branchId: 'branch-1' }),
  savePendingBookingCheckout: jest.fn().mockResolvedValue(undefined),
  resolvePendingBookingResume: jest.fn().mockResolvedValue({ kind: 'missing' }),
}));
jest.mock('@/constants/config', () => ({ APP_SCHEME: 'sawa' }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
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
  const { Pressable } = require('react-native') as typeof import('react-native');
  // Forward onPress so option cards (payment methods) stay interactive in tests.
  return {
    Glass: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) =>
      <Pressable onPress={onPress}>{children}</Pressable>,
  };
});
jest.mock('@/components/features/booking/BookingStepHeader', () => ({ BookingStepHeader: () => null }));
jest.mock('@/components/ui/EmptyState', () => {
  const { Text, Pressable } = require('react-native') as typeof import('react-native');
  return { EmptyState: ({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) => <><Text>{title}</Text>{onAction ? <Pressable onPress={onAction}><Text>{actionLabel}</Text></Pressable> : null}</> };
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
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), selectionAsync: jest.fn(), impactAsync: jest.fn(), NotificationFeedbackType: { Success: 'success' }, ImpactFeedbackStyle: { Light: 'light' } }));

import BookingConfirmScreen from '../confirm';

describe('BookingConfirmScreen direct clinic service', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBookingCreate.mockReset();
    mockMethodsLoading = false;
    mockMethodsError = false;
    mockCatalogError = false;
    mockRetryMethods.mockClear();
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = false;
    mockPaymentMethods = { moyasarEnabled: true, atClinicEnabled: true };
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

  it('offers pay-at-center to a signed-in client and books without online payment', async () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockBookingCreate.mockResolvedValue({ id: 'booking-1', invoiceId: null });
    const screen = render(<BookingConfirmScreen />);

    expect(screen.getByText('Pay at the center')).toBeTruthy();
    fireEvent.press(screen.getByText('Pay at the center'));
    // The CTA carries the amount; method subtitles also start with "Pay".
    fireEvent.press(screen.getAllByText(/Pay .*450/)[0]);

    await waitFor(() => expect(mockBookingCreate).toHaveBeenCalled());
    expect(mockBookingCreate.mock.calls[0][0]).toMatchObject({ payAtClinic: true });
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const destination = mockReplace.mock.calls[0][0] as { pathname: string; params: { bookingId: string } };
    expect(destination.pathname).toBe('/(client)/booking/success');
    expect(destination.params.bookingId).toBe('booking-1');
  });

  it('hides pay-at-center and online methods the deployment cannot complete', () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockPaymentMethods = { moyasarEnabled: false, atClinicEnabled: false };
    const screen = render(<BookingConfirmScreen />);

    expect(screen.queryByText('Pay at the center')).toBeNull();
    expect(screen.queryByText('Credit card')).toBeNull();
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
  it.each(['wrong-service', 'missing-price', 'invalid-date', 'catalog-error'])('blocks signed-in submission for %s', async (invalid) => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    if (invalid === 'wrong-service') mockRouteParams.serviceId = 'other-service';
    if (invalid === 'missing-price') mockRouteParams.chargedPrice = undefined;
    if (invalid === 'invalid-date') mockRouteParams.scheduledAt = 'invalid';
    if (invalid === 'catalog-error') mockCatalogError = true;
    const screen = render(<BookingConfirmScreen />);
    fireEvent.press(screen.getByText(/^Pay \d/));
    await waitFor(() => expect(mockBookingCreate).not.toHaveBeenCalled());
  });

  it('shows payment loading separately and disables submission', () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockMethodsLoading = true;
    const screen = render(<BookingConfirmScreen />);
    expect(screen.getByText('Loading payment methods…')).toBeTruthy();
    expect(screen.queryByText('Credit card')).toBeNull();
    fireEvent.press(screen.getByText(/^Pay /));
    expect(mockBookingCreate).not.toHaveBeenCalled();
  });

  it('shows failed payment capabilities with retry instead of a disabled-method state', () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockMethodsError = true;
    const screen = render(<BookingConfirmScreen />);
    expect(screen.getByText('Could not load payment methods')).toBeTruthy();
    expect(screen.queryByText('Credit card')).toBeNull();
    fireEvent.press(screen.getByText('Retry'));
    expect(mockRetryMethods).toHaveBeenCalledTimes(1);
  });

  it('explains when loaded payment methods are all disabled', () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockPaymentMethods = { moyasarEnabled: false, atClinicEnabled: false };
    const screen = render(<BookingConfirmScreen />);
    expect(screen.getByText('No payment methods are currently available')).toBeTruthy();
    expect(screen.queryByText('Could not load payment methods')).toBeNull();
  });

  it('retains pay-at-center after a guest returns from authentication to confirmation', async () => {
    const screen = render(<BookingConfirmScreen />);
    fireEvent.press(screen.getByText('Sign in or register to continue'));
    const draft = JSON.parse(mockPush.mock.calls[0][0].params.booking);
    mockRouteParams = { ...draft, chargedPrice: draft.amount };
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockBookingCreate.mockResolvedValue({ id: 'booking-after-auth', invoiceId: null });
    screen.rerender(<BookingConfirmScreen />);
    fireEvent.press(screen.getByText('Pay at the center'));
    fireEvent.press(screen.getByText(/^Pay .*450/));
    await waitFor(() => expect(mockBookingCreate).toHaveBeenCalledWith(expect.objectContaining({ payAtClinic: true })));
  });

});
