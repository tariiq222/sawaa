import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';

const mockPush = jest.fn();
const mockHome = jest.fn();
const mockCards = jest.fn();
const mockCardRefetch = jest.fn();
let mockSignedIn = false;
let mockUserOverride: unknown = undefined;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: true, locale: 'ar', textAlign: 'right', row: 'row', writingDirection: 'rtl' }) }));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      auth: {
        token: mockSignedIn ? 'token' : null,
        user: mockSignedIn
          ? mockUserOverride !== undefined
            ? mockUserOverride
            : { firstName: 'أمل' }
          : null,
      },
    }),
}));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => ({ teal: { 600: 'teal', 700: 'teal' }, ink: { 900: 'black' }, glass: { opaqueBg: 'white' } }) }));
jest.mock('@/theme/sawaa', () => ({ AquaBackground: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/theme/components/Glass', () => ({ Glass: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => onPress ? <>{children}</> : <>{children}</> }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: { View }, Easing: { out: () => null, cubic: () => null }, FadeInDown: { duration: () => ({ easing: () => null, delay: () => ({ duration: () => ({ easing: () => null }) }) }), delay: () => ({ duration: () => ({ easing: () => null }) }) } };
});
jest.mock('@/hooks/queries', () => ({
  useHome: (enabled: boolean) => mockHome(enabled),
  useMobileHomeCards: () => mockCards(),
  useTherapists: () => ({ data: [], refetch: jest.fn() }),
  usePublicCatalog: () => ({ data: { services: [] }, refetch: jest.fn() }),
  useClinics: () => ({ data: [], refetch: jest.fn() }),
  useGroupSessions: () => ({ data: [], refetch: jest.fn() }),
}));
jest.mock('@/components/features/home/HomeAssessmentServices', () => ({ HomeAssessmentServices: () => null }));
jest.mock('@/components/features/home/HomeDiscoveryCards', () => ({ HomeDiscoveryCards: () => null }));
jest.mock('@/components/features/home/HomeTopBar', () => ({ HomeTopBar: () => null }));
jest.mock('@/components/features/home/HomeCardsCarousel', () => ({ HomeCardsCarousel: ({ signedIn }: { signedIn: boolean }) => {
  const { Text } = require('react-native');
  return <Text>{signedIn ? 'cards-client' : 'cards-guest'}</Text>;
} }));
jest.mock('@/components/features/home/UpNextCard', () => ({ UpNextCard: () => null }));
jest.mock('@/components/features/home/FeaturedClinics', () => ({ FeaturedClinics: () => null }));
jest.mock('@/components/features/home/SupportSessions', () => ({ SupportSessions: () => null }));
jest.mock('@/components/features/home/TherapistsRow', () => ({ TherapistsRow: () => null }));
jest.mock('@/components/features/home/GuestDock', () => ({
  GuestDock: () => { const { Text } = require('react-native'); return <Text>guest-dock</Text>; },
}));
jest.mock('@/components/features/home/HomeSectionHeading', () => ({ HomeSectionHeading: () => null }));

import HomeScreen from '../(client)/(tabs)/home';

describe('shared home', () => {
  beforeEach(() => {
    mockSignedIn = false;
    mockUserOverride = undefined;
    mockHome.mockReset();
    mockHome.mockReturnValue({ data: undefined, isLoading: false, refetch: jest.fn() });
    mockCardRefetch.mockReset();
    mockCards.mockReset();
    mockCards.mockReturnValue({ data: [], refetch: mockCardRefetch });
    mockPush.mockClear();
  });

  it('renders public sections without a standalone login action or private portal request', () => {
    const screen = render(<HomeScreen />);
    expect(screen.getByText('guest-dock')).toBeTruthy();
    expect(screen.queryByText('auth.login')).toBeNull();
    expect(mockHome).toHaveBeenCalledWith(false);
    expect(screen.getByText('cards-guest')).toBeTruthy();
    expect(mockCards).toHaveBeenCalledTimes(1);
  });

  it('shows private upcoming data for signed-in clients', () => {
    mockSignedIn = true;
    mockHome.mockReturnValue({ data: { upcomingBookings: [], unreadNotifications: [] }, isLoading: true, refetch: jest.fn() });
    const screen = render(<HomeScreen />);
    expect(mockHome).toHaveBeenCalledWith(true);
    expect(screen.getByText('home.upcomingAppointment')).toBeTruthy();
    expect(screen.queryByText('auth.login')).toBeNull();
    expect(screen.queryByText('guest-dock')).toBeNull();
    expect(screen.getByText('cards-client')).toBeTruthy();
  });

  it('does not request private home data or render client upcoming sections for staff users', () => {
    mockSignedIn = true;
    mockUserOverride = { role: 'EMPLOYEE', firstName: 'طبيب' };
    mockHome.mockReturnValue({ data: { upcomingBookings: [], unreadNotifications: [] }, isLoading: false, refetch: jest.fn() });

    const screen = render(<HomeScreen />);

    expect(mockHome).toHaveBeenCalledWith(false);
    expect(screen.queryByText('home.upcomingAppointment')).toBeNull();
    expect(screen.getByText('cards-guest')).toBeTruthy();
    expect(screen.getByText('guest-dock')).toBeTruthy();
  });

  it('refetches public home cards when the guest refreshes the home screen', async () => {
    const screen = render(<HomeScreen />);
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    await waitFor(() => expect(mockCardRefetch).toHaveBeenCalledTimes(1));
  });
});
