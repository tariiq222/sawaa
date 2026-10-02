import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockParams: Record<string, string> = { id: 'clinic-1' };
let mockAuthToken: string | null = 'client-token';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
  useLocalSearchParams: () => mockParams,
}));

const mockClinics = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
const mockCatalog = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
const mockTherapists = { data: undefined as unknown, isLoading: false, isError: false, refetch: jest.fn() };
jest.mock('@/hooks/queries', () => ({ useClinics: () => mockClinics, usePublicCatalog: () => mockCatalog, useTherapists: () => mockTherapists }));
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
  Building2: () => null,
  CalendarPlus: () => null,
  Check: () => null,
  ChevronLeft: () => null,
  ChevronRight: () => null,
  Star: () => null,
  User: () => null,
}));

import i18n from '@/i18n';
import { DirContext, buildDirState } from '@/hooks/useDir';
import ClinicDetailScreen from '../../public-clinic/[id]';

const clinic = {
  id: 'clinic-1',
  nameAr: 'عيادة القلق',
  nameEn: 'Anxiety Clinic',
  therapistCount: 4,
  serviceCount: 3,
  serviceIds: ['s1', 's2', 's3'],
  bookingMode: 'SERVICES',
  directServiceId: null,
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
    mockPush.mockClear();
    mockAuthToken = 'client-token';
    mockParams = { id: 'clinic-1' };
    mockClinics.data = [clinic];
    mockClinics.isLoading = false;
    mockClinics.isError = false;
    mockClinics.refetch = jest.fn();
    mockCatalog.data = {
      departments: [],
      categories: [{ id: 'clinic-1', nameAr: 'عيادة القلق', nameEn: 'Anxiety Clinic', bookingMode: 'SERVICES', kind: 'CLINIC' }],
      services: [
        { id: 's1', categoryId: 'clinic-1', nameAr: 'جلسة إرشاد', nameEn: 'Counseling session', price: 200, currency: 'SAR', imageUrl: null },
        { id: 's2', categoryId: 'clinic-1', nameAr: 'خدمة أخرى', nameEn: 'Other service', price: 150, currency: 'SAR', imageUrl: null },
        { id: 'outside', categoryId: 'another-clinic', nameAr: 'خدمة خارجية', nameEn: 'Outside service', price: 150, currency: 'SAR', imageUrl: null },
      ],
    };
    mockCatalog.isLoading = false;
    mockCatalog.isError = false;
    mockCatalog.refetch = jest.fn();
    mockTherapists.data = [{ id: 'employee-1', slug: 'sara', nameAr: 'سارة', nameEn: 'Sara', serviceIds: ['s1'], isBookable: true }];
    mockTherapists.isLoading = false;
    mockTherapists.isError = false;
    mockTherapists.refetch = jest.fn();
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

  it('shows only this clinic’s real services and keeps serviceId when opening its practitioners', async () => {
    const view = await renderIn('ar');

    expect(view.getByText('جلسة إرشاد')).toBeTruthy();
    expect(view.queryByText('خدمة خارجية')).toBeNull();
    fireEvent.press(view.getByText('جلسة إرشاد'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/therapists',
      params: { clinicId: 'clinic-1', serviceId: 's1', steps: '4' },
    });
  });

  it('shows real clinic practitioners and carries clinicId into the employee profile', async () => {
    const view = await renderIn('en');
    fireEvent.press(view.getByText(i18n.getFixedT('en')('clinics.specialistsTab')));
    expect(view.getByText('Sara')).toBeTruthy();
    expect(view.queryByRole('link', { name: i18n.getFixedT('en')('therapists.viewProfile') })).toBeNull();
    fireEvent.press(view.getByText('Sara'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/employee/[id]',
      params: { id: 'sara', clinicId: 'clinic-1' },
    });
  });

  it('shows a retryable catalog error instead of hiding clinic services', async () => {
    mockCatalog.data = undefined;
    mockCatalog.isError = true;
    const view = await renderIn('en');
    expect(view.getByText(i18n.getFixedT('en')('guest.loadError'))).toBeTruthy();
    fireEvent.press(view.getByText(i18n.getFixedT('en')('common.retry')));
    expect(mockCatalog.refetch).toHaveBeenCalledTimes(1);
  });

  it('shows a retryable practitioner error instead of silently omitting the practitioners', async () => {
    mockTherapists.data = undefined;
    mockTherapists.isError = true;
    const view = await renderIn('en');
    fireEvent.press(view.getByText(i18n.getFixedT('en')('clinics.specialistsTab')));
    expect(view.getByText(i18n.getFixedT('en')('guest.loadError'))).toBeTruthy();
    fireEvent.press(view.getByText(i18n.getFixedT('en')('common.retry')));
    expect(mockTherapists.refetch).toHaveBeenCalledTimes(1);
  });

  it('lets a guest browse a clinic and carry clinic and service into public practitioner discovery', async () => {
    mockAuthToken = null;
    const view = await renderIn('en');

    fireEvent.press(view.getByText('Counseling session'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-list/[kind]',
      params: { kind: 'therapists', clinicId: 'clinic-1', serviceId: 's1', steps: '4' },
    });
  });

  it('lets a guest open a practitioner through public detail with clinic context', async () => {
    mockAuthToken = null;
    const view = await renderIn('en');

    fireEvent.press(view.getByText(i18n.getFixedT('en')('clinics.specialistsTab')));
    fireEvent.press(view.getByText('Sara'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-detail/[kind]/[id]',
      params: { kind: 'therapist', id: 'sara', clinicId: 'clinic-1' },
    });
  });

  describe('default tab', () => {
    const t = i18n.getFixedT('en');
    const about = 'A calm space for families.';

    it('opens a SERVICES clinic on its services, not the description, and About comes last', async () => {
      mockClinics.data = [{ ...clinic, descriptionEn: about }];
      const view = await renderIn('en');
      expect(view.getByText('Counseling session')).toBeTruthy();
      expect(view.queryByText(about)).toBeNull();
      const tabs = view.getAllByRole('tab');
      ['employeeProfile.services', 'clinics.specialistsTab', 'employeeProfile.about'].forEach((key, index) => {
        expect(within(tabs[index]).getByText(t(key))).toBeTruthy();
      });
      fireEvent.press(view.getByRole('tab', { name: t('employeeProfile.about') }));
      expect(view.getByText(about)).toBeTruthy();
    });

    it('opens a DIRECT clinic on its therapists, and About is the second tab', async () => {
      mockClinics.data = [{ ...clinic, bookingMode: 'DIRECT', directServiceId: 'direct-1', descriptionEn: about }];
      const view = await renderIn('en');
      expect(view.getByText('Sara')).toBeTruthy();
      expect(view.queryByText(about)).toBeNull();
      const tabs = view.getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(within(tabs[1]).getByText(t('employeeProfile.about'))).toBeTruthy();
      fireEvent.press(view.getByRole('tab', { name: t('employeeProfile.about') }));
      expect(view.getByText(about)).toBeTruthy();
      expect(view.queryByText('Sara')).toBeNull();
    });
  });

  describe('practitioner cards in a DIRECT clinic', () => {
    const tabLabel = () => i18n.getFixedT('en')('clinics.specialistsTab');
    const profileLink = () => ({ name: i18n.getFixedT('en')('therapists.viewProfile') });
    beforeEach(() => {
      mockClinics.data = [{ ...clinic, bookingMode: 'DIRECT', directServiceId: 'direct-1' }];
    });

    it('sends a signed-in client straight to the time step', async () => {
      const view = await renderIn('en');
      fireEvent.press(view.getByText(tabLabel()));
      fireEvent.press(view.getByText('Sara'));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(client)/booking/[serviceId]',
        params: { serviceId: 'direct-1', employeeId: 'employee-1', clinicId: 'clinic-1', steps: '2' },
      });
    });

    it('sends a guest straight to the public time step', async () => {
      mockAuthToken = null;
      const view = await renderIn('en');
      fireEvent.press(view.getByText(tabLabel()));
      fireEvent.press(view.getByText('Sara'));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/public-booking/[serviceId]',
        params: { serviceId: 'direct-1', employeeId: 'employee-1', clinicId: 'clinic-1', steps: '2' },
      });
    });

    it('opens the profile from the View profile link', async () => {
      const view = await renderIn('en');
      fireEvent.press(view.getByText(tabLabel()));
      fireEvent.press(view.getByRole('link', profileLink()));
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(client)/employee/[id]',
        params: { id: 'sara', clinicId: 'clinic-1' },
      });
    });

    it('keeps the profile as the card action, without a link, when the internal service is missing', async () => {
      mockClinics.data = [{ ...clinic, bookingMode: 'DIRECT', directServiceId: null }];
      const view = await renderIn('en');
      fireEvent.press(view.getByText(tabLabel()));
      expect(view.queryByRole('link', profileLink())).toBeNull();
      fireEvent.press(view.getByText('Sara'));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(client)/employee/[id]',
        params: { id: 'sara', clinicId: 'clinic-1' },
      });
    });
  });

  describe('booking button', () => {
    const t = i18n.getFixedT('en');

    it('starts a SERVICES clinic at the service step', async () => {
      const view = await renderIn('en');
      fireEvent.press(view.getByText(t('employeeProfile.bookAppointment')));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(client)/booking/service',
        params: { clinicId: 'clinic-1', steps: '4' },
      });
    });

    it('sends a guest to the public service step', async () => {
      mockAuthToken = null;
      const view = await renderIn('en');
      fireEvent.press(view.getByText(t('employeeProfile.bookAppointment')));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/public-booking/service',
        params: { clinicId: 'clinic-1', steps: '4' },
      });
    });

    it('skips to the therapist list with the hidden service for a DIRECT clinic', async () => {
      mockClinics.data = [{ ...clinic, bookingMode: 'DIRECT', directServiceId: 'direct-1' }];
      const view = await renderIn('en');
      fireEvent.press(view.getByText(t('employeeProfile.bookAppointment')));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(client)/therapists',
        params: { clinicId: 'clinic-1', serviceId: 'direct-1', steps: '3' },
      });
    });

    it('does not navigate and explains a DIRECT clinic without its internal service', async () => {
      mockClinics.data = [{ ...clinic, bookingMode: 'DIRECT', directServiceId: null }];
      const view = await renderIn('en');
      expect(view.getByText(t('clinics.bookingSetupMissing'))).toBeTruthy();
      fireEvent.press(view.getByText(t('employeeProfile.bookAppointment')));
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});
