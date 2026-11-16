import {
  Controller, Get, Post, Body, Query, Param,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiExtraModels,
  ApiOkResponse, ApiQuery, ApiParam, ApiNotFoundResponse, ApiConflictResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ReportFormat } from '@prisma/client';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { GenerateReportHandler } from '../../modules/ops/generate-report/generate-report.handler';
import { GenerateReportDto } from '../../modules/ops/generate-report/generate-report.dto';
import { PackageReportsHandler } from '../../modules/ops/generate-report/package-reports.handler';
import { PackageReportQueryDto } from '../../modules/ops/generate-report/package-report.dto';
import { ListActivityHandler } from '../../modules/ops/log-activity/list-activity.handler';
import { ListActivityDto } from '../../modules/ops/log-activity/list-activity.dto';
import { ListTerminalFailedOutboxHandler } from '../../modules/ops/outbox/list-terminal-failed-outbox.handler';
import { ListFailedOutboxDto } from '../../modules/ops/outbox/list-failed-outbox.dto';
import { RetryFailedOutboxEventHandler } from '../../modules/ops/outbox/retry-failed-outbox-event.handler';
import {
  OPS_GENERATED_REPORT_SCHEMA,
  OPS_PACKAGE_REPORT_SCHEMA,
  OpsActivityReportDto,
  OpsActivityLogListResponseDto,
  OpsBookingsReportDto,
  OpsClientsReportDto,
  OpsOverviewReportDto,
  OpsOutboxFailedEventListResponseDto,
  OpsOutboxRetryResponseDto,
  OpsPackageConsumptionReportDto,
  OpsPackageOutstandingCreditReportDto,
  OpsPackageSalesReportDto,
  OpsPractitionerDetailReportDto,
  OpsPractitionersReportDto,
  OpsRatingsReportDto,
  OpsRefundedPackagesEventsReportDto,
  OpsRefundedPackagesLegacyReportDto,
  OpsRefundedUndatedHistoryDto,
  OpsRevenueReportDto,
  OpsServicesReportDto,
  type OpsGeneratedReportResponseDto,
  type OpsPackageReportResponseDto,
} from './dto/ops-response.dto';

