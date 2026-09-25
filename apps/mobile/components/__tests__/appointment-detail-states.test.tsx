import React from 'react';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: false, language: 'en' }) }));
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
const mockRefetch = jest.fn();
const mockQuery = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'a1' }), useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/hooks/queries', () => ({ useBooking: () => mockQuery(), useCancelBooking: () => ({ isPending: false, mutate: jest.fn() }) }));
jest.mock('@/theme/sawaa', () => {
  const { View, Text, Pressable } = require('react-native');
  return { ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: View,
    PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => <Pressable onPress={onPress}><Text>{label}</Text></Pressable> };
});
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/components/features/JoinVideoCallButton', () => ({ JoinVideoCallButton: () => null }));
jest.mock('@/components/ui/EmptyState', () => {
  const { View, Text, Pressable } = require('react-native');
  return { EmptyState: ({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) =>
    <View><Text>{title}</Text>{onAction && <Pressable onPress={onAction}><Text>{actionLabel}</Text></Pressable>}</View> };
});
import AppointmentDetail from '../../app/(client)/appointment/[id]';
const booking = { id: 'a1', status: 'cancelled', scheduledAt: '', durationMins: 60, employee: { nameEn: 'Nora' } };
describe('appointment detail truthful states', () => {
  beforeEach(() => { jest.clearAllMocks(); mockQuery.mockReturnValue({ data: booking, isLoading: false, isError: false, refetch: mockRefetch }); });
  it('never invents clinical instructions or an upcoming confirmed status', () => {
    const screen = render(<AppointmentDetail />);
    expect(screen.queryByText(/progressive relaxation/)).toBeNull();
    expect(screen.queryByText('Confirmed · Upcoming')).toBeNull();
    expect(screen.getByText('appointments.cancelledStatus')).toBeTruthy();
  });
  it('shows loading instead of appointment details and actions', () => {
    mockQuery.mockReturnValue({ isLoading: true, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);
    expect(screen.getByText('common.loading')).toBeTruthy();
    expect(screen.queryByText('Cancel booking')).toBeNull();
  });
  it('offers retry on query failure without showing cached details', () => {
    mockQuery.mockReturnValue({ data: booking, isLoading: false, isError: true, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByText('common.retry'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Nora')).toBeNull();
  });
  it('does not render appointment actions for missing data', () => {
    mockQuery.mockReturnValue({ isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);
    expect(screen.getByText('common.noResults')).toBeTruthy();
    expect(screen.queryByText('Cancel booking')).toBeNull();
  });
});
