import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = { clinicId: 'clinic-1', steps: '4' };
let mockAuthToken: string | null = 'client-token';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

const mockClinics = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
const mockCatalog = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
jest.mock('@/hooks/queries', () => ({ useClinics: () => mockClinics, usePublicCatalog: () => mockCatalog }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockAuthToken } }) }));

jest.mock('@/hooks/useA11y', () => ({
  useReduceMotion: () => true,
  useReducedTransparency: () => false,
  useIncreasedContrast: () => false,
}));

jest.mock('@/theme/useTheme', () => ({
  useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light'), scheme: 'light' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = () => {
    const builder: Record<string, unknown> = {};
    for (const method of ['delay', 'duration', 'easing']) builder[method] = () => builder;
    return builder;
  };
  return {
    __esModule: true,
    default: { View },
    FadeInDown: chain(),
    Easing: { out: () => undefined, cubic: undefined },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withTiming: (value: unknown) => value,
    withRepeat: (value: unknown) => value,
  };
});

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock('lucide-react-native', () => ({
  Check: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
}));

import i18n from '@/i18n';
import { DirContext, buildDirState } from '@/hooks/useDir';
import ServiceStepScreen from '../service';

const clinic = {
  id: 'clinic-1',
  nameAr: 'عيادة القلق',
  nameEn: 'Anxiety Clinic',
  serviceIds: ['s1', 's2'],
  bookingMode: 'SERVICES',
  directServiceId: null,
};

async function renderIn(language: 'ar' | 'en') {
  await act(async () => {
    await i18n.changeLanguage(language);
  });
  return render(
    <DirContext.Provider value={buildDirState(language)}>
      <ServiceStepScreen />
    </DirContext.Provider>,
  );
}

describe('booking service step', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthToken = 'client-token';
    mockParams = { clinicId: 'clinic-1', steps: '4' };
    mockClinics.data = [clinic];
    mockClinics.isLoading = false;
    mockClinics.isError = false;
    mockCatalog.data = {
      departments: [],
      categories: [{ id: 'clinic-1', nameAr: 'عيادة القلق', nameEn: 'Anxiety Clinic', bookingMode: 'SERVICES', kind: 'CLINIC' }],
      services: [
        { id: 's1', categoryId: 'clinic-1', nameAr: 'جلسة إرشاد', nameEn: 'Counseling session', price: 200, currency: 'SAR', imageUrl: null },
        { id: 's2', categoryId: 'clinic-1', nameAr: 'خدمة أخرى', nameEn: 'Other service', price: 150, currency: 'SAR', imageUrl: null },
      ],
    };
    mockCatalog.isLoading = false;
    mockCatalog.isError = false;
    mockCatalog.refetch = jest.fn();
  });

  it('lists the clinic services without prices and shows step 1 of 4', async () => {
    const view = await renderIn('en');
    expect(view.getByText('Counseling session')).toBeTruthy();
    expect(view.getByText('Other service')).toBeTruthy();
    expect(view.getByText(i18n.getFixedT('en')('booking.chooseService'))).toBeTruthy();
    expect(view.getByText('Step 1 of 4')).toBeTruthy();
    expect(view.queryByText(/200|150|SAR/)).toBeNull();
  });

  it('continues to the therapist list for a signed-in client', async () => {
    const view = await renderIn('en');
    fireEvent.press(view.getByText('Counseling session'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/therapists',
      params: { clinicId: 'clinic-1', serviceId: 's1', steps: '4' },
    });
  });

  it('continues to the public therapist list for a guest', async () => {
    mockAuthToken = null;
    const view = await renderIn('en');
    fireEvent.press(view.getByText('Other service'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-list/[kind]',
      params: { kind: 'therapists', clinicId: 'clinic-1', serviceId: 's2', steps: '4' },
    });
  });

  it('explains an unknown clinic', async () => {
    mockParams = { clinicId: 'missing', steps: '4' };
    const view = await renderIn('en');
    expect(view.getByText(i18n.getFixedT('en')('clinics.notFound'))).toBeTruthy();
  });

  it('offers a retry when the catalog fails to load', async () => {
    mockCatalog.data = undefined;
    mockCatalog.isError = true;
    const view = await renderIn('en');
    fireEvent.press(view.getByText(i18n.getFixedT('en')('common.retry')));
    expect(mockCatalog.refetch).toHaveBeenCalledTimes(1);
  });
});
