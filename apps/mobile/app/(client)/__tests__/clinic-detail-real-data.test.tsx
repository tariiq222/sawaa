import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = { id: 'clinic-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockClinics = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
jest.mock('@/hooks/queries', () => ({ useClinics: () => mockClinics }));

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
  Building2: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
}));

import i18n from '@/i18n';
import { DirContext, buildDirState } from '@/hooks/useDir';
import ClinicDetailScreen from '../clinic/[id]';

const clinic = {
  id: 'clinic-1',
  nameAr: 'عيادة القلق',
  nameEn: 'Anxiety Clinic',
  therapistCount: 4,
  serviceCount: 3,
  serviceIds: ['s1', 's2', 's3'],
};

async function renderIn(language: 'ar' | 'en') {
  await act(async () => {
    await i18n.changeLanguage(language);
  });
  return render(
    <DirContext.Provider value={buildDirState(language)}>
      <ClinicDetailScreen />
    </DirContext.Provider>,
  );
}

describe('clinic detail renders catalog data, not placeholders', () => {
  beforeEach(() => {
    mockParams = { id: 'clinic-1' };
    mockClinics.data = [clinic];
    mockClinics.isLoading = false;
    mockClinics.isError = false;
    mockClinics.refetch = jest.fn();
  });

  it('renders the real clinic name and bookable counts', async () => {
    const view = await renderIn('ar');
    const t = i18n.getFixedT('ar');

    expect(view.getByText('عيادة القلق')).toBeTruthy();
    expect(view.getByText(t('clinics.therapistsCount', { count: 4 }))).toBeTruthy();
    expect(view.getByText(t('clinics.servicesCount', { count: 3 }))).toBeTruthy();
  });

  it('renders the English name for the English locale', async () => {
    const view = await renderIn('en');
    expect(view.getByText('Anxiety Clinic')).toBeTruthy();
  });

  it('never renders the fabricated clinic identity, rating, distance or stats', async () => {
    const view = await renderIn('ar');
    for (const fabricated of [
      'عيادة سواء النفسية',
      'Sawaa Wellness Clinic',
      '4.7',
      '(٢٨٤)',
      'الرياض · حي العليا · ٢.٤ كم',
      '٢٤/٧',
      'عن العيادة',
      'التخصصات',
    ]) {
      expect(view.queryByText(fabricated)).toBeNull();
    }
  });

  it('shows the retryable error when the clinic directory fails to load', async () => {
    mockClinics.data = undefined;
    mockClinics.isError = true;
    const view = await renderIn('ar');
    const t = i18n.getFixedT('ar');

    expect(view.getByText(t('common.error'))).toBeTruthy();
    expect(view.getByText(t('common.retry'))).toBeTruthy();
  });

  it('explains an unknown clinic id instead of inventing one', async () => {
    mockParams = { id: 'missing-clinic' };
    const view = await renderIn('ar');
    const t = i18n.getFixedT('ar');

    expect(view.getByText(t('clinics.notFound'))).toBeTruthy();
    expect(view.queryByText('عيادة القلق')).toBeNull();
  });

  it('retries the directory from the error state, and offers the list when the id is unknown', async () => {
    mockClinics.data = undefined;
    mockClinics.isError = true;
    const errorView = await renderIn('ar');
    fireEvent.press(errorView.getByText(i18n.getFixedT('ar')('common.retry')));
    expect(mockClinics.refetch).toHaveBeenCalledTimes(1);

    mockClinics.isError = false;
    mockClinics.data = [];
    const missingView = await renderIn('ar');
    fireEvent.press(missingView.getByText(i18n.getFixedT('ar')('clinics.title')));
    expect(mockReplace).toHaveBeenCalledWith('/(client)/clinics');
  });

  it('sends the real clinic id to the therapist directory from the call to action', async () => {
    const view = await renderIn('ar');
    fireEvent.press(view.getByText(i18n.getFixedT('ar')('therapists.title')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/therapists',
      params: { clinicId: 'clinic-1' },
    });
  });
});
