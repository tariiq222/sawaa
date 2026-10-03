import {
  NOTIFICATION_OUTBOX_CONSUMERS,
  NOTIFICATION_OUTBOX_REMINDER_POLICY_VERSION,
  type NotificationIntentPayload,
} from './notification-outbox.types';

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isValidNotificationIntentPayload(
  consumerKey: string,
  payload: NotificationIntentPayload | unknown,
): payload is NotificationIntentPayload {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const value = payload as Record<string, unknown>;
  switch (consumerKey) {
    case NOTIFICATION_OUTBOX_CONSUMERS.REFUND_OUTCOME_CLIENT:
      return value.kind === 'refund-outcome-client' && nonEmptyString(value.clientId) && nonEmptyString(value.refundRequestId) && nonEmptyString(value.currency) && ['COMPLETED', 'FAILED', 'DENIED', 'PENDING_REVIEW', 'MANUAL_REVIEW'].includes(String(value.status)) && Number.isSafeInteger(value.amount) && Number(value.amount) >= 0;
    case NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CREATED_STAFF:
      return value.kind === 'booking-created-staff' && nonEmptyString(value.bookingId);
    case NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_CLIENT:
      return value.kind === 'booking-cancelled-client' &&
        nonEmptyString(value.bookingId) &&
        nonEmptyString(value.clientId) &&
        nonEmptyString(value.reason);
    case NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_STAFF:
      return value.kind === 'booking-cancelled-staff' &&
        nonEmptyString(value.bookingId) &&
        nonEmptyString(value.reason);
    case NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_REMINDER_CLIENT: {
      if (
        value.kind !== 'booking-reminder-client' ||
        !nonEmptyString(value.bookingId) ||
        !nonEmptyString(value.clientId) ||
        !nonEmptyString(value.scheduledAt) ||
        value.policyVersion !== NOTIFICATION_OUTBOX_REMINDER_POLICY_VERSION
      ) return false;
      return !Number.isNaN(new Date(value.scheduledAt).getTime());
    }
    case NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT:
      return value.kind === 'client-enrolled-client' &&
        nonEmptyString(value.clientId) &&
        nonEmptyString(value.name);
    case NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_STAFF:
      return value.kind === 'client-enrolled-staff' &&
        nonEmptyString(value.clientId) &&
        nonEmptyString(value.name);
    case NOTIFICATION_OUTBOX_CONSUMERS.CONTACT_MESSAGE_STAFF:
      return value.kind === 'contact-message-staff' && nonEmptyString(value.contactMessageId);
    default:
      return false;
  }
}
