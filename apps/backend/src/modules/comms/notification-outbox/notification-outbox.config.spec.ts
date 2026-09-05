import { ConfigService } from '@nestjs/config';

import { NotificationOutboxConfig } from './notification-outbox.config';

describe('NotificationOutboxConfig', () => {
  it('keeps capture and delivery disabled when controls are absent', () => {
    const config = new NotificationOutboxConfig(new ConfigService({}));

    expect(config.captureEnabled).toBe(false);
    expect(config.deliveryEnabled).toBe(false);
    expect(config.cutoverAt).toBeNull();
    expect(config.shouldCapture(new Date('2026-09-05T12:00:00.000Z'))).toBe(false);
  });

  it('requires an explicit stable cutover when capture is enabled', () => {
    expect(
      () =>
        new NotificationOutboxConfig(
          new ConfigService({ NOTIFICATION_OUTBOX_CAPTURE_ENABLED: 'true' }),
        ),
    ).toThrow('NOTIFICATION_OUTBOX_CUTOVER_AT');
  });

  it('captures only sources at or after the configured cutover', () => {
    const config = new NotificationOutboxConfig(
      new ConfigService({
        NOTIFICATION_OUTBOX_CAPTURE_ENABLED: 'true',
        NOTIFICATION_OUTBOX_CUTOVER_AT: '2026-09-05T12:00:00.000Z',
      }),
    );

    expect(config.shouldCapture(new Date('2026-09-05T11:59:59.999Z'))).toBe(false);
    expect(config.shouldCapture(new Date('2026-09-05T12:00:00.000Z'))).toBe(true);
    expect(config.shouldCapture(new Date('2026-09-05T12:00:00.001Z'))).toBe(true);
  });

  it('allows delivery to drain independently while capture is paused', () => {
    const config = new NotificationOutboxConfig(
      new ConfigService({ NOTIFICATION_OUTBOX_DELIVERY_ENABLED: 'true' }),
    );

    expect(config.captureEnabled).toBe(false);
    expect(config.deliveryEnabled).toBe(true);
  });

  it('rejects ambiguous boolean values instead of silently enabling controls', () => {
    expect(
      () =>
        new NotificationOutboxConfig(
          new ConfigService({ NOTIFICATION_OUTBOX_DELIVERY_ENABLED: 'yes' }),
        ),
    ).toThrow('NOTIFICATION_OUTBOX_DELIVERY_ENABLED');
  });
});