@ApiTags('Dashboard / Ops')
@ApiBearerAuth()
@ApiStandardResponses()
@ApiExtraModels(
  OpsOverviewReportDto,
  OpsRevenueReportDto,
  OpsBookingsReportDto,
  OpsClientsReportDto,
  OpsPractitionersReportDto,
  OpsPractitionerDetailReportDto,
  OpsServicesReportDto,
  OpsRatingsReportDto,
  OpsActivityReportDto,
  OpsPackageSalesReportDto,
  OpsPackageOutstandingCreditReportDto,
  OpsPackageConsumptionReportDto,
  OpsRefundedPackagesEventsReportDto,
  OpsRefundedPackagesLegacyReportDto,
  OpsRefundedUndatedHistoryDto,
)
@Controller('dashboard/ops')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardOpsController {
  constructor(
    private readonly generateReport: GenerateReportHandler,
    private readonly packageReports: PackageReportsHandler,
    private readonly listActivity: ListActivityHandler,
    private readonly listFailedOutbox: ListTerminalFailedOutboxHandler,
    private readonly retryFailedOutbox: RetryFailedOutboxEventHandler,
  ) {}

  @Post('reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a clinic report' })
  @ApiOkResponse({
    description:
      'JSON report object, or an xlsx binary when format is EXCEL ' +
      '(Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)',
    content: {
      'application/json': { schema: OPS_GENERATED_REPORT_SCHEMA },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @CheckPermissions({ action: 'read', subject: 'Report' })
  async generateReportEndpoint(
    @Body() body: GenerateReportDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OpsGeneratedReportResponseDto | void> {
    const result = await this.generateReport.execute(body);

    if (result.format === ReportFormat.EXCEL && result.excelBuffer) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="report-${result.reportId}.xlsx"`);
      res.send(result.excelBuffer);
      return;
    }

    // The handler keeps `data` as `unknown` (it dispatches to nine builders);
    // the OpenAPI union below documents what each builder actually produces.
    return result.data as OpsGeneratedReportResponseDto;
  }

  @Get('reports/packages')
  @CheckPermissions({ action: 'read', subject: 'Report' })
  @ApiOperation({
    summary:
      'Generate a session-package operational report (sales, outstanding-credit liability, consumption per employee, or refunded packages)',
  })
  @ApiQuery({
    name: 'report',
    required: true,
    enum: ['SALES', 'OUTSTANDING_CREDIT', 'CONSUMPTION', 'REFUNDED'],
    description: 'Which package report to generate',
  })
  @ApiQuery({ name: 'from', required: true, description: 'Start of period (ISO 8601 date)' })
  @ApiQuery({ name: 'to', required: true, description: 'End of period (ISO 8601 date)' })
  @ApiOkResponse({
    description:
      'JSON report object by report type. REFUNDED uses historyMode EVENTS with individual refund events and separate undatedHistorical records after reconciliation; otherwise historyMode LEGACY preserves the previous report with an incomplete historyReconciliation indicator.',
    schema: OPS_PACKAGE_REPORT_SCHEMA,
  })
  packageReportEndpoint(@Query() query: PackageReportQueryDto): Promise<OpsPackageReportResponseDto> {
    return this.packageReports.execute({
      report: query.report,
      from: query.from,
      to: query.to,
    }) as Promise<OpsPackageReportResponseDto>;
  }

  @Get('activity')
  @CheckPermissions({ action: 'read', subject: 'Report' })
  @ApiOperation({ summary: 'List activity log entries' })
  @ApiOkResponse({
    description: 'Paginated list of activity log entries',
    type: OpsActivityLogListResponseDto,
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1, schema: { type: 'integer', minimum: 1 } })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 50, schema: { type: 'integer', minimum: 1, maximum: 200 } })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by staff user UUID' })
  @ApiQuery({ name: 'entity', required: false, description: 'Filter by entity type (e.g. Booking, Client)' })
  @ApiQuery({ name: 'entityId', required: false, description: 'Filter by entity UUID' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action type (ActivityAction enum)' })
  @ApiQuery({ name: 'from', required: false, description: 'Start of date range (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End of date range (ISO 8601)' })
  listActivityEndpoint(@Query() query: ListActivityDto): Promise<OpsActivityLogListResponseDto> {
    return this.listActivity.execute({ ...query });
  }

  @Get('outbox/failed')
  @CheckPermissions({ action: 'read', subject: 'Report' })
  @ApiOperation({ summary: 'List terminal failed outbox events' })
  @ApiOkResponse({
    description:
      'Failed outbox event metadata only — the event payload is never returned',
    type: OpsOutboxFailedEventListResponseDto,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum events to return (default 50, max 100)',
    example: 50,
  })
  @ApiQuery({
    name: 'eventType',
    required: false,
    description: 'Filter by exact outbox event type',
    example: 'bookings.booking.created',
  })
  listFailedOutboxEndpoint(@Query() query: ListFailedOutboxDto): Promise<OpsOutboxFailedEventListResponseDto> {
    return this.listFailedOutbox.execute({
      limit: query.limit,
      eventType: query.eventType,
    });
  }

  @Post('outbox/:id/retry')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'Report' })
  @ApiOperation({ summary: 'Retry a terminal failed outbox event' })
  @ApiParam({
    name: 'id',
    description: 'Outbox event UUID',
    example: '00000000-0000-0000-0000-000000000000',
  })
  @ApiOkResponse({
    description:
      'Event reset for publishing (status PENDING, or PENDING_V2 when the row is on the durable v2 lane) with attemptCount 0; the next outbox tick will publish it',
    type: OpsOutboxRetryResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Outbox event not found' })
  @ApiConflictResponse({ description: 'Outbox event is not in FAILED state' })
  retryFailedOutboxEndpoint(@Param('id', ParseUUIDPipe) id: string): Promise<OpsOutboxRetryResponseDto> {
    return this.retryFailedOutbox.execute({ id });
  }
}
