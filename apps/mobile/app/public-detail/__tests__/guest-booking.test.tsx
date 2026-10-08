import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { decodeRedirect } from '@/lib/navigation';

const mockTherapistsRetry = jest.fn();
let mockTherapistsError = false;
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSignedIn = false;
let mockKind = 'service';
let mockId = 'service-1';
let mockClinicId: string | undefined;
let mockServiceId: string | undefined;
let mockSteps: string | undefined;
let mockCategoryKind = 'CLINIC';
let mockBookingMode = 'SERVICES';
let mockPackageExtra: Record<string, unknown> = {};

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => false, replace: mockReplace }),
  useLocalSearchParams: () => ({ kind: mockKind, id: mockId, clinicId: mockClinicId, serviceId: mockServiceId, steps: mockSteps }),
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: false, locale: 'en', textAlign: 'left' }) }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockSignedIn ? 'token' : null } }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({
  ...jest.requireActual('@/theme/sawaa/tokens'),
  AquaBackground: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, onPress, accessibilityLabel, testID }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string; testID?: string }) => {
  const { Pressable, View } = require('react-native');
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{children}</Pressable> : <View testID={testID}>{children}</View>;
} }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/hooks/queries', () => ({
  usePublicCatalog: () => ({ data: { categories: [{ id: 'clinic-42', kind: mockCategoryKind, bookingMode: mockBookingMode, nameAr: 'عيادة', nameEn: mockCategoryKind === 'SERVICE_GROUP' ? 'Assessments' : 'Clinic' }], services: [{ id: 'service-1', categoryId: 'clinic-42', nameAr: 'خدمة', nameEn: 'Service', price: 10000, isActive: true, isHidden: mockBookingMode === 'DIRECT' }] }, isLoading: false }),
  useTherapists: () => ({ isError: mockTherapistsError, refetch: mockTherapistsRetry, data: [{ id: 'employee-1', nameAr: 'مختصة', nameEn: 'Specialist', serviceIds: ['service-1'], isBookable: true }], isLoading: false }),
  useTherapist: () => ({ data: { id: 'employee-1', nameAr: 'مختصة', nameEn: 'Specialist', serviceIds: ['service-1'], isBookable: true }, isLoading: false }),
  usePackageFamily: () => ({ data: mockKind === 'package' ? { id: mockId, nameAr: 'باقة', nameEn: 'Package', options: [], ...mockPackageExtra } : null, isLoading: false }),
  useGroupSession: () => ({ data: mockKind === 'program' ? { id: mockId, nameAr: 'برنامج', nameEn: 'Program', price: 10000 } : null, isLoading: false }),
}));

import PublicDetailScreen from '../[kind]/[id]';

