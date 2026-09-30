import type { Href } from 'expo-router';
import type { Notification, NotificationMetadata } from '@/types/models';

/**
 * Notification types whose natural in-app home is the appointments tab.
 * Mirrors the backend notification type list.
 */
const BOOKING_ROUTE_TYPES = new Set<string>([
  'booking_created',
  'booking_confirmed',
  'booking_completed',
  'booking_cancelled',
  'booking_rescheduled',
  'booking_expired',
  'booking_no_show',
  'booking_reminder',
  'booking_reminder_urgent',
  'booking_cancellation_rejected',
  'cancellation_rejected',
  'cancellation_requested',
  'no_show_review',
  'client_arrived',
]);

/**
 * Push payloads are attacker-influencable, so an id taken from one must never
 * be able to contribute extra path segments (`/`, `..`, `:`) to a route.
 */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

function pushId(value: unknown): string | null {
  return typeof value === 'string' && SAFE_ID.test(value) ? value : null;
}

function appointmentHref(bookingId: string): Href {
  return {
    pathname: '/(client)/appointment/[id]',
    params: { id: bookingId },
  } as Href;
}

/**
 * Resolves the in-app destination for a notification based on its `metadata`
 * payload and `type`. Returns `null` when there is no actionable target — the
 * caller should leave the user on the notifications list.
 *
 * Wired against existing client routes only; never invents a screen.
 */
export function resolveNotificationHref(notification: Notification): Href | null {
  const meta: NotificationMetadata = notification.metadata ?? {};

  if (typeof meta.bookingId === 'string' && meta.bookingId.length > 0) {
    return appointmentHref(meta.bookingId);
  }

  if (typeof meta.conversationId === 'string' && meta.conversationId.length > 0) {
    return '/(client)/(tabs)/chat' as Href;
  }

  return BOOKING_ROUTE_TYPES.has(notification.type)
    ? ('/(client)/(tabs)/appointments' as Href)
    : null;
}

/**
 * Resolves the destination for a tapped push notification from its raw FCM
 * `data` payload. Only whitelisted keys are read and the route is built
 * locally, so a payload can never supply a URL or path of its own. Returns
 * `null` when nothing is actionable — the caller keeps the user on the list.
 */
export function resolvePushHref(data: unknown): Href | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;

  const bookingId = pushId(payload.bookingId);
  if (bookingId) return appointmentHref(bookingId);

  if (pushId(payload.conversationId)) {
    return '/(client)/(tabs)/chat' as Href;
  }

  // The backend sends the uppercase intent type (e.g. BOOKING_REMINDER).
  const type =
    typeof payload.notificationType === 'string'
      ? payload.notificationType.trim().toLowerCase()
      : '';
  return BOOKING_ROUTE_TYPES.has(type)
    ? ('/(client)/(tabs)/appointments' as Href)
    : null;
}
