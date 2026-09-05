import { Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationType, RecipientType } from '@prisma/client';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { CaptureNotificationIntentHandler } from '../notification-outbox/capture-notification-intent.handler';
import { MaterializeNotificationIntentHandler } from '../notification-outbox/materialize-notification-intent.handler';
import { ResolveNotificationIntentOwnershipHandler } from '../notification-outbox/resolve-notification-intent-ownership.handler';
import { NotificationOutboxConfig } from '../notification-outbox/notification-outbox.config';
import { NOTIFICATION_OUTBOX_CONSUMERS, NOTIFICATION_OUTBOX_PAYLOAD_VERSION, notificationSourceKey } from '../notification-outbox/notification-outbox.types';

interface ClientEnrolledPayload {
  clientId: string;
  name: string;
  phone?: string;
  email?: string;
}

@Injectable()
export class OnClientEnrolledHandler {
  private readonly logger = new Logger(OnClientEnrolledHandler.name);

  constructor(
    private readonly notify: SendNotificationHandler,
    @Optional() private readonly ownership?: ResolveNotificationIntentOwnershipHandler,
    @Optional() private readonly capture?: CaptureNotificationIntentHandler,
    @Optional() private readonly materialize?: MaterializeNotificationIntentHandler,
    @Optional() private readonly outboxConfig?: NotificationOutboxConfig,
  ) {}

  register(eventBus: EventBusService): void {
    eventBus.subscribe<ClientEnrolledPayload>(
      'people.client.enrolled',
      'comms.client-enrolled-notify.v1',
      (e) => this.handle(e),
    );
  }

  async handle(envelope: DomainEventEnvelope<ClientEnrolledPayload>): Promise<void> {
    const { payload } = envelope;
    if (await this.routeV2(envelope)) return;
    try {
      await this.notify.execute({
        recipientId: payload.clientId,
        recipientType: RecipientType.CLIENT,
        type: NotificationType.WELCOME,
        title: 'مرحباً بك!',
        body: `أهلاً ${payload.name}، يسعدنا انضمامك إلينا.`,
        channels: ['in-app', 'email'],
        recipientEmail: payload.email,
        emailTemplateSlug: 'welcome',
        emailVars: { client_name: payload.name },
      });
    } catch (err) {
      this.logger.error(
        `Failed to handle client enrolled for client ${payload.clientId}`,
        err,
      );
    }
  }

  private async routeV2(envelope: DomainEventEnvelope<ClientEnrolledPayload>): Promise<boolean> {
    if (!this.ownership || !this.capture || !this.materialize || !this.outboxConfig || !envelope.eventId) return false;
    const sourceKey = notificationSourceKey.clientEnrolled(envelope.payload.clientId);
    const consumerKey = NOTIFICATION_OUTBOX_CONSUMERS.CLIENT_ENROLLED_CLIENT;
    const owned = await this.ownership.execute({ sourceKey, consumerKey });
    if (owned) { await this.materialize.execute(owned); return true; }
    if (envelope.version !== NOTIFICATION_OUTBOX_PAYLOAD_VERSION) throw new Error(`Unsupported notification envelope version: ${envelope.version}`);
    if (!this.outboxConfig.shouldCapture(envelope.occurredAt)) return false;
    const payload = envelope.payload;
    const intentId = await this.capture.execute({
      sourceKey, consumerKey, payloadVersion: NOTIFICATION_OUTBOX_PAYLOAD_VERSION,
      occurredAt: new Date(envelope.occurredAt),
      payload: { kind: 'client-enrolled-client', clientId: payload.clientId, name: payload.name, phone: payload.phone, email: payload.email },
    });
    await this.materialize.execute(intentId);
    return true;
  }
}
