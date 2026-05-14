import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { MarkReadDto } from './mark-read.dto';

export type MarkReadCommand = MarkReadDto & { organizationId: string; recipientId: string };

@Injectable()
export class MarkReadHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: MarkReadCommand): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        organizationId: cmd.organizationId,
        recipientId: cmd.recipientId,
        isRead: false,
        ...(cmd.notificationId ? { id: cmd.notificationId } : {}),
      },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
