import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const NOTIFICATION_OUTBOX_QUEUE = 'notification-outbox-delivery';
export const NOTIFICATION_OUTBOX_JOB = 'notification-delivery';
export const NOTIFICATION_OUTBOX_LEASE_MS = 60_000;
export const NOTIFICATION_OUTBOX_LEASE_RENEW_MS = 15_000;
export const NOTIFICATION_OUTBOX_MAX_PROVIDER_ATTEMPTS = 5;
export const NOTIFICATION_OUTBOX_RETRY_DELAYS_MS = [30_000, 120_000, 300_000, 900_000] as const;
export const NOTIFICATION_OUTBOX_RECONCILE_INTERVAL_MS = 5_000;
export const NOTIFICATION_OUTBOX_BACKLOG_WARNING_MS = 120_000;
export const NOTIFICATION_OUTBOX_BATCH_SIZE = 100;

function strictBoolean(config: ConfigService, key: string): boolean {
  const raw = config.get<string | boolean>(key);
  if (raw === undefined || raw === null || raw === '') return false;
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  throw new Error(`${key} must be exactly "true" or "false"`);
}

@Injectable()
export class NotificationOutboxConfig {
  readonly captureEnabled: boolean;
  readonly deliveryEnabled: boolean;
  readonly cutoverAt: Date | null;

  constructor(config: ConfigService) {
    this.captureEnabled = strictBoolean(config, 'NOTIFICATION_OUTBOX_CAPTURE_ENABLED');
    this.deliveryEnabled = strictBoolean(config, 'NOTIFICATION_OUTBOX_DELIVERY_ENABLED');
    const rawCutover = config.get<string>('NOTIFICATION_OUTBOX_CUTOVER_AT');
    this.cutoverAt = rawCutover ? new Date(rawCutover) : null;

    if (this.cutoverAt && Number.isNaN(this.cutoverAt.getTime())) {
      throw new Error('NOTIFICATION_OUTBOX_CUTOVER_AT must be an ISO-8601 timestamp');
    }
    if (this.captureEnabled && !this.cutoverAt) {
      throw new Error('NOTIFICATION_OUTBOX_CUTOVER_AT is required when capture is enabled');
    }
  }

  shouldCapture(occurredAt: Date | string): boolean {
    if (!this.captureEnabled || !this.cutoverAt) return false;
    return new Date(occurredAt).getTime() >= this.cutoverAt.getTime();
  }
}
