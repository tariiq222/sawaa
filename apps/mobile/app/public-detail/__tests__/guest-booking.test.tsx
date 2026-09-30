import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';
import { decodeRedirect } from '@/lib/navigation';

const mockPush = jest.fn();
let mockSignedIn = false;
let mockKind = 'service';
let mockId = 'service-1';
let mockClinicId: string | undefined;
let mockServiceId: string | undefined;
let mockCategoryKind = 'CLINIC';
let mockBookingMode = 'SERVICES';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ kind: mockKind, id: mockId, clinicId: mockClinicId, serviceId: mockServiceId }),
}));
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
  useTherapists: () => ({ data: [{ id: 'employee-1', nameAr: 'مختصة', nameEn: 'Specialist', serviceIds: ['service-1'], isBookable: true }], isLoading: false }),
  useTherapist: () => ({ data: { id: 'employee-1', nameAr: 'مختصة', nameEn: 'Specialist', serviceIds: ['service-1'], isBookable: true }, isLoading: false }),
  usePackageFamily: () => ({ data: mockKind === 'package' ? { id: mockId, nameAr: 'باقة', nameEn: 'Package', options: [] } : null, isLoading: false }),
  useGroupSession: () => ({ data: mockKind === 'program' ? { id: mockId, nameAr: 'برنامج', nameEn: 'Program', price: 10000 } : null, isLoading: false }),
}));

import PublicDetailScreen from '../[kind]/[id]';

describe('public appointment discovery', () => {
  beforeEach(() => { mockPush.mockClear(); mockSignedIn = false; mockKind = 'service'; mockId = 'service-1'; mockClinicId = undefined; mockServiceId = undefined; mockCategoryKind = 'CLINIC'; mockBookingMode = 'SERVICES'; });

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
    const clinic = within(screen.getByTestId('guest-clinic-clinic-42'));
    expect(clinic.getByText('Clinic')).toBeTruthy();
    expect(clinic.getByRole('button', { name: 'Service' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Service' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1', clinicId: 'clinic-42' },
    });
  });

  it('carries clinic and selected service context into guest booking', () => {
    mockKind = 'therapist'; mockId = 'employee-1'; mockClinicId = 'clinic-42'; mockServiceId = 'service-1';
    const screen = render(<PublicDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Service' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1', clinicId: 'clinic-42' },
    });
  });

  it('shows a direct clinic once without exposing its internal service', () => {
    mockKind = 'therapist'; mockId = 'employee-1'; mockBookingMode = 'DIRECT';
    const screen = render(<PublicDetailScreen />);
    expect(screen.getAllByText('Clinic')).toHaveLength(1);
    expect(screen.queryByText('Service')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Clinic' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1', clinicId: 'clinic-42' },
    });
  });

  it('keeps service groups under services and does not send a clinic ID', () => {
    mockKind = 'therapist'; mockId = 'employee-1'; mockCategoryKind = 'SERVICE_GROUP';
    const screen = render(<PublicDetailScreen />);
    expect(screen.queryByText('employeeProfile.clinics')).toBeNull();
    expect(screen.getByText('employeeProfile.services')).toBeTruthy();
    expect(screen.getByText('Assessments')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Service' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1' },
    });
  });

  it('keeps an invalid scoped clinic link empty', () => {
    mockKind = 'therapist'; mockId = 'employee-1'; mockClinicId = 'missing';
    const screen = render(<PublicDetailScreen />);
    expect(screen.queryByRole('button', { name: 'Service' })).toBeNull();
    expect(screen.getByText('guest.empty')).toBeTruthy();
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
});
