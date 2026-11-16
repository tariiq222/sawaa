import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiResponse,
  getSchemaPath,
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
import {
  EmailTemplatePreviewResponseDto,
  EmailTemplateResponseDto,
  PaginatedEmailTemplatesResponseDto,
} from './dto/email-template-response.dto';

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
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-based, default: 1)',
    schema: { type: 'integer', minimum: 1, default: 1 },
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Results per page (1–200, default: 20)',
    schema: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
    example: 20,
  })
  @ApiOkResponse({ description: 'Paginated email template list', type: PaginatedEmailTemplatesResponseDto })
  @CheckPermissions({ action: 'read', subject: 'Content' })
  @Get('email-templates')
  listEmailTemplatesEndpoint(
    @Query() query: ListEmailTemplatesDto,
  ): Promise<PaginatedEmailTemplatesResponseDto> {
    return this.listEmailTemplates.execute({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @ApiOperation({ summary: 'Create an email template' })
  @ApiCreatedResponse({ description: 'Email template created', type: EmailTemplateResponseDto })
  @ApiResponse({ status: 409, description: 'A template with this slug already exists' })
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @Post('email-templates')
  @HttpCode(HttpStatus.CREATED)
  createEmailTemplateEndpoint(
    @Body() body: CreateEmailTemplateDto,
  ): Promise<EmailTemplateResponseDto> {
    return this.createEmailTemplate.execute({ ...body });
  }

  @ApiOperation({ summary: 'Get a single email template by ID' })
  @ApiOkResponse({
    description:
      'Email template details; the handler returns null (empty 200 body) when no row matches the id',
    schema: {
      allOf: [{ $ref: getSchemaPath(EmailTemplateResponseDto) }],
      nullable: true,
    },
  })
  @ApiParam({ name: 'id', description: 'Email template UUID', example: '00000000-0000-0000-0000-000000000000' })
  @CheckPermissions({ action: 'read', subject: 'Content' })
  @Get('email-templates/:id')
  getEmailTemplateEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmailTemplateResponseDto | null> {
    return this.getEmailTemplate.execute({ id });
  }

  @ApiOperation({ summary: 'Preview a rendered email template' })
  @ApiOkResponse({ description: 'Rendered HTML preview', type: EmailTemplatePreviewResponseDto })
  @ApiResponse({ status: 404, description: 'Email template not found' })
  @ApiParam({ name: 'id', description: 'Email template UUID', example: '00000000-0000-0000-0000-000000000000' })
  @CheckPermissions({ action: 'read', subject: 'Content' })
  @Post('email-templates/:id/preview')
  @HttpCode(HttpStatus.OK)
  previewEmailTemplateEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PreviewEmailTemplateDto,
  ): Promise<EmailTemplatePreviewResponseDto> {
    return this.previewEmailTemplate.execute({
      id,
      context: body.context ?? {},
    });
  }

  @ApiOperation({ summary: 'Update an email template' })
  @ApiOkResponse({ description: 'Updated email template', type: EmailTemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Email template not found' })
  @ApiParam({ name: 'id', description: 'Email template UUID', example: '00000000-0000-0000-0000-000000000000' })
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @Patch('email-templates/:id')
  updateEmailTemplateEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEmailTemplateDto,
  ): Promise<EmailTemplateResponseDto> {
    return this.updateEmailTemplate.execute({ id, ...body });
  }
}
