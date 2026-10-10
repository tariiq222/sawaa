import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockParams: Record<string, string> = {};
const mockCatalog = { data: undefined as unknown };
const mockTherapists = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
const mockClinics = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };

jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/hooks/queries', () => ({
  useTherapists: () => mockTherapists,
  useClinics: () => mockClinics,
  usePublicCatalog: () => mockCatalog,
  useServicePriceFloors: () => ({}),
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

function renderScreen(locale: 'ar' | 'en' = 'en') {
  return render(
    <DirContext.Provider value={buildDirState(locale)}>
      <TherapistsListScreen />
    </DirContext.Provider>,
  );
}

describe('therapist directory query failures', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
    Object.keys(mockParams).forEach((key) => delete mockParams[key]);
    mockCatalog.data = undefined;
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

  it('filters with chips and the "All" chip clears the filter', () => {
    mockTherapists.data = [
      { id: 'a', slug: 'a', nameEn: 'Available therapist', serviceIds: [], isAvailableToday: true, minServicePrice: 20000 },
      { id: 'b', slug: 'b', nameEn: 'Busy therapist', serviceIds: [], isAvailableToday: false, minServicePrice: null },
    ];
    const screen = renderScreen();
    expect(screen.getByText('Available therapist')).toBeTruthy();
    expect(screen.getByText('Busy therapist')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Available' }));
    expect(screen.queryByText('Busy therapist')).toBeNull();
    expect(screen.getByRole('button', { name: 'Available' })).toHaveProp('accessibilityState', { selected: true, disabled: false });

    fireEvent.press(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Busy therapist')).toBeTruthy();
  });

  it('shows availability today and the lowest price only where the directory has them', () => {
    mockTherapists.data = [
      { id: 'a', slug: 'a', nameEn: 'Available therapist', serviceIds: [], isAvailableToday: true, minServicePrice: 20000 },
      { id: 'b', slug: 'b', nameEn: 'Busy therapist', serviceIds: [], isAvailableToday: false, minServicePrice: null },
    ];
    const screen = renderScreen();
    expect(screen.getAllByText('Available today')).toHaveLength(1);
    expect(screen.getAllByText(/^From /)).toHaveLength(1);
  });
});

describe('selected service presentation', () => {
  function setup(mode = 'SERVICES', hidden = false) {
    Object.keys(mockParams).forEach((key) => delete mockParams[key]);
    Object.assign(mockParams, { clinicId: 'c1', serviceId: 's1', steps: '4' });
    mockClinics.data = [{ id: 'c1', nameAr: 'القياس والتقييم', nameEn: 'Assessment', serviceIds: ['s1'], bookingMode: mode }];
    mockClinics.isLoading = false; mockClinics.isError = false;
    mockTherapists.data = [{ id: 'a', serviceIds: ['s1'] }, { id: 'b', serviceIds: ['s1'] }];
    mockTherapists.isLoading = false; mockTherapists.isError = false;
    mockCatalog.data = {
      departments: [],
      categories: [{ id: 'c1', departmentId: null, kind: 'CLINIC', nameAr: 'القياس والتقييم', nameEn: 'Assessment', sortOrder: 0, bookingMode: mode }],
      services: [{ id: 's1', categoryId: 'c1', nameAr: 'فحص الحالة العقلية', nameEn: 'Mental Status Examination', price: 5000, currency: 'SAR', imageUrl: null, isHidden: hidden }],
    };
  }
  it.each(['ar', 'en'] as const)('keeps the selected service and booking progress visible in %s', async (locale) => {
    setup();
    await i18n.changeLanguage(locale);
    const screen = renderScreen(locale);
    const name = locale === 'ar' ? 'فحص الحالة العقلية' : 'Mental Status Examination';
    expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText(name).props.numberOfLines).toBeUndefined();
    expect(screen.getByText(i18n.getFixedT(locale)('booking.stepOf', { step: locale === 'ar' ? '٢' : '2', total: locale === 'ar' ? '٤' : '4' }))).toBeTruthy();
  });
  it('does not disclose internal DIRECT service names', () => {
    setup('DIRECT', true);
    const screen = renderScreen();
    expect(screen.queryByText('Mental Status Examination')).toBeNull();
    expect(screen.queryByText('فحص الحالة العقلية')).toBeNull();
  });
  it('does not show a service belonging to another selected category', () => {
    setup(); mockParams.clinicId = 'other';
    expect(renderScreen().queryByText('Mental Status Examination')).toBeNull();
  });
  it('falls back to the Arabic name when the English service name is missing', async () => {
    setup(); await i18n.changeLanguage('en');
    const catalog = mockCatalog.data as { services: { nameEn: string | null }[] };
    catalog.services[0].nameEn = null;
    expect(renderScreen().getByText('فحص الحالة العقلية')).toBeTruthy();
  });
  it('keeps the directory usable while catalog context is missing', () => {
    setup(); mockCatalog.data = undefined;
    expect(renderScreen().getByText(i18n.t('booking.chooseTherapist'))).toBeTruthy();
  });
});
