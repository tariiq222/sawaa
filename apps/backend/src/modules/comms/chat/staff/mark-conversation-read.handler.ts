import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConversationStatus, MessageSenderType } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';

export interface MarkConversationReadCommand {
  conversationId: string;
  staffUserId: string;
  throughMessageId?: string;
  throughSequence?: string;
}

@Injectable()
export class MarkConversationReadHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transaction: RlsTransactionService,
  ) {}

  async execute(command: MarkConversationReadCommand) {
    if (command.throughMessageId && command.throughSequence) {
      throw new BadRequestException('Provide either throughMessageId or throughSequence');
    }
    const owned = await this.prisma.chatConversation.findFirst({
      where: {
        id: command.conversationId,
        status: ConversationStatus.STAFF_ACTIVE,
        assignedStaffUserId: command.staffUserId,
      },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Assigned conversation not found');

    let requestedSequence: bigint | undefined;
    try {
      requestedSequence = command.throughSequence === undefined ? undefined : BigInt(command.throughSequence);
    } catch {
      throw new BadRequestException('throughSequence must be an integer');
    }
    if (requestedSequence !== undefined && requestedSequence < 1n) {
      throw new BadRequestException('throughSequence must be positive');
    }

    const cursorMessage = command.throughMessageId
      ? await this.prisma.commsChatMessage.findFirst({
          where: { id: command.throughMessageId, conversationId: command.conversationId },
          select: { sequence: true },
        })
      : requestedSequence === undefined
        ? null
        : await this.prisma.commsChatMessage.findFirst({
            where: { conversationId: command.conversationId, sequence: requestedSequence },
            select: { sequence: true },
          });
    if ((command.throughMessageId || requestedSequence !== undefined) && !cursorMessage) {
      throw new NotFoundException('Owned message cursor not found');
    }
    const throughSequence = cursorMessage?.sequence;

    return this.transaction.withTransaction(async (tx) => {
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
      const conversation = await tx.chatConversation.updateMany({
        where: {
          id: command.conversationId,
          status: ConversationStatus.STAFF_ACTIVE,
          assignedStaffUserId: command.staffUserId,
        },
        data: { staffUnreadCount: 0 },
      });
      if (conversation.count !== 1) throw new NotFoundException('Assigned conversation not found');
      return { markedReadCount: messages.count, readAt };
    });
  }
}
