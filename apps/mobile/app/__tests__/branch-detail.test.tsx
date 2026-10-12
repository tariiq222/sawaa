import React from 'react';
import { Linking, Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockRefetch = jest.fn();
let mockQuery: { data?: unknown; isLoading: boolean; isError: boolean; refetch: () => void };

const hours = [
  { dayOfWeek: 1, isOpen: true, startTime: '09:00', endTime: '17:00' },
  { dayOfWeek: 0, isOpen: true, startTime: '10:00', endTime: '14:00' },
  { dayOfWeek: 5, isOpen: false, startTime: null, endTime: null },
];
const branch = {
  id: 'branch-1', nameAr: 'الفرع الرئيسي', nameEn: 'Main Branch', city: 'Riyadh', isMain: true,
  addressAr: 'حي النخيل', addressEn: 'Al Nakheel', phone: '+966500000000',
  latitude: 24.7, longitude: 46.6, timezone: 'Asia/Riyadh', businessHours: hours,
};

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'branch-1' }),
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => true }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({
  useDir: () => ({ isRTL: false, locale: 'en', row: 'row', textAlign: 'left', writingDirection: 'ltr', alignStart: 'flex-start' }),
}));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => ({ AquaBackground: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('@/theme/components/Glass', () => ({
  Glass: ({ children }: { children: React.ReactNode }) => {
    const { View } = require('react-native');
    return <View>{children}</View>;
  },
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ scheme: 'light' }) }));
jest.mock('@/theme/sawaa/useSawaaColors', () => ({ useSawaaColors: () => jest.requireActual('@/theme/sawaa/tokens').getSawaaColors('light') }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => { const { View } = require('react-native'); return <View testID="skeleton" />; } }));
jest.mock('@/hooks/queries', () => ({ usePublicBranch: () => mockQuery }));

import BranchDetailScreen from '../branch/[id]';

describe('BranchDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = { data: branch, isLoading: false, isError: false, refetch: mockRefetch };
  });

  it('renders the branch details and hours ordered by weekday', () => {
    const screen = render(<BranchDetailScreen />);
    expect(screen.getAllByText('Main Branch').length).toBeGreaterThan(0);
    expect(screen.getByText('Riyadh')).toBeTruthy();
    expect(screen.getByText('Al Nakheel')).toBeTruthy();
    expect(screen.getByText('branches.main')).toBeTruthy();
    expect(screen.getByText('branches.hours')).toBeTruthy();
    expect(screen.getByText('Sunday')).toBeTruthy();
    expect(screen.getByText('Monday')).toBeTruthy();
    expect(screen.getByTestId('branch-hours-0')).toHaveTextContent(/10:00\s?AM.*2:00\s?PM/);
    expect(screen.getByTestId('branch-hours-5')).toHaveTextContent(/Friday/);
    expect(screen.getByTestId('branch-hours-5')).toHaveTextContent(/branches.closed/);
  });

  it('calls the branch phone and opens maps with the platform URL', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const canOpen = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const screen = render(<BranchDetailScreen />);

    fireEvent.press(screen.getByTestId('branch-call'));
    expect(openURL).toHaveBeenCalledWith('tel:+966500000000');

    fireEvent.press(screen.getByTestId('branch-maps'));
    const expected = Platform.OS === 'ios' ? 'maps:?q=24.7,46.6' : 'geo:24.7,46.6?q=24.7,46.6';
    await waitFor(() => expect(openURL).toHaveBeenCalledWith(expected));

    canOpen.mockResolvedValue(false);
    fireEvent.press(screen.getByTestId('branch-maps'));
    await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://maps.google.com/?q=24.7,46.6'));
    openURL.mockRestore();
    canOpen.mockRestore();
  });

  it('omits the actions when the branch has no phone or coordinates', () => {
    mockQuery = { ...mockQuery, data: { ...branch, phone: null, latitude: null, longitude: null } };
    const screen = render(<BranchDetailScreen />);
    expect(screen.queryByTestId('branch-call')).toBeNull();
    expect(screen.queryByTestId('branch-maps')).toBeNull();
  });

  it('shows skeletons while loading', () => {
    mockQuery = { isLoading: true, isError: false, refetch: mockRefetch };
    const screen = render(<BranchDetailScreen />);
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('shows an error state with retry', () => {
    mockQuery = { isLoading: false, isError: true, refetch: mockRefetch };
    const screen = render(<BranchDetailScreen />);
    expect(screen.getByText('branches.loadError')).toBeTruthy();
    fireEvent.press(screen.getByText('common.retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
