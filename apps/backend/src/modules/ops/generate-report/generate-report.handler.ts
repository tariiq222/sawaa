import { Injectable, BadRequestException } from '@nestjs/common';
import { ReportType, ReportFormat, ReportStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { TenantContextService } from '../../../common/tenant';
import { GenerateReportDto } from './generate-report.dto';
import { buildRevenueReport } from './revenue-report.builder';
import { buildActivityReport } from './activity-report.builder';
import { buildRevenueExcel, buildActivityExcel } from './excel-export.builder';
import { DEFAULT_ORGANIZATION_ID } from "../../../common/tenant/tenant.constants";

export type GenerateReportCommand = GenerateReportDto;

@Injectable()
export class GenerateReportHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenant: TenantContextService,
  ) {}

  async execute(dto: GenerateReportCommand): Promise<{
    reportId: string;
    type: ReportType;
    format: ReportFormat;
    status: ReportStatus;
    data?: unknown;
    excelBuffer?: Buffer;
  }> {
    const from = new Date(dto.from);
    const to = new Date(dto.to);

    if (from >= to) {
      throw new BadRequestException('from must be before to');
    }

    const format = dto.format ?? ReportFormat.JSON;
    const organizationId = DEFAULT_ORGANIZATION_ID;

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
        data = await this.buildEmployeesReport(from, to);
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

    const [total, byStatus] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
    ]);

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.status })),
    };
  }

  private async buildEmployeesReport(from: Date, to: Date) {
    const bookings = await this.prisma.booking.groupBy({
      by: ['employeeId', 'status'],
      where: { scheduledAt: { gte: from, lte: to } },
      _count: { employeeId: true },
    });

    const byEmployee = new Map<string, Record<string, number>>();
    for (const row of bookings) {
      const existing = byEmployee.get(row.employeeId) ?? {};
      existing[row.status] = row._count.employeeId!;
      byEmployee.set(row.employeeId, existing);
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      employees: [...byEmployee.entries()].map(([employeeId, stats]) => ({
        employeeId,
        ...stats,
      })),
    };
  }
}
