import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';

const mockPush = jest.fn();
const mockHome = jest.fn();
const mockCards = jest.fn();
const mockCardRefetch = jest.fn();
let mockSignedIn = false;
let mockUserOverride: unknown = undefined;
let mockFocusCallback: () => void;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useFocusEffect: (callback: () => void) => { mockFocusCallback = callback; require('react').useEffect(callback, [callback]); } }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: false, locale: 'en', textAlign: 'left', row: 'row', writingDirection: 'ltr' }) }));
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
jest.mock('@/theme/ThemeProvider', () => ({ useTheme: () => ({ scheme: 'light' }) }));
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
  useClientEmailStatus: () => ({ data: undefined }),
}));
jest.mock('@/components/features/home/HomeAssessmentServices', () => ({ HomeAssessmentServices: () => null }));
jest.mock('@/components/features/home/HomeDiscoveryCards', () => ({ HomeDiscoveryCards: () => null }));
jest.mock('@/components/features/home/HomeTopBar', () => ({ HomeTopBar: () => null }));
jest.mock('@/components/features/home/HomeCardsCarousel', () => ({ HomeCardsCarousel: ({ signedIn }: { signedIn: boolean }) => {
  const { Text } = require('react-native');
  return <Text>{signedIn ? 'cards-client' : 'cards-guest'}</Text>;
} }));
jest.mock('@/components/features/home/PackageBalanceCard', () => ({ PackageBalanceCard: () => { const { Text } = require('react-native'); return <Text>balance</Text>; } }));
jest.mock('@/components/features/home/FeaturedClinics', () => ({ FeaturedClinics: () => null }));
jest.mock('@/components/ui/SectionHeader', () => ({ SectionHeader: () => null }));
jest.mock('@/components/features/home/SupportSessions', () => ({ SupportSessions: () => null }));
jest.mock('@/components/features/home/TherapistsRow', () => ({ TherapistsRow: () => null }));
jest.mock('@/components/features/home/HomeSectionHeading', () => ({ HomeSectionHeading: () => null }));

import HomeScreen from '../(client)/(tabs)/home';

function booking(id: string, scheduledAt: string, status = 'CONFIRMED') {
  return { id, scheduledAt, date: '2026-10-09', startTime: '16:00', endTime: '17:00', status, type: 'in_person', employee: null, service: null, zoomJoinUrl: null };
}

