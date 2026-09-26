import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockSignedIn = false;
let mockKind = 'service';
let mockId = 'service-1';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ kind: mockKind, id: mockId }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: false, locale: 'en', textAlign: 'left' }) }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockSignedIn ? 'token' : null } }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ AquaBackground: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({
  useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light'),
}));
jest.mock('@/hooks/queries', () => ({
  usePublicCatalog: () => ({ data: { services: [{ id: 'service-1', nameAr: 'خدمة', nameEn: 'Service', price: 10000 }] }, isLoading: false }),
  useTherapists: () => ({ data: [{ id: 'employee-1', nameAr: 'مختصة', nameEn: 'Specialist', serviceIds: ['service-1'], isBookable: true }], isLoading: false }),
  useTherapist: () => ({ data: { id: 'employee-1', nameAr: 'مختصة', nameEn: 'Specialist', serviceIds: ['service-1'], isBookable: true }, isLoading: false }),
  usePackageFamily: () => ({ data: null, isLoading: false }),
  useGroupSession: () => ({ data: null, isLoading: false }),
}));

import PublicDetailScreen from '../[kind]/[id]';

describe('public appointment discovery', () => {
  beforeEach(() => { mockPush.mockClear(); mockSignedIn = false; mockKind = 'service'; mockId = 'service-1'; });

  it('lets a guest choose a specialist and enter booking without signing in', () => {
    const screen = render(<PublicDetailScreen />);
    expect(screen.queryByText('guest.signInToBook')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Specialist' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1' },
    });
  });

  it('lets a guest choose a service from a specialist detail', () => {
    mockKind = 'therapist'; mockId = 'employee-1';
    const screen = render(<PublicDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Service' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 'service-1', employeeId: 'employee-1' },
    });
  });
});
