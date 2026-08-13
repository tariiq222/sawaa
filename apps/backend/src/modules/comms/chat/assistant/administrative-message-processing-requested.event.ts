import type { Prisma } from '@prisma/client';
import { BaseEvent } from '../../../../common/events';
import { stableEventId } from '../../../../common/events/stable-event-id';

export interface AdministrativeMessageProcessingRequestedPayload {
  messageId: string;
  manualRetry: boolean;
  dispatchAttempt: number;
}

export class AdministrativeMessageProcessingRequestedEvent extends BaseEvent<AdministrativeMessageProcessingRequestedPayload> {
  readonly eventName = 'comms.chat.assistant.processing_requested';

  constructor(payload: AdministrativeMessageProcessingRequestedPayload) {
    super({
      source: 'comms',
      version: 1,
      payload,
      eventId: stableEventId(`chat-message:${payload.messageId}:assistant-dispatch:${payload.dispatchAttempt}`),
    });
  }
}

type OutboxWriter = {
  outboxEvent: {
    create(args: { data: {
      id: string;
      aggregateId: string;
      eventType: string;
      status: string;
      deliveryLane: string;
      payload: Prisma.InputJsonValue;
    } }): Promise<unknown>;
  };
};

export async function stageAdministrativeMessageProcessing(
  tx: OutboxWriter,
  payload: AdministrativeMessageProcessingRequestedPayload,
): Promise<void> {
  const event = new AdministrativeMessageProcessingRequestedEvent(payload);
  await tx.outboxEvent.create({
    data: {
      id: event.eventId,
      aggregateId: payload.messageId,
      eventType: event.eventName,
      status: 'PENDING_V2',
      deliveryLane: 'PENDING_V2',
      payload: event.toEnvelope() as unknown as Prisma.InputJsonValue,
    },
  });
}
