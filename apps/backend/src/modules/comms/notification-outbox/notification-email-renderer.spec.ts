import { notificationEmailDefinition } from './notification-email-renderer';
import { NOTIFICATION_OUTBOX_CONSUMERS } from './notification-outbox.types';

describe('notificationEmailDefinition reminder time', () => {
  it.each(['UTC', 'America/New_York'])(
    'formats Arabic time in Riyadh when the host defaults to %s',
    (hostTimeZone) => {
      // Jest config pins TZ to Riyadh; emulate another host default while
      // keeping real Intl formatting and respecting explicit timeZone options.
      const format = Date.prototype.toLocaleTimeString;
      const spy = jest.spyOn(Date.prototype, 'toLocaleTimeString').mockImplementation(function (this: Date, locales, options) {
        return format.call(this, locales, { timeZone: hostTimeZone, ...options });
      });
      try {
        const definition = notificationEmailDefinition(
          NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_REMINDER_CLIENT,
          {
            kind: 'booking-reminder-client',
            bookingId: 'booking-1',
            clientId: 'client-1',
            scheduledAt: '2026-05-23T22:30:00Z',
            clientName: 'سارة',
            serviceName: 'استشارة أسرية',
          },
        );

        expect(definition).toEqual({
          templateSlug: 'booking-reminder',
          variables: {
            client_name: 'سارة',
            service_name: 'استشارة أسرية',
            time: '٠١:٣٠ ص',
          },
        });
      } finally {
        spy.mockRestore();
      }
    },
  );

  it('does not render an invalid reminder timestamp', () => {
    expect(notificationEmailDefinition(
      NOTIFICATION_OUTBOX_CONSUMERS.BOOKING_REMINDER_CLIENT,
      { kind: 'booking-reminder-client', scheduledAt: 'invalid' },
    )).toBeNull();
  });
});
