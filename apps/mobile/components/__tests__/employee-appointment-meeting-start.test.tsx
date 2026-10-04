import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'booking-1' }),
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ auth: { user: { id: 'staff', role: 'EMPLOYEE', permissions: ['booking:update'], isSuperAdmin: false } } }),
}));

const mockMeetingStartHook = jest.fn();
jest.mock('@/hooks/queries', () => ({
  useEmployeeBooking: () => ({
    data: {
      id: 'booking-1',
      status: 'confirmed',
      checkedInAt: null,
      bookingType: 'individual',
      deliveryType: 'online',
      zoomMeetingStatus: 'CREATED',
      zoomJoinUrl: 'https://zoom.us/j/123',
      date: '2026-10-01',
      startTime: '17:30',
      endTime: '18:20',
    },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useEmployeeMeetingStart: (...args: unknown[]) => mockMeetingStartHook(...args),
  useCancelEmployeeBooking: () => ({ mutateAsync: jest.fn() }),
  useRequestCancelEmployeeBooking: () => ({ mutateAsync: jest.fn() }),
  useMarkEmployeeBookingCompleted: () => ({ mutateAsync: jest.fn() }),
  useStartEmployeeBookingSession: () => ({ mutateAsync: jest.fn() }),
}));

let mockVideoCalls = true;
jest.mock('@/constants/feature-flags', () => ({
  FEATURE_FLAGS: {
    get videoCalls() {
      return mockVideoCalls;
    },
  },
}));

jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return { __esModule: true, default: { View }, FadeInDown: animation, Easing: { out: () => undefined, cubic: undefined } };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', alignStart: 'flex-start', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    ...jest.requireActual('@/theme/sawaa/tokens'),
    AquaBackground: View,
    PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => <Pressable onPress={onPress}><Text>{label}</Text></Pressable>,
  };
});
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/features/JoinVideoCallButton', () => {
  const { Text } = require('react-native');
  return {
    JoinVideoCallButton: (props: { url: string | null; scheduledAt: string; durationMins: number; status: string | null; variant: string }) => (
      <Text testID="host-button">{`${props.variant}|${props.url}|${props.scheduledAt}|${props.durationMins}|${props.status}`}</Text>
    ),
  };
});

import EmployeeAppointmentDetail from '../../app/(employee)/appointment/[id]';

describe('employee appointment detail - start meeting', () => {
  beforeEach(() => {
    mockMeetingStartHook.mockReset();
    mockVideoCalls = true;
  });

  it('shows the host button from the start-meeting details, not from the booking row', () => {
    mockMeetingStartHook.mockReturnValue({
      data: {
        bookingId: 'booking-1',
        scheduledAt: '2026-10-01T14:30:00.000Z',
        durationMins: 50,
        meetingStatus: 'CREATED',
        startUrl: 'https://zoom.us/s/123?zak=token',
      },
    });

    const screen = render(<EmployeeAppointmentDetail />);

    expect(screen.getByTestId('host-button').props.children).toBe(
      'start|https://zoom.us/s/123?zak=token|2026-10-01T14:30:00.000Z|50|CREATED',
    );
    expect(mockMeetingStartHook).toHaveBeenCalledWith('booking-1', true);
  });

  it('shows no host button until the start-meeting details arrive', () => {
    mockMeetingStartHook.mockReturnValue({ data: undefined });
    const screen = render(<EmployeeAppointmentDetail />);
    expect(screen.queryByTestId('host-button')).toBeNull();
  });

  it('does not fetch the host link while video calls are switched off', () => {
    mockVideoCalls = false;
    mockMeetingStartHook.mockReturnValue({ data: undefined });
    render(<EmployeeAppointmentDetail />);
    expect(mockMeetingStartHook).toHaveBeenCalledWith('booking-1', false);
  });
});
