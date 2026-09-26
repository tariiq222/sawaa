import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockClinics = { data: [{ id: 'clinic-42', nameAr: 'عيادة القلق', nameEn: 'Anxiety Clinic', therapistCount: 2, serviceCount: 1, serviceIds: ['service-1'], bookingMode: 'SERVICES', directServiceId: null }], isLoading: false };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/queries', () => ({ useClinics: () => mockClinics }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: null } }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: false, row: 'row', textAlign: 'left' }) }));
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/components/ui/LocalizedHorizontalScroll', () => ({ LocalizedHorizontalScroll: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) => {
  const { Pressable } = require('react-native');
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{children}</Pressable>;
} }));

import { FeaturedClinics } from '../FeaturedClinics';

describe('FeaturedClinics', () => {
  it('opens the combined clinic detail with the actual clinic id', () => {
    const screen = render(<FeaturedClinics dir={{ isRTL: false, row: 'row', textAlign: 'left' } as never} f600="System" f700="System" />);
    fireEvent.press(screen.getByRole('button', { name: 'Anxiety Clinic' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/public-clinic/[id]', params: { id: 'clinic-42' } });
  });
});
