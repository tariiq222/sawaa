import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
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
  'explore.viewAll': 'View all ({{count}})',
  'explore.centerTitle': 'The center',
  'explore.contact': 'Contact the center',
  'explore.email': 'Email',
  'branches.title': 'Branches',
  'branches.main': 'Main branch',
  'a11y.buttonBack': 'Back',
};
let mockBranches: unknown[] = [{ id: 'branch-1', nameAr: 'الفرع الرئيسي', nameEn: 'Main branch site', city: 'Riyadh', isMain: true, addressAr: null }];
let mockBranding: { contactPhone: string | null; contactEmail: string | null } = { contactPhone: '0500000000', contactEmail: 'info@example.test' };
const mockQueries = {
  clinics: { data: [{ id: 'clinic-1', nameAr: 'عيادة الأسرة', nameEn: 'Family Clinic', therapistCount: 1, serviceCount: 1, serviceIds: ['service-1'], bookingMode: 'SERVICES', directServiceId: null }], isLoading: false, isError: false, refetch: jest.fn() },
  catalog: { data: { departments: [], categories: [{ id: 'clinic-1', departmentId: null, nameAr: 'عيادة الأسرة', nameEn: 'Family Clinic', sortOrder: 0, kind: 'CLINIC', bookingMode: 'SERVICES' }], services: [{ id: 'service-1', categoryId: 'clinic-1', nameAr: 'جلسة أسرية', nameEn: 'Family session', price: 100, currency: 'SAR' }] }, isLoading: false, isError: false, refetch: jest.fn() },
  therapists: { data: [{ id: 'employee-1', slug: 'sara', nameAr: 'سارة', nameEn: 'Sara', specialty: 'Family counseling', specialtyAr: 'إرشاد أسري', serviceIds: ['service-1'], isBookable: true }], isLoading: false, isError: false, refetch: jest.fn() },
  packages: { data: [{ id: 'package-1', nameAr: 'باقة الأسرة', nameEn: 'Family package', isActive: true, isPublic: true, options: [] }], isLoading: false, isError: false, refetch: jest.fn() },
  programs: { data: [{ id: 'program-1', nameAr: 'برنامج الأسرة', nameEn: 'Family program', publicDescriptionAr: '', publicDescriptionEn: '', isPublic: true }], isLoading: false, isError: false, refetch: jest.fn() },
};

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useLocalSearchParams: () => ({}) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockToken } }) }));
jest.mock('@/components/ui/AppIcon', () => ({ AppIcon: () => null }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, accessibilityLabel, testID }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string; testID?: string }) => {
    const { Pressable, View } = require('react-native');
    if (!onPress) return <View>{children}</View>;
    return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={testID}>{children}</Pressable>;
  },
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, options?: { count?: number }) => (mockLabels[key] ?? key).replace('{{count}}', String(options?.count ?? '')) }) }));
jest.mock('@/hooks/queries', () => ({
  useClinics: () => mockQueries.clinics,
  usePublicCatalog: () => mockQueries.catalog,
  useTherapists: () => mockQueries.therapists,
  usePackageFamilies: () => mockQueries.packages,
  useGroupSessions: () => mockQueries.programs,
  usePublicBranches: () => ({ data: mockBranches }),
  useBranding: () => ({ data: mockBranding }),
}));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', writingDirection: 'ltr' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => require('@/theme/sawaa/tokens').getSawaaColors('light') }));

import { ExploreDirectory } from '../ExploreDirectory';

const manyClinics = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: `clinic-${index + 1}`, nameAr: `عيادة ${index + 1}`, nameEn: `Clinic ${index + 1}`, therapistCount: 1, serviceCount: 0, serviceIds: [], bookingMode: 'SERVICES', directServiceId: null,
}));

