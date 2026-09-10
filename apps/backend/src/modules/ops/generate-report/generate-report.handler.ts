import { Injectable } from '@nestjs/common';
import { ReportType, ReportFormat, ReportStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { GenerateReportDto } from './generate-report.dto';
import { buildRevenueReport } from './revenue-report.builder';
import { buildActivityReport } from './activity-report.builder';
import { buildBookingsReport } from './bookings-report.builder';
import {
  buildPractitionersReport,
  buildPractitionerDetail,
} from './practitioners-report.builder';
import { buildOverviewReport } from './overview-report.builder';
import { buildClientsReport } from './clients-report.builder';
import { buildServicesReport } from './services-report.builder';
import { buildRatingsReport } from './ratings-report.builder';
import { revenueReportDateRange } from './revenue-report-query.helper';
import {
  buildRevenueExcel,
  buildActivityExcel,
  buildBookingsExcel,
  buildPractitionersExcel,
  buildOverviewExcel,
  buildClientsExcel,
  buildServicesExcel,
  buildRatingsExcel,
} from './excel-export.builder';

export type GenerateReportCommand = GenerateReportDto;

type BuilderArgs = {
  from: Date;
  to: Date;
  toExclusive: Date;
  branchId?: string;
  employeeId?: string;
};

@Injectable()
export class GenerateReportHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(dto: GenerateReportCommand): Promise<{
    reportId: string;
    type: ReportType;
    format: ReportFormat;
    status: ReportStatus;
    data?: unknown;
    excelBuffer?: Buffer;
  }> {
    let from: Date;
    let to: Date;
    let toExclusive: Date;
    if (dto.type === ReportType.REVENUE) {
      ({ from, toExclusive } = revenueReportDateRange(dto.from, dto.to));
      to = toExclusive;
    } else {
      from = new Date(dto.from);
      to = new Date(dto.to);
      if (from > to) [from, to] = [to, from];
      toExclusive = to;
    }

    const format = dto.format ?? ReportFormat.JSON;

    const report = await this.prisma.report.create({
      data: {
        type: dto.type,
        format,
        status: ReportStatus.PENDING,
        params: {
          from: dto.from,
          to: dto.to,
          branchId: dto.branchId,
          employeeId: dto.employeeId,
          compareWithPrevious: dto.compareWithPrevious === true,
        },
        requestedBy: dto.requestedBy,
      },
    });

    try {
      const args: BuilderArgs = {
        from,
        to,
        toExclusive,
        branchId: dto.branchId,
        employeeId: dto.employeeId,
      };

      let data: unknown = await this.runBuilder(dto.type, args);

      // Compare-with-previous (JSON only)
      if (
        dto.compareWithPrevious === true &&
        format === ReportFormat.JSON &&
        dto.type !== ReportType.ACTIVITY
      ) {
        const lengthMs = toExclusive.getTime() - from.getTime();
        const prevFrom = dto.type === ReportType.REVENUE
          ? new Date(from.getTime() - lengthMs)
          : new Date(from.getTime() - lengthMs - 1);
        const previousTo = dto.type === ReportType.REVENUE
          ? from
          : new Date(from.getTime() - 1);
        const prev = await this.runBuilder(dto.type, {
          ...args,
          from: prevFrom,
          to: previousTo,
          toExclusive: previousTo,
        });
        data = { ...(data as object), previous: prev };
      }

      let excelBuffer: Buffer | undefined;
      if (format === ReportFormat.EXCEL) {
        excelBuffer = await this.runExcelBuilder(dto.type, data);
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

  private async runBuilder(type: ReportType, args: BuilderArgs): Promise<unknown> {
    switch (type) {
      case ReportType.REVENUE:
        return buildRevenueReport(this.prisma, args);
      case ReportType.ACTIVITY:
        return buildActivityReport(this.prisma, args);
      case ReportType.BOOKINGS:
        return buildBookingsReport(this.prisma, args);
      case ReportType.EMPLOYEES:
        // Detail mode when employeeId is provided; otherwise list mode.
        if (args.employeeId) {
          return buildPractitionerDetail(this.prisma, args);
        }
        return buildPractitionersReport(this.prisma, args);
      case ReportType.OVERVIEW:
        return buildOverviewReport(this.prisma, args);
      case ReportType.CLIENTS:
        return buildClientsReport(this.prisma, args);
      case ReportType.SERVICES:
        return buildServicesReport(this.prisma, args);
      case ReportType.RATINGS:
        return buildRatingsReport(this.prisma, args);
      default:
        throw new Error(`Unsupported report type: ${type}`);
    }
  }

  private async runExcelBuilder(type: ReportType, data: unknown): Promise<Buffer> {
    switch (type) {
      case ReportType.REVENUE:
        return buildRevenueExcel(data as Parameters<typeof buildRevenueExcel>[0]);
      case ReportType.ACTIVITY:
        return buildActivityExcel(data as Parameters<typeof buildActivityExcel>[0]);
      case ReportType.BOOKINGS:
        return buildBookingsExcel(data as Parameters<typeof buildBookingsExcel>[0]);
      case ReportType.EMPLOYEES:
        return buildPractitionersExcel(
          data as Parameters<typeof buildPractitionersExcel>[0],
        );
      case ReportType.OVERVIEW:
        return buildOverviewExcel(data as Parameters<typeof buildOverviewExcel>[0]);
      case ReportType.CLIENTS:
        return buildClientsExcel(data as Parameters<typeof buildClientsExcel>[0]);
      case ReportType.SERVICES:
        return buildServicesExcel(data as Parameters<typeof buildServicesExcel>[0]);
      case ReportType.RATINGS:
        return buildRatingsExcel(data as Parameters<typeof buildRatingsExcel>[0]);
      default:
        throw new Error(`Unsupported excel report type: ${type}`);
    }
  }
}
