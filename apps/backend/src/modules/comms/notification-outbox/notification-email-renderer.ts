import { escapeHtml } from '../../../common/security/escape-html';
import {
  NOTIFICATION_OUTBOX_CONSUMERS,
  type NotificationIntentPayload,
} from './notification-outbox.types';

export type NotificationEmailDefinition = {
  templateSlug: string;
  variables: Record<string, string>;
};

type EmailTemplateSnapshot = {
  subject: string;
  htmlBody: string;
};

function record(payload: NotificationIntentPayload | unknown): Record<string, unknown> | null {
  return payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
}

export function notificationEmailDefinition(
  consumerKey: string,
  payload: NotificationIntentPayload | unknown,
  currentClientName?: string | null,
): NotificationEmailDefinition | null {
  const value = record(payload);
  if (!value) return null;
  const clientName = typeof value.clientName === 'string'
    ? value.clientName
    : typeof value.name === 'string'
      ? value.name
      : currentClientName ?? '';

  if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_CANCELLED_CLIENT) {
    if (value.kind !== 'booking-cancelled-client' || typeof value.bookingId !== 'string') return null;
    return {
      templateSlug: 'booking-cancelled',
      variables: {
        client_name: clientName,
        booking_id: value.bookingId,
        reason: typeof value.reason === 'string' ? value.reason : '',
      },
    };
  }
  if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_REMINDER_CLIENT) {
    if (value.kind !== 'booking-reminder-client' || typeof value.scheduledAt !== 'string') return null;
    const scheduledAt = new Date(value.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return null;
    return {
      templateSlug: 'booking-reminder',
      variables: {
        client_name: clientName,
        service_name: typeof value.serviceName === 'string' ? value.serviceName : '',
        time: scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      },
    };
  }
  if (consumerKey === NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT) {
    if (value.kind !== 'client-enrolled-client' || typeof value.clientId !== 'string') return null;
    return {
      templateSlug: 'welcome',
      variables: { client_name: clientName },
    };
  }
  return null;
}

export function renderFrozenNotificationEmail(
  definition: NotificationEmailDefinition,
  template: EmailTemplateSnapshot,
): { channel: 'EMAIL'; templateSlug: string; subject: string; html: string } {
  return {
    channel: 'EMAIL',
    templateSlug: definition.templateSlug,
    subject: template.subject.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => definition.variables[key] ?? '',
    ),
    html: template.htmlBody.replace(
      /\{\{(\w+)\}\}/g,
      (_, key: string) => escapeHtml(definition.variables[key] ?? ''),
    ),
  };
}
