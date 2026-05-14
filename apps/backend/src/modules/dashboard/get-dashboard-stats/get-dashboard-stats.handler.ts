import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { BookingStatus, PaymentStatus, PaymentMethod } from '@prisma/client';
import { todayRangeInTz } from '../../../common/helpers/date-tz.helper';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export interface DashboardStatsCommand {
  userId: string;
  role?: string | null;
}

export interface DashboardStats {
  todayBookings: number;
  confirmedToday: number;
  pendingToday: number;
  cancelRequests: number;
  pendingPayments?: number;
  todayRevenue?: number;
}

const PAYMENT_READ_ROLES = new Set(['OWNER', 'ADMIN', 'ACCOUNTANT']);

@Injectable()
export class GetDashboardStatsHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(cmd: DashboardStatsCommand): Promise<DashboardStats> {
    const organizationId = DEFAULT_ORGANIZATION_ID;

    const { start: today, end: tomorrow } = todayRangeInTz();

    let employeeFilter: { employeeId: string } | object = {};
    if (cmd.role === 'EMPLOYEE') {
      const emp = await this.prisma.employee.findFirst({
        where: { organizationId, userId: cmd.userId },
        select: { id: true },
      });
      if (!emp) {
        // EMPLOYEE membership without a linked Employee row → nothing to show.
        return {
          todayBookings: 0,
          confirmedToday: 0,
          pendingToday: 0,
          cancelRequests: 0,
        };
      }
      employeeFilter = { employeeId: emp.id };
    }

    const baseWhere = { organizationId, ...employeeFilter };
    const includePayments = PAYMENT_READ_ROLES.has(cmd.role ?? '');

    const [todayBookingsCount, confirmedCount, pendingCount, cancelRequestedCount] =
      await Promise.all([
        this.prisma.booking.count({
          where: { ...baseWhere, scheduledAt: { gte: today, lt: tomorrow } },
        }),
        this.prisma.booking.count({
          where: {
            ...baseWhere,
            scheduledAt: { gte: today, lt: tomorrow },
            status: BookingStatus.CONFIRMED,
          },
        }),
        this.prisma.booking.count({
          where: {
            ...baseWhere,
            scheduledAt: { gte: today, lt: tomorrow },
            status: BookingStatus.PENDING,
          },
        }),
        this.prisma.booking.count({
          where: { ...baseWhere, status: BookingStatus.CANCEL_REQUESTED },
        }),
      ]);

    const result: DashboardStats = {
      todayBookings: todayBookingsCount,
      confirmedToday: confirmedCount,
      pendingToday: pendingCount,
      cancelRequests: cancelRequestedCount,
    };

    if (includePayments) {
      const [pendingPaymentsCount, revenueResult] = await Promise.all([
        this.prisma.payment.count({
          where: {
            invoice: { organizationId },
            method: PaymentMethod.BANK_TRANSFER,
            status: PaymentStatus.PENDING_VERIFICATION,
          },
        }),
        this.prisma.payment.aggregate({
          where: {
            invoice: { organizationId },
            status: PaymentStatus.COMPLETED,
            processedAt: { gte: today, lt: tomorrow },
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
