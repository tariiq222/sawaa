import { Injectable, NotFoundException } from '@nestjs/common';
import { RlsTransactionService } from '../../../../infrastructure/database';

export interface GetClientChatConversationCommand {
  clientId: string;
  conversationId: string;
}

@Injectable()
export class GetClientChatConversationHandler {
  constructor(private readonly rlsTransaction: RlsTransactionService) {}

  async execute(command: GetClientChatConversationCommand) {
    return this.rlsTransaction.withTransaction(async (tx) => {
      const conversation = await tx.chatConversation.findFirst({
        where: { id: command.conversationId, clientId: command.clientId },
        select: {
          id: true,
          isAiChat: true,
          status: true,
          language: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');
      return conversation;
    });
  }
}
