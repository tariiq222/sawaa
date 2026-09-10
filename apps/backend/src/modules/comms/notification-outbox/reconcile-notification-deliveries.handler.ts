import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { NotificationOutboxConfig } from './notification-outbox.config';
import { NotificationOutboxMetrics } from './notification-outbox.metrics';
import {
  NOTIFICATION_OUTBOX_OUTCOME_REASONS,
  type NotificationOutboxTickResult,
} from './notification-outbox.types';

@Injectable()
export class ReconcileNotificationDeliveriesHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: NotificationOutboxConfig,
    @Optional() private readonly metrics?: NotificationOutboxMetrics,
  ) {}

  async execute(): Promise<NotificationOutboxTickResult> {
    const rows = await this.prisma.notificationDelivery.findMany({
      where: {
        status: 'SENDING',
        leaseUntil: { lt: new Date() },
      },
      orderBy: { leaseUntil: 'asc' },
      take: 100,
    });
    let changed = 0;
    let failed = 0;
    for (const row of rows) {
      if (!row.leaseToken) {
        failed += 1;
        continue;
      }
      const leaseToken = row.leaseToken;
      try {
        // This background reconciler has no request context. Sawaa is single-tenant
        // and RLS has been removed; the direct transaction fences both ledgers.
        // eslint-disable-next-line no-restricted-syntax
        const result = await this.prisma.$transaction(async (tx) => {
          const delivery = await tx.notificationDelivery.updateMany({
            where: { id: row.id, status: 'SENDING', leaseToken },
            data: {
              status: 'UNKNOWN',
              outcomeReason: NOTIFICATION_OUTBOX_OUTCOME_REASONS.LEASE_EXPIRED,
              leaseToken: null,
              leaseUntil: null,
            },
          });
          if (delivery.count !== 1) return delivery;
          await tx.notificationDeliveryAttempt.updateMany({
            where: {
              deliveryId: row.id,
              leaseToken,
              outcome: 'STARTED',
            },
            data: { outcome: 'UNKNOWN', finishedAt: new Date(), errorCode: 'LEASE_EXPIRED' },
          });
          return delivery;
        });
        changed += result.count ?? 0;
        if (result.count === 1) {
          this.metrics?.recordExpiredLease();
          this.metrics?.recordTerminal('UNKNOWN');
        }
      } catch {
        failed += 1;
      }
    }
    return { examined: rows.length, changed, failed };
  }
}
