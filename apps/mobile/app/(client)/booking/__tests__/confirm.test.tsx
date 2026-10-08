jest.mock('react-native-moyasar-sdk/lib/module/specs/RTNSamsungPayNativeComponent.android', () => ({ SAMSUNG_PAY_BUTTON_COMPONENT_NAME: 'RTNSamsungPayButton' }));
jest.mock('react-native/Libraries/Settings/Settings', () => ({ __esModule: true, default: { get: (key: string) => key === 'AppleLanguages' ? ['en'] : 'en' } }));
jest.mock('react-native-webview', () => ({ WebView: 'WebView' }));
jest.mock('@/features/payments/native-payment-capabilities', () => ({ useNativePaymentCapabilities: () => ({ enabled: true, applePayAvailable: mockAppleAvailable, isLoading: false, isError: false, refetch: jest.fn() }) }), { virtual: true });
import React from 'react';
import { createTestQueryEnvironment } from '@/test-utils/query-wrapper';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRetryMethods = jest.fn();
let mockAppleAvailable = false;
const mockShowWallet = jest.fn();
const mockInitNative = jest.fn();
const mockGetBooking = jest.fn();
let mockLowLevelProps: Record<string, unknown>;
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { applePayMerchantId: 'merchant.test' } } } }));
jest.mock('@/modules/sawaa-payments', () => ({ canUseApplePay: () => true }));
jest.mock('react-native-moyasar-sdk/src/react_native_apple_pay', () => ({
  ApplePayButton: (props: Record<string, unknown>) => {
    mockLowLevelProps = props;
    const { Pressable, Text } = require('react-native');
    return <Pressable onPress={props.onPress}><Text>Native Wallet action</Text></Pressable>;
  },
  PaymentRequest: class { show() { return mockShowWallet(); } },
}));
jest.mock('@/services/client/payments', () => ({ clientPaymentsService: { initNativePayment: (...args: unknown[]) => mockInitNative(...args), reconcileNativePayment: jest.fn() } }));
let mockMethodsLoading = false;
let mockMethodsError = false;
let mockCatalogError = false;
let mockHeaderProps: unknown;
const mockClinics = [
  { id: 'clinic-1', nameAr: 'عيادة الرشد', nameEn: 'Growth Clinic' },
  { id: 'clinic-2', nameAr: 'عيادة أخرى', nameEn: 'Other Clinic' },
];
const mockTherapists = [{ id: 'employee-1', nameAr: 'د. سارة', nameEn: 'Dr. Sara' }];
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
  steps?: string;
} = {
  clinicId: 'clinic-1', serviceId: 'direct-service', employeeId: 'employee-1',
  branchId: 'branch-1', deliveryType: 'in_person', scheduledAt: '2026-10-01T10:00:00.000Z',
  chargedPrice: '45000', currency: 'SAR',
};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockRouteParams,
  useFocusEffect: () => {}, useRouter: () => ({ push: mockPush, back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  const chain = { delay: () => chain, duration: () => chain, easing: () => chain };
  return { __esModule: true, default: { View: NativeView }, FadeInDown: chain, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('lucide-react-native', () => {
  const { View: NativeView } = require('react-native') as typeof import('react-native');
  return { Calendar: NativeView, ChevronLeft: NativeView, ChevronRight: NativeView, Clock: NativeView, Video: NativeView, Stethoscope: NativeView, CreditCard: NativeView, Apple: NativeView, Banknote: NativeView, Building2: NativeView, UserRound: NativeView, Check: NativeView };
});
jest.mock('react-i18next', () => ({
  __esModule: true,
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({ t: (key: string, options?: import('i18next').TOptions) => require('@/test-utils/translation').translatedTestMessage(key, 'en', options) }),
}));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (select: (state: { auth: { token: string | null; user: { id: string } | null } }) => unknown) => {
  const signedIn = (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn === true;
  return select({ auth: { token: signedIn ? 'test-token' : null, user: signedIn ? { id: 'client-1' } : null } });
} }));
jest.mock('@/hooks/queries', () => ({
  useCatalogDepartments: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
  usePublicCatalog: () => ({ data: mockCatalog, isLoading: false, isError: mockCatalogError, refetch: jest.fn() }),
  useClinics: () => ({ data: mockClinics }),
  useTherapists: () => ({ data: mockTherapists }),
  useBankTransferSettings: () => ({ data: undefined, refetch: jest.fn() }),
  usePublicPaymentMethods: () => ({ data: mockPaymentMethods, isLoading: mockMethodsLoading, isError: mockMethodsError, refetch: mockRetryMethods }),
}));
const mockBookingCreate = jest.fn();
jest.mock('@/services/client/bookings', () => ({
  clientBookingsService: { create: (...args: unknown[]) => mockBookingCreate(...args), getById: (...args: unknown[]) => mockGetBooking(...args) },
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
jest.mock('@/components/features/booking/BookingStepHeader', () => ({
  BookingStepHeader: (props: unknown) => { mockHeaderProps = props; return null; },
}));
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
let queries: ReturnType<typeof createTestQueryEnvironment>;
afterEach(() => queries.client.clear());
describe('BookingConfirmScreen direct clinic service', () => {
  beforeEach(() => {
    queries = createTestQueryEnvironment();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBookingCreate.mockReset();
    mockAppleAvailable = false; mockShowWallet.mockReset(); mockInitNative.mockReset(); mockGetBooking.mockReset();
    mockMethodsLoading = false;
    mockMethodsError = false;
    mockCatalogError = false;
    mockHeaderProps = undefined;
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
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });

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
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });

    expect(screen.getByText('Confirm and pay at the center')).toBeTruthy();
    fireEvent.press(screen.getByText('Confirm and pay at the center'));

    await waitFor(() => expect(mockBookingCreate).toHaveBeenCalled());
    expect(mockBookingCreate.mock.calls[0][0]).toMatchObject({ payAtClinic: true });
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const destination = mockReplace.mock.calls[0][0] as { pathname: string; params: { bookingId: string } };
    expect(destination.pathname).toBe('/(client)/booking/success');
    expect(destination.params.bookingId).toBe('booking-1');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens the native Wallet with one action from confirmation, without a payment route', async () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockAppleAvailable = true;
    mockBookingCreate.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1' });
    mockGetBooking.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-1', status: 'pending' });
    mockInitNative.mockResolvedValue({ paymentId: 'payment', invoiceId: 'invoice-1', config: {
      enabled: true, isLive: false, supportedNetworks: ['mada', 'visa', 'mastercard'],
      applePay: { merchantId: 'merchant.test', countryCode: 'SA', label: 'Sawa' },
      publishableKey: 'pk_test_fixture', givenId: 'a0000000-0000-4000-8000-000000000001', amount: 30000, currency: 'SAR', description: 'Invoice',
    } });
    mockShowWallet.mockRejectedValue(new Error('AbortError'));
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    expect(mockBookingCreate).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('Native Wallet action'));
    await waitFor(() => expect(mockShowWallet).toHaveBeenCalledTimes(1));
    expect(mockBookingCreate).toHaveBeenCalledTimes(1);
    expect(mockInitNative).toHaveBeenCalledWith('invoice-1', 'APPLE_PAY');
    expect(mockPush).not.toHaveBeenCalled(); expect(mockReplace).not.toHaveBeenCalled();
    expect(mockLowLevelProps.type).toBe('inStore');
    screen.unmount();
  });

  it('removes only Apple Pay when disabled and removes online actions when online payment is disabled', () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockAppleAvailable = true;
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    expect(screen.getByText('Native Wallet action')).toBeTruthy();
    mockAppleAvailable = false;
    screen.rerender(<BookingConfirmScreen />);
    expect(screen.queryByText('Native Wallet action')).toBeNull();
    expect(screen.getByText('Pay with cards')).toBeTruthy();
    mockPaymentMethods.moyasarEnabled = false;
    screen.rerender(<BookingConfirmScreen />);
    expect(screen.queryByText('Pay with cards')).toBeNull();
    expect(screen.getByText('Confirm and pay at the center')).toBeTruthy();
    expect(mockBookingCreate).not.toHaveBeenCalled();
  });

  it('hides pay-at-center and online methods the deployment cannot complete', () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockPaymentMethods = { moyasarEnabled: false, atClinicEnabled: false };
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });

    expect(screen.queryByText('Pay at the center')).toBeNull();
    expect(screen.queryByText('Credit card')).toBeNull();
  });

  it('does not substitute a service from another clinic when the scoped service is invalid', () => {
    mockRouteParams = { ...mockRouteParams, serviceId: 'other-service' };
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });

    expect(screen.getByText('Service unavailable')).toBeTruthy();
    expect(screen.queryByText('Wrong service')).toBeNull();
    fireEvent.press(screen.getByText('Sign in or register to continue'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('resolves a visible category-less supporting service from raw public catalog data', () => {
    mockRouteParams = { ...mockRouteParams, clinicId: undefined, serviceId: 'supporting-service', chargedPrice: undefined };
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });

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
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    expect(screen.queryByText('Pay with cards')).toBeNull();
    await waitFor(() => expect(mockBookingCreate).not.toHaveBeenCalled());
  });

  it('shows payment loading separately and disables submission', () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockMethodsLoading = true;
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    expect(screen.getByText('Loading payment methods…')).toBeTruthy();
    expect(screen.queryByText('Credit card')).toBeNull();
    expect(screen.queryByText('Pay with cards')).toBeNull();
    expect(mockBookingCreate).not.toHaveBeenCalled();
  });

  it('shows failed payment capabilities with retry instead of a disabled-method state', () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockMethodsError = true;
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    expect(screen.getByText('Could not load payment methods')).toBeTruthy();
    expect(screen.queryByText('Credit card')).toBeNull();
    fireEvent.press(screen.getByText('Retry'));
    expect(mockRetryMethods).toHaveBeenCalledTimes(1);
  });

  it('explains when loaded payment methods are all disabled', () => {
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockPaymentMethods = { moyasarEnabled: false, atClinicEnabled: false };
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    expect(screen.getByText('No payment methods are currently available')).toBeTruthy();
    expect(screen.queryByText('Could not load payment methods')).toBeNull();
  });

  it('retains pay-at-center after a guest returns from authentication to confirmation', async () => {
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    fireEvent.press(screen.getByText('Sign in or register to continue'));
    const draft = JSON.parse(mockPush.mock.calls[0][0].params.booking);
    mockRouteParams = { ...draft, chargedPrice: draft.amount };
    (globalThis as { __mockSignedIn?: boolean }).__mockSignedIn = true;
    mockBookingCreate.mockResolvedValue({ id: 'booking-after-auth', invoiceId: null });
    screen.rerender(<BookingConfirmScreen />);
    fireEvent.press(screen.getByText('Confirm and pay at the center'));
    await waitFor(() => expect(mockBookingCreate).toHaveBeenCalledWith(expect.objectContaining({ payAtClinic: true })));
  });
  it('shows the specialist and omits the clinic row when the service row already names the direct clinic', () => {
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    expect(screen.getByText('Specialist')).toBeTruthy();
    expect(screen.getByText('Dr. Sara')).toBeTruthy();
    expect(screen.queryByText('Clinic')).toBeNull();
    expect(screen.getAllByText('Growth Clinic')).toHaveLength(1);
  });

  it('shows clinic and specialist rows for a services-mode clinic', () => {
    mockRouteParams = { ...mockRouteParams, clinicId: 'clinic-2', serviceId: 'other-service' };
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    expect(screen.getByText('Clinic')).toBeTruthy();
    expect(screen.getByText('Other Clinic')).toBeTruthy();
    expect(screen.getByText('Wrong service')).toBeTruthy();
    expect(screen.getByText('Dr. Sara')).toBeTruthy();
  });

  it('omits the specialist row when the therapist cannot be resolved', () => {
    mockRouteParams = { ...mockRouteParams, employeeId: 'unknown' };
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    expect(screen.queryByText('Specialist')).toBeNull();
  });

  it('numbers the header from steps and forwards steps through sign-in', () => {
    mockRouteParams = { ...mockRouteParams, steps: '3' };
    const screen = render(<BookingConfirmScreen />, { wrapper: queries.wrapper });
    expect(mockHeaderProps).toMatchObject({ step: 3, total: 3 });
    fireEvent.press(screen.getByText('Sign in or register to continue'));
    expect(JSON.parse(mockPush.mock.calls[0][0].params.booking)).toMatchObject({ steps: '3' });
  });

});
