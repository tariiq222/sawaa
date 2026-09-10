import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NotificationOutboxConfig } from './notification-outbox.config';
import {
  NOTIFICATION_OUTBOX_OUTCOME_REASONS,
  type NotificationOutboxTickResult,
} from './notification-outbox.types';

@Injectable()
export class ReconcileSmsDeliveryReceiptsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: NotificationOutboxConfig,
  ) {}

  async execute(): Promise<NotificationOutboxTickResult> {
    let changed = 0;
    let failed = 0;
    let examined = 0;
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.notificationDelivery.findMany({
        where: {
          channel: 'SMS',
          status: 'ACCEPTED',
          providerMessageId: { not: null },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: 100,
      });
      if (rows.length === 0) break;
      for (const row of rows) {
        cursor = row.id;
        examined += 1;
        const providerMessageId = row.providerMessageId;
        if (!providerMessageId) continue;
        try {
          const receipt = await this.prisma.smsDelivery.findUnique({
            where: { providerMessageId },
          });
          if (!receipt || (receipt.status !== 'DELIVERED' && receipt.status !== 'FAILED')) continue;
          const status = receipt.status === 'DELIVERED' ? 'DELIVERED' : 'DEAD';
          const result = await this.prisma.notificationDelivery.updateMany({
            where: {
              id: row.id,
              status: 'ACCEPTED',
              providerMessageId,
            },
            data: {
              status,
              deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
              outcomeReason:
                status === 'DEAD'
                  ? NOTIFICATION_OUTBOX_OUTCOME_REASONS.PROVIDER_REJECTED
                  : undefined,
            },
          });
          changed += result.count ?? 0;
        } catch {
          failed += 1;
        }
      }
      if (rows.length < 100) break;
    }
    return { examined, changed, failed };
  }
}
