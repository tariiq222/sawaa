import { Injectable } from '@nestjs/common';
import { ConversationStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface CreateConversationDto {
  clientId: string;
  employeeId?: string;
}

@Injectable()
export class CreateConversationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: CreateConversationDto) {
    const _organizationId = DEFAULT_ORGANIZATION_ID;
    const isAiChat = !dto.employeeId;

    const existing = await this.prisma.chatConversation.findFirst({
      where: {
        clientId: dto.clientId,
        employeeId: dto.employeeId ?? null,
        status: ConversationStatus.OPEN,
      },
    });
    if (existing) return existing;

    return this.prisma.chatConversation.create({
      data: {
        clientId: dto.clientId,
        employeeId: dto.employeeId ?? null,
        isAiChat,
      },
    });
  }
}
