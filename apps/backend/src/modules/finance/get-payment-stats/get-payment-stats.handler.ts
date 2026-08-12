import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';

export interface PaymentStats {
  total: number;
  totalAmount: number;
  completed: number;
  completedAmount: number;
  pending: number;
  pendingAmount: number;
  pendingVerification: number;
  pendingVerificationAmount: number;
  refunded: number;
  refundedAmount: number;
  failed: number;
  historical: {
    collectedCount: number;
    collectedAmount: number;
    reviewCount: number;
    reviewAmount: number;
  };
}

@Injectable()
export class GetPaymentStatsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<PaymentStats> {
    const [rows, historicalRows] = await Promise.all([
      this.prisma.payment.groupBy({
        by: ['status'],
        _count: { id: true },
        _sum: { amount: true },
      }),
      this.prisma.$queryRaw<Array<{
        collectedCount: bigint | number;
        collectedAmount: bigint | number;
        reviewCount: bigint | number;
        reviewAmount: bigint | number;
      }>>(Prisma.sql`
        SELECT
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(r.metadata->>'paymentStatus', '')) = 'paid'
              AND b.status = 'CONFIRMED'
          )::bigint AS "collectedCount",
          COALESCE(ROUND(SUM(CASE
            WHEN LOWER(COALESCE(r.metadata->>'paymentStatus', '')) = 'paid'
              AND b.status = 'CONFIRMED'
              AND COALESCE(r.metadata->>'paidAmount', '') ~ '^[0-9]+([.][0-9]+)?$'
            THEN (r.metadata->>'paidAmount')::numeric * 100
            ELSE 0
          END)), 0)::bigint AS "collectedAmount",
          COUNT(*) FILTER (
            WHERE LOWER(COALESCE(r.metadata->>'paymentStatus', '')) = 'paid'
              AND (b.id IS NULL OR b.status <> 'CONFIRMED')
          )::bigint AS "reviewCount",
          COALESCE(ROUND(SUM(CASE
            WHEN LOWER(COALESCE(r.metadata->>'paymentStatus', '')) = 'paid'
              AND (b.id IS NULL OR b.status <> 'CONFIRMED')
              AND COALESCE(r.metadata->>'paidAmount', '') ~ '^[0-9]+([.][0-9]+)?$'
            THEN (r.metadata->>'paidAmount')::numeric * 100
            ELSE 0
          END)), 0)::bigint AS "reviewAmount"
        FROM "LegacyImportRecord" r
        LEFT JOIN "Booking" b ON b.id = r."targetId"
        WHERE r."sourceSystem" = 'booknetic'
          AND r."sourceTenant" = '6'
          AND r."entityType" = 'APPOINTMENT'
      `),
    ]);
    const historical = historicalRows[0];

    const stats: PaymentStats = {
      total: 0,
      totalAmount: 0,
      completed: 0,
      completedAmount: 0,
      pending: 0,
      pendingAmount: 0,
      pendingVerification: 0,
      pendingVerificationAmount: 0,
      refunded: 0,
      refundedAmount: 0,
      failed: 0,
      historical: {
        collectedCount: Number(historical?.collectedCount ?? 0),
        collectedAmount: Number(historical?.collectedAmount ?? 0),
        reviewCount: Number(historical?.reviewCount ?? 0),
        reviewAmount: Number(historical?.reviewAmount ?? 0),
      },
    };

    for (const row of rows) {
      const count = (row._count as { id: number }).id;
      const amount = (row._sum as { amount: { toNumber(): number } | null }).amount?.toNumber() ?? 0;
      stats.total += count;
      stats.totalAmount += amount;

      if (row.status === PaymentStatus.COMPLETED) {
        stats.completed = count;
        stats.completedAmount = amount;
      } else if (row.status === PaymentStatus.PENDING) {
        stats.pending = count;
        stats.pendingAmount = amount;
      } else if (row.status === PaymentStatus.PENDING_VERIFICATION) {
        stats.pendingVerification = count;
        stats.pendingVerificationAmount = amount;
      } else if (row.status === PaymentStatus.REFUNDED) {
        stats.refunded = count;
        stats.refundedAmount = amount;
      } else if (row.status === PaymentStatus.FAILED) {
        stats.failed = count;
      }
    }

    return stats;
  }
}
