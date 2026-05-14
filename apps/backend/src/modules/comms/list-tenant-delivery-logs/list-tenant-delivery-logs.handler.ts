import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { ListTenantDeliveryLogsDto } from './list-tenant-delivery-logs.dto';

export type ListTenantDeliveryLogsCommand = ListTenantDeliveryLogsDto;

@Injectable()
export class ListTenantDeliveryLogsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: ListTenantDeliveryLogsCommand) {
    const where = {
      ...(cmd.status ? { status: cmd.status } : {}),
      ...(cmd.channel ? { channel: cmd.channel } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notificationDeliveryLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (cmd.page - 1) * cmd.perPage,
        take: cmd.perPage,
        select: {
          id: true,
          // organizationId removed in single-tenant migration
          recipientId: true,
          type: true,
          priority: true,
          channel: true,
          status: true,
          senderActor: true,
          toAddress: true,
          providerName: true,
          attempts: true,
          lastAttemptAt: true,
          sentAt: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      this.prisma.notificationDeliveryLog.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: cmd.page,
        perPage: cmd.perPage,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / cmd.perPage),
      },
    };
  }
}
