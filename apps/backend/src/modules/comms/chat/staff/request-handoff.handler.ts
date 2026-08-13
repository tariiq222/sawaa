import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, type ChatConversation } from '@prisma/client';
import { SAUDI_PHONE_REGEX } from '@sawaa/shared/validators/phone';
import { PrismaService } from '../../../../infrastructure/database';
import { ChatAccessService } from '../guest/chat-access.service';

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
  ) {}

  async execute(command: RequestHandoffCommand): Promise<ChatConversation> {
    const conversation = command.audience === 'guest'
      ? await this.access.assertGuestAccess(command.conversationId, command.guestToken)
      : await this.access.assertClientAccess(command.conversationId, command.clientId);

    if (conversation.status === ConversationStatus.WAITING_FOR_STAFF) return conversation;
    if (conversation.status !== ConversationStatus.AI_ACTIVE) {
      throw new ConflictException('Conversation cannot request reception in its current state');
    }

    const contact = command.audience === 'guest'
      ? this.guestContact(command.guestName, command.guestPhone)
      : {};
    const updated = await this.prisma.chatConversation.updateMany({
      where: { id: command.conversationId, status: ConversationStatus.AI_ACTIVE },
      data: {
        status: ConversationStatus.WAITING_FOR_STAFF,
        handoffRequestedAt: new Date(),
        ...contact,
      },
    });

    const current = await this.prisma.chatConversation.findUnique({ where: { id: command.conversationId } });
    if (!current) throw new NotFoundException('Conversation not found');
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
