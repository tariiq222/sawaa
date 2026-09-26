import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockParams: Record<string, string> = {};
const mockTherapists = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
const mockClinics = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/hooks/queries', () => ({
  useTherapists: () => mockTherapists,
  useClinics: () => mockClinics,
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
import TherapistsListScreen from '../therapists';

function renderScreen() {
  return render(
    <DirContext.Provider value={buildDirState('en')}>
      <TherapistsListScreen />
    </DirContext.Provider>,
  );
}

describe('therapist directory query failures', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    mockParams.clinicId = '';
    mockTherapists.data = undefined;
    mockTherapists.isLoading = false;
    mockTherapists.isError = false;
    mockTherapists.refetch = jest.fn();
    mockClinics.data = undefined;
    mockClinics.isLoading = false;
    mockClinics.isError = false;
    mockClinics.refetch = jest.fn();
  });

  it('shows a therapist load error, hides the count, and retries therapists', () => {
    mockTherapists.data = [{ id: 'specialist-1', nameEn: 'Cached specialist', serviceIds: [] }];
    mockTherapists.isError = true;
    const screen = renderScreen();
    const t = i18n.getFixedT('en');

    expect(screen.getByText(t('guest.loadError'))).toBeTruthy();
    expect(screen.getByTestId('therapist-directory-retry')).toBeTruthy();
    expect(screen.getByText('Cached specialist')).toBeTruthy();
    expect(screen.queryByText(t('therapists.availableCount', { count: 0 }))).toBeNull();
    expect(screen.queryByText(t('therapists.empty'))).toBeNull();

    fireEvent.press(screen.getByTestId('therapist-directory-retry'));
    expect(mockTherapists.refetch).toHaveBeenCalledTimes(1);
  });

  it('retries the clinic query when clinic scoping cannot be loaded', () => {
    mockParams.clinicId = 'clinic-1';
    mockClinics.isError = true;
    const screen = renderScreen();

    expect(screen.getByTestId('clinic-directory-retry')).toBeTruthy();
    fireEvent.press(screen.getByTestId('clinic-directory-retry'));
    expect(mockClinics.refetch).toHaveBeenCalledTimes(1);
    expect(mockTherapists.refetch).not.toHaveBeenCalled();
  });

  it('does not show a count while either required query is loading', () => {
    mockTherapists.data = [];
    mockTherapists.isLoading = true;
    const screen = renderScreen();

    expect(screen.getByText(i18n.getFixedT('en')('therapists.loading'))).toBeTruthy();
    expect(screen.queryByText(i18n.getFixedT('en')('therapists.availableCount', { count: 0 }))).toBeNull();
  });
});
