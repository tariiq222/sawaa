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
import { CreateServiceHandler } from '../../modules/org-experience/services/create-service.handler';
import { CreateServiceDto } from '../../modules/org-experience/services/create-service.dto';
import { UpdateServiceHandler } from '../../modules/org-experience/services/update-service.handler';
import { UpdateServiceDto } from '../../modules/org-experience/services/update-service.dto';
import { ListServicesHandler } from '../../modules/org-experience/services/list-services.handler';
import { ListServicesDto } from '../../modules/org-experience/services/list-services.dto';
import { GetServiceHandler } from '../../modules/org-experience/services/get-service.handler';
import { ArchiveServiceHandler } from '../../modules/org-experience/services/archive-service.handler';
import { RestoreServiceHandler } from '../../modules/org-experience/services/restore-service.handler';
import { GetDurationOptionsHandler } from '../../modules/org-experience/services/get-duration-options.handler';
import { SetDurationOptionsHandler } from '../../modules/org-experience/services/set-duration-options.handler';
import { SetDurationOptionsDto } from '../../modules/org-experience/services/set-duration-options.dto';
import { SetServiceBookingConfigsHandler } from '../../modules/org-experience/services/set-service-booking-configs.handler';
import { SetServiceBookingConfigsDto } from '../../modules/org-experience/services/set-service-booking-configs.dto';
import { GetServiceBookingConfigsHandler } from '../../modules/org-experience/services/get-service-booking-configs.handler';
import { ListServiceEmployeesHandler } from '../../modules/org-experience/services/list-service-employees.handler';
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
import { SubmitRatingHandler } from '../../modules/org-experience/ratings/submit-rating.handler';
import { SubmitRatingDto } from '../../modules/org-experience/ratings/submit-rating.dto';
import { ListRatingsHandler } from '../../modules/org-experience/ratings/list-ratings.handler';
import { ListRatingsDto } from '../../modules/org-experience/ratings/list-ratings.dto';
import { UpdateRatingVisibilityHandler } from '../../modules/org-experience/ratings/update-rating-visibility.handler';
import { UpdateRatingVisibilityDto } from '../../modules/org-experience/ratings/update-rating-visibility.dto';
import { GetOrgSettingsHandler } from '../../modules/org-experience/org-settings/get-org-settings.handler';
import { UpsertOrgSettingsHandler } from '../../modules/org-experience/org-settings/upsert-org-settings.handler';
import { UpsertOrgSettingsDto } from '../../modules/org-experience/org-settings/upsert-org-settings.dto';
import { GetBookingSettingsHandler } from '../../modules/bookings/get-booking-settings/get-booking-settings.handler';
import { UpsertBookingSettingsHandler } from '../../modules/bookings/upsert-booking-settings/upsert-booking-settings.handler';
import { UpsertBookingSettingsDto } from '../../modules/bookings/upsert-booking-settings/upsert-booking-settings.dto';
import { CreateBundleHandler } from '../../modules/org-experience/bundles/create-bundle.handler';
import { CreateBundleDto } from '../../modules/org-experience/bundles/create-bundle.dto';
import { UpdateBundleHandler } from '../../modules/org-experience/bundles/update-bundle.handler';
import { UpdateBundleDto } from '../../modules/org-experience/bundles/update-bundle.dto';
import { ListBundlesHandler } from '../../modules/org-experience/bundles/list-bundles.handler';
import { ListBundlesDto } from '../../modules/org-experience/bundles/list-bundles.dto';
import { GetBundleHandler } from '../../modules/org-experience/bundles/get-bundle.handler';
import { ArchiveBundleHandler } from '../../modules/org-experience/bundles/archive-bundle.handler';
@ApiTags('Dashboard / Org Experience')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
export class DashboardOrganizationSettingsController {
  constructor(
    private readonly createService: CreateServiceHandler,
    private readonly updateService: UpdateServiceHandler,
    private readonly listServices: ListServicesHandler,
    private readonly getService: GetServiceHandler,
    private readonly archiveService: ArchiveServiceHandler,
    private readonly restoreService: RestoreServiceHandler,
    private readonly createIntakeForm: CreateIntakeFormHandler,
    private readonly getIntakeForm: GetIntakeFormHandler,
    private readonly listIntakeForms: ListIntakeFormsHandler,
    private readonly deleteIntakeForm: DeleteIntakeFormHandler,
    private readonly updateIntakeForm: UpdateIntakeFormHandler,
    private readonly setIntakeFields: SetIntakeFieldsHandler,
    private readonly getIntakeFormResponses: GetIntakeFormResponsesHandler,
    private readonly submitIntakeResponse: SubmitIntakeResponseHandler,
    private readonly submitRating: SubmitRatingHandler,
    private readonly listRatings: ListRatingsHandler,
    private readonly updateRatingVisibility: UpdateRatingVisibilityHandler,
    private readonly getOrgSettings: GetOrgSettingsHandler,
    private readonly upsertOrgSettings: UpsertOrgSettingsHandler,
    private readonly getBookingSettings: GetBookingSettingsHandler,
    private readonly upsertBookingSettings: UpsertBookingSettingsHandler,
    private readonly setServiceBookingConfigs: SetServiceBookingConfigsHandler,
    private readonly getServiceBookingConfigs: GetServiceBookingConfigsHandler,
    private readonly listServiceEmployees: ListServiceEmployeesHandler,
    private readonly getDurationOptions: GetDurationOptionsHandler,
    private readonly setDurationOptions: SetDurationOptionsHandler,
    private readonly createBundle: CreateBundleHandler,
    private readonly updateBundle: UpdateBundleHandler,
    private readonly listBundles: ListBundlesHandler,
    private readonly getBundle: GetBundleHandler,
    private readonly archiveBundle: ArchiveBundleHandler,
  ) {}

