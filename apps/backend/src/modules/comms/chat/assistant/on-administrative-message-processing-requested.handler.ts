import { Injectable } from '@nestjs/common';
import { ConversationStatus, MessageSenderType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { EventBusService, type DomainEventEnvelope } from '../../../../infrastructure/events';
import { AdministrativeAssistantService } from './administrative-assistant.service';
import type { AdministrativeMessageProcessingRequestedPayload } from './administrative-message-processing-requested.event';
import { readAdministrativeMessageState } from './administrative-message-state';

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
    const { messageId, manualRetry } = event.payload;
    const response = await this.assistant.processMessage(messageId, { manualRetry });
    if (response) return;

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
    if (state.assistantStatus === 'RETRYABLE_FAILURE' && state.retryable === true) return;

    const aiActive = message.conversation.isAiChat
      && message.conversation.status === ConversationStatus.AI_ACTIVE;
    const sameEpoch = state.assistantStateVersion === message.conversation.stateVersion
      && (state.assistantClientId ?? null) === message.conversation.clientId;
    if (aiActive && sameEpoch && (state.assistantStatus === 'QUEUED' || state.assistantStatus === 'RETRYING')) {
      throw new Error('Administrative assistant processing remains pending');
    }

    if ((!aiActive || !sameEpoch) && (state.assistantStatus === 'QUEUED' || state.assistantStatus === 'RETRYING')) {
      await this.prisma.commsChatMessage.updateMany({
        where: { id: messageId },
        data: { metadata: Prisma.JsonNull },
      });
    }
  }
}
