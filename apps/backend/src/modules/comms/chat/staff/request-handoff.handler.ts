import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, type ChatConversation } from '@prisma/client';
import { SAUDI_PHONE_REGEX } from '@sawaa/shared/validators/phone';
import { PrismaService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';
import { ChatAuditService } from '../chat-audit.service';

export type RequestHandoffCommand =
  | {
      audience: 'guest';
      conversationId: string;
      guestToken: string;
      guestName: string;
      guestPhone: string;
    }
  | { audience: 'client'; conversationId: string; clientId: string };

@Injectable()
export class RequestHandoffHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ChatAccessService,
    private readonly audit: ChatAuditService,
  ) {}

  async execute(command: RequestHandoffCommand): Promise<ChatConversation> {
    const conversation = command.audience === 'guest'
      ? await this.access.assertGuestAccess(command.conversationId, command.guestToken)
      : await this.access.assertClientAccess(command.conversationId, command.clientId);

    const contact = command.audience === 'guest'
      ? this.guestContact(command.guestName, command.guestPhone)
      : {};
    const ownership = command.audience === 'guest'
      ? { clientId: null, guestTokenHash: conversation.guestTokenHash }
      : { clientId: command.clientId };
    if (conversation.status !== ConversationStatus.AI_ACTIVE && conversation.status !== ConversationStatus.WAITING_FOR_STAFF) {
      throw new ConflictException('Conversation cannot request reception in its current state');
    }
    if (conversation.status === ConversationStatus.WAITING_FOR_STAFF) {
      const ownedWaiting = await this.prisma.chatConversation.findFirst({
        where: { id: command.conversationId, status: ConversationStatus.WAITING_FOR_STAFF, ...ownership },
      });
      if (ownedWaiting) return ownedWaiting;
      throw new ConflictException('Conversation ownership changed before reception request');
    }
    const updated = await this.prisma.chatConversation.updateMany({
      where: { id: command.conversationId, status: ConversationStatus.AI_ACTIVE, ...ownership },
      data: {
        status: ConversationStatus.WAITING_FOR_STAFF,
        handoffRequestedAt: new Date(),
        stateVersion: { increment: 1 },
        assistantLeaseOwner: null,
        assistantLeaseExpiresAt: null,
        ...contact,
      },
    });

    const current = await this.prisma.chatConversation.findFirst({
      where: { id: command.conversationId, status: ConversationStatus.WAITING_FOR_STAFF, ...ownership },
    });
    if (updated.count === 1) {
      await this.audit.record({ action: 'HANDOFF_REQUESTED', conversationId: command.conversationId });
    }
    if (!current) {
      const exists = await this.prisma.chatConversation.findUnique({
        where: { id: command.conversationId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Conversation not found');
      throw new ConflictException('Conversation ownership or state changed before reception request');
    }
    if (updated.count === 1 || current.status === ConversationStatus.WAITING_FOR_STAFF) return current;
    throw new ConflictException('Conversation cannot request reception in its current state');
  }

  private guestContact(guestName: string, guestPhone: string) {
    const trimmedName = guestName.trim();
    if (!trimmedName || trimmedName.length > 120 || !SAUDI_PHONE_REGEX.test(guestPhone)) {
      throw new BadRequestException('Guest name and a valid Saudi mobile are required');
    }
    return { guestName: trimmedName, guestPhone };
  }
}
