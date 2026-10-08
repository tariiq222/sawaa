import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { Program } from '@/services/client/group-sessions';
import type { ClientPackageFamily } from '@/services/client/packages';
const mockProgram: Program = {id:'program-1',ref:1,title:'برنامج',nameAr:'برنامج',nameEn:'Program',descriptionAr:null,descriptionEn:null,publicDescriptionAr:null,publicDescriptionEn:null,departmentId:'department-1',branchId:'branch-1',startDate:null,daysCount:1,hoursPerDay:1,minParticipants:1,maxParticipants:10,enrolledCount:10,price:'10000',currency:'SAR',depositEnabled:false,depositAmount:null,status:'PUBLISHED',isPublic:true,isFull:true,spotsLeft:0};
const mockFamily: ClientPackageFamily = {id:'family-1',nameAr:'باقة',nameEn:'Package',descriptionAr:null,descriptionEn:null,isStandalone:false,options:[{id:'offer-1',nameAr:'خيار',nameEn:'Option',sessionCount:4,price:{finalPrice:70000},displayGroups:[]} as unknown as ClientPackageFamily['options'][number]]};
let mockRichLists = false;
let mockSignedIn = false;
let mockCanGoBack = false;
let mockParams: Record<string, string> = { kind: 'clinics' };
const mockPush = jest.fn();
const mockClinics = [{ id: 'clinic-1', nameAr: 'عيادة', nameEn: 'Clinic', serviceIds: ['service-1'] }];
const mockTherapists = [{ id: 'employee-1', slug: 'sara', nameAr: 'سارة', nameEn: 'Sara', title: 'أخصائية إرشاد تربوي وأسري', publicBioAr: 'إرشاد الوالدين وتحديات الأطفال والمراهقين', serviceIds: ['service-1', 'service-2'] }];
const mockRefetch = { clinics: jest.fn(), therapists: jest.fn(), programs: jest.fn(), packages: jest.fn() };
let mockFailed: string[] = [];
let mockNoData = false;
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack, push: mockPush }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/use-redux', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ auth: { token: mockSignedIn ? 'token' : null } }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ isRTL: true, row: 'row-reverse', textAlign: 'right', locale: 'ar' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ AquaBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children, onPress, accessibilityLabel }: { children: React.ReactNode; onPress?: () => void; accessibilityLabel?: string }) => {
    const { Pressable, View } = require('react-native');
    if (!onPress) return <View>{children}</View>;
    return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>{children}</Pressable>;
  },
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/hooks/queries', () => ({
  useServicePriceFloors: () => ({}),
  useClinics: () => ({ data: mockNoData ? undefined : mockClinics, isLoading: false, isError: mockFailed.includes('clinics'), refetch: mockRefetch.clinics }),
  useTherapists: () => ({ data: mockNoData ? undefined : mockTherapists, isLoading: false, isError: mockFailed.includes('therapists'), refetch: mockRefetch.therapists }),
  useGroupSessions: () => ({ data: mockNoData ? undefined : mockRichLists ? [mockProgram] : [], isLoading: false, isError: mockFailed.includes('programs'), refetch: mockRefetch.programs }),
  usePackageFamilies: () => ({ data: mockNoData ? undefined : mockRichLists ? [mockFamily] : [], isLoading: false, isError: mockFailed.includes('packages'), refetch: mockRefetch.packages }),
}));

import PublicListScreen from '../public-list/[kind]';

it('returns to public home when a list has no history entry', () => {
  mockSignedIn = false;
  mockCanGoBack = false;
  mockReplace.mockClear();
  mockBack.mockClear();
  const screen = render(<PublicListScreen />);
  const { fireEvent } = require('@testing-library/react-native');
  fireEvent.press(screen.getByRole('button', { name: 'a11y.buttonBack' }));
  expect(mockReplace).toHaveBeenCalledWith('/(guest)/home');
  expect(mockBack).not.toHaveBeenCalled();
});

