import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { RlsTransactionService } from '../../../../infrastructure/database';
import { lockChatConversation } from '../conversation-lock.helper';

export interface MarkConversationReadCommand {
  conversationId: string;
  staffUserId: string;
  throughMessageId?: string;
  throughSequence?: string;
}

@Injectable()
export class MarkConversationReadHandler {
  constructor(private readonly transaction: RlsTransactionService) {}

  async execute(command: MarkConversationReadCommand) {
    if (command.throughMessageId && command.throughSequence) {
      throw new BadRequestException('Provide either throughMessageId or throughSequence');
    }
    let requestedSequence: bigint | undefined;
    try {
      requestedSequence = command.throughSequence === undefined ? undefined : BigInt(command.throughSequence);
    } catch {
      throw new BadRequestException('throughSequence must be an integer');
    }
    if (requestedSequence !== undefined && requestedSequence < 1n) {
      throw new BadRequestException('throughSequence must be positive');
    }

    return this.transaction.withTransaction(async (tx) => {
      await lockChatConversation(tx, command.conversationId);
      const owned = await tx.chatConversation.findFirst({
        where: {
          id: command.conversationId,
          status: ConversationStatus.STAFF_ACTIVE,
          assignedStaffUserId: command.staffUserId,
        },
        select: { id: true },
      });
      if (!owned) throw new NotFoundException('Assigned conversation not found');

      const cursorMessage = command.throughMessageId
        ? await tx.commsChatMessage.findFirst({
            where: { id: command.throughMessageId, conversationId: command.conversationId },
            select: { sequence: true },
          })
        : requestedSequence === undefined
          ? null
          : await tx.commsChatMessage.findFirst({
              where: { conversationId: command.conversationId, sequence: requestedSequence },
              select: { sequence: true },
            });
      if ((command.throughMessageId || requestedSequence !== undefined) && !cursorMessage) {
        throw new NotFoundException('Owned message cursor not found');
      }
      const throughSequence = cursorMessage?.sequence;
      const readAt = new Date();
      const messages = await tx.commsChatMessage.updateMany({
        where: {
          conversationId: command.conversationId,
          senderType: { in: [MessageSenderType.VISITOR, MessageSenderType.CLIENT] },
          isRead: false,
          ...(throughSequence === undefined ? {} : { sequence: { lte: throughSequence } }),
        },
        data: { isRead: true, readAt },
      });
      const remainingUnread = await tx.commsChatMessage.count({
        where: {
          conversationId: command.conversationId,
          senderType: { in: [MessageSenderType.VISITOR, MessageSenderType.CLIENT] },
          isRead: false,
        },
      });
      const conversation = await tx.chatConversation.updateMany({
        where: {
          id: command.conversationId,
          status: ConversationStatus.STAFF_ACTIVE,
          assignedStaffUserId: command.staffUserId,
        },
        data: { staffUnreadCount: remainingUnread },
      });
      if (conversation.count !== 1) throw new NotFoundException('Assigned conversation not found');
      return { markedReadCount: messages.count, readAt };
    });
  }
}
