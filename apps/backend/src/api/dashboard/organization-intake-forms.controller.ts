import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiResponse,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { CreateIntakeFormHandler } from '../../modules/org-experience/intake-forms/create-intake-form.handler';
import { CreateIntakeFormDto } from '../../modules/org-experience/intake-forms/create-intake-form.dto';
import { GetIntakeFormHandler } from '../../modules/org-experience/intake-forms/get-intake-form.handler';
import { ListIntakeFormsHandler } from '../../modules/org-experience/intake-forms/list-intake-forms.handler';
import { ListIntakeFormsDto } from '../../modules/org-experience/intake-forms/list-intake-forms.dto';
import { DeleteIntakeFormHandler } from '../../modules/org-experience/intake-forms/delete-intake-form.handler';
import { UpdateIntakeFormHandler } from '../../modules/org-experience/intake-forms/update-intake-form.handler';
import { UpdateIntakeFormDto } from '../../modules/org-experience/intake-forms/update-intake-form.dto';
import { SetIntakeFieldsHandler } from '../../modules/org-experience/intake-forms/set-intake-fields.handler';
import { SetIntakeFieldsDto } from '../../modules/org-experience/intake-forms/set-intake-fields.dto';
import { GetIntakeFormResponsesHandler } from '../../modules/org-experience/intake-forms/get-intake-form-responses.handler';
import { SubmitIntakeResponseHandler } from '../../modules/org-experience/submit-intake-response/submit-intake-response.handler';
import { SubmitIntakeResponseDto } from '../../modules/org-experience/submit-intake-response/submit-intake-response.dto';
import {
  IntakeBookingResponseDto,
  IntakeFormListItemResponseDto,
  IntakeFormResponseDto,
  IntakeSubmissionResponseDto,
} from './dto/intake-form-response.dto';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

@ApiTags('Dashboard / Org Experience')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
@AuditControllerName('DashboardOrganizationSettingsController')
export class DashboardOrganizationIntakeFormsController {
  constructor(
    private readonly createIntakeForm: CreateIntakeFormHandler,
    private readonly getIntakeForm: GetIntakeFormHandler,
    private readonly listIntakeForms: ListIntakeFormsHandler,
    private readonly deleteIntakeForm: DeleteIntakeFormHandler,
    private readonly updateIntakeForm: UpdateIntakeFormHandler,
    private readonly setIntakeFields: SetIntakeFieldsHandler,
    private readonly getIntakeFormResponses: GetIntakeFormResponsesHandler,
    private readonly submitIntakeResponse: SubmitIntakeResponseHandler,
  ) {}

  @Post('intake-forms')
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @ApiOperation({ summary: 'Create an intake form' })
  @ApiCreatedResponse({ description: 'Intake form created', type: IntakeFormResponseDto })
  createIntakeFormEndpoint(@Body() body: CreateIntakeFormDto) {
    return this.createIntakeForm.execute(body);
  }

  @Get('intake-forms')
  @CheckPermissions({ action: 'read', subject: 'Content' })
  @ApiOperation({ summary: 'List intake forms' })
  @ApiOkResponse({ description: 'List of intake forms', type: [IntakeFormListItemResponseDto] })
  listIntakeFormsEndpoint(@Query() query: ListIntakeFormsDto) {
    return this.listIntakeForms.execute(query);
  }

  // NOTE: This static-segment route MUST be declared before /:formId routes
  // so NestJS does not treat "responses" as a formId value.
  @Get('intake-forms/responses/:bookingId')
  @CheckPermissions({ action: 'read', subject: 'PersonalData' })
  @ApiOperation({ summary: 'Get intake form responses for a booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'List of intake responses for the booking, each with its form, resolved scope label and submission count', type: [IntakeBookingResponseDto] })
  getIntakeFormResponsesEndpoint(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.getIntakeFormResponses.execute({ bookingId });
  }

  @Post('intake-forms/responses/:bookingId')
  @CheckPermissions({ action: 'manage', subject: 'PersonalData' })
  @ApiOperation({ summary: 'Submit (or overwrite) intake answers on behalf of a client for a booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiCreatedResponse({ description: 'Persisted intake response', type: IntakeSubmissionResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed (missing required field, unknown field, or invalid option)' })
  @ApiResponse({ status: 404, description: 'Booking or form not found' })
  submitIntakeResponseEndpoint(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() body: SubmitIntakeResponseDto,
  ) {
    return this.submitIntakeResponse.execute({
      bookingId,
      formId: body.formId,
      answers: body.answers,
    });
  }

  @Get('intake-forms/:formId')
  @CheckPermissions({ action: 'read', subject: 'Content' })
  @ApiOperation({ summary: 'Get an intake form by ID' })
  @ApiParam({ name: 'formId', description: 'Intake form UUID or reference (e.g. FRM-1024)', example: 'FRM-1024' })
  @ApiOkResponse({ description: 'Intake form detail', type: IntakeFormResponseDto })
  @ApiResponse({ status: 404, description: 'Intake form not found' })
  getIntakeFormEndpoint(@Param('formId') formId: string) {
    return this.getIntakeForm.execute({ formId });
  }

  @Patch('intake-forms/:formId')
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an intake form' })
  @ApiParam({ name: 'formId', description: 'Intake form UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Intake form updated', type: IntakeFormResponseDto })
  @ApiResponse({ status: 409, description: 'Answered intake forms cannot change their fields' })
  @ApiResponse({ status: 404, description: 'Intake form not found' })
  updateIntakeFormEndpoint(
    @Param('formId', ParseUUIDPipe) formId: string,
    @Body() body: UpdateIntakeFormDto,
  ) {
    return this.updateIntakeForm.execute({ formId, ...body });
  }

  @Put('intake-forms/:formId/fields')
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace all fields on an intake form' })
  @ApiParam({ name: 'formId', description: 'Intake form UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Fields replaced, full form returned', type: IntakeFormResponseDto })
  @ApiResponse({ status: 409, description: 'Answered intake forms cannot change their fields' })
  @ApiResponse({ status: 404, description: 'Intake form not found' })
  setIntakeFieldsEndpoint(
    @Param('formId', ParseUUIDPipe) formId: string,
    @Body() body: SetIntakeFieldsDto,
  ) {
    return this.setIntakeFields.execute({ formId, fields: body.fields ?? [] });
  }

  @Delete('intake-forms/:formId')
  @CheckPermissions({ action: 'manage', subject: 'Content' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an intake form' })
  @ApiParam({ name: 'formId', description: 'Intake form UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Intake form deleted' })
  @ApiResponse({ status: 404, description: 'Intake form not found' })
  deleteIntakeFormEndpoint(@Param('formId', ParseUUIDPipe) formId: string) {
    return this.deleteIntakeForm.execute({ formId });
  }
}
