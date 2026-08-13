import { Injectable, UnauthorizedException } from '@nestjs/common';
import { toChatConversationResponse } from './chat-conversation.response';
import { ChatAccessService } from './chat-access.service';

export interface GetCurrentConversationCommand {
  guestToken?: string;
  clientId?: string;
}

@Injectable()
export class GetCurrentConversationHandler {
  constructor(private readonly access: ChatAccessService) {}

  async execute(command: GetCurrentConversationCommand) {
    if (command.clientId) {
      return toChatConversationResponse(await this.access.getCurrentForClient(command.clientId));
    }
    if (command.guestToken) {
      return toChatConversationResponse(await this.access.getCurrentForGuest(command.guestToken));
    }
    throw new UnauthorizedException('Guest chat cookie is required');
  }
}
