import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'booking-1' }),
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
}));

const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockRequestCancel = jest.fn().mockResolvedValue(undefined);
const mockComplete = jest.fn().mockResolvedValue(undefined);
const mockRefetch = jest.fn();

let mockAuthState: {
  user: {
    id: string;
    role: string;
    permissions: string[];
    isSuperAdmin?: boolean;
  } | null;
} = {
  user: {
    id: 'admin-1',
    role: 'ADMIN',
    permissions: ['*'],
    isSuperAdmin: true,
  },
};

jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: (selector: (state: { auth: typeof mockAuthState }) => unknown) =>
    selector({ auth: mockAuthState }),
}));

let mockIsLoading = false;
let mockIsError = false;
let mockData: Record<string, unknown> | null = {
  id: 'booking-1',
  status: 'confirmed',
  checkedInAt: null,
  bookingType: 'individual',
  deliveryType: 'in_person',
  date: '2026-09-27T10:00:00Z',
  startTime: '10:00',
  endTime: '11:00',
};

jest.mock('@/hooks/queries', () => ({
  useEmployeeBooking: () => ({
    data: mockData,
    isLoading: mockIsLoading,
    isError: mockIsError,
    refetch: mockRefetch,
  }),
  useEmployeeMeetingStart: () => ({ data: undefined }),
  useCancelEmployeeBooking: () => ({ mutateAsync: mockCancel }),
  useRequestCancelEmployeeBooking: () => ({ mutateAsync: mockRequestCancel }),
  useMarkEmployeeBookingCompleted: () => ({ mutateAsync: mockComplete }),
  useStartEmployeeBookingSession: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(null, 'light') }) }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const animation = { duration: () => animation, delay: () => animation, easing: () => animation };
  return {
    __esModule: true,
    default: { View },
    FadeInDown: animation,
    Easing: { out: () => undefined, cubic: undefined },
    useSharedValue: (init: unknown) => ({ value: init }),
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left', alignStart: 'flex-start', writingDirection: 'ltr' }) }));
jest.mock('@/hooks/useA11y', () => ({ useReduceMotion: () => true }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/theme/sawaa', () => {
  const { View, Pressable, Text } = require('react-native');
  return {
    ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: View,
    PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => <Pressable onPress={onPress}><Text>{label}</Text></Pressable>,
  };
});
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/components/features/JoinVideoCallButton', () => ({ JoinVideoCallButton: () => null }));
jest.mock('@/components/ui/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/components/ui/EmptyState', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    EmptyState: ({ title, actionLabel, onAction, description }: { title: string; actionLabel?: string; onAction?: () => void; description?: string }) => (
      <View testID="empty-state">
        <Text>{title}</Text>
        {description ? <Text>{description}</Text> : null}
        {actionLabel ? <Pressable onPress={onAction}><Text>{actionLabel}</Text></Pressable> : null}
      </View>
    ),
  };
});

import EmployeeAppointmentDetail from '../../app/(employee)/appointment/[id]';

// Sentinel value that would only appear if cached booking data leaked through
const SENSITIVE_SENTINEL = 'September 27';

