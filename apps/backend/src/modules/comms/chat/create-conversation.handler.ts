import { Injectable } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface CreateConversationDto {
  clientId: string;
  employeeId?: string;
}

@Injectable()
export class CreateConversationHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: CreateConversationDto) {
    const isAiChat = !dto.employeeId;
    const status = isAiChat
      ? ConversationStatus.AI_ACTIVE
      : ConversationStatus.STAFF_ACTIVE;

    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        clientId: dto.clientId,
        employeeId: dto.employeeId ?? null,
        status,
      },
    });
    if (existing) return existing;

    return this.prisma.chatConversation.create({
      data: {
        clientId: dto.clientId,
        employeeId: dto.employeeId ?? null,
        isAiChat,
        status,
      },
    });
  }
}
