import { Injectable } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../../infrastructure/database';
import { CreateGuestConversationDto } from './create-guest-conversation.dto';
import { GuestChatTokenService } from './guest-chat-token.service';

@Injectable()
export class CreateGuestConversationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: GuestChatTokenService,
  ) {}

  async execute(dto: CreateGuestConversationDto) {
    const token = this.tokens.issue();
    const conversation = await this.prisma.chatConversation.create({
      data: {
        clientId: null,
        guestTokenHash: token.tokenHash,
        guestName: dto.guestName ?? null,
        guestPhone: dto.guestPhone ?? null,
        language: dto.language ?? 'ar',
        isAiChat: true,
        status: ConversationStatus.AI_ACTIVE,
      },
    });
    return { conversation, guestToken: token.rawToken };
  }
}
