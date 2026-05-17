import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { BookingStatus, PaymentStatus, PaymentMethod } from '@prisma/client';
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

    const [todayBookingsCount, confirmedCount, pendingCount, cancelRequestedCount, newClientsTodayCount] =
      await Promise.all([
        this.prisma.booking.count({
          where: { ...baseWhere, scheduledAt: { gte: rangeStart, lt: rangeEnd } },
        }),
        this.prisma.booking.count({
          where: {
            ...baseWhere,
            scheduledAt: { gte: rangeStart, lt: rangeEnd },
            status: BookingStatus.CONFIRMED,
          },
        }),
        this.prisma.booking.count({
          where: {
            ...baseWhere,
            scheduledAt: { gte: rangeStart, lt: rangeEnd },
            status: BookingStatus.PENDING,
          },
        }),
        this.prisma.booking.count({
          where: { ...baseWhere, status: BookingStatus.CANCEL_REQUESTED },
        }),
        this.prisma.client.count({
          where: { createdAt: { gte: rangeStart, lt: rangeEnd } },
        }),
      ]);

    const result: DashboardStats = {
      todayBookings: todayBookingsCount,
      confirmedToday: confirmedCount,
      pendingToday: pendingCount,
      cancelRequests: cancelRequestedCount,
      newClientsToday: newClientsTodayCount,
    };

    if (includePayments) {
      const [pendingPaymentsCount, revenueResult] = await Promise.all([
        this.prisma.payment.count({
          where: {
            invoice: {},
            method: PaymentMethod.BANK_TRANSFER,
            status: PaymentStatus.PENDING_VERIFICATION,
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            invoice: {},
            status: PaymentStatus.COMPLETED,
            processedAt: { gte: rangeStart, lt: rangeEnd },
          },
          _sum: { amount: true },
        }),
      ]);
      result.pendingPayments = pendingPaymentsCount;
      result.todayRevenue = Number(revenueResult._sum.amount?.toString() ?? 0);
    }

    return result;
  }
}
