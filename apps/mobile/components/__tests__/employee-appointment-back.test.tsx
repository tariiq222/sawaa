import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

let mockPermissions = ['booking:delete', 'booking:update'];
jest.mock('@/hooks/use-redux', () => ({
  useAppSelector: () => ({ permissions: mockPermissions, isSuperAdmin: false }),
}));
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'booking-1' }),
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
}));
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockComplete = jest.fn().mockResolvedValue(undefined);
const mockRequestCancel = jest.fn().mockResolvedValue(undefined);
const mockRefetch = jest.fn().mockResolvedValue(undefined);
let mockStatus = 'cancelled';
let mockCheckedIn = false;
jest.mock('@/hooks/queries', () => ({
  useEmployeeBooking: () => ({ data: { id: 'booking-1', status: mockStatus, checkedInAt: mockCheckedIn ? '2026-09-27T09:55:00Z' : null, bookingType: 'individual', deliveryType: 'in_person', date: '2026-09-27T10:00:00Z', startTime: '10:00', endTime: '11:00' }, isLoading: false, refetch: mockRefetch }),
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
    ...jest.requireActual('@/theme/sawaa/tokens'), AquaBackground: View,
    PrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) => <Pressable onPress={onPress}><Text>{label}</Text></Pressable>,
  };
});
jest.mock('@/theme/components/Glass', () => ({ Glass: require('react-native').View }));
jest.mock('@/components/features/JoinVideoCallButton', () => ({ JoinVideoCallButton: () => null }));

import EmployeeAppointmentDetail from '../../app/(employee)/appointment/[id]';

describe('staff appointment deep-link back button', () => {
  beforeEach(() => { jest.clearAllMocks(); mockPermissions = ['booking:delete', 'booking:update']; mockCanGoBack = false; mockStatus = 'cancelled'; mockCheckedIn = false; });

  async function confirmAction(label: string) {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'common.confirm')?.onPress?.();
    });
    const screen = render(<EmployeeAppointmentDetail />);
    fireEvent.press(screen.getByText(label));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today'));
    expect(mockBack).not.toHaveBeenCalled();
    alert.mockRestore();
  }

  it('requests approval as ordinary staff without direct cancellation or navigation', async () => {
    mockPermissions = ['booking:update'];
    mockStatus = 'pending';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'common.confirm')?.onPress?.();
    });
    const screen = render(<EmployeeAppointmentDetail />);
    expect(screen.queryByText('doctor.cancelBooking')).toBeNull();
    fireEvent.press(screen.getByText('appointments.requestCancel'));
    await waitFor(() => expect(mockRequestCancel).toHaveBeenCalledWith('booking-1'));
    await waitFor(() => expect(alert).toHaveBeenCalledWith('appointments.cancellationRequestedTitle', 'appointments.cancellationRequestedMessage'));
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    mockStatus = 'cancel_requested';
    screen.rerender(<EmployeeAppointmentDetail />);
    expect(screen.queryByText('appointments.requestCancel')).toBeNull();
    alert.mockRestore();
  });

  it('leaves a cold detail after successful staff cancellation', async () => {
    mockStatus = 'confirmed';
    await confirmAction('doctor.cancelBooking');
    expect(mockCancel).toHaveBeenCalledWith('booking-1');
  });

  it('leaves a cold detail after marking a checked-in appointment complete', async () => {
    mockStatus = 'confirmed';
    mockCheckedIn = true;
    await confirmAction('doctor.markCompleted');
    expect(mockComplete).toHaveBeenCalledWith('booking-1');
  });

  it('returns to the staff tabs when the app opened without history', () => {
    const screen = render(<EmployeeAppointmentDetail />);
    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));
    expect(mockReplace).toHaveBeenCalledWith('/(employee)/(tabs)/today');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('uses the existing history when available', () => {
    mockCanGoBack = true;
    const screen = render(<EmployeeAppointmentDetail />);
    fireEvent.press(screen.getByLabelText('a11y.buttonBack'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