describe('public appointment discovery', () => {
  beforeEach(() => { mockPush.mockClear(); mockTherapistsRetry.mockClear(); mockReplace.mockClear(); mockTherapistsError = false; mockSignedIn = false; mockKind = 'service'; mockId = 'service-1'; mockClinicId = undefined; mockServiceId = undefined; mockSteps = undefined; mockCategoryKind = 'CLINIC'; mockBookingMode = 'SERVICES'; mockPackageExtra = {}; });

  it('lets a guest choose a specialist and enter booking without signing in', () => {
    const screen = render(<PublicDetailScreen />);
    expect(screen.queryByText('guest.signInToBook')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Specialist' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1', clinicId: 'clinic-42' },
    });
  });

  it('groups a specialist services under the clinic and retains clinic context', () => {
    mockKind = 'therapist'; mockId = 'employee-1';
    const screen = render(<PublicDetailScreen />);
    expect(screen.getByText('employeeProfile.clinics')).toBeTruthy();
    const clinic = within(screen.getByTestId('employee-clinic-clinic-42'));
    expect(clinic.getByText('Clinic')).toBeTruthy();
    expect(clinic.getByRole('button', { name: 'Service' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Service' }));
    fireEvent.press(screen.getByRole('button', { name: 'employeeProfile.bookAppointment' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1', clinicId: 'clinic-42' },
    });
  });

  it('carries clinic and selected service context into guest booking', () => {
    mockKind = 'therapist'; mockId = 'employee-1'; mockClinicId = 'clinic-42'; mockServiceId = 'service-1';
    const screen = render(<PublicDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Service' }));
    fireEvent.press(screen.getByRole('button', { name: 'employeeProfile.bookAppointment' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1', clinicId: 'clinic-42' },
    });
  });

  it('forwards steps from the therapist step to the guest time step', () => {
    mockKind = 'therapist'; mockId = 'employee-1'; mockClinicId = 'clinic-42'; mockServiceId = 'service-1'; mockSteps = '4';
    const screen = render(<PublicDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'employeeProfile.bookAppointment' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1', clinicId: 'clinic-42', steps: '4' },
    });
  });

  it('shows a direct clinic once without exposing its internal service', () => {
    mockKind = 'therapist'; mockId = 'employee-1'; mockBookingMode = 'DIRECT';
    const screen = render(<PublicDetailScreen />);
    expect(within(screen.getByTestId('employee-clinic-clinic-42')).getAllByText('Clinic')).toHaveLength(1);
    expect(screen.queryByText('Service')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Clinic' }));
    fireEvent.press(screen.getByRole('button', { name: 'employeeProfile.bookAppointment' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1', clinicId: 'clinic-42' },
    });
  });

  it('keeps service groups under services and does not send a clinic ID', () => {
    mockKind = 'therapist'; mockId = 'employee-1'; mockCategoryKind = 'SERVICE_GROUP';
    const screen = render(<PublicDetailScreen />);
    expect(screen.queryByText('employeeProfile.clinics')).toBeNull();
    expect(screen.getAllByText('employeeProfile.services')).toHaveLength(1); // the tab only
    expect(screen.queryByText('employeeProfile.clinics')).toBeNull();
    expect(screen.getByText('Assessments')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Service' }));
    fireEvent.press(screen.getByRole('button', { name: 'employeeProfile.bookAppointment' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1' },
    });
  });

  it('keeps an invalid scoped clinic link empty', () => {
    mockKind = 'therapist'; mockId = 'employee-1'; mockClinicId = 'missing';
    const screen = render(<PublicDetailScreen />);
    expect(screen.queryByRole('button', { name: 'Service' })).toBeNull();
    expect(screen.getByText('employeeProfile.noServices')).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it.each([
    ['package', 'package-1', '/(client)/packages/package-1'],
    ['program', 'program-1', '/(client)/groups/program-1'],
  ])('returns to the chosen %s after signing in', (kind, id, destination) => {
    mockKind = kind;
    mockId = id;
    const screen = render(<PublicDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'auth.login' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/login',
      params: { redirect: destination },
    });
    expect(decodeRedirect(mockPush.mock.calls[0][0].params.redirect)).toBe(destination);
  });

  it.each([
    [0, 'Option · 360.00 SAR', false],
    [0.15, 'Option · 414.00 SAR', true],
  ])('shows package option prices with VAT rate %s', (vatRate, priceLine, showsNote) => {
    mockKind = 'package';
    mockId = 'package-1';
    mockPackageExtra = { vatRate, options: [{ id: 'opt', nameAr: 'خيار', nameEn: 'Option', price: { finalPrice: 36000 } }] };
    const screen = render(<PublicDetailScreen />);
    expect(screen.getByText(priceLine)).toBeTruthy();
    expect(Boolean(screen.queryByText('packages.vatIncluded'))).toBe(showsNote);
  });
});

it('shows practitioner read failure without claiming a successful empty result', () => {
  mockKind='service';mockId='service-1';mockTherapistsError=true;mockTherapistsRetry.mockClear();
  const screen=render(<PublicDetailScreen />);expect(screen.queryByText('guest.empty')).toBeNull();
  fireEvent.press(screen.getByRole('button',{name:'common.retry'}));expect(mockTherapistsRetry).toHaveBeenCalledTimes(1);
  mockTherapistsError=false;
});
it('returns a direct public detail entry to guest home', () => {
  mockKind='service';mockId='service-1';mockReplace.mockClear();
  const screen=render(<PublicDetailScreen />);fireEvent.press(screen.getByRole('button',{name:'a11y.buttonBack'}));
  expect(mockReplace).toHaveBeenCalledWith('/(guest)/home');
});
