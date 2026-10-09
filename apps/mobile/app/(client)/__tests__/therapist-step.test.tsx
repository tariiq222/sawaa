import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

let mockParams: Record<string, string> = {};
let mockFloors: Record<string, { price: number; currency: string }> = {};
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockTherapists = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
const mockClinics = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };

let mockFocused = true;
jest.mock('expo-router', () => ({
  useIsFocused: () => mockFocused,
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/hooks/queries', () => ({
  useTherapists: () => mockTherapists,
  useClinics: () => mockClinics,
  usePublicCatalog: () => ({ data: undefined }),
  useServicePriceFloors: () => mockFloors,
}));
jest.mock('@/hooks/useA11y', () => ({
  useReduceMotion: () => true,
  useReducedTransparency: () => false,
  useIncreasedContrast: () => false,
}));
jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light') }),
}));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const builder = { delay: () => builder, duration: () => builder, easing: () => builder };
  return { __esModule: true, default: { View }, FadeInDown: builder, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('expo-linear-gradient', () => ({ LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
jest.mock('@/theme/components/Glass', () => {
  const { Pressable, View } = require('react-native');
  return {
    Glass: ({ children, onPress, style, accessibilityLabel }: { children?: React.ReactNode; onPress?: () => void; style?: unknown; accessibilityLabel?: string }) =>
      onPress ? <Pressable onPress={onPress} style={style} accessibilityLabel={accessibilityLabel}>{children}</Pressable> : <View style={style}>{children}</View>,
  };
});

import { DirContext, buildDirState } from '@/hooks/useDir';
import i18n from '@/i18n';
import { bookingStep, stepsAfterSkip } from '@/features/booking/booking-entry';
import TherapistsListScreen from '../therapists';

const e1 = { id: 'e1', slug: 'e1', nameEn: 'Sara', serviceIds: ['s1'], minServicePrice: 20000 };
const e2 = { id: 'e2', slug: 'e2', nameEn: 'Noura', serviceIds: ['s1'], minServicePrice: 25000 };

function renderScreen() {
  return render(
    <DirContext.Provider value={buildDirState('en')}>
      <TherapistsListScreen />
    </DirContext.Provider>,
  );
}

describe('signed-in therapist step', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    jest.clearAllMocks();
    mockFocused = true;
    mockParams = { clinicId: 'c1', serviceId: 's1', steps: '3' };
    mockFloors = {};
    mockTherapists.data = [e1, e2];
    mockTherapists.isLoading = false;
    mockTherapists.isError = false;
    mockClinics.data = [{ id: 'c1', nameAr: 'عيادة', nameEn: 'Clinic', serviceIds: ['s1'] }];
    mockClinics.isLoading = false;
    mockClinics.isError = false;
  });

  it('opens the time step when a card is pressed', () => {
    const screen = renderScreen();
    fireEvent.press(screen.getByLabelText('Sara'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 's1', employeeId: 'e1', clinicId: 'c1', steps: '3' },
    });
  });

  it('opens the profile from the separate View profile link only', () => {
    const screen = renderScreen();
    fireEvent.press(screen.getAllByRole('link', { name: 'View profile' })[0]);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/employee/[id]',
      params: { id: 'e1', clinicId: 'c1', serviceId: 's1', steps: '3' },
    });
  });

  it('replaces to the time step once when exactly one therapist matches', () => {
    mockTherapists.data = [e1];
    const screen = renderScreen();
    screen.rerender(
      <DirContext.Provider value={buildDirState('en')}><TherapistsListScreen /></DirContext.Provider>,
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: 's1', employeeId: 'e1', clinicId: 'c1', steps: stepsAfterSkip('3') },
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not skip when a search narrows two therapists to one', () => {
    const screen = renderScreen();
    fireEvent.changeText(screen.getByTestId('therapist-search'), 'Sara');
    expect(screen.queryByLabelText('Noura')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not skip while the screen is not focused', () => {
    mockTherapists.data = [e1];
    mockFocused = false;
    const screen = renderScreen();
    expect(mockReplace).not.toHaveBeenCalled();
    mockFocused = true;
    screen.rerender(
      <DirContext.Provider value={buildDirState('en')}><TherapistsListScreen /></DirContext.Provider>,
    );
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('does not skip while a query is loading or failed', () => {
    mockTherapists.data = [e1];
    mockClinics.isLoading = true;
    renderScreen();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('keeps the profile as the card action without a serviceId', () => {
    mockParams = { clinicId: 'c1' };
    const screen = renderScreen();
    expect(screen.queryByRole('link', { name: 'View profile' })).toBeNull();
    fireEvent.press(screen.getByLabelText('Sara'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/employee/[id]',
      params: { id: 'e1', clinicId: 'c1' },
    });
  });

  it('shows the empty state and never navigates when the service is not in the clinic', () => {
    mockParams = { clinicId: 'c1', serviceId: 'other', steps: '3' };
    const screen = renderScreen();
    expect(screen.getByText(i18n.getFixedT('en')('therapists.empty'))).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the per-service price instead of minServicePrice', () => {
    mockFloors = { e1: { price: 30000, currency: 'SAR' } };
    const screen = renderScreen();
    expect(screen.getAllByText(/^From /)).toHaveLength(1);
    expect(screen.getByText(/^From 300/)).toBeTruthy();
  });

  it('renders the step header when steps is present', () => {
    const screen = renderScreen();
    const t = i18n.getFixedT('en');
    const { step, total } = bookingStep('therapist', '3');
    expect(screen.getByText(t('booking.chooseTherapist'))).toBeTruthy();
    expect(screen.getByText(t('booking.stepOf', { step: String(step), total: String(total) }))).toBeTruthy();
  });
});
