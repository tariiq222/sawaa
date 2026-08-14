import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, Prisma, type ChatConversation } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { GuestChatTokenService } from './guest-chat-token.service';
import { ChatOperationsResumeRequestedEvent } from '../operations/events/chat-operations-resume-requested.event';
import { lockChatConversation } from '../conversation-lock.helper';
import { ChatAuditService } from '../chat-audit.service';

export interface ClaimGuestConversationCommand {
  conversationId: string;
  guestToken: string;
  clientId: string;
}

@Injectable()
export class ChatAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: GuestChatTokenService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly audit: ChatAuditService,
  ) {}

  guestTokenHash(guestToken: string): string {
    return this.tokens.toStoredToken(guestToken).tokenHash;
  }

  async assertGuestAccess(conversationId: string, guestToken: string): Promise<ChatConversation> {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        id: conversationId,
        clientId: null,
        guestTokenHash: this.guestTokenHash(guestToken),
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async assertClientAccess(conversationId: string, clientId: string): Promise<ChatConversation> {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { id: conversationId, clientId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async getCurrentForGuest(guestToken: string): Promise<ChatConversation> {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: {
        clientId: null,
        guestTokenHash: this.guestTokenHash(guestToken),
        status: { not: ConversationStatus.CLOSED },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async getCurrentForClient(clientId: string): Promise<ChatConversation> {
    const conversation = await this.prisma.chatConversation.findFirst({
      where: { clientId, status: { not: ConversationStatus.CLOSED } },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async claimGuestConversation(command: ClaimGuestConversationCommand): Promise<ChatConversation> {
    const guestTokenHash = this.tokens.toStoredToken(command.guestToken).tokenHash;

    return this.rlsTransaction.withTransaction(async (tx) => {
      await lockChatConversation(tx, command.conversationId);
      const claimed = await tx.chatConversation.updateMany({
        where: {
          id: command.conversationId,
          clientId: null,
          guestTokenHash,
        },
        data: {
          clientId: command.clientId,
          guestTokenHash: null,
          guestName: null,
          guestPhone: null,
          stateVersion: { increment: 1 },
          assistantLeaseOwner: null,
          assistantLeaseExpiresAt: null,
        },
      });
      if (claimed.count !== 1) {
        throw new ForbiddenException('Guest conversation cannot be claimed');
      }

      const conversation = await tx.chatConversation.findUnique({
        where: { id: command.conversationId },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');

      const resumeEvent = new ChatOperationsResumeRequestedEvent({
        conversationId: command.conversationId,
        clientId: command.clientId,
      });
      await tx.outboxEvent.create({
        data: {
          id: resumeEvent.eventId,
          aggregateId: command.conversationId,
          eventType: resumeEvent.eventName,
          status: 'PENDING_V2',
          deliveryLane: 'PENDING_V2',
          payload: resumeEvent.toEnvelope() as unknown as Prisma.InputJsonValue,
        },
      });
      await this.audit.record({
        action: 'GUEST_CLAIMED',
        conversationId: command.conversationId,
        clientId: command.clientId,
      }, tx);
      return conversation;
    });
  }
}