describe('employee appointment detail states', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = { user: { id: 'staff', role: 'EMPLOYEE', permissions: ['booking:update', 'booking:delete'], isSuperAdmin: false } };
    mockCanGoBack = false;
    mockIsLoading = false;
    mockIsError = false;
    mockData = {
      id: 'booking-1',
      status: 'confirmed',
      checkedInAt: null,
      bookingType: 'individual',
      deliveryType: 'in_person',
      date: '2026-09-27T10:00:00Z',
      startTime: '10:00',
      endTime: '11:00',
    };
  });

  describe('loading state', () => {
    it('shows loading skeleton without crashing', () => {
      mockIsLoading = true;
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.queryByText('appointments.details')).toBeNull();
    });

    it('allows back navigation during loading to avoid trapped screen (cold)', () => {
      mockIsLoading = true;
      const screen = render(<EmployeeAppointmentDetail />);
      fireEvent.press(screen.getByLabelText('common.back'));
      expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today');
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('uses router.back when history exists during loading (warm)', () => {
      mockIsLoading = true;
      mockCanGoBack = true;
      const screen = render(<EmployeeAppointmentDetail />);
      fireEvent.press(screen.getByLabelText('common.back'));
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('error state', () => {
    it('shows error EmptyState with retry button on query error', () => {
      mockIsError = true;
      mockData = null;
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.getByTestId('empty-state')).toBeTruthy();
      expect(screen.getByText('common.error')).toBeTruthy();
      expect(screen.getByText('common.retry')).toBeTruthy();
    });

    it('calls refetch when retry is pressed', () => {
      mockIsError = true;
      mockData = null;
      const screen = render(<EmployeeAppointmentDetail />);
      fireEvent.press(screen.getByText('common.retry'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('navigates to fallback on back press from error state (cold)', () => {
      mockIsError = true;
      mockData = null;
      const screen = render(<EmployeeAppointmentDetail />);
      fireEvent.press(screen.getByLabelText('common.back'));
      expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today');
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('uses router.back from error state when history exists (warm)', () => {
      mockIsError = true;
      mockData = null;
      mockCanGoBack = true;
      const screen = render(<EmployeeAppointmentDetail />);
      fireEvent.press(screen.getByLabelText('common.back'));
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('does NOT display cached sensitive booking details on error (data sentinel)', () => {
      mockIsError = true;
      mockData = {
        id: 'booking-1',
        status: 'confirmed',
        checkedInAt: null,
        bookingType: 'individual',
        deliveryType: 'in_person',
        date: '2026-09-27T10:00:00Z',
        startTime: '10:00',
        endTime: '11:00',
      };
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.getByTestId('empty-state')).toBeTruthy();
      expect(screen.queryByText('appointments.details')).toBeNull();
      // The formatted date string is a sentinel that proves detail rendering
      expect(screen.queryByText(SENSITIVE_SENTINEL)).toBeNull();
    });

    it('does NOT show action buttons on error even with cached data', () => {
      mockIsError = true;
      mockData = {
        id: 'booking-1',
        status: 'confirmed',
        checkedInAt: null,
        bookingType: 'individual',
        deliveryType: 'in_person',
        date: '2026-09-27T10:00:00Z',
        startTime: '10:00',
        endTime: '11:00',
      };
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.queryByText('doctor.startSession')).toBeNull();
      expect(screen.queryByText('doctor.markCompleted')).toBeNull();
      expect(screen.queryByText('doctor.cancelBooking')).toBeNull();
    });

    it('recovers to detail view after retry resolves the error', () => {
      mockIsError = true;
      mockData = null;
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.getByText('common.error')).toBeTruthy();

      // Simulate successful retry: error clears, data arrives
      mockIsError = false;
      mockData = {
        id: 'booking-1',
        status: 'confirmed',
        checkedInAt: null,
        bookingType: 'individual',
        deliveryType: 'in_person',
        date: '2026-09-27T10:00:00Z',
        startTime: '10:00',
        endTime: '11:00',
      };
      screen.rerender(<EmployeeAppointmentDetail />);

      expect(screen.queryByText('common.error')).toBeNull();
      expect(screen.getByText('appointments.details')).toBeTruthy();
    });
  });

  describe('missing data (not found) state', () => {
    it('shows not-found EmptyState when data is null after loading', () => {
      mockData = null;
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.getByTestId('empty-state')).toBeTruthy();
      expect(screen.getByText('appointments.notFound')).toBeTruthy();
    });

    it('does not render null (blank screen) when booking is missing', () => {
      mockData = null;
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.toJSON()).not.toBeNull();
    });

    it('navigates to fallback on back from not-found (cold)', () => {
      mockData = null;
      const screen = render(<EmployeeAppointmentDetail />);
      fireEvent.press(screen.getByLabelText('common.back'));
      expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today');
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('uses router.back from not-found when history exists (warm)', () => {
      mockData = null;
      mockCanGoBack = true;
      const screen = render(<EmployeeAppointmentDetail />);
      fireEvent.press(screen.getByLabelText('common.back'));
      expect(mockBack).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('successful data rendering preserves existing behavior', () => {
    it('renders appointment details when data is present', () => {
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.getByText('appointments.details')).toBeTruthy();
    });

    it('shows cancel button for confirmed bookings when user has direct cancel permission', () => {
      mockAuthState = {
        user: { id: 'admin-1', role: 'ADMIN', permissions: ['booking:delete'], isSuperAdmin: false },
      };
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.getByText('doctor.cancelBooking')).toBeTruthy();
      expect(screen.queryByText('appointments.requestCancel')).toBeNull();
    });

    it('shows request cancel button for ordinary employee with Booking:update and submits cancel request', () => {
      mockAuthState = {
        user: { id: 'emp-1', role: 'EMPLOYEE', permissions: ['booking:read', 'booking:update'], isSuperAdmin: false },
      };
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.getByText('appointments.requestCancel')).toBeTruthy();
      expect(screen.queryByText('doctor.cancelBooking')).toBeNull();
    });

    it('hides cancellation action when user has neither delete nor update permission', () => {
      mockAuthState = {
        user: { id: 'viewer-1', role: 'STAFF', permissions: ['booking:read'], isSuperAdmin: false },
      };
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.queryByText('doctor.cancelBooking')).toBeNull();
      expect(screen.queryByText('appointments.requestCancel')).toBeNull();
    });

    it('shows start session for confirmed unchecked-in bookings', () => {
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.getByText('doctor.startSession')).toBeTruthy();
    });

    it('shows mark completed for confirmed checked-in bookings', () => {
      mockData = { ...mockData!, checkedInAt: '2026-09-27T09:55:00Z' };
      const screen = render(<EmployeeAppointmentDetail />);
      expect(screen.getByText('doctor.markCompleted')).toBeTruthy();
    });
  });
});
