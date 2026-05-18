import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';

export interface EmailFallbackQuota {
  used: number;
  limit: number;
  periodStart: string;
}

@Injectable()
export class GetEmailFallbackQuotaHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<EmailFallbackQuota> {
    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const used = await this.prisma.notificationDeliveryLog.count({
      where: {
        channel: 'EMAIL',
        createdAt: { gte: periodStart },
      },
    });

    return {
      used,
      limit: -1,
      periodStart: periodStart.toISOString(),
    };
  }
}
