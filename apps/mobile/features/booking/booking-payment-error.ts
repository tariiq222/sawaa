import { Alert } from 'react-native';
import type { TFunction } from 'i18next';

/** Translate the known booking conflict instead of showing the server's English message. */
export function showBookingPaymentError(error: unknown, t: TFunction, viewAppointments: () => void): void {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } } | null)?.response;
  const message = response?.data?.message;
  const messages = Array.isArray(message) ? message : [message];
  const overlaps = response?.status === 409
    && messages.some((value) => value === 'Client already has an overlapping appointment');

  if (overlaps) {
    Alert.alert(t('booking.overlapTitle'), t('booking.overlapDescription'), [
      { text: t('common.ok'), style: 'cancel' },
      { text: t('client.appointments'), onPress: viewAppointments },
    ]);
    return;
  }
  Alert.alert(t('common.error'), t('payment.couldNotContinuePaymentTryAgain'));
}
