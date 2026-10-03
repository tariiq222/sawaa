import type { StaffCancellationIntent } from '../../finance/cancellation-refund/staff-cancellation-refund';
import type { ClientCancellationIntent } from '../../bookings/client/client-cancellation-policy';
import type { Prisma } from '@prisma/client';

export const NOTIFICATION_OUTBOX_PAYLOAD_VERSION = 1 as const;
export const NOTIFICATION_OUTBOX_REMINDER_POLICY_VERSION = 1 as const;

export const NOTIFICATION_OUTBOX_OUTCOME_REASONS = {
  NO_PROVIDER: 'NO_PROVIDER',
  TEMPLATE_UNAVAILABLE: 'TEMPLATE_UNAVAILABLE',
  RECIPIENT_DISABLED: 'RECIPIENT_DISABLED',
  MISSING_TARGET: 'MISSING_TARGET',
  SAFE_TRANSIENT: 'SAFE_TRANSIENT',
  ATTEMPTS_EXHAUSTED: 'ATTEMPTS_EXHAUSTED',
  AMBIGUOUS_PROVIDER_OUTCOME: 'AMBIGUOUS_PROVIDER_OUTCOME',
  LEASE_EXPIRED: 'LEASE_EXPIRED',
  EXPIRED: 'EXPIRED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  PROVIDER_REJECTED: 'PROVIDER_REJECTED',
} as const;

export const NOTIFICATION_OUTBOX_CONSUMERS = {
  REFUND_OUTCOME_CLIENT: 'comms.refund-outcome-client.v1',
  BOOKING_CREATED_STAFF: 'comms.booking-created-staff.v2',
  BOOKING_CANCELLED_CLIENT: 'comms.booking-cancelled-client.v2',
  BOOKING_CANCELLED_STAFF: 'comms.booking-cancelled-staff.v2',
  BOOKING_REMINDER_CLIENT: 'comms.booking-reminder-client.v2',
  CLIENT_ENROLLED_CLIENT: 'comms.client-enrolled-client.v2',
  CLIENT_ENROLLED_STAFF: 'comms.client-enrolled-staff.v2',
  CONTACT_MESSAGE_STAFF: 'comms.contact-message-staff.v2',
} as const;

export type NotificationOutboxConsumerKey =
  (typeof NOTIFICATION_OUTBOX_CONSUMERS)[keyof typeof NOTIFICATION_OUTBOX_CONSUMERS];

export type BookingCreatedStaffPayload = {
  kind: 'booking-created-staff';
  bookingId: string;
  bookingNumber?: number;
  employeeId?: string;
};

export type BookingCancelledClientPayload = {
  kind: 'booking-cancelled-client';
  centerCancellation?: StaffCancellationIntent;
  clientCancellation?: ClientCancellationIntent;
  bookingId: string;
  clientId: string;
  reason: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
};

export type BookingCancelledStaffPayload = {
  kind: 'booking-cancelled-staff';
  centerCancellation?: StaffCancellationIntent;
  bookingId: string;
  bookingNumber?: number;
  employeeId?: string;
  reason: string;
};

export type BookingReminderPayload = {
  kind: 'booking-reminder-client';
  bookingId: string;
  clientId: string;
  scheduledAt: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceName?: string;
  policyVersion: number;
};

export type ClientEnrolledClientPayload = {
  kind: 'client-enrolled-client';
  clientId: string;
  name: string;
  phone?: string;
  email?: string;
};

export type ClientEnrolledStaffPayload = {
  kind: 'client-enrolled-staff';
  clientId: string;
  name: string;
};

export type ContactMessageStaffPayload = {
  kind: 'contact-message-staff';
  contactMessageId: string;
};

export type RefundOutcomeClientPayload = {
  kind: 'refund-outcome-client'; clientId: string; bookingId: string | null; refundRequestId: string; status: 'COMPLETED' | 'FAILED' | 'DENIED' | 'PENDING_REVIEW' | 'MANUAL_REVIEW'; amount: number; currency: string;
};

export type NotificationIntentPayload =
  | RefundOutcomeClientPayload
  | BookingCreatedStaffPayload
  | BookingCancelledClientPayload
  | BookingCancelledStaffPayload
  | BookingReminderPayload
  | ClientEnrolledClientPayload
  | ClientEnrolledStaffPayload
  | ContactMessageStaffPayload;

export interface CaptureNotificationIntent {
  sourceKey: string;
  consumerKey: NotificationOutboxConsumerKey;
  sourceOutboxId?: string;
  payloadVersion: typeof NOTIFICATION_OUTBOX_PAYLOAD_VERSION;
  payload: NotificationIntentPayload;
  occurredAt: Date;
  expiresAt?: Date;
}

export interface CaptureNotificationIntentPort {
  execute(
    command: CaptureNotificationIntent,
    tx?: Prisma.TransactionClient,
  ): Promise<string>;
}

export interface MaterializeNotificationIntentPort {
  execute(intentId: string): Promise<void>;
}

export interface NotificationDeliveryWorkerPort {
  process(deliveryId: string, generation: number): Promise<void>;
}

export type NotificationOutboxTickResult = {
  examined: number;
  changed: number;
  failed: number;
};

export interface NotificationOutboxTickPort {
  execute(): Promise<NotificationOutboxTickResult>;
}

export type InAppChannelPayload = {
  channel: 'IN_APP';
  notificationType: string;
  title: string;
  body: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type PushChannelPayload = {
  channel: 'PUSH';
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type SmsChannelPayload = {
  channel: 'SMS';
  body: string;
};

export type EmailChannelPayload = {
  channel: 'EMAIL';
  templateSlug: string;
  subject: string;
  html: string;
};

export type NotificationDeliveryChannelPayload =
  | InAppChannelPayload
  | PushChannelPayload
  | SmsChannelPayload
  | EmailChannelPayload;

export const notificationSourceKey = {
  domainEvent(eventId: string): string {
    return `domain-event:${eventId}`;
  },
  reminder(bookingId: string, scheduledAt: Date | string, policyVersion: number): string {
    return `booking-reminder:${bookingId}:${new Date(scheduledAt).toISOString()}:v${policyVersion}`;
  },
  clientEnrolled(clientId: string): string {
    return `client-enrolled:${clientId}`;
  },
  contactMessage(contactMessageId: string): string {
    return `contact-message:${contactMessageId}`;
  },
};
