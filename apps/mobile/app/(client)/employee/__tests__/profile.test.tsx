import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockEmployee = {
  id: 'employee-uuid', slug: 'dr-example', nameAr: 'سارة', nameEn: 'Sara',
  title: null, specialty: 'Family counseling', specialtyAr: 'إرشاد أسري',
  publicBioAr: null, publicBioEn: null, publicImageUrl: null, gender: null,
  employmentType: 'FULL_TIME', serviceIds: ['service-a', 'service-b'],
  isBookable: true, ratingAverage: null, ratingCount: 0,
  minServicePrice: null, isAvailableToday: false,
};
const mockCatalog = {
  departments: [], categories: [], services: [
    { id: 'service-a', categoryId: null, nameAr: 'جلسة فردية', nameEn: 'Individual session', price: 10000, currency: 'SAR' },
    { id: 'service-b', categoryId: null, nameAr: 'جلسة أسرية', nameEn: 'Family session', price: 20000, currency: 'SAR' },
  ],
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'dr-example' }),
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
  useTherapist: () => ({ data: mockEmployee, isLoading: false }),
  usePublicCatalog: () => ({ data: mockCatalog, isLoading: false }),
}));
jest.mock('@/services/client/catalog', () => ({ publicCatalogService: { getCatalog: jest.fn() } }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return {
    AquaBackground: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    sawaaColors: { ink: { 400: '#888', 500: '#555', 700: '#333', 900: '#000' }, teal: { 500: '#098', 600: '#087', 700: '#076' }, accent: { amber: '#fa0', sky: '#acf', violet: '#aaf', rose: '#faa' } },
    sawaaRadius: { pill: 999, xl: 24 },
  };
});
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => require('@/theme/sawaa').sawaaColors,
}));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => {
    const { Pressable } = require('react-native') as typeof import('react-native');
    return <Pressable onPress={onPress}>{children}</Pressable>;
  },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import EmployeeProfileScreen from '../[id]';

describe('EmployeeProfileScreen', () => {
  beforeEach(() => mockPush.mockClear());

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
      params: { serviceId: 'service-b', employeeId: 'employee-uuid' },
    });
  });
});
