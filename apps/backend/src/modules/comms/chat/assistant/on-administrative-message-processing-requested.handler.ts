import { Injectable } from '@nestjs/common';
import { ConversationStatus, MessageSenderType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { EventBusService, type DomainEventEnvelope } from '../../../../infrastructure/events';
import { AdministrativeAssistantService } from './administrative-assistant.service';
import type { AdministrativeMessageProcessingRequestedPayload } from './administrative-message-processing-requested.event';
import { readAdministrativeMessageState, readNonNegativeInteger } from './administrative-message-state';

export const ADMINISTRATIVE_MESSAGE_PROCESSING_CONSUMER_ID = 'comms.administrative-assistant.v1';

@Injectable()
export class OnAdministrativeMessageProcessingRequestedHandler {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly assistant: AdministrativeAssistantService,
    private readonly prisma: PrismaService,
  ) {}

  register(): void {
    this.eventBus.subscribe<AdministrativeMessageProcessingRequestedPayload>(
      'comms.chat.assistant.processing_requested',
      ADMINISTRATIVE_MESSAGE_PROCESSING_CONSUMER_ID,
      (event) => this.handle(event),
    );
  }

  async handle(event: DomainEventEnvelope<AdministrativeMessageProcessingRequestedPayload>): Promise<void> {
    const { messageId, manualRetry, dispatchAttempt } = event.payload;
    const message = await this.prisma.commsChatMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderType: true,
        metadata: true,
        conversation: { select: { status: true, isAiChat: true, stateVersion: true, clientId: true } },
      },
    });
    if (!message || (message.senderType !== MessageSenderType.CLIENT && message.senderType !== MessageSenderType.VISITOR)) return;

    const state = readAdministrativeMessageState(message.metadata);
    const isPending = state.assistantStatus === 'QUEUED' || state.assistantStatus === 'RETRYING';
    const dispatchMatches = readNonNegativeInteger(state.dispatchAttempt) === dispatchAttempt;
    const retryKindMatches = manualRetry === (state.assistantStatus === 'RETRYING');
    // Event delivery is at-least-once. The durable message state is the source
    // of truth: a redelivery must never revive an older or capped attempt.
    if (!isPending || !dispatchMatches || !retryKindMatches) return;

    const response = await this.assistant.processMessage(messageId, { manualRetry, dispatchAttempt });
    if (response) return;

    const current = await this.prisma.commsChatMessage.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        senderType: true,
        metadata: true,
        conversation: { select: { status: true, isAiChat: true, stateVersion: true, clientId: true } },
      },
    });
    if (!current || (current.senderType !== MessageSenderType.CLIENT && current.senderType !== MessageSenderType.VISITOR)) return;

    const currentState = readAdministrativeMessageState(current.metadata);
    if (currentState.assistantStatus === 'RETRYABLE_FAILURE' && currentState.retryable === true) return;

    const aiActive = current.conversation.isAiChat
      && current.conversation.status === ConversationStatus.AI_ACTIVE;
    const sameEpoch = currentState.assistantStateVersion === current.conversation.stateVersion
      && (currentState.assistantClientId ?? null) === current.conversation.clientId;
    if (aiActive && sameEpoch && (currentState.assistantStatus === 'QUEUED' || currentState.assistantStatus === 'RETRYING')) {
      throw new Error('Administrative assistant processing remains pending');
    }

    if ((!aiActive || !sameEpoch) && (currentState.assistantStatus === 'QUEUED' || currentState.assistantStatus === 'RETRYING')) {
      await this.prisma.commsChatMessage.updateMany({
        where: { id: messageId },
        data: { metadata: Prisma.JsonNull },
      });
    }
  }
}
