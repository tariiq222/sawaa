import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { BookingStatus, Prisma } from '@prisma/client';
import { dateRangeInTz } from '../../../common/helpers/date-tz.helper';

export interface DashboardStatsCommand {
  userId: string;
  role?: string | null;
  from?: string;
  to?: string;
}

export interface DashboardStats {
  todayBookings: number;
  confirmedToday: number;
  pendingToday: number;
  cancelRequests: number;
  newClientsToday: number;
  pendingPayments?: number;
  todayRevenue?: number;
}

const PAYMENT_READ_ROLES = new Set(['OWNER', 'ADMIN', 'ACCOUNTANT']);

@Injectable()
export class GetDashboardStatsHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(cmd: DashboardStatsCommand): Promise<DashboardStats> {
    const { start: rangeStart, end: rangeEnd } = dateRangeInTz(cmd.from, cmd.to);

    let employeeFilter: { employeeId: string } | object = {};
    if (cmd.role === 'EMPLOYEE') {
      const emp = await this.prisma.employee.findFirst({
        where: { userId: cmd.userId },
        select: { id: true },
      });
      if (!emp) {
        // EMPLOYEE membership without a linked Employee row → nothing to show.
        return {
          todayBookings: 0,
          confirmedToday: 0,
          pendingToday: 0,
          cancelRequests: 0,
          newClientsToday: 0,
        };
      }
      employeeFilter = { employeeId: emp.id };
    }

    const baseWhere = { ...employeeFilter };
    const includePayments = PAYMENT_READ_ROLES.has(cmd.role ?? '');

    // One groupBy replaces the three per-status counts that shared the same
    // base filter (employee scope + scheduledAt window):
    //   todayBookings  = sum of all status buckets
    //   confirmedToday = CONFIRMED bucket
    //   pendingToday   = PENDING bucket
    // cancelRequests has NO scheduledAt filter, so it stays a separate count.
    const [statusGroups, cancelRequestedCount, newClientsTodayCount] =
      await Promise.all([
        this.prisma.booking.groupBy({
          by: ['status'],
          where: { ...baseWhere, scheduledAt: { gte: rangeStart, lt: rangeEnd } },
          _count: { _all: true },
        }),
        this.prisma.booking.count({
          where: { ...baseWhere, status: BookingStatus.CANCEL_REQUESTED },
        }),
        this.prisma.client.count({
          where: { createdAt: { gte: rangeStart, lt: rangeEnd }, deletedAt: null },
        }),
      ]);

    const countByStatus = new Map<BookingStatus, number>(
      statusGroups.map((g) => [g.status, g._count._all]),
    );
    const todayBookingsCount = statusGroups.reduce((sum, g) => sum + g._count._all, 0);

    const result: DashboardStats = {
      todayBookings: todayBookingsCount,
      confirmedToday: countByStatus.get(BookingStatus.CONFIRMED) ?? 0,
      pendingToday: countByStatus.get(BookingStatus.PENDING) ?? 0,
      cancelRequests: cancelRequestedCount,
      newClientsToday: newClientsTodayCount,
    };

    if (includePayments) {
      // Single scan replaces the former payment.count + payment.aggregate pair.
      // The old `invoice: {}` relation filter is a no-op: Payment.invoiceId is
      // non-nullable with an FK (onDelete: Restrict), so every row qualifies.
      // Enum literals + ::float cast follow get-top-performers.handler.ts.
      const [paymentRow] = await this.prisma.$queryRaw<
        Array<{ pendingPayments: number; todayRevenue: number }>
      >(Prisma.sql`
        SELECT
          COUNT(*) FILTER (
            WHERE p.method = 'BANK_TRANSFER'
              AND p.status = 'PENDING_VERIFICATION'
          )::int AS "pendingPayments",
          COALESCE(SUM(p.amount) FILTER (
            WHERE p.status = 'COMPLETED'
              AND p."processedAt" >= ${rangeStart}
              AND p."processedAt" <  ${rangeEnd}
          ), 0)::float AS "todayRevenue"
        FROM "Payment" p
      `);
      result.pendingPayments = Number(paymentRow?.pendingPayments ?? 0);
      result.todayRevenue = Number(paymentRow?.todayRevenue ?? 0);
    }

    return result;
  }
}
