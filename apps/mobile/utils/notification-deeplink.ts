import type { Href } from 'expo-router';
import type { Notification, NotificationMetadata } from '@/types/models';

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
    return {
      pathname: '/(client)/appointment/[id]',
      params: { id: meta.bookingId },
    } as Href;
  }

  if (typeof meta.conversationId === 'string' && meta.conversationId.length > 0) {
    return '/(client)/(tabs)/chat' as Href;
  }

  // Booking-shaped types without explicit metadata still land on the
  // appointments tab, which is the natural home for them.
  switch (notification.type) {
    case 'booking_confirmed':
    case 'booking_completed':
    case 'booking_cancelled':
    case 'booking_rescheduled':
    case 'booking_expired':
    case 'booking_no_show':
    case 'booking_reminder':
    case 'booking_reminder_urgent':
    case 'booking_cancellation_rejected':
    case 'cancellation_rejected':
    case 'cancellation_requested':
    case 'no_show_review':
    case 'client_arrived':
    case 'waitlist_slot_available':
      return '/(client)/(tabs)/appointments' as Href;
    default:
      return null;
  }
}
