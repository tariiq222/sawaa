import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

let mockParams: Record<string, string> = {};
let mockFloors: Record<string, { price: number; currency: string }> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockClinicsQuery = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
const mockTherapistsQuery = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
const mockIdle = { data: [], isLoading: false, isError: false, refetch: jest.fn() };

let mockFocused = true;
jest.mock('expo-router', () => ({
  useIsFocused: () => mockFocused,
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn(), replace: mockReplace, canGoBack: () => true, push: mockPush }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: null } }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: false, row: 'row', textAlign: 'left', locale: 'en' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ AquaBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, accessibilityLabel, testID }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string; testID?: string }) => {
    const { Pressable } = require('react-native');
    return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={testID}>{children}</Pressable>;
  },
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/hooks/queries', () => ({
  useClinics: () => mockClinicsQuery,
  useTherapists: () => mockTherapistsQuery,
  useGroupSessions: () => mockIdle,
  usePackageFamilies: () => mockIdle,
  useServicePriceFloors: () => mockFloors,
}));

import i18n from '@/i18n';
import { bookingStep, stepsAfterSkip } from '@/features/booking/booking-entry';
import PublicListScreen from '../public-list/[kind]';

const e1 = { id: 'e1', slug: 'e1', nameEn: 'Sara', serviceIds: ['s1'], minServicePrice: 20000 };
const e2 = { id: 'e2', slug: 'e2', nameEn: 'Noura', serviceIds: ['s1'], minServicePrice: 25000 };

describe('guest therapist step', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    jest.clearAllMocks();
    mockFocused = true;
    mockParams = { kind: 'therapists', clinicId: 'c1', serviceId: 's1', steps: '3' };
    mockFloors = {};
    mockTherapistsQuery.data = [e1, e2];
    mockTherapistsQuery.isLoading = false;
    mockTherapistsQuery.isError = false;
    mockClinicsQuery.data = [{ id: 'c1', nameAr: 'عيادة', nameEn: 'Clinic', serviceIds: ['s1'] }];
    mockClinicsQuery.isLoading = false;
    mockClinicsQuery.isError = false;
  });

  it('opens the public time step when a card is pressed', () => {
    const screen = render(<PublicListScreen />);
    fireEvent.press(screen.getByLabelText('Sara'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 's1', employeeId: 'e1', clinicId: 'c1', steps: '3' },
    });
  });

  it('opens the public profile from the separate View profile link only', () => {
    const screen = render(<PublicListScreen />);
    fireEvent.press(screen.getAllByRole('link', { name: 'View profile' })[0]);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-detail/[kind]/[id]',
      params: { kind: 'therapist', id: 'e1', clinicId: 'c1', serviceId: 's1', steps: '3' },
    });
  });

  it('replaces to the time step once when exactly one therapist matches', () => {
    mockTherapistsQuery.data = [e1];
    const screen = render(<PublicListScreen />);
    screen.rerender(<PublicListScreen />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/public-booking/[serviceId]',
      params: { serviceId: 's1', employeeId: 'e1', clinicId: 'c1', steps: stepsAfterSkip('3') },
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not skip when a search narrows two therapists to one', () => {
    const screen = render(<PublicListScreen />);
    fireEvent.changeText(screen.getByTestId('public-list-search'), 'Sara');
    expect(screen.queryByLabelText('Noura')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not skip while the screen is not focused', () => {
    mockTherapistsQuery.data = [e1];
    mockFocused = false;
    const screen = render(<PublicListScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
    mockFocused = true;
    screen.rerender(<PublicListScreen />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('keeps the profile as the card action without a serviceId', () => {
    mockParams = { kind: 'therapists', clinicId: 'c1' };
    const screen = render(<PublicListScreen />);
    expect(screen.queryByRole('link', { name: 'View profile' })).toBeNull();
    fireEvent.press(screen.getByLabelText('Sara'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-detail/[kind]/[id]',
      params: { kind: 'therapist', id: 'e1', clinicId: 'c1' },
    });
  });

  it('shows the empty state and never navigates when the service is not in the clinic', () => {
    mockParams = { kind: 'therapists', clinicId: 'c1', serviceId: 'other', steps: '3' };
    const screen = render(<PublicListScreen />);
    expect(screen.getByText(i18n.getFixedT('en')('guest.empty'))).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the per-service price instead of minServicePrice', () => {
    mockFloors = { e1: { price: 30000, currency: 'SAR' } };
    const screen = render(<PublicListScreen />);
    expect(screen.getAllByText(/^From /)).toHaveLength(1);
    expect(screen.getByText(/^From 300/)).toBeTruthy();
  });

  it('renders the step header when steps is present', () => {
    const screen = render(<PublicListScreen />);
    const t = i18n.getFixedT('en');
    const { step, total } = bookingStep('therapist', '3');
    expect(screen.getByText(t('booking.chooseTherapist'))).toBeTruthy();
    expect(screen.getByText(t('booking.stepOf', { step: String(step), total: String(total) }))).toBeTruthy();
  });
});
