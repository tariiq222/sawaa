import { Injectable } from '@nestjs/common';
import { ReportType, ReportFormat, ReportStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GenerateReportDto } from './generate-report.dto';
import { buildRevenueReport } from './revenue-report.builder';
import { buildActivityReport } from './activity-report.builder';
import { buildRevenueExcel, buildActivityExcel } from './excel-export.builder';

export type GenerateReportCommand = GenerateReportDto;

@Injectable()
export class GenerateReportHandler {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: GenerateReportCommand): Promise<{
    reportId: string;
    type: ReportType;
    format: ReportFormat;
    status: ReportStatus;
    data?: unknown;
    excelBuffer?: Buffer;
  }> {
    let from = new Date(dto.from);
    let to = new Date(dto.to);

    // Auto-swap if dates are reversed (common in RTL date pickers)
    if (from > to) {
      [from, to] = [to, from];
    }

    const format = dto.format ?? ReportFormat.JSON;

    const report = await this.prisma.report.create({
      data: {
        type: dto.type,
        format,
        status: ReportStatus.PENDING,
        params: { from: dto.from, to: dto.to, branchId: dto.branchId, employeeId: dto.employeeId },
        requestedBy: dto.requestedBy,
      },
    });

    try {
      let data: unknown;
      let excelBuffer: Buffer | undefined;

      if (dto.type === ReportType.REVENUE) {
        data = await buildRevenueReport(this.prisma, {
          from,
          to,
          branchId: dto.branchId,
          employeeId: dto.employeeId,
        });
        if (format === ReportFormat.EXCEL) {
          excelBuffer = await buildRevenueExcel(data as Parameters<typeof buildRevenueExcel>[0]);
        }
      } else if (dto.type === ReportType.ACTIVITY) {
        data = await buildActivityReport(this.prisma, {
          from,
          to,
        });
        if (format === ReportFormat.EXCEL) {
          excelBuffer = await buildActivityExcel(
            data as Parameters<typeof buildActivityExcel>[0],
          );
        }
      } else if (dto.type === ReportType.BOOKINGS) {
        data = await this.buildBookingsReport(from, to, dto.branchId);
      } else {
        data = await this.buildEmployeesReport(from, to, dto.employeeId);
      }

      await this.prisma.report.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.COMPLETED,
          resultData:
            format === ReportFormat.JSON
              ? (data as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          completedAt: new Date(),
        },
      });

      return {
        reportId: report.id,
        type: dto.type,
        format,
        status: ReportStatus.COMPLETED,
        data: format === ReportFormat.JSON ? data : undefined,
        excelBuffer: format === ReportFormat.EXCEL ? excelBuffer : undefined,
      };
    } catch (err) {
      await this.prisma.report.update({
        where: { id: report.id },
        data: {
          status: ReportStatus.FAILED,
          errorMsg: err instanceof Error ? err.message : 'Unknown error',
        },
      });
      throw err;
    }
  }

  private async buildBookingsReport(
    from: Date,
    to: Date,
    branchId?: string,
  ) {
    const where = {
      scheduledAt: { gte: from, lte: to },
      ...(branchId ? { branchId } : {}),
    };

    const [total, byStatus, byType] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      this.prisma.booking.groupBy({
        by: ['bookingType'],
        where,
        _count: { bookingType: true },
      }),
    ]);

    // byDay breakdown — group by date portion of scheduledAt
    const allBookings = await this.prisma.booking.findMany({
      where,
      select: { scheduledAt: true },
    });
    const dayMap = new Map<string, number>();
    for (const b of allBookings) {
      const day = b.scheduledAt.toISOString().slice(0, 10);
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.status })),
      byType: byType.map((t) => ({ type: t.bookingType, count: t._count.bookingType })),
      byDay: [...dayMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count })),
    };
  }

  private async buildEmployeesReport(from: Date, to: Date, employeeId?: string) {
    const where = {
      scheduledAt: { gte: from, lte: to },
      ...(employeeId ? { employeeId } : {}),
    };

    const bookings = await this.prisma.booking.findMany({
      where,
      select: {
        employeeId: true,
        status: true,
        scheduledAt: true,
        price: true,
      },
    });

    // Group by employee
    const empMap = new Map<string, {
      totalBookings: number;
      completedBookings: number;
      totalRevenue: number;
      byDay: Map<string, { bookings: number; revenue: number }>;
    }>();

    for (const b of bookings) {
      let entry = empMap.get(b.employeeId);
      if (!entry) {
        entry = { totalBookings: 0, completedBookings: 0, totalRevenue: 0, byDay: new Map() };
        empMap.set(b.employeeId, entry);
      }
      entry.totalBookings++;
      if (b.status === 'COMPLETED') {
        entry.completedBookings++;
        entry.totalRevenue += Number(b.price ?? 0);
      }
      const day = b.scheduledAt.toISOString().slice(0, 10);
      const dayEntry = entry.byDay.get(day) ?? { bookings: 0, revenue: 0 };
      dayEntry.bookings++;
      if (b.status === 'COMPLETED') {
        dayEntry.revenue += Number(b.price ?? 0);
      }
      entry.byDay.set(day, dayEntry);
    }

    // If filtering by single employee, return single-employee shape
    if (employeeId) {
      const entry = empMap.get(employeeId) ?? {
        totalBookings: 0,
        completedBookings: 0,
        totalRevenue: 0,
        byDay: new Map(),
      };
      return {
        employeeId,
        totalBookings: entry.totalBookings,
        completedBookings: entry.completedBookings,
        totalRevenue: entry.totalRevenue,
        averageRating: 0, // TODO: join with ratings table
        byDay: [...entry.byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, v]) => ({ date, bookings: v.bookings, revenue: v.revenue })),
      };
    }

    // Multi-employee: return array
    return [...empMap.entries()].map(([empId, entry]) => ({
      employeeId: empId,
      totalBookings: entry.totalBookings,
      completedBookings: entry.completedBookings,
      totalRevenue: entry.totalRevenue,
      averageRating: 0, // TODO: join with ratings table
      byDay: [...entry.byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, bookings: v.bookings, revenue: v.revenue })),
    }));
  }
}