  // ── Services ─────────────────────────────────────────────────────────────

  @Post('services')
  @CheckPermissions({ action: 'create', subject: 'Service' })
  @ApiOperation({ summary: 'Create a service' })
  @ApiCreatedResponse({ description: 'Service created' })
  createServiceEndpoint(@Body() body: CreateServiceDto) {
    return this.createService.execute(body);
  }

  @Get('services')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'List services' })
  @ApiOkResponse({ description: 'Paginated list of services' })
  listServicesEndpoint(@Query() query: ListServicesDto) {
    return this.listServices.execute(query);
  }

  @Get('services/:serviceId')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'Get a service by id' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID or reference (e.g. SVC-1024)', example: 'SVC-1024' })
  @ApiOkResponse({ description: 'Service details' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  getServiceEndpoint(@Param('serviceId') serviceId: string) {
    return this.getService.execute({ serviceId });
  }

  @Patch('services/:serviceId')
  @CheckPermissions({ action: 'update', subject: 'Service' })
  @ApiOperation({ summary: 'Update a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Service updated' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  updateServiceEndpoint(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: UpdateServiceDto,
  ) {
    return this.updateService.execute({ serviceId, ...body });
  }

  @Delete('services/:serviceId')
  @CheckPermissions({ action: 'delete', subject: 'Service' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Service archived' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  archiveServiceEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.archiveService.execute({ serviceId });
  }

  @Post('services/:serviceId/restore')
  @CheckPermissions({ action: 'update', subject: 'Service' })
  @ApiOperation({ summary: 'Restore an archived service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Service restored' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  restoreServiceEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.restoreService.execute({ serviceId });
  }

  @Get('services/:serviceId/employees')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'List active employees who offer this service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'List of employees for the service' })
  listServiceEmployeesEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.listServiceEmployees.execute({ serviceId });
  }

  @Get('services/:serviceId/booking-types')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'Get booking type configs for a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking type configs' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  getServiceBookingTypesEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.getServiceBookingConfigs.execute({ serviceId });
  }

  @Put('services/:serviceId/booking-types')
  @CheckPermissions({ action: 'update', subject: 'Service' })
  @ApiOperation({ summary: 'Set booking type configs for a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking type configs updated' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  setServiceBookingTypesEndpoint(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: SetServiceBookingConfigsDto,
  ) {
    return this.setServiceBookingConfigs.execute({ serviceId, ...body });
  }

  @Get('services/:serviceId/duration-options')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'Get duration options for a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Duration options for the service' })
  getDurationOptionsEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string) {
    return this.getDurationOptions.execute({ serviceId });
  }

  @Put('services/:serviceId/duration-options')
  @CheckPermissions({ action: 'update', subject: 'Service' })
  @ApiOperation({ summary: 'Set duration options for a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Duration options updated' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  setDurationOptionsEndpoint(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: SetDurationOptionsDto,
  ) {
    return this.setDurationOptions.execute({ serviceId, ...body });
  }

  // ── Service Bundles ───────────────────────────────────────────────────────

  @Post('bundles')
  @CheckPermissions({ action: 'create', subject: 'Service' })
  @ApiOperation({ summary: 'Create a service bundle' })
  @ApiCreatedResponse({ description: 'Bundle created' })
  createBundleEndpoint(@Body() body: CreateBundleDto) {
    return this.createBundle.execute(body);
  }

  @Get('bundles')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'List service bundles' })
  @ApiOkResponse({ description: 'Paginated list of bundles' })
  listBundlesEndpoint(@Query() query: ListBundlesDto) {
    return this.listBundles.execute(query);
  }

  @Get('bundles/:bundleId')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'Get a service bundle by id' })
  @ApiParam({ name: 'bundleId', description: 'Bundle UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Bundle details' })
  @ApiResponse({ status: 404, description: 'Bundle not found' })
  getBundleEndpoint(@Param('bundleId', ParseUUIDPipe) bundleId: string) {
    return this.getBundle.execute({ bundleId });
  }

  @Patch('bundles/:bundleId')
  @CheckPermissions({ action: 'update', subject: 'Service' })
  @ApiOperation({ summary: 'Update a service bundle' })
  @ApiParam({ name: 'bundleId', description: 'Bundle UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Bundle updated' })
  @ApiResponse({ status: 404, description: 'Bundle not found' })
  updateBundleEndpoint(
    @Param('bundleId', ParseUUIDPipe) bundleId: string,
    @Body() body: UpdateBundleDto,
  ) {
    return this.updateBundle.execute({ bundleId, ...body });
  }

  @Delete('bundles/:bundleId')
  @CheckPermissions({ action: 'delete', subject: 'Service' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a service bundle' })
  @ApiParam({ name: 'bundleId', description: 'Bundle UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Bundle archived' })
  @ApiResponse({ status: 404, description: 'Bundle not found' })
  archiveBundleEndpoint(@Param('bundleId', ParseUUIDPipe) bundleId: string) {
    return this.archiveBundle.execute({ bundleId });
  }

  // ── Intake Forms ──────────────────────────────────────────────────────────

  @Post('intake-forms')
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Create an intake form' })
  @ApiCreatedResponse({ description: 'Intake form created' })
  createIntakeFormEndpoint(@Body() body: CreateIntakeFormDto) {
    return this.createIntakeForm.execute(body);
  }

  @Get('intake-forms')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'List intake forms' })
  @ApiOkResponse({ description: 'List of intake forms' })
  listIntakeFormsEndpoint(@Query() query: ListIntakeFormsDto) {
    return this.listIntakeForms.execute(query);
  }

  // NOTE: This static-segment route MUST be declared before /:formId routes
  // so NestJS does not treat "responses" as a formId value.
  @Get('intake-forms/responses/:bookingId')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get intake form responses for a booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'List of intake responses for the booking, each with its form, resolved scope label and submission count' })
  getIntakeFormResponsesEndpoint(@Param('bookingId', ParseUUIDPipe) bookingId: string) {
    return this.getIntakeFormResponses.execute({ bookingId });
  }

  @Post('intake-forms/responses/:bookingId')
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @ApiOperation({ summary: 'Submit (or overwrite) intake answers on behalf of a client for a booking' })
  @ApiParam({ name: 'bookingId', description: 'Booking UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiCreatedResponse({ description: 'Persisted intake response' })
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
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get an intake form by ID' })
  @ApiParam({ name: 'formId', description: 'Intake form UUID or reference (e.g. FRM-1024)', example: 'FRM-1024' })
  @ApiOkResponse({ description: 'Intake form detail' })
  @ApiResponse({ status: 404, description: 'Intake form not found' })
  getIntakeFormEndpoint(@Param('formId') formId: string) {
    return this.getIntakeForm.execute({ formId });
  }

  @Patch('intake-forms/:formId')
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update an intake form' })
  @ApiParam({ name: 'formId', description: 'Intake form UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Intake form updated' })
  @ApiResponse({ status: 404, description: 'Intake form not found' })
  updateIntakeFormEndpoint(
    @Param('formId', ParseUUIDPipe) formId: string,
    @Body() body: UpdateIntakeFormDto,
  ) {
    return this.updateIntakeForm.execute({ formId, ...body });
  }

  @Put('intake-forms/:formId/fields')
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Replace all fields on an intake form' })
  @ApiParam({ name: 'formId', description: 'Intake form UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Fields replaced, full form returned' })
  @ApiResponse({ status: 404, description: 'Intake form not found' })
  setIntakeFieldsEndpoint(
    @Param('formId', ParseUUIDPipe) formId: string,
    @Body() body: SetIntakeFieldsDto,
  ) {
    return this.setIntakeFields.execute({ formId, fields: body.fields ?? [] });
  }

  @Delete('intake-forms/:formId')
  @CheckPermissions({ action: 'manage', subject: 'Setting' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an intake form' })
  @ApiParam({ name: 'formId', description: 'Intake form UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Intake form deleted' })
  @ApiResponse({ status: 404, description: 'Intake form not found' })
  deleteIntakeFormEndpoint(@Param('formId', ParseUUIDPipe) formId: string) {
    return this.deleteIntakeForm.execute({ formId });
  }

  // ── Ratings ───────────────────────────────────────────────────────────────

  @Post('ratings')
  @CheckPermissions({ action: 'create', subject: 'Booking' })
  @ApiOperation({ summary: 'Submit a rating for a booking' })
  @ApiCreatedResponse({ description: 'Rating submitted' })
  submitRatingEndpoint(@Body() body: SubmitRatingDto) {
    return this.submitRating.execute(body);
  }

  @Get('ratings')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List ratings' })
  @ApiOkResponse({ description: 'Paginated list of ratings' })
  listRatingsEndpoint(@Query() query: ListRatingsDto) {
    return this.listRatings.execute(query);
  }

  @Patch('ratings/:id/visibility')
  @CheckPermissions({ action: 'update', subject: 'Booking' })
  @ApiOperation({ summary: 'Update rating public visibility' })
  @ApiParam({ name: 'id', description: 'Rating UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Visibility updated' })
  updateRatingVisibilityEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRatingVisibilityDto,
  ) {
    return this.updateRatingVisibility.execute({ id, isPublic: body.isPublic });
  }

  // ── Organization Settings ─────────────────────────────────────────────────

  @Get('settings')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get organization settings' })
  @ApiOkResponse({ description: 'Current organization settings' })
  getOrgSettingsEndpoint() {
    return this.getOrgSettings.execute();
  }

  @Patch('settings')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Update organization settings' })
  @ApiOkResponse({ description: 'Organization settings updated' })
  upsertOrgSettingsEndpoint(@Body() body: UpsertOrgSettingsDto) {
    return this.upsertOrgSettings.execute(body);
  }

  // ── Booking Settings ──────────────────────────────────────────────────────

  @Get('booking-settings')
  @CheckPermissions({ action: 'read', subject: 'Setting' })
  @ApiOperation({ summary: 'Get booking settings' })
  @ApiOkResponse({ description: 'Current booking settings' })
  getBookingSettingsEndpoint() {
    return this.getBookingSettings.execute({ branchId: null });
  }

  @Patch('booking-settings')
  @CheckPermissions({ action: 'update', subject: 'Setting' })
  @ApiOperation({ summary: 'Update booking settings' })
  @ApiOkResponse({ description: 'Booking settings updated' })
  upsertBookingSettingsEndpoint(@Body() body: UpsertBookingSettingsDto) {
    return this.upsertBookingSettings.execute({ branchId: null, ...body });
  }

}
