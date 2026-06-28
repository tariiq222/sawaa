import {
  Controller, Get, Post, Body, Query,
  UseGuards, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiOkResponse, ApiQuery,
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

@ApiTags('Dashboard / Ops')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/ops')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardOpsController {
  constructor(
    private readonly generateReport: GenerateReportHandler,
    private readonly packageReports: PackageReportsHandler,
    private readonly listActivity: ListActivityHandler,
  ) {}

  @Post('reports')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate a clinic report' })
  @ApiOkResponse({
    description:
      'JSON report object, or an xlsx binary when format is EXCEL ' +
      '(Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)',
    content: {
      'application/json': { schema: { type: 'object' } },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @CheckPermissions({ action: 'read', subject: 'Report' })
  async generateReportEndpoint(
    @Body() body: GenerateReportDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.generateReport.execute(body);

    if (result.format === ReportFormat.EXCEL && result.excelBuffer) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="report-${result.reportId}.xlsx"`);
      res.send(result.excelBuffer);
      return;
    }

    return result.data;
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
  @ApiOkResponse({ description: 'JSON report object (shape depends on the report type)' })
  packageReportEndpoint(@Query() query: PackageReportQueryDto) {
    return this.packageReports.execute({
      report: query.report,
      from: query.from,
      to: query.to,
    });
  }

  @Get('activity')
  @ApiOperation({ summary: 'List activity log entries' })
  @ApiOkResponse({
    description: 'Paginated list of activity log entries',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              userId: { type: 'string', format: 'uuid', nullable: true },
              action: { type: 'string' },
              module: { type: 'string' },
              resourceId: { type: 'string', format: 'uuid', nullable: true },
              description: { type: 'string', nullable: true },
              ipAddress: { type: 'string', nullable: true },
              userAgent: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              userEmail: { type: 'string', nullable: true },
              user: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  firstName: { type: 'string', nullable: true },
                  lastName: { type: 'string', nullable: true },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
            hasNextPage: { type: 'boolean' },
            hasPreviousPage: { type: 'boolean' },
          },
        },
      },
    },
  })
  @CheckPermissions({ action: 'read', subject: 'Report' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by staff user UUID' })
  @ApiQuery({ name: 'entity', required: false, description: 'Filter by entity type (e.g. Booking, Client)' })
  @ApiQuery({ name: 'entityId', required: false, description: 'Filter by entity UUID' })
  @ApiQuery({ name: 'action', required: false, description: 'Filter by action type (ActivityAction enum)' })
  @ApiQuery({ name: 'from', required: false, description: 'Start of date range (ISO 8601)' })
  @ApiQuery({ name: 'to', required: false, description: 'End of date range (ISO 8601)' })
  listActivityEndpoint(@Query() query: ListActivityDto) {
    return this.listActivity.execute({ ...query });
  }
}
