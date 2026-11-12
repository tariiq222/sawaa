import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ApiStandardResponses } from '../../common/swagger';
import { ListEmailTemplatesHandler } from '../../modules/comms/email-templates/list-email-templates.handler';
import { ListEmailTemplatesDto } from '../../modules/comms/email-templates/list-email-templates.dto';
import { GetEmailTemplateHandler } from '../../modules/comms/email-templates/get-email-template.handler';
import { CreateEmailTemplateHandler } from '../../modules/comms/email-templates/create-email-template.handler';
import { CreateEmailTemplateDto } from '../../modules/comms/email-templates/create-email-template.dto';
import { UpdateEmailTemplateHandler } from '../../modules/comms/email-templates/update-email-template.handler';
import { UpdateEmailTemplateDto } from '../../modules/comms/email-templates/update-email-template.dto';
import { PreviewEmailTemplateHandler } from '../../modules/comms/email-templates/preview-email-template.handler';
import { PreviewEmailTemplateDto } from '../../modules/comms/email-templates/preview-email-template.dto';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

@ApiTags('Dashboard / Comms')
@ApiBearerAuth()
@ApiStandardResponses()
@Controller('dashboard/comms')
@UseGuards(JwtGuard, CaslGuard)
@AuditControllerName('DashboardCommsController')
export class DashboardCommsEmailTemplatesController {
  constructor(
    private readonly listEmailTemplates: ListEmailTemplatesHandler,
    private readonly getEmailTemplate: GetEmailTemplateHandler,
    private readonly createEmailTemplate: CreateEmailTemplateHandler,
    private readonly updateEmailTemplate: UpdateEmailTemplateHandler,
    private readonly previewEmailTemplate: PreviewEmailTemplateHandler,
  ) {}

  @ApiOperation({ summary: 'List email templates' })
  @ApiOkResponse({ description: 'Paginated email template list' })
  @CheckPermissions({ action: 'read', subject: 'Content' })
  @Get('email-templates')
  listEmailTemplatesEndpoint(
    @Query() query: ListEmailTemplatesDto,
  ) {
    return this.listEmailTemplates.execute({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Create an email template' })
  @ApiCreatedResponse({ description: 'Email template created' })
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @Post('email-templates')
  @HttpCode(HttpStatus.CREATED)
  createEmailTemplateEndpoint(
    @Body() body: CreateEmailTemplateDto,
  ) {
    return this.createEmailTemplate.execute({ ...body });
  }

  @ApiOperation({ summary: 'Get a single email template by ID' })
  @ApiOkResponse({ description: 'Email template details' })
  @ApiParam({ name: 'id', description: 'Email template UUID', example: '00000000-0000-0000-0000-000000000000' })
  @CheckPermissions({ action: 'read', subject: 'Content' })
  @Get('email-templates/:id')
  getEmailTemplateEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getEmailTemplate.execute({ id });
  }

  @ApiOperation({ summary: 'Preview a rendered email template' })
  @ApiOkResponse({ description: 'Rendered HTML preview' })
  @ApiParam({ name: 'id', description: 'Email template UUID', example: '00000000-0000-0000-0000-000000000000' })
  @CheckPermissions({ action: 'read', subject: 'Content' })
  @Post('email-templates/:id/preview')
  @HttpCode(HttpStatus.OK)
  previewEmailTemplateEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PreviewEmailTemplateDto,
  ) {
    return this.previewEmailTemplate.execute({
      id,
      context: body.context ?? {},
    });
  }

  @ApiOperation({ summary: 'Update an email template' })
  @ApiOkResponse({ description: 'Updated email template' })
  @ApiParam({ name: 'id', description: 'Email template UUID', example: '00000000-0000-0000-0000-000000000000' })
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @Patch('email-templates/:id')
  updateEmailTemplateEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEmailTemplateDto,
  ) {
    return this.updateEmailTemplate.execute({ id, ...body });
  }
}
