import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { toListResponse } from '../../../common/dto';
import { ListNotificationsDto } from './list-notifications.dto';

export type ListNotificationsCommand = Omit<ListNotificationsDto, 'page' | 'limit'> & {
  organizationId: string;
  recipientId: string;
  page: number;
  limit: number;
};

@Injectable()
export class ListNotificationsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: ListNotificationsCommand) {
    const where = {
      organizationId: cmd.organizationId,
      recipientId: cmd.recipientId,
      ...(cmd.unreadOnly ? { isRead: false } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (cmd.page - 1) * cmd.limit,
        take: cmd.limit,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return toListResponse(items, total, cmd.page, cmd.limit);
  }
}
