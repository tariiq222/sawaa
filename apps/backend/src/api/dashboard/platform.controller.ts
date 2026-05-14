import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { CreateProblemReportHandler } from '../../modules/platform/problem-reports/create-problem-report.handler';
import { CreateProblemReportDto } from '../../modules/platform/problem-reports/create-problem-report.dto';
import { ListProblemReportsHandler } from '../../modules/platform/problem-reports/list-problem-reports.handler';
import { ListProblemReportsDto } from '../../modules/platform/problem-reports/list-problem-reports.dto';
import { UpdateProblemReportStatusHandler } from '../../modules/platform/problem-reports/update-problem-report-status.handler';
import { UpdateProblemReportStatusDto } from '../../modules/platform/problem-reports/update-problem-report-status.dto';
import { UpsertIntegrationHandler } from '../../modules/platform/integrations/upsert-integration.handler';
import { UpsertIntegrationDto } from '../../modules/platform/integrations/upsert-integration.dto';
import { ListIntegrationsHandler } from '../../modules/platform/integrations/list-integrations.handler';
@ApiTags('Dashboard / Platform')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/platform')
@UseGuards(JwtGuard, CaslGuard)
export class DashboardPlatformController {
  constructor(
    private readonly createProblemReport: CreateProblemReportHandler,
    private readonly listProblemReports: ListProblemReportsHandler,
    private readonly updateProblemReportStatus: UpdateProblemReportStatusHandler,
    private readonly upsertIntegration: UpsertIntegrationHandler,
    private readonly listIntegrations: ListIntegrationsHandler,
  ) {}

  // ── Problem Reports ──────────────────────────────────────────────────────────

  @Post('problem-reports')
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions({ action: 'manage', subject: 'Report' })
  @ApiOperation({ summary: 'Submit a problem report' })
  @ApiCreatedResponse({ description: 'Problem report created successfully' })
  createProblemReportEndpoint(@Body() body: CreateProblemReportDto) {
    return this.createProblemReport.execute(body);
  }

  @Get('problem-reports')
  @CheckPermissions({ action: 'read', subject: 'Report' })
  @ApiOperation({ summary: 'List problem reports with optional status filter' })
  @ApiOkResponse({ description: 'Paginated list of problem reports' })
  listProblemReportsEndpoint(@Query() query: ListProblemReportsDto) {
    return this.listProblemReports.execute(query);
  }

  @Patch('problem-reports/:id/status')
  @CheckPermissions({ action: 'manage', subject: 'Report' })
  @ApiOperation({ summary: 'Update the status of a problem report' })
  @ApiParam({ name: 'id', description: 'Problem report UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'Problem report status updated' })
  @ApiNotFoundResponse({ description: 'Problem report not found' })
  updateProblemReportStatusEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProblemReportStatusDto,
  ) {
    return this.updateProblemReportStatus.execute({ id, ...body });
  }

  // ── Integrations ─────────────────────────────────────────────────────────────

  @Post('integrations')
  @HttpCode(HttpStatus.OK)
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Create or update a third-party integration' })
  @ApiOkResponse({ description: 'Integration upserted successfully' })
  upsertIntegrationEndpoint(@Body() body: UpsertIntegrationDto) {
    return this.upsertIntegration.execute(body);
  }

  @Get('integrations')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'List all configured integrations' })
  @ApiOkResponse({ description: 'Array of integration records' })
  listIntegrationsEndpoint() {
    return this.listIntegrations.execute();
  }

}
