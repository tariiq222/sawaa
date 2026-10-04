import type { StaffCancellationIntent } from '../../finance/cancellation-refund/staff-cancellation-refund';
import { centerCancellationBody, clientCancellationBody } from '../events/client-cancellation-copy';
import type { ClientCancellationIntent } from '../../bookings/client/client-cancellation-policy';
import { escapeHtml } from '../../../common/security/escape-html';
import { BUSINESS_TZ } from '../../../common/timezone';
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
      templateSlug: value.centerCancellation ? 'program-cancelled' : 'booking-cancelled',
      variables: {
        client_name: clientName,
        booking_id: value.bookingId,
        reason: value.centerCancellation ? centerCancellationBody(value.centerCancellation as StaffCancellationIntent) : value.clientCancellation ? clientCancellationBody(value.clientCancellation as ClientCancellationIntent) : typeof value.reason === 'string' ? value.reason : '',
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
        time: scheduledAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', timeZone: BUSINESS_TZ }),
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

/** Program cancellation must not inherit appointment-cancelled template claims. */
export function renderCenterCancellationEmail(variables: Record<string, string>) {
  return { channel: 'EMAIL' as const, templateSlug: 'program-cancelled', subject: 'تم إلغاء البرنامج',
    html: `<div dir="rtl"><h1>تم إلغاء البرنامج</h1><p>${escapeHtml(variables.client_name ?? '')}</p><p>${escapeHtml(variables.reason ?? '')}</p></div>` };
}
