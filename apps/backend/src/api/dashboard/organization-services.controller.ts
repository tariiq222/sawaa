import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiParam,
  ApiOkResponse, ApiCreatedResponse, ApiNoContentResponse, ApiResponse, ApiExtraModels,
  ApiQuery,
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
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';
import {
  PaginatedServicesResponseDto,
  ServiceBookingConfigResponseDto,
  ServiceCategoryDepartmentRecordDto,
  ServiceDetailResponseDto,
  ServiceEmbeddedCategoryDto,
  ServiceEmbeddedCategoryListItemDto,
  ServiceEmployeeAssignmentDto,
  ServiceRestoreResponseDto,
} from './dto/service-response.dto';
import { ServiceDurationOptionRecordDto } from './dto/employee-response.dto';

@ApiTags('Dashboard / Org Experience')
@ApiBearerAuth()
@ApiStandardResponses()
@ApiExtraModels(
  ServiceEmbeddedCategoryDto,
  ServiceCategoryDepartmentRecordDto,
  ServiceEmbeddedCategoryListItemDto,
  ServiceRestoreResponseDto,
)
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/organization')
@AuditControllerName('DashboardOrganizationSettingsController')
export class DashboardOrganizationServicesController {
  constructor(
    private readonly createService: CreateServiceHandler,
    private readonly updateService: UpdateServiceHandler,
    private readonly listServices: ListServicesHandler,
    private readonly getService: GetServiceHandler,
    private readonly archiveService: ArchiveServiceHandler,
    private readonly restoreService: RestoreServiceHandler,
    private readonly setServiceBookingConfigs: SetServiceBookingConfigsHandler,
    private readonly getServiceBookingConfigs: GetServiceBookingConfigsHandler,
    private readonly listServiceEmployees: ListServiceEmployeesHandler,
    private readonly getDurationOptions: GetDurationOptionsHandler,
    private readonly setDurationOptions: SetDurationOptionsHandler,
  ) {}

  @Post('services')
  @CheckPermissions({ action: 'create', subject: 'Service' })
  @ApiOperation({ summary: 'Create a service' })
  @ApiCreatedResponse({ description: 'Service created', type: ServiceDetailResponseDto })
  @ApiResponse({ status: 409, description: 'A non-archived service with the same Arabic or English name already exists' })
  createServiceEndpoint(@Body() body: CreateServiceDto): Promise<ServiceDetailResponseDto> {
    return this.createService.execute(body);
  }

  @Get('services')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'List services' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1, schema: { type: 'integer', minimum: 1, default: 1 } })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20, schema: { type: 'integer', minimum: 1, maximum: 200, default: 20 } })
  @ApiOkResponse({ description: 'Paginated list of services', type: PaginatedServicesResponseDto })
  listServicesEndpoint(@Query() query: ListServicesDto): Promise<PaginatedServicesResponseDto> {
    return this.listServices.execute(query);
  }

  @Get('services/:serviceId')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'Get a service by id' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID or reference (e.g. SVC-1024)', example: 'SVC-1024' })
  @ApiOkResponse({ description: 'Service details', type: ServiceDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Service not found' })
  getServiceEndpoint(@Param('serviceId') serviceId: string): Promise<ServiceDetailResponseDto> {
    return this.getService.execute({ serviceId });
  }

  @Patch('services/:serviceId')
  @CheckPermissions({ action: 'update', subject: 'Service' })
  @ApiOperation({ summary: 'Update a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Service updated', type: ServiceDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @ApiResponse({ status: 409, description: 'Service was modified by someone else (expectedUpdatedAt mismatch) or the name is taken' })
  updateServiceEndpoint(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: UpdateServiceDto,
  ): Promise<ServiceDetailResponseDto> {
    return this.updateService.execute({ serviceId, ...body });
  }

  @Delete('services/:serviceId')
  @CheckPermissions({ action: 'delete', subject: 'Service' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Service archived' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @ApiResponse({ status: 409, description: 'Clinic booking services and services referenced by packages cannot be deleted or archived' })
  async archiveServiceEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string): Promise<void> {
    await this.archiveService.execute({ serviceId });
  }

  @Post('services/:serviceId/restore')
  @CheckPermissions({ action: 'update', subject: 'Service' })
  @ApiOperation({ summary: 'Restore an archived service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Service restored', type: ServiceRestoreResponseDto })
  @ApiResponse({ status: 404, description: 'Service not found' })
  restoreServiceEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string): Promise<ServiceRestoreResponseDto> {
    return this.restoreService.execute({ serviceId });
  }

  @Get('services/:serviceId/employees')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'List active employees who offer this service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'List of employees for the service', type: ServiceEmployeeAssignmentDto, isArray: true })
  @ApiResponse({ status: 404, description: 'Service not found' })
  listServiceEmployeesEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string): Promise<ServiceEmployeeAssignmentDto[]> {
    return this.listServiceEmployees.execute({ serviceId });
  }

  @Get('services/:serviceId/booking-types')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'Get booking type configs for a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking type configs', type: ServiceBookingConfigResponseDto, isArray: true })
  @ApiResponse({ status: 404, description: 'Service not found' })
  getServiceBookingTypesEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string): Promise<ServiceBookingConfigResponseDto[]> {
    return this.getServiceBookingConfigs.execute({ serviceId });
  }

  @Put('services/:serviceId/booking-types')
  @CheckPermissions({ action: 'update', subject: 'Service' })
  @ApiOperation({ summary: 'Set booking type configs for a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking type configs updated', type: ServiceBookingConfigResponseDto, isArray: true })
  @ApiResponse({ status: 404, description: 'Service not found' })
  setServiceBookingTypesEndpoint(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: SetServiceBookingConfigsDto,
  ): Promise<ServiceBookingConfigResponseDto[]> {
    return this.setServiceBookingConfigs.execute({ serviceId, ...body });
  }

  @Get('services/:serviceId/duration-options')
  @CheckPermissions({ action: 'read', subject: 'Service' })
  @ApiOperation({ summary: 'Get duration options for a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Duration options for the service', type: ServiceDurationOptionRecordDto, isArray: true })
  getDurationOptionsEndpoint(@Param('serviceId', ParseUUIDPipe) serviceId: string): Promise<ServiceDurationOptionRecordDto[]> {
    return this.getDurationOptions.execute({ serviceId });
  }

  @Put('services/:serviceId/duration-options')
  @CheckPermissions({ action: 'update', subject: 'Service' })
  @ApiOperation({ summary: 'Set duration options for a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Duration options updated', type: ServiceDurationOptionRecordDto, isArray: true })
  @ApiResponse({ status: 404, description: 'Service not found' })
  setDurationOptionsEndpoint(
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: SetDurationOptionsDto,
  ): Promise<ServiceDurationOptionRecordDto[]> {
    return this.setDurationOptions.execute({ serviceId, ...body });
  }
}
