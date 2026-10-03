import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { EventBusService, type DomainEventEnvelope } from '../../../infrastructure/events';
import { stableEventId } from '../../../common/events';
import { SendNotificationHandler } from '../send-notification/send-notification.handler';
import { GetClientPushTargetsHandler } from '../fcm-tokens/get-client-push-targets.handler';
import { CaptureNotificationIntentHandler } from '../notification-outbox/capture-notification-intent.handler';
import { MaterializeNotificationIntentHandler } from '../notification-outbox/materialize-notification-intent.handler';
import { ResolveNotificationIntentOwnershipHandler } from '../notification-outbox/resolve-notification-intent-ownership.handler';
import { NotificationOutboxConfig } from '../notification-outbox/notification-outbox.config';
import { NOTIFICATION_OUTBOX_CONSUMERS, type RefundOutcomeClientPayload, notificationSourceKey } from '../notification-outbox/notification-outbox.types';
import { refundOutcomeBody } from './client-cancellation-copy';

@Injectable()
export class OnRefundOutcomeHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: SendNotificationHandler,
    private readonly pushTargets: GetClientPushTargetsHandler,
    private readonly capture: CaptureNotificationIntentHandler,
    private readonly materialize: MaterializeNotificationIntentHandler,
    private readonly ownership: ResolveNotificationIntentOwnershipHandler,
    private readonly config: NotificationOutboxConfig,
  ) {}

  register(bus: EventBusService): void {
    bus.subscribe('finance.refund.completed', 'comms.refund-completed-client.v1', e => this.handle(e as DomainEventEnvelope<{ refundRequestId: string }>, true));
    bus.subscribe('finance.cancellation-refund.updated', 'comms.cancellation-refund-outcome-client.v1', e => this.handle(e as DomainEventEnvelope<{ refundRequestId: string }>, false));
  }

  async handle(event: DomainEventEnvelope<{ refundRequestId: string }>, completed: boolean): Promise<void> {
    if (event.version !== 1) throw new ConflictException('Unsupported refund event version');
    const request = await this.prisma.refundRequest.findUnique({ where: { id: event.payload.refundRequestId }, include: { invoice: true } });
    if (!request || (completed && request.status !== 'COMPLETED')) throw new ConflictException('Refund completion is not confirmed by the ledger');
    if (!['COMPLETED', 'FAILED', 'DENIED', 'PENDING_REVIEW', 'MANUAL_REVIEW'].includes(request.status)) return;
    const payload: RefundOutcomeClientPayload = {
      kind: 'refund-outcome-client', refundRequestId: request.id, clientId: request.clientId,
      bookingId: request.invoice.bookingId, status: request.status as RefundOutcomeClientPayload['status'], amount: Number(request.amount), currency: request.invoice.currency,
    };
    const identity = stableEventId(`refund:${request.id}:client-notification:${request.status}`);
    const sourceKey = notificationSourceKey.domainEvent(identity);
    const consumerKey = NOTIFICATION_OUTBOX_CONSUMERS.REFUND_OUTCOME_CLIENT;
    const owned = await this.ownership.execute({ sourceKey, consumerKey });
    if (owned) { await this.materialize.execute(owned); return; }
    if (this.config.shouldCapture(event.occurredAt)) {
      const id = await this.capture.execute({ sourceKey, consumerKey, payloadVersion: 1, occurredAt: new Date(event.occurredAt), payload });
      await this.materialize.execute(id);
      return;
    }
    const { pushEnabled, tokens } = await this.pushTargets.execute({ clientId: request.clientId });
    await this.notify.execute({
      notificationId: identity, recipientId: request.clientId, recipientType: 'CLIENT', type: 'GENERAL',
      title: 'تحديث الاسترداد', body: refundOutcomeBody(request.status, payload.amount, payload.currency),
      channels: pushEnabled && tokens.length ? ['in-app', 'push'] : ['in-app'], fcmTokens: tokens,
      metadata: { bookingId: payload.bookingId, refundRequestId: request.id, refundStatus: request.status },
    });
  }
}
