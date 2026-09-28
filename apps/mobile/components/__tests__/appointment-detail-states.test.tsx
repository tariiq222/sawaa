import React from 'react';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: false, language: 'en' }) }));
import { fireEvent, render } from '@testing-library/react-native';
import { Alert, ScrollView } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View: require('react-native').View }, FadeInDown: animation, Easing: { out: jest.fn(), cubic: jest.fn() } };
});
const mockRefetch = jest.fn();
const mockQuery = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
const mockCancel = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'a1' }), useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, canGoBack: () => mockCanGoBack }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/hooks/queries', () => ({ useBooking: () => mockQuery(), useCancelBooking: () => ({ isPending: false, mutate: mockCancel }) }));
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
  beforeEach(() => { jest.clearAllMocks(); mockCanGoBack = true; mockQuery.mockReturnValue({ data: booking, isLoading: false, isError: false, refetch: mockRefetch }); });
  it('returns to client appointments from a cold notification without history', () => {
    mockCanGoBack = false;
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));
    expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/appointments');
    expect(mockBack).not.toHaveBeenCalled();
  });
  it('preserves ordinary back navigation when history exists', () => {
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
  it('can leave the error screen opened from a cold link', () => {
    mockCanGoBack = false;
    mockQuery.mockReturnValue({ data: null, isLoading: false, isError: true, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));
    expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/appointments');
  });
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

  it('offers a rating route for completed appointments', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'completed' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    fireEvent.press(screen.getByText('appointments.rate'));

    expect(mockPush).toHaveBeenCalledWith('/(client)/rate/a1');
  });

  it('does not offer rating or cancellation for a cancelled appointment', () => {
    const screen = render(<AppointmentDetail />);

    expect(screen.queryByText('appointments.rate')).toBeNull();
    expect(screen.queryByText('Cancel booking')).toBeNull();
  });

  it('keeps cancellation available for a confirmed appointment', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    expect(screen.getByText('Cancel booking')).toBeTruthy();
    expect(screen.queryByText('appointments.rate')).toBeNull();
  });

  it('places cancellation with the appointment content instead of pinning it below empty space', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);
    const scroll = screen.UNSAFE_getByType(ScrollView);
    expect(scroll.findByProps({ children: 'Cancel booking' })).toBeTruthy();
    expect(screen.getByText('appointments.details')).toBeTruthy();
  });

  it('does not offer client cancellation while a group appointment awaits enough participants', () => {
    mockQuery.mockReturnValue({ data: { ...booking, type: 'group', status: 'pending_group_fill' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    expect(screen.queryByText('Cancel booking')).toBeNull();
  });

  it('does not offer cancellation for an active group booking', () => {
    mockQuery.mockReturnValue({ data: { ...booking, bookingType: 'GROUP', status: 'confirmed' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    expect(screen.queryByText('Cancel booking')).toBeNull();
  });

  it('shows a pending cancellation label for a cancellation request', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'cancel_requested' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    expect(screen.getByText('appointments.pendingCancellation')).toBeTruthy();
    expect(screen.queryByText('Cancel booking')).toBeNull();
  });

  it('does not offer the rating CTA when this session has submitted a rating', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'completed', ratingSubmittedLocally: true }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    expect(screen.queryByText('appointments.rate')).toBeNull();
  });

  it('does not offer the rating CTA when the detail API says a rating already exists', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'completed', hasRated: true }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    expect(screen.queryByText('appointments.rate')).toBeNull();
  });

  it('returns to appointments after immediate cancellation from a cold link', () => {
    mockCanGoBack = false;
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' }, isLoading: false, isError: false, refetch: mockRefetch });
    mockCancel.mockImplementation((_vars, callbacks) => callbacks.onSuccess({ status: 'cancelled' }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons) => {
      if (title === 'Cancel booking') buttons?.[1]?.onPress?.();
    });
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByText('Cancel booking'));
    expect(mockReplace).toHaveBeenCalledWith('/(client)/(tabs)/appointments');
    expect(mockBack).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('explains that a cancellation is awaiting approval and keeps the detail open', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' }, isLoading: false, isError: false, refetch: mockRefetch });
    mockCancel.mockImplementation((_vars, callbacks) => callbacks.onSuccess({ status: 'cancel_requested' }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons) => {
      if (title === 'Cancel booking') buttons?.[1]?.onPress?.();
    });
    render(<AppointmentDetail />);

    fireEvent.press(require('@testing-library/react-native').screen.getByText('Cancel booking'));

    expect(alert).toHaveBeenCalledWith(
      'appointments.cancellationRequestedTitle',
      'appointments.cancellationRequestedMessage',
    );
    expect(mockBack).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
