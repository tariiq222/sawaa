import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockRouteParams: Record<string, string> = { id: 'dr-example' };
let mockDirectClinic = false;
let mockEmployeeError = false;
let mockCatalogError = false;
const mockEmployeeRetry = jest.fn();
const mockCatalogRetry = jest.fn();
let mockServiceGroup = false;
const mockEmployee: { publicBioEn: string | null; [key: string]: unknown } = {
  id: 'employee-uuid', slug: 'dr-example', nameAr: 'سارة', nameEn: 'Sara',
  title: null, specialty: 'Family counseling', specialtyAr: 'إرشاد أسري',
  publicBioAr: null, publicBioEn: null, publicImageUrl: null, gender: null,
  employmentType: 'FULL_TIME', serviceIds: ['service-a', 'service-b'],
  isBookable: true, ratingAverage: null, ratingCount: 0,
  minServicePrice: null, isAvailableToday: false,
};
const mockCatalog = {
  departments: [], categories: [{ id: 'clinic-1', kind: 'CLINIC', bookingMode: 'SERVICES', nameAr: 'عيادة الأسرة', nameEn: 'Family clinic' }], services: [
    { id: 'service-a', categoryId: 'clinic-1', nameAr: 'جلسة فردية', nameEn: 'Individual session', price: 10000, currency: 'SAR' },
    { id: 'service-b', categoryId: 'clinic-1', nameAr: 'جلسة أسرية', nameEn: 'Family session', price: 20000, currency: 'SAR' },
  ],
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockRouteParams,
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light', theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native') as typeof import('react-native');
  const chain = { delay: () => chain, duration: () => chain, easing: () => chain };
  return { __esModule: true, default: { View }, FadeInDown: chain, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return { LinearGradient: View };
});
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left' }) }));
jest.mock('@/hooks/queries', () => ({
  useTherapist: () => ({ isError: mockEmployeeError, refetch: mockEmployeeRetry, data: mockDirectClinic ? { ...mockEmployee, serviceIds: ['direct-service'] } : mockEmployee, isLoading: false }),
  usePublicCatalog: () => ({ isError: mockCatalogError, refetch: mockCatalogRetry, data: mockDirectClinic ? {
    departments: [],
    categories: [{ id: 'direct-clinic', kind: 'CLINIC', bookingMode: 'DIRECT', nameAr: 'عيادة الأسرة', nameEn: 'Family clinic', isActive: true }],
    services: [{ id: 'direct-service', categoryId: 'direct-clinic', nameAr: 'خدمة داخلية', nameEn: 'Internal service', price: 0, currency: 'SAR', isHidden: true, isActive: true }],
  } : mockServiceGroup ? { ...mockCatalog, categories: [{ ...mockCatalog.categories[0], kind: 'SERVICE_GROUP', nameEn: 'Assessments' }] } : mockCatalog, isLoading: false }),
}));
jest.mock('@/services/client/catalog', () => ({ publicCatalogService: { getCatalog: jest.fn() } }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return {
    ...jest.requireActual('@/theme/sawaa/tokens'),
    AquaBackground: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, testID, accessibilityRole, accessibilityState }: { children: React.ReactNode; onPress?: () => void; testID?: string; accessibilityRole?: 'radio'; accessibilityState?: { selected?: boolean } }) => {
    const { Pressable } = require('react-native') as typeof import('react-native');
    return <Pressable onPress={onPress} testID={testID} accessibilityRole={accessibilityRole} accessibilityState={accessibilityState}>{children}</Pressable>;
  },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import EmployeeProfileScreen from '../[id]';

describe('EmployeeProfileScreen', () => {
  beforeEach(() => { mockEmployee.languages = undefined; mockEmployee.experience = undefined; mockEmployee.publicBioEn = null; mockPush.mockClear(); mockRouteParams = { id: 'dr-example' }; mockDirectClinic = false; mockServiceGroup = false; mockEmployeeError = false; mockCatalogError = false; jest.clearAllMocks(); });

  it('shows saved spoken languages and experience on the public biography tab', () => {
    mockEmployee.publicBioEn = 'Biography';
    mockEmployee.languages = ['العربية', 'English'];
    mockEmployee.experience = 8;
    const screen = render(<EmployeeProfileScreen />);
    fireEvent.press(screen.getByText('employeeProfile.about'));
    expect(screen.getByText('employeeSelfProfile.publicLanguages')).toBeTruthy();
    expect(screen.getByText('employeeSelfProfile.publicExperience')).toBeTruthy();
  });

  it('retries employee errors and hides a stale profile booking action', () => {
    mockEmployeeError = true;
    const screen = render(<EmployeeProfileScreen />);
    fireEvent.press(screen.getByText('common.tryAgain'));
    expect(mockEmployeeRetry).toHaveBeenCalled();
    expect(screen.queryByText('employeeProfile.bookAppointment')).toBeNull();
  });

  it('retries catalog errors while keeping missing clinic scope closed', () => {
    mockCatalogError = true;
    mockRouteParams = { id: 'dr-example', clinicId: 'missing' };
    const screen = render(<EmployeeProfileScreen />);
    fireEvent.press(screen.getByText('common.tryAgain'));
    expect(mockCatalogRetry).toHaveBeenCalled();
    expect(screen.queryByText('Individual session')).toBeNull();
    fireEvent.press(screen.getByText('employeeProfile.bookAppointment'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not show invented profile claims or imply that an unknown price is free', () => {
    const screen = render(<EmployeeProfileScreen />);
    expect(screen.queryByText('4.9')).toBeNull();
    expect(screen.queryByText(/412 reviews|980|98%|Noura|General Anxiety|0 ﷼/)).toBeNull();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('books the selected real service with the canonical employee ID', () => {
    const screen = render(<EmployeeProfileScreen />);
    fireEvent.press(screen.getByText('Family session'));
    fireEvent.press(screen.getByText('employeeProfile.bookAppointment'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 'service-b', employeeId: 'employee-uuid', clinicId: 'clinic-1' },
    });
  });

  it('places service choices within their clinic on an unscoped profile', () => {
    const screen = render(<EmployeeProfileScreen />);
    expect(screen.getByText('employeeProfile.clinics')).toBeTruthy();
    const clinic = within(screen.getByTestId('employee-clinic-clinic-1'));
    expect(clinic.getByText('Family clinic')).toBeTruthy();
    expect(clinic.getByText('Individual session')).toBeTruthy();
    expect(clinic.getByText('Family session')).toBeTruthy();
  });

  it('shows service group context without presenting it as a clinic', () => {
    mockServiceGroup = true;
    const screen = render(<EmployeeProfileScreen />);
    expect(screen.queryByText('employeeProfile.clinics')).toBeNull();
    expect(screen.getAllByText('employeeProfile.services')).toHaveLength(1); // the tab only
    expect(screen.queryByText('employeeProfile.clinics')).toBeNull();
    expect(screen.getByText('Assessments')).toBeTruthy();
    fireEvent.press(screen.getByText('Family session'));
    fireEvent.press(screen.getByText('employeeProfile.bookAppointment'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 'service-b', employeeId: 'employee-uuid' },
    });
  });

  it('does not broaden an invalid clinic link to the practitioner services', () => {
    mockRouteParams = { id: 'dr-example', clinicId: 'missing' };
    const screen = render(<EmployeeProfileScreen />);
    expect(screen.queryByText('Family session')).toBeNull();
    expect(screen.getByText('employeeProfile.noServices')).toBeTruthy();
    fireEvent.press(screen.getByText('employeeProfile.bookAppointment'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('retains clinic context when booking a service selected from clinic detail', () => {
    mockRouteParams = { id: 'dr-example', clinicId: 'clinic-1', serviceId: 'service-b' };
    const screen = render(<EmployeeProfileScreen />);
    fireEvent.press(screen.getByText('employeeProfile.bookAppointment'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 'service-b', employeeId: 'employee-uuid', clinicId: 'clinic-1' },
    });
  });

  it('carries the direct clinic into booking when the profile was opened without clinic context', () => {
    mockDirectClinic = true;
    const screen = render(<EmployeeProfileScreen />);
    expect(within(screen.getByTestId('employee-clinic-direct-clinic')).getAllByText('Family clinic')).toHaveLength(1);
    expect(screen.queryByText('Internal service')).toBeNull();
    fireEvent.press(screen.getByText('employeeProfile.bookAppointment'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 'direct-service', employeeId: 'employee-uuid', clinicId: 'direct-clinic' },
    });
  });

  it('opens on the about tab when there is a bio and nothing to choose, and switches to the services tab', () => {
    mockEmployee.publicBioEn = 'Works with families.';
    mockRouteParams = { id: 'dr-example', serviceId: 'service-a' };
    const screen = render(<EmployeeProfileScreen />);
    expect(screen.getByText('Works with families.')).toBeTruthy();
    expect(screen.queryByText('Individual session')).toBeNull();
    fireEvent.press(screen.getByRole('tab', { name: 'employeeProfile.services' }));
    expect(screen.getByText('Individual session')).toBeTruthy();
    expect(screen.queryByText('Works with families.')).toBeNull();
  });

  it('opens on services with a disabled choose-to-continue button until one of several services is chosen', () => {
    mockEmployee.publicBioEn = 'Works with families.';
    const screen = render(<EmployeeProfileScreen />);
    expect(screen.getByText('employeeProfile.selectBookingOption')).toBeTruthy();
    // A choice is needed, so the profile opens on the services tab even with a bio.
    expect(screen.queryByText('Works with families.')).toBeNull();
    expect(screen.queryByText('employeeProfile.bookAppointment')).toBeNull();
    fireEvent.press(screen.getByText('employeeProfile.chooseToContinue'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'employeeProfile.chooseToContinue' }).props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByText('Individual session'));
    // The chosen row stays visible and the button now books.
    expect(screen.getByText('Individual session')).toBeTruthy();
    fireEvent.press(screen.getByText('employeeProfile.bookAppointment'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 'service-a', employeeId: 'employee-uuid', clinicId: 'clinic-1' },
    });
  });

  it('forwards steps from the therapist step to the time step', () => {
    mockRouteParams = { id: 'dr-example', serviceId: 'service-a', clinicId: 'clinic-1', steps: '4' };
    const screen = render(<EmployeeProfileScreen />);
    fireEvent.press(screen.getByText('employeeProfile.bookAppointment'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 'service-a', employeeId: 'employee-uuid', clinicId: 'clinic-1', steps: '4' },
    });
  });
});
