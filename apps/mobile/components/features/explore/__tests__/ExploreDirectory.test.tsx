import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockToken: string | null = 'token';
const mockLabels: Record<string, string> = {
  'explore.all': 'All',
  'explore.searchPlaceholder': 'Search clinics, services, and specialists',
  'clinics.title': 'Clinics',
  'guest.services': 'Services',
  'guest.therapists': 'Specialists',
  'guest.packages': 'Packages',
  'guest.programs': 'Programs',
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.retry': 'Retry',
  'common.noResults': 'No results found',
  'guest.loadError': 'Could not load this information',
  'a11y.buttonBack': 'Back',
};
const mockQueries = {
  clinics: { data: [{ id: 'clinic-1', nameAr: 'عيادة الأسرة', nameEn: 'Family Clinic', therapistCount: 1, serviceCount: 1, serviceIds: ['service-1'], bookingMode: 'SERVICES', directServiceId: null }], isLoading: false, isError: false, refetch: jest.fn() },
  catalog: { data: { departments: [], categories: [{ id: 'clinic-1', departmentId: null, nameAr: 'عيادة الأسرة', nameEn: 'Family Clinic', sortOrder: 0, kind: 'CLINIC', bookingMode: 'SERVICES' }], services: [{ id: 'service-1', categoryId: 'clinic-1', nameAr: 'جلسة أسرية', nameEn: 'Family session', price: 100, currency: 'SAR' }] }, isLoading: false, isError: false, refetch: jest.fn() },
  therapists: { data: [{ id: 'employee-1', slug: 'sara', nameAr: 'سارة', nameEn: 'Sara', specialty: 'Family counseling', specialtyAr: 'إرشاد أسري', serviceIds: ['service-1'], isBookable: true }], isLoading: false, isError: false, refetch: jest.fn() },
  packages: { data: [{ id: 'package-1', nameAr: 'باقة الأسرة', nameEn: 'Family package', isActive: true, isPublic: true, options: [] }], isLoading: false, isError: false, refetch: jest.fn() },
  programs: { data: [{ id: 'program-1', nameAr: 'برنامج الأسرة', nameEn: 'Family program', publicDescriptionAr: '', publicDescriptionEn: '', isPublic: true }], isLoading: false, isError: false, refetch: jest.fn() },
};

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockToken } }) }));
jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, accessibilityLabel, testID }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string; testID?: string }) => {
    const { Pressable, View } = require('react-native');
    if (!onPress) return <View>{children}</View>;
    return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={testID}>{children}</Pressable>;
  },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => mockLabels[key] ?? key }) }));
jest.mock('@/hooks/queries', () => ({
  useClinics: () => mockQueries.clinics,
  usePublicCatalog: () => mockQueries.catalog,
  useTherapists: () => mockQueries.therapists,
  usePackageFamilies: () => mockQueries.packages,
  useGroupSessions: () => mockQueries.programs,
}));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light') }));

import { ExploreDirectory } from '../ExploreDirectory';

describe('ExploreDirectory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockToken = 'token';
    for (const query of Object.values(mockQueries)) {
      query.isLoading = false;
      query.isError = false;
    }
  });

  it('starts with five category destinations and preserves IDs in service results', () => {
    const screen = render(<ExploreDirectory />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.queryByText('Family session')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Clinics' }));
    expect(screen.getAllByText('Family Clinic').length).toBeGreaterThan(0);
    expect(screen.queryByText('Family session')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    fireEvent.press(screen.getByRole('button', { name: 'Services' }));
    fireEvent.press(screen.getByTestId('explore-result-service-service-1'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/therapists',
      params: { clinicId: 'clinic-1', serviceId: 'service-1' },
    });
  });

  it('opens guest clinic results through the public detail route', () => {
    mockToken = null;
    const screen = render(<ExploreDirectory />);
    fireEvent.press(screen.getByRole('button', { name: 'Clinics' }));
    fireEvent.press(screen.getByTestId('explore-result-clinic-clinic-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/public-clinic/[id]', params: { id: 'clinic-1' } });
  });

  it('opens guest service details before the practitioner and priced booking choices', () => {
    mockToken = null;
    const screen = render(<ExploreDirectory />);
    fireEvent.press(screen.getByRole('button', { name: 'Services' }));
    fireEvent.press(screen.getByTestId('explore-result-service-service-1'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-detail/[kind]/[id]',
      params: { kind: 'service', id: 'service-1', clinicId: 'clinic-1' },
    });
  });

  it('searches clinics, services and specialist specialties together', () => {
    const screen = render(<ExploreDirectory />);
    fireEvent.changeText(screen.getByPlaceholderText('Search clinics, services, and specialists'), 'family');
    expect(screen.getAllByText('Family Clinic').length).toBeGreaterThan(0);
    expect(screen.getByText('Family session')).toBeTruthy();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('shows loading and retries failed catalog requests', () => {
    mockQueries.catalog.isLoading = true;
    const loading = render(<ExploreDirectory />);
    fireEvent.press(loading.getByRole('button', { name: 'Services' }));
    expect(loading.getByText('Loading...')).toBeTruthy();
    loading.unmount();

    mockQueries.catalog.isLoading = false;
    mockQueries.catalog.isError = true;
    const failed = render(<ExploreDirectory />);
    fireEvent.press(failed.getByRole('button', { name: 'Services' }));
    fireEvent.press(failed.getByText('Retry'));
    expect(mockQueries.catalog.refetch).toHaveBeenCalled();
    expect(failed.getByText('Could not load this information')).toBeTruthy();
  });

  it('shows an empty state when the search has no matching result', () => {
    const screen = render(<ExploreDirectory />);
    fireEvent.changeText(screen.getByPlaceholderText('Search clinics, services, and specialists'), 'no match');
    expect(screen.getByText('No results found')).toBeTruthy();
  });
});
