import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database';
import { buildPackageSalesReport } from './package-sales-report.builder';
import { buildOutstandingCreditReport } from './outstanding-credit-report.builder';
import { buildPackageConsumptionReport } from './package-consumption-report.builder';
import { buildRefundedPackagesReport } from './refunded-packages-report.builder';

/** The four session-package operational reports (Phase 5). */
export enum PackageReportType {
  SALES = 'SALES',
  OUTSTANDING_CREDIT = 'OUTSTANDING_CREDIT',
  CONSUMPTION = 'CONSUMPTION',
  REFUNDED = 'REFUNDED',
}

export interface PackageReportCommand {
  report: PackageReportType;
  /** ISO 8601 date string. */
  from: string;
  /** ISO 8601 date string. */
  to: string;
}

/**
 * Orchestrates the four session-package reports, mirroring GenerateReportHandler:
 * parse + normalise the date range (swap a reversed range), then dispatch to the
 * matching `buildXxx*Report(prisma, params)` builder. JSON-only — these reports
 * feed dashboard widgets, not the Excel export pipeline.
 */
@Injectable()
export class PackageReportsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: PackageReportCommand): Promise<unknown> {
    let from = new Date(cmd.from);
    let to = new Date(cmd.to);
    if (from > to) [from, to] = [to, from];

    // Every body carries `kind` so the dashboard can discriminate the union
    // (apps/dashboard/lib/types/package-report.ts) without guessing the shape.
    switch (cmd.report) {
      case PackageReportType.SALES:
        return { kind: cmd.report, ...(await buildPackageSalesReport(this.prisma, { from, to })) };
      case PackageReportType.OUTSTANDING_CREDIT:
        return { kind: cmd.report, ...(await buildOutstandingCreditReport(this.prisma, { from, to })) };
      case PackageReportType.CONSUMPTION:
        return { kind: cmd.report, ...(await buildPackageConsumptionReport(this.prisma, { from, to })) };
      case PackageReportType.REFUNDED:
        return { kind: cmd.report, ...(await buildRefundedPackagesReport(this.prisma, { from, to })) };
      default:
        throw new BadRequestException(`Unsupported package report type: ${cmd.report}`);
    }
  }
}
