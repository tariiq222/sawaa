import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseModule } from '../../../infrastructure/database';
import { EmailModule } from '../../../infrastructure/email/email.module';
import { MailModule } from '../../../infrastructure/mail/mail.module';
import { MessagingModule } from '../../../infrastructure/messaging.module';
import { SmsModule } from '../../../infrastructure/sms/sms.module';
import { TelemetryModule } from '../../../infrastructure/telemetry/telemetry.module';
import { CaptureReminderNotificationIntentsHandler } from './capture-reminder-notification-intents.handler';
import { MaterializeNotificationIntentHandler } from './materialize-notification-intent.handler';
import { ResolveNotificationIntentOwnershipHandler } from './resolve-notification-intent-ownership.handler';
import { NotificationIntentCaptureModule } from '../../../common/notification-intent/notification-intent-capture.module';
import { NotificationChannelSender } from './notification-channel-sender';
import { NotificationDeliveryPublisher } from './notification-delivery-publisher';
import { NotificationDeliveryWorker } from './notification-delivery-worker';
import { NotificationOutboxLifecycle } from './notification-outbox.lifecycle';
import { NotificationOutboxMetrics } from './notification-outbox.metrics';
import { ReconcileNotificationDeliveriesHandler } from './reconcile-notification-deliveries.handler';
import { ReconcileNotificationIntentsHandler } from './reconcile-notification-intents.handler';
import { ReconcileNotificationSourcesHandler } from './reconcile-notification-sources.handler';
import { ReconcileSmsDeliveryReceiptsHandler } from './reconcile-sms-delivery-receipts.handler';

const runtime = [
  // Capture boundary is in common (MNT-19); materialization and ownership
  // resolution stay here because they depend on comms renderers.
  MaterializeNotificationIntentHandler,
  ResolveNotificationIntentOwnershipHandler,
  CaptureReminderNotificationIntentsHandler,
  ReconcileNotificationSourcesHandler,
  ReconcileNotificationIntentsHandler,
  NotificationChannelSender,
  NotificationDeliveryPublisher,
  NotificationDeliveryWorker,
  ReconcileNotificationDeliveriesHandler,
  ReconcileSmsDeliveryReceiptsHandler,
  NotificationOutboxMetrics,
  NotificationOutboxLifecycle,
];

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    MessagingModule,
    MailModule,
    SmsModule,
    EmailModule,
    TelemetryModule,
    NotificationIntentCaptureModule,
  ],
  providers: [...runtime],
  exports: [
    NotificationIntentCaptureModule,
    MaterializeNotificationIntentHandler,
    ResolveNotificationIntentOwnershipHandler,
  ],
})
export class NotificationOutboxModule {}