describe('ExploreDirectory', () => {
  const defaultClinics = mockQueries.clinics.data;

  beforeEach(() => {
    jest.clearAllMocks();
    mockToken = 'token';
    mockQueries.clinics.data = defaultClinics;
    mockBranches = [{ id: 'branch-1', nameAr: 'الفرع الرئيسي', nameEn: 'Main branch site', city: 'Riyadh', isMain: true, addressAr: null }];
    mockBranding = { contactPhone: '0500000000', contactEmail: 'info@example.test' };
    for (const query of Object.values(mockQueries)) {
      query.isLoading = false;
      query.isError = false;
    }
  });

  it('renders results grouped by kind under category chips', () => {
    const screen = render(<ExploreDirectory />);
    expect(screen.getByRole('button', { name: 'All' }).props.accessibilityState.selected).toBe(true);
    for (const label of ['Clinics', 'Services', 'Specialists', 'Packages', 'Programs']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    for (const id of ['clinic-clinic-1', 'service-service-1', 'therapist-employee-1', 'package-package-1', 'program-program-1']) {
      expect(screen.getByTestId(`explore-result-${id}`)).toBeTruthy();
    }
  });

  it('selects a kind chip, shows only that kind and keeps the service clinic ID', () => {
    const screen = render(<ExploreDirectory />);
    fireEvent.press(screen.getByRole('button', { name: 'Services' }));
    expect(screen.getByRole('button', { name: 'Services' }).props.accessibilityState.selected).toBe(true);
    expect(screen.queryByTestId('explore-result-clinic-clinic-1')).toBeNull();
    expect(screen.queryByText('Branches')).toBeNull();
    fireEvent.press(screen.getByTestId('explore-result-service-service-1'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(client)/therapists',
      params: { clinicId: 'clinic-1', serviceId: 'service-1', steps: '3' },
    });
  });

  it('caps each kind at four on the overview and View all selects that kind', () => {
    mockQueries.clinics.data = manyClinics(6) as typeof defaultClinics;
    const screen = render(<ExploreDirectory />);
    expect(screen.getByTestId('explore-result-clinic-clinic-4')).toBeTruthy();
    expect(screen.queryByTestId('explore-result-clinic-clinic-5')).toBeNull();
    fireEvent.press(screen.getByText('View all (6)'));
    expect(screen.getByTestId('explore-result-clinic-clinic-6')).toBeTruthy();
    expect(screen.queryByTestId('explore-result-service-service-1')).toBeNull();
    expect(screen.queryByText('View all (6)')).toBeNull();
  });

  it('shows every match without a cap while searching', () => {
    mockQueries.clinics.data = manyClinics(6) as typeof defaultClinics;
    const screen = render(<ExploreDirectory />);
    fireEvent.changeText(screen.getByPlaceholderText('Search clinics, services, and specialists'), 'clinic');
    expect(screen.getByTestId('explore-result-clinic-clinic-6')).toBeTruthy();
    expect(screen.queryByText(/View all/)).toBeNull();
    expect(screen.queryByText('Branches')).toBeNull();
    expect(screen.queryByText('The center')).toBeNull();
  });

  it('lists branches and opens the public branch screen', () => {
    const screen = render(<ExploreDirectory />);
    expect(screen.getByText('Branches')).toBeTruthy();
    expect(screen.getByText('Main branch')).toBeTruthy();
    fireEvent.press(screen.getByTestId('explore-branch-branch-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/branch/[id]', params: { id: 'branch-1' } });
  });

  it('shows centre contact rows and omits the ones without data', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const screen = render(<ExploreDirectory />);
    expect(screen.getByText('The center')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Contact the center' }));
    expect(openURL).toHaveBeenCalledWith('tel:0500000000');
    fireEvent.press(screen.getByRole('button', { name: 'Email' }));
    expect(openURL).toHaveBeenCalledWith('mailto:info@example.test');
    screen.unmount();

    mockBranding = { contactPhone: null, contactEmail: null };
    const empty = render(<ExploreDirectory />);
    expect(empty.queryByText('The center')).toBeNull();
    openURL.mockRestore();
  });

  it('opens guest clinic results through the public detail route', () => {
    mockToken = null;
    const screen = render(<ExploreDirectory />);
    fireEvent.press(screen.getByTestId('explore-result-clinic-clinic-1'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/public-clinic/[id]', params: { id: 'clinic-1' } });
  });

  it('opens guest service details before the practitioner and priced booking choices', () => {
    mockToken = null;
    const screen = render(<ExploreDirectory />);
    fireEvent.press(screen.getByTestId('explore-result-service-service-1'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/public-detail/[kind]/[id]',
      params: { kind: 'service', id: 'service-1', clinicId: 'clinic-1' },
    });
  });

  it('searches clinics, services and specialist specialties together', () => {
    const screen = render(<ExploreDirectory />);
    fireEvent.changeText(screen.getByPlaceholderText('Search clinics, services, and specialists'), 'family');
    expect(screen.getByTestId('explore-result-clinic-clinic-1')).toBeTruthy();
    expect(screen.getByText('Family session')).toBeTruthy();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('shows loading and retries only the failed requests', () => {
    mockQueries.catalog.isLoading = true;
    const loading = render(<ExploreDirectory />);
    expect(loading.getByText('Loading...')).toBeTruthy();
    loading.unmount();

    mockQueries.catalog.isLoading = false;
    mockQueries.catalog.isError = true;
    const failed = render(<ExploreDirectory />);
    fireEvent.press(failed.getByText('Retry'));
    expect(mockQueries.catalog.refetch).toHaveBeenCalled();
    expect(failed.getByText('Could not load this information')).toBeTruthy();
    expect(failed.queryByText('No results found')).toBeNull();
    expect(mockQueries.therapists.refetch).not.toHaveBeenCalled();
    expect(mockQueries.clinics.refetch).not.toHaveBeenCalled();
  });

  it('shows an empty state when the search has no matching result', () => {
    const screen = render(<ExploreDirectory />);
    fireEvent.changeText(screen.getByPlaceholderText('Search clinics, services, and specialists'), 'no match');
    expect(screen.getByText('No results found')).toBeTruthy();
  });
});
