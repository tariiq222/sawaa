import React from 'react';
import { render } from '@testing-library/react-native';

let mockSignedIn = false;
let mockCanGoBack = false;
let mockParams: Record<string, string> = { kind: 'clinics' };
const mockPush = jest.fn();
const mockClinics = [{ id: 'clinic-1', nameAr: 'عيادة', nameEn: 'Clinic', serviceIds: ['service-1'] }];
const mockTherapists = [{ id: 'employee-1', slug: 'sara', nameAr: 'سارة', nameEn: 'Sara', title: 'أخصائية إرشاد تربوي وأسري', publicBioAr: 'إرشاد الوالدين وتحديات الأطفال والمراهقين', serviceIds: ['service-1', 'service-2'] }];
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack, push: mockPush }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockSignedIn ? 'token' : null } }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: true, row: 'row-reverse', textAlign: 'right', locale: 'ar' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ AquaBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) => {
    const { Pressable } = require('react-native');
    return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{children}</Pressable>;
  },
}));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => ({ teal: { 700: 'teal' }, ink: { 900: 'black', 500: 'grey' } }) }));
jest.mock('@/hooks/queries', () => ({
  useClinics: () => ({ data: mockClinics, isLoading: false }),
  useTherapists: () => ({ data: mockTherapists, isLoading: false }),
  useGroupSessions: () => ({ data: [], isLoading: false }),
  usePackageFamilies: () => ({ data: [], isLoading: false }),
}));

import PublicListScreen from '../public-list/[kind]';

it('returns to public home when a list has no history entry', () => {
  mockSignedIn = false;
  mockCanGoBack = false;
  mockReplace.mockClear();
  mockBack.mockClear();
  const screen = render(<PublicListScreen />);
  const { fireEvent } = require('@testing-library/react-native');
  fireEvent.press(screen.getByRole('button', { name: 'a11y.buttonBack' }));
  expect(mockReplace).toHaveBeenCalledWith('/home');
  expect(mockBack).not.toHaveBeenCalled();
});

it('opens guest clinic cards on the public clinic route', () => {
  mockSignedIn = false;
  mockParams = { kind: 'clinics' };
  const screen = render(<PublicListScreen />);
  const { fireEvent } = require('@testing-library/react-native');
  fireEvent.press(screen.getByRole('button', { name: 'عيادة' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/public-clinic/[id]', params: { id: 'clinic-1' } });
});

it('keeps clinic and selected service context when opening a guest practitioner detail', () => {
  mockSignedIn = false;
  mockParams = { kind: 'therapists', clinicId: 'clinic-1', serviceId: 'service-1' };
  mockPush.mockClear();
  const screen = render(<PublicListScreen />);
  const { fireEvent } = require('@testing-library/react-native');
  fireEvent.press(screen.getByRole('button', { name: 'سارة' }));
  expect(screen.getByText('أخصائية إرشاد تربوي وأسري')).toBeTruthy();
  expect(screen.getByText('إرشاد الوالدين وتحديات الأطفال والمراهقين')).toBeTruthy();
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/public-detail/[kind]/[id]',
    params: { kind: 'therapist', id: 'sara', clinicId: 'clinic-1', serviceId: 'service-1' },
  });
});
