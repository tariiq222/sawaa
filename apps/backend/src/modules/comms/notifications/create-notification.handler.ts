import { Injectable } from '@nestjs/common';
import { Prisma, NotificationType, RecipientType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface CreateNotificationDto {
  recipientId: string;
  recipientType: RecipientType;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class CreateNotificationHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: CreateNotificationDto) {
    return this.prisma.notification.create({
      data: {
        recipientId: dto.recipientId,
        recipientType: dto.recipientType,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        metadata: (dto.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }
}
