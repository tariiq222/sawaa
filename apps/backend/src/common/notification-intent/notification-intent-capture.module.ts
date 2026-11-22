import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../infrastructure/database';
import { CaptureNotificationIntentHandler } from './capture-notification-intent.handler';
import {
  NOTIFICATION_CAPTURE_POLICY,
  NOTIFICATION_INTENT_CAPTURE,
} from './capture.contract';
import { NotificationOutboxConfig } from './notification-outbox.config';

/**
 * Provider module for the notification-intent capture boundary.
 *
 * The handler itself is neutral (it writes `notificationIntent` rows inside the
 * caller's transaction), so it lives in `common` beside its contract. Only the
 * *rollout policy* is still comms-owned, and importing that one config file
 * from `modules/comms` keeps this module inside `common` rather than in a
 * feature cluster — the checker classifies by directory, and `people` importing
 * this module is what removes the `comms -> people -> comms` pair.
 *
 * `NotificationOutboxModule` imports this module and keeps re-exporting the
 * same providers, so comms consumers are unaffected.
 */
@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    NotificationOutboxConfig,
    CaptureNotificationIntentHandler,
    { provide: NOTIFICATION_INTENT_CAPTURE, useExisting: CaptureNotificationIntentHandler },
    { provide: NOTIFICATION_CAPTURE_POLICY, useExisting: NotificationOutboxConfig },
  ],
  exports: [
    NOTIFICATION_INTENT_CAPTURE,
    NOTIFICATION_CAPTURE_POLICY,
    NotificationOutboxConfig,
    CaptureNotificationIntentHandler,
  ],
})
export class NotificationIntentCaptureModule {}
