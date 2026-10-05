import React from 'react';
jest.mock('@/theme/useTheme', () => ({ useTheme: () => ({ theme: require('@/theme/tokens').buildTheme(), scheme: 'light', isRTL: false, language: 'en' }) }));
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

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
const mockPreview = jest.fn();
const mockPreviewRefetch = jest.fn();
const mockUuid = jest.fn(() => 'action-uuid');
const refund = { status: 'PENDING_REVIEW', paidAmount: 10000, alreadyRefundedAmount: 0, pendingRefundAmount: 0, refundAmount: 5000, refundPercent: 50, currency: 'SAR', execution: 'REVIEW', window: 'LATE' };
const preview = { policyEnabled: true, requiresApproval: false, refundDecision: 'QUOTED' as const, canCancel: true, reasonCode: 'ALLOWED', cutoffAt: '2099-01-01T00:00:00Z', quoteToken: 'quote-1', refund };
jest.mock('expo-modules-core', () => ({ ...jest.requireActual('expo-modules-core'), uuid: { v4: () => mockUuid() } }));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'a1' }), useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace, canGoBack: () => mockCanGoBack }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useDir', () => ({ useDir: () => ({ locale: 'en', isRTL: false, row: 'row', textAlign: 'left' }) }));
jest.mock('@/theme/fonts', () => ({ getFontName: () => 'System' }));
jest.mock('@/hooks/queries', () => ({ useBooking: () => mockQuery(), useCancelBooking: () => ({ isPending: false, mutateAsync: mockCancel }), useBookingCancellationPreview: () => mockPreview() }));
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
  beforeEach(() => { jest.clearAllMocks(); mockPreview.mockReturnValue({ data: { ...preview, policyEnabled: false }, refetch: mockPreviewRefetch }); mockCanGoBack = true; mockQuery.mockReturnValue({ data: booking, isLoading: false, isError: false, refetch: mockRefetch }); });
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
    expect(screen.queryByText('appointments.cancelAppointment')).toBeNull();
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
    expect(screen.queryByText('appointments.cancelAppointment')).toBeNull();
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
    expect(screen.queryByText('appointments.cancelAppointment')).toBeNull();
  });

  it('keeps cancellation available for a confirmed appointment', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    expect(screen.getByText('appointments.cancelAppointment')).toBeTruthy();
    expect(screen.queryByText('appointments.rate')).toBeNull();
  });

  it('lets the client keep the appointment after reviewing cancellation terms', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' } });
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByText('appointments.cancelAppointment'));
    expect(screen.getByText('cancellation.confirm')).toBeTruthy();

    fireEvent.press(screen.getByText('cancellation.keepAppointment'));

    expect(screen.queryByText('cancellation.confirm')).toBeNull();
    expect(screen.getByText('appointments.cancelAppointment')).toBeTruthy();
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('places cancellation with the appointment content instead of pinning it below empty space', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);
    const scroll = screen.UNSAFE_getByType(ScrollView);
    expect(scroll.findByProps({ children: 'appointments.cancelAppointment' })).toBeTruthy();
    expect(screen.getByText('appointments.details')).toBeTruthy();
  });

  it('does not offer client cancellation while a group appointment awaits enough participants', () => {
    mockQuery.mockReturnValue({ data: { ...booking, type: 'group', status: 'pending_group_fill' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    expect(screen.queryByText('appointments.cancelAppointment')).toBeNull();
  });

  it('does not offer cancellation for an active group booking', () => {
    mockQuery.mockReturnValue({ data: { ...booking, bookingType: 'GROUP', status: 'confirmed' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    expect(screen.queryByText('appointments.cancelAppointment')).toBeNull();
  });

  it('shows a pending cancellation label for a cancellation request', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'cancel_requested' }, isLoading: false, isError: false, refetch: mockRefetch });
    const screen = render(<AppointmentDetail />);

    expect(screen.getByText('appointments.pendingCancellation')).toBeTruthy();
    expect(screen.queryByText('appointments.cancelAppointment')).toBeNull();
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

  it.each(['cancelled', 'cancel_requested'])('retains the %s outcome on the detail screen', async (status) => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' }, refetch: mockRefetch });
    mockCancel.mockResolvedValue({ status });
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByText('appointments.cancelAppointment'));
    expect(mockCancel).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('cancellation.confirm'));
    expect(await screen.findByText(status === 'cancelled' ? 'cancellation.cancelled' : 'appointments.cancellationRequestedMessage')).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith({ id: 'a1', reason: 'appointments.cancelReason', acceptedRefundTerms: true, quoteToken: 'quote-1', sourceActionId: 'action-uuid' });
  });

  it('shows the quoted amount and sends the quote only after explicit confirmation', async () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'deposit_paid' }, refetch: mockRefetch });
    mockPreview.mockReturnValue({ data: preview, refetch: mockPreviewRefetch });
    mockCancel.mockResolvedValue({ status: 'cancelled', refund });
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByText('appointments.cancelAppointment'));
    expect(screen.getByText(/50.00 SAR/)).toBeTruthy();
    expect(screen.getByText('cancellation.reviewPreview')).toBeTruthy();
    expect(mockCancel).not.toHaveBeenCalled();
    fireEvent.press(screen.getByText('cancellation.confirm'));
    expect(await screen.findByText('cancellation.PENDING_REVIEW')).toBeTruthy();
    expect(mockCancel).toHaveBeenCalledWith({ id: 'a1', reason: 'appointments.cancelReason', acceptedRefundTerms: true, quoteToken: 'quote-1', sourceActionId: 'action-uuid' });
  });

  it.each(['CUTOFF_PASSED', 'ATTENDED', 'FINAL_STATE', 'HISTORICAL', 'GROUP_STAFF_ONLY'])('disables cancellation for server reason %s', (reasonCode) => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' } });
    mockPreview.mockReturnValue({ data: { ...preview, canCancel: false, reasonCode } });
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByText('appointments.cancelAppointment'));
    expect(screen.getByText(`cancellation.${reasonCode}`)).toBeTruthy();
    expect(screen.queryByText('cancellation.confirm')).toBeNull();
  });

  it('does not bypass a failed preview request', () => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' } });
    mockPreview.mockReturnValue({ isError: true, refetch: mockPreviewRefetch });
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByText('appointments.cancelAppointment'));
    expect(screen.getByText('cancellation.loadError')).toBeTruthy();
    expect(screen.queryByText('cancellation.confirm')).toBeNull();
    fireEvent.press(screen.getByText('cancellation.retry'));
    expect(mockPreviewRefetch).toHaveBeenCalledTimes(1);
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it('refreshes a stale quote and requires another confirmation', async () => {
    mockUuid.mockReturnValueOnce('action-1').mockReturnValueOnce('action-2');
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' } });
    mockPreview.mockReturnValue({ data: preview, refetch: mockPreviewRefetch });
    mockCancel.mockRejectedValueOnce({ response: { status: 409 } }).mockResolvedValue({ status: 'cancelled', refund });
    mockPreviewRefetch.mockResolvedValue({ data: { ...preview, quoteToken: 'quote-2' } });
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByText('appointments.cancelAppointment'));
    fireEvent.press(screen.getByText('cancellation.confirm'));
    await waitFor(() => expect(mockPreviewRefetch).toHaveBeenCalledTimes(1));
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByText('cancellation.changed')).toBeTruthy();
    mockPreview.mockReturnValue({ data: { ...preview, quoteToken: 'quote-2', refund: { ...refund, refundAmount: 2500 } }, refetch: mockPreviewRefetch });
    screen.rerender(<AppointmentDetail />);
    expect(screen.getByText(/25.00 SAR/)).toBeTruthy();
    fireEvent.press(screen.getByText('cancellation.confirm'));
    await waitFor(() => expect(mockCancel).toHaveBeenCalledTimes(2));
    expect(mockCancel.mock.calls[1][0]).toMatchObject({ acceptedRefundTerms: true, quoteToken: 'quote-2', sourceActionId: 'action-2' });
    expect(mockCancel.mock.calls[0][0].sourceActionId).toBe('action-1');
  });

  it.each(['NOT_APPLICABLE', 'NO_REFUND', 'PROCESSING', 'PENDING_REVIEW', 'CREDIT_RETURNED', 'COMPLETED', 'FAILED'])('retains persisted %s refund state after reopening', (status) => {
    mockQuery.mockReturnValue({ data: { ...booking, cancellationRefund: { ...refund, status, completedAmount: status === 'COMPLETED' ? 5000 : 0, failedAmount: status === 'FAILED' ? 5000 : 0 } } });
    const screen = render(<AppointmentDetail />);
    expect(screen.getByText(`cancellation.${status}`)).toBeTruthy();
    expect(screen.queryByText('cancellation.confirm')).toBeNull();
  });
  it.each([
    ['NOT_APPLICABLE', 'NONE', 'NOT_APPLICABLE'], ['NO_REFUND', 'NONE', 'NO_REFUND'],
    ['PROCESSING', 'AUTOMATIC', 'automaticPreview'], ['CREDIT_RETURNED', 'NONE', 'creditPreview'],
  ])('shows %s terms before confirmation', (status, execution, message) => {
    mockQuery.mockReturnValue({ data: { ...booking, status: 'confirmed' } });
    mockPreview.mockReturnValue({ data: { ...preview, refund: { ...refund, status, execution, refundAmount: status === 'PROCESSING' ? 5000 : 0 } } });
    const screen = render(<AppointmentDetail />);
    fireEvent.press(screen.getByText('appointments.cancelAppointment'));
    expect(screen.getByText(`cancellation.${message}`)).toBeTruthy();
    expect(mockCancel).not.toHaveBeenCalled();
  });

});
