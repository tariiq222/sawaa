import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface GetUnreadCountQuery {
  organizationId: string;
  recipientId: string;
}

@Injectable()
export class GetUnreadCountHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetUnreadCountQuery): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: {
        organizationId: query.organizationId,
        recipientId: query.recipientId,
        isRead: false,
      },
    });
    return { count };
  }
}