it('opens guest clinic cards on the public clinic route', () => {
  mockSignedIn = false;
  mockParams = { kind: 'clinics' };
  const screen = render(<PublicListScreen />);
  const { fireEvent } = require('@testing-library/react-native');
  fireEvent.press(screen.getByRole('button', { name: 'عيادة' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/public-clinic/[id]', params: { id: 'clinic-1' } });
});

it('keeps clinic and selected service context when opening a guest practitioner detail', () => {
  mockSignedIn = false;
  mockParams = { kind: 'therapists', clinicId: 'clinic-1', serviceId: 'service-1' };
  mockPush.mockClear();
  const screen = render(<PublicListScreen />);
  const { fireEvent } = require('@testing-library/react-native');
  expect(screen.getByText('أخصائية إرشاد تربوي وأسري')).toBeTruthy();
  fireEvent.press(screen.getByRole('link', { name: 'therapists.viewProfile' }));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/public-detail/[kind]/[id]',
    params: { kind: 'therapist', id: 'sara', clinicId: 'clinic-1', serviceId: 'service-1' },
  });
});

beforeEach(() => {
  mockFailed = [];
  mockRichLists = false;
  mockNoData = false;
  mockParams = { kind: 'clinics' };
  jest.clearAllMocks();
});

it.each(['clinics', 'therapists', 'packages', 'programs'])('shows an error and retries the relevant %s query', (kind) => {
  mockParams = { kind };
  mockNoData = true;
  mockFailed = [kind];
  const screen = render(<PublicListScreen />);
  expect(screen.getByText('guest.loadError')).toBeTruthy();
  expect(screen.queryByText('guest.empty')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'common.retry' }));
  expect(mockRefetch[kind as keyof typeof mockRefetch]).toHaveBeenCalledTimes(1);
  Object.entries(mockRefetch).filter(([name]) => name !== kind).forEach(([, retry]) => expect(retry).not.toHaveBeenCalled());
});

it('keeps a successful empty result distinct from a failure', () => {
  mockParams = { kind: 'programs' };
  const screen = render(<PublicListScreen />);
  expect(screen.getByText('guest.empty')).toBeTruthy();
  expect(screen.queryByText('guest.loadError')).toBeNull();
});

it('retries clinic context and practitioners for a clinic-scoped list', () => {
  mockParams = { kind: 'therapists', clinicId: 'clinic-1' };
  mockFailed = ['clinics'];
  mockNoData = true;
  const screen = render(<PublicListScreen />);
  expect(screen.getByText('guest.loadError')).toBeTruthy();
  expect(screen.queryByText('guest.empty')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'common.retry' }));
  expect(mockRefetch.clinics).toHaveBeenCalledTimes(1);
  expect(mockRefetch.therapists).toHaveBeenCalledTimes(1);
});

it('ignores unrelated query failures in an unscoped practitioner list', () => {
  mockParams = { kind: 'therapists' };
  mockFailed = ['clinics', 'programs'];
  const screen = render(<PublicListScreen />);
  expect(screen.getByRole('button', { name: 'سارة' })).toBeTruthy();
  expect(screen.queryByText('guest.loadError')).toBeNull();
});

it('keeps cached cards visible with a retry when refreshing fails', () => {
  mockFailed = ['clinics'];
  const screen = render(<PublicListScreen />);
  expect(screen.getByRole('button', { name: 'عيادة' })).toBeTruthy();
  expect(screen.getByText('guest.loadError')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'common.retry' })).toBeTruthy();
});

it('shows package option prices and opens the original family', () => {
  mockRichLists=true;mockParams={kind:'packages'};mockPush.mockClear();
  const screen=render(<PublicListScreen />);expect(screen.getByText('٧٠٠٫٠٠ ر.س')).toBeTruthy();
  fireEvent.press(screen.getByRole('button',{name:'packages.buy'}));
  expect(mockPush).toHaveBeenCalledWith({pathname:'/public-detail/[kind]/[id]',params:{kind:'package',id:'family-1'}});
});
it('keeps a full public program detail reachable', () => {
  mockRichLists=true;mockParams={kind:'programs'};mockPush.mockClear();
  const screen=render(<PublicListScreen />);fireEvent.press(screen.getByRole('button',{name:'guest.viewDetails'}));
  expect(mockPush).toHaveBeenCalledWith({pathname:'/public-detail/[kind]/[id]',params:{kind:'program',id:'program-1'}});
});
