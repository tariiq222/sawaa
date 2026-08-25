import { Injectable, UnauthorizedException } from '@nestjs/common';
import { toChatConversationResponse } from './chat-conversation.response';
import { ChatAccessService } from './chat-access.service';

export interface ClaimConversationCommand {
  conversationId: string;
  clientId: string;
  guestToken?: string;
}

@Injectable()
export class ClaimConversationHandler {
  constructor(private readonly access: ChatAccessService) {}

  async execute(command: ClaimConversationCommand) {
    if (!command.guestToken) {
      throw new UnauthorizedException('Guest chat cookie is required');
    }
    return toChatConversationResponse(await this.access.claimGuestConversation({
      conversationId: command.conversationId,
      clientId: command.clientId,
      guestToken: command.guestToken,
    }));
  }
}
