import { notificationSourceKey } from './notification-outbox.types';

describe('notificationSourceKey', () => {
  it('uses the domain envelope event id rather than the mutable outbox row id', () => {
    expect(notificationSourceKey.domainEvent('event-123')).toBe('domain-event:event-123');
  });

  it('keeps reminder identity stable across equivalent timestamp encodings', () => {
    const first = notificationSourceKey.reminder(
      'booking-123',
      new Date('2026-09-06T09:00:00.000Z'),
      1,
    );
    const replay = notificationSourceKey.reminder(
      'booking-123',
      '2026-09-06T12:00:00.000+03:00',
      1,
    );

    expect(first).toBe('booking-reminder:booking-123:2026-09-06T09:00:00.000Z:v1');
    expect(replay).toBe(first);
  });

  it('separates direct business sources while allowing consumer-key fanout', () => {
    expect(notificationSourceKey.clientEnrolled('client-123')).toBe(
      'client-enrolled:client-123',
    );
    expect(notificationSourceKey.contactMessage('contact-123')).toBe(
      'contact-message:contact-123',
    );
  });
});
