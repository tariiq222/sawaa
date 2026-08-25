import { Injectable } from '@nestjs/common';
import { SendChatMessageHandler } from '../messages/send-chat-message.handler';

export interface ReplyConversationCommand {
  conversationId: string;
  staffUserId: string;
  body: string;
  clientMessageId: string;
}

@Injectable()
export class ReplyConversationHandler {
  constructor(private readonly messages: SendChatMessageHandler) {}

  execute(command: ReplyConversationCommand) {
    return this.messages.execute({
      audience: 'staff',
      conversationId: command.conversationId,
      staffUserId: command.staffUserId,
      body: command.body,
      clientMessageId: command.clientMessageId,
    });
  }
}