describe('shared home', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-09T12:00:00Z'));
    mockSignedIn = false;
    mockUserOverride = undefined;
    mockHome.mockReset();
    mockHome.mockReturnValue({ data: undefined, isLoading: false, refetch: jest.fn() });
    mockCardRefetch.mockReset();
    mockCards.mockReset();
    mockCards.mockReturnValue({ data: [{ id: 'fixture-card' }], refetch: mockCardRefetch });
    mockPush.mockClear();
  });

  afterEach(() => jest.useRealTimers());

  it('renders public sections without a standalone login action or private portal request', () => {
    const screen = render(<HomeScreen />);
    expect(screen.queryByText('auth.login')).toBeNull();
    expect(mockHome).toHaveBeenCalledWith(false);
    expect(screen.getByText('cards-guest')).toBeTruthy();
    expect(mockCards).toHaveBeenCalledTimes(1);
  });

  it('shows private upcoming data for signed-in clients', () => {
    mockSignedIn = true;
    mockHome.mockReturnValue({ data: { upcomingBookings: [booking('fixture-booking', '2026-10-09T13:00:00Z')], unreadNotifications: [] }, isLoading: false, refetch: jest.fn() });
    const screen = render(<HomeScreen />);
    expect(mockHome).toHaveBeenCalledWith(true);
    expect(screen.getByText('4:00 PM')).toBeTruthy();
    expect(screen.getByText('balance')).toBeTruthy();
    expect(screen.queryByText('auth.login')).toBeNull();
    expect(screen.getByText('cards-client')).toBeTruthy();
  });

  it('does not request private home data or render client upcoming sections for staff users', () => {
    mockSignedIn = true;
    mockUserOverride = { role: 'EMPLOYEE', firstName: 'طبيب' };
    mockHome.mockReturnValue({ data: { upcomingBookings: [], unreadNotifications: [] }, isLoading: false, refetch: jest.fn() });

    const screen = render(<HomeScreen />);

    expect(mockHome).toHaveBeenCalledWith(false);
    expect(screen.queryByText('home.upcomingAppointment')).toBeNull();
    expect(screen.queryByText('balance')).toBeNull();
    expect(screen.getByText('cards-guest')).toBeTruthy();
  });

  it('refetches public home cards when the guest refreshes the home screen', async () => {
    const screen = render(<HomeScreen />);
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    await waitFor(() => expect(mockCardRefetch).toHaveBeenCalledTimes(1));
  });
  it('skips stale and terminal bookings and shows the nearest future appointment from unsorted cached data', () => {
    mockSignedIn = true;
    mockHome.mockReturnValue({ data: { upcomingBookings: [
      booking('past', '2026-10-09T11:00:00Z'),
      booking('cancelled', '2026-10-09T12:01:00Z', 'CANCELLED'),
      booking('completed', '2026-10-09T12:02:00Z', 'COMPLETED'),
      booking('expired', '2026-10-09T12:03:00Z', 'EXPIRED'),
      booking('no-show', '2026-10-09T12:04:00Z', 'NO_SHOW'),
      booking('later', '2026-10-09T14:00:00Z'),
      booking('nearest', '2026-10-09T13:00:00Z', 'deposit_paid'),
    ] }, isLoading: false, refetch: jest.fn() });
    const screen = render(<HomeScreen />);
    expect(screen.getByText('4:00 PM')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /home.upcomingAppointment:/ }));
    expect(mockPush).toHaveBeenCalledWith('/(client)/appointment/nearest');
  });

  it('advances the card when the appointment starts without waiting for a network response', () => {
    mockSignedIn = true;
    const refetch = jest.fn();
    mockHome.mockReturnValue({ data: { upcomingBookings: [booking('first', '2026-10-09T12:00:01Z'), booking('second', '2026-10-09T13:00:00Z')] }, isLoading: false, refetch });
    const screen = render(<HomeScreen />);
    act(() => { jest.advanceTimersByTime(1001); });
    expect(screen.getByText('4:00 PM')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /home.upcomingAppointment:/ }));
    expect(mockPush).toHaveBeenCalledWith('/(client)/appointment/second');
    expect(refetch).toHaveBeenCalled();
  });

  it('preserves a book-now empty state when no valid future appointment remains', () => {
    mockSignedIn = true;
    mockHome.mockReturnValue({ data: { upcomingBookings: [booking('past', '2026-10-09T11:00:00Z')] }, isLoading: false, refetch: jest.fn() });
    const screen = render(<HomeScreen />);
    expect(screen.getByText('home.noUpcoming')).toBeTruthy();
    fireEvent.press(screen.getByText('home.bookNow'));
    expect(mockPush).toHaveBeenCalledWith('/(client)/therapists');
  });

  it('re-evaluates cached appointments and refreshes when the home tab regains focus', () => {
    mockSignedIn = true;
    const refetch = jest.fn();
    mockHome.mockReturnValue({ data: { upcomingBookings: [booking('first', '2026-10-09T12:30:00Z'), booking('second', '2026-10-09T13:00:00Z')] }, isLoading: false, refetch });
    const screen = render(<HomeScreen />);
    refetch.mockClear();
    act(() => { jest.setSystemTime(new Date('2026-10-09T12:45:00Z')); mockFocusCallback(); });
    expect(screen.getByText('4:00 PM')).toBeTruthy();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('clears the expiry refresh timer when home unmounts', () => {
    mockSignedIn = true;
    const refetch = jest.fn();
    mockHome.mockReturnValue({ data: { upcomingBookings: [booking('first', '2026-10-09T12:00:01Z')] }, isLoading: false, refetch });
    const screen = render(<HomeScreen />);
    refetch.mockClear();
    screen.unmount();
    act(() => { jest.advanceTimersByTime(1001); });
    expect(refetch).not.toHaveBeenCalled();
  });

});
