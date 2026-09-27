import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockRouteParams: Record<string, string> = { id: 'dr-example' };
let mockDirectClinic = false;
let mockServiceGroup = false;
const mockEmployee = {
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
  useTherapist: () => ({ data: mockDirectClinic ? { ...mockEmployee, serviceIds: ['direct-service'] } : mockEmployee, isLoading: false }),
  usePublicCatalog: () => ({ data: mockDirectClinic ? {
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
    AquaBackground: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    sawaaColors: { ink: { 400: '#888', 500: '#555', 700: '#333', 900: '#000' }, teal: { 500: '#098', 600: '#087', 700: '#076' }, accent: { amber: '#fa0', sky: '#acf', violet: '#aaf', rose: '#faa' }, glass: { opaqueBg: '#fff' } },
    sawaaRadius: { pill: 999, xl: 24 },
  };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => require('@/theme/sawaa').sawaaColors,
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
  beforeEach(() => { mockPush.mockClear(); mockRouteParams = { id: 'dr-example' }; mockDirectClinic = false; mockServiceGroup = false; });

  it('does not show invented profile claims or imply that an unknown price is free', () => {
    const screen = render(<EmployeeProfileScreen />);
    expect(screen.queryByText('4.9')).toBeNull();
    expect(screen.queryByText(/412 reviews|980|98%|Noura|General Anxiety|0 ﷼/)).toBeNull();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('books the selected real service with the canonical employee ID', () => {
    const screen = render(<EmployeeProfileScreen />);
    fireEvent.press(screen.getByText('Family session'));
    fireEvent.press(screen.getByText('employeeProfile.bookNow'));
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
    expect(screen.getByText('employeeProfile.services')).toBeTruthy();
    expect(screen.getByText('Assessments')).toBeTruthy();
    fireEvent.press(screen.getByText('Family session'));
    fireEvent.press(screen.getByText('employeeProfile.bookNow'));
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
    fireEvent.press(screen.getByText('employeeProfile.bookNow'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('retains clinic context when booking a service selected from clinic detail', () => {
    mockRouteParams = { id: 'dr-example', clinicId: 'clinic-1', serviceId: 'service-b' };
    const screen = render(<EmployeeProfileScreen />);
    fireEvent.press(screen.getByText('employeeProfile.bookNow'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 'service-b', employeeId: 'employee-uuid', clinicId: 'clinic-1' },
    });
  });

  it('carries the direct clinic into booking when the profile was opened without clinic context', () => {
    mockDirectClinic = true;
    const screen = render(<EmployeeProfileScreen />);
    expect(screen.getAllByText('Family clinic')).toHaveLength(1);
    expect(screen.queryByText('Internal service')).toBeNull();
    fireEvent.press(screen.getByText('employeeProfile.bookNow'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 'direct-service', employeeId: 'employee-uuid', clinicId: 'direct-clinic' },
    });
  });
});
