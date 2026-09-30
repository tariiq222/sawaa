import { resolveNotificationHref, resolvePushHref } from '../notification-deeplink';
import type { Notification } from '@/types/models';

function notification(overrides: Partial<Notification>): Notification {
  return {
    id: 'n-1',
    userId: 'u-1',
    type: 'system_alert',
    titleAr: 'عنوان',
    titleEn: 'Title',
    bodyAr: 'نص',
    bodyEn: 'Body',
    isRead: false,
    createdAt: '2026-09-20T10:00:00.000Z',
    ...overrides,
  };
}

describe('resolveNotificationHref', () => {
  it('opens the appointment detail for a booking-scoped notification', () => {
    expect(resolveNotificationHref(notification({ metadata: { bookingId: 'b-9' } }))).toEqual({
      pathname: '/(client)/appointment/[id]',
      params: { id: 'b-9' },
    });
  });

  it('prefers the booking target when both ids are present', () => {
    const href = resolveNotificationHref(
      notification({ metadata: { bookingId: 'b-9', conversationId: 'c-2' } }),
    );
    expect(href).toEqual({ pathname: '/(client)/appointment/[id]', params: { id: 'b-9' } });
  });

  it('sends a type-only booking notification to the appointments tab', () => {
    expect(resolveNotificationHref(notification({ type: 'booking_created' }))).toBe('/(client)/(tabs)/appointments');
    expect(resolveNotificationHref(notification({ type: 'booking_confirmed' }))).toBe('/(client)/(tabs)/appointments');
  });

  it('opens the chat tab for a conversation-scoped notification', () => {
    expect(resolveNotificationHref(notification({ metadata: { conversationId: 'c-2' } }))).toBe(
      '/(client)/(tabs)/chat',
    );
  });

  it('ignores empty or non-string metadata ids instead of inventing a route', () => {
    expect(resolveNotificationHref(notification({ metadata: { bookingId: '' } }))).toBeNull();
    expect(resolveNotificationHref(notification({ metadata: { conversationId: '' } }))).toBeNull();
    expect(resolveNotificationHref(notification({ metadata: { invoiceId: 'inv-1' } }))).toBeNull();
    expect(resolveNotificationHref(notification({ metadata: null }))).toBeNull();
  });

  it.each([
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
  ] as const)('falls back to the appointments tab for %s without metadata', (type) => {
    expect(resolveNotificationHref(notification({ type }))).toBe('/(client)/(tabs)/appointments');
  });

  it('leaves the user on the list for types with no actionable target', () => {
    for (const type of ['new_rating', 'payment_received', 'receipt_rejected', 'system_alert', 'reminder'] as const) {
      expect(resolveNotificationHref(notification({ type }))).toBeNull();
    }
  });
});

describe('resolvePushHref', () => {
  it('opens the exact appointment when the payload carries a booking id', () => {
    expect(resolvePushHref({ notificationType: 'BOOKING_REMINDER', bookingId: 'b-9' })).toEqual({
      pathname: '/(client)/appointment/[id]',
      params: { id: 'b-9' },
    });
  });

  it('falls back to the appointments tab for a booking type without an id', () => {
    expect(resolvePushHref({ notificationType: 'BOOKING_REMINDER' })).toBe('/(client)/(tabs)/appointments');
    expect(resolvePushHref({ notificationType: 'BOOKING_CANCELLED' })).toBe('/(client)/(tabs)/appointments');
  });

  it('opens the chat tab for a conversation-scoped payload', () => {
    expect(resolvePushHref({ conversationId: 'c-2' })).toBe('/(client)/(tabs)/chat');
  });

  it('never routes to a URL or path supplied by the payload', () => {
    expect(resolvePushHref({ url: 'https://untrusted.example' })).toBeNull();
    expect(resolvePushHref({ path: '/(client)/settings-profile' })).toBeNull();
    expect(resolvePushHref({ route: 'javascript:alert(1)' })).toBeNull();
  });

  it('rejects ids that could contribute extra path segments', () => {
    expect(resolvePushHref({ bookingId: '../../admin' })).toBeNull();
    expect(resolvePushHref({ bookingId: 'a/b' })).toBeNull();
    expect(resolvePushHref({ bookingId: '' })).toBeNull();
    expect(resolvePushHref({ bookingId: 42 })).toBeNull();
  });

  it('ignores unknown types and non-object payloads', () => {
    expect(resolvePushHref({ notificationType: 'SYSTEM_ALERT' })).toBeNull();
    expect(resolvePushHref(null)).toBeNull();
    expect(resolvePushHref(undefined)).toBeNull();
    expect(resolvePushHref('BOOKING_REMINDER')).toBeNull();
  });
});
