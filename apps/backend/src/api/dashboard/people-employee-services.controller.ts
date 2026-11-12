import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiExtraModels,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import {
  ClientResponseDto,
  EmployeeResponseDto,
  PaginatedClientsDto,
  PaginatedEmployeesDto,
  EmployeeStatsResponseDto,
  SetClientActiveResponseDto,
  UploadAvatarResponseDto,
} from './dto/people-response.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { ListEmployeeServicesHandler } from '../../modules/people/employees/list-employee-services.handler';
import { GetEmployeeServiceTypesHandler } from '../../modules/people/employees/get-employee-service-types.handler';
import { IsUUID } from 'class-validator';
import { AssignEmployeeServiceHandler } from '../../modules/people/employees/assign-employee-service.handler';
import { UpdateEmployeeServiceHandler } from '../../modules/people/employees/update-employee-service.handler';
import { RemoveEmployeeServiceHandler } from '../../modules/people/employees/remove-employee-service.handler';
import { SetEmployeeServiceOptionsHandler } from '../../modules/org-experience/services/set-employee-service-options.handler';
import { SetEmployeeServiceOptionsDto } from '../../modules/org-experience/services/set-employee-service-options.dto';
import { SetEmployeeCustomPricingHandler } from '../../modules/org-experience/services/set-employee-custom-pricing/set-employee-custom-pricing.handler';
import { SetEmployeeCustomPricingDto } from '../../modules/org-experience/services/set-employee-custom-pricing/set-employee-custom-pricing.dto';
import { SetEmployeeDurationsHandler } from '../../modules/org-experience/services/set-employee-durations/set-employee-durations.handler';
import { SetEmployeeDurationsDto } from '../../modules/org-experience/services/set-employee-durations/set-employee-durations.dto';
import { SetEmployeeDeliveryTypesHandler } from '../../modules/org-experience/services/set-employee-delivery-types/set-employee-delivery-types.handler';
import { SetEmployeeDeliveryTypesDto } from '../../modules/org-experience/services/set-employee-delivery-types/set-employee-delivery-types.dto';
import { SetEmployeePricingModeHandler } from '../../modules/org-experience/services/set-employee-pricing-mode/set-employee-pricing-mode.handler';
import { SetEmployeePricingModeDto } from '../../modules/org-experience/services/set-employee-pricing-mode/set-employee-pricing-mode.dto';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

class AssignEmployeeServiceDto {
  @IsUUID()
  serviceId!: string;
}

@ApiTags('Dashboard / People')
@ApiBearerAuth()
@ApiStandardResponses()
@ApiExtraModels(
  ClientResponseDto, EmployeeResponseDto,
  PaginatedClientsDto, PaginatedEmployeesDto,
  EmployeeStatsResponseDto, SetClientActiveResponseDto,
  UploadAvatarResponseDto,
)
@Controller('dashboard/people')
@UseGuards(JwtGuard, CaslGuard)
@AuditControllerName('DashboardPeopleController')
export class DashboardPeopleEmployeeServicesController {
  constructor(
    private readonly listEmployeeServices: ListEmployeeServicesHandler,
    private readonly getEmployeeServiceTypes: GetEmployeeServiceTypesHandler,
    private readonly assignEmployeeService: AssignEmployeeServiceHandler,
    private readonly updateEmployeeService: UpdateEmployeeServiceHandler,
    private readonly removeEmployeeService: RemoveEmployeeServiceHandler,
    private readonly setEmployeeServiceOptions: SetEmployeeServiceOptionsHandler,
    private readonly setEmployeeCustomPricing: SetEmployeeCustomPricingHandler,
    private readonly setEmployeeDurations: SetEmployeeDurationsHandler,
    private readonly setEmployeeDeliveryTypes: SetEmployeeDeliveryTypesHandler,
    private readonly setEmployeePricingMode: SetEmployeePricingModeHandler,
  ) {}

  @Get('employees/:id/services')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: "List services assigned to an employee" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'List of assigned services with service details',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', description: 'EmployeeService link UUID' },
          employeeId: { type: 'string', format: 'uuid' },
          serviceId: { type: 'string', format: 'uuid' },
          service: {
            type: 'object', nullable: true,
            properties: {
              id: { type: 'string', format: 'uuid' },
              name: { type: 'string', example: 'Family Therapy Session' },
              price: { type: 'number', example: 300 },
              isActive: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  listEmployeeServicesEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.listEmployeeServices.execute({ employeeId: id });
  }

  @Post('employees/:id/services')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign a service to an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['serviceId'],
      properties: { serviceId: { type: 'string', format: 'uuid', description: 'Service UUID to assign' } },
    },
  })
  @ApiCreatedResponse({
    description: 'Service assigned',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        employeeId: { type: 'string', format: 'uuid' },
        serviceId: { type: 'string', format: 'uuid' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  assignEmployeeServiceEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AssignEmployeeServiceDto,
  ) {
    return this.assignEmployeeService.execute({ employeeId: id, serviceId: body.serviceId });
  }

  @Patch('employees/:id/services/:serviceId')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @ApiOperation({ summary: 'Update an employee-service assignment' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Employee-service assignment updated' })
  @ApiNotFoundResponse({ description: 'Employee-service assignment not found' })
  updateEmployeeServiceEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: { isActive?: boolean; bufferMinutes?: number },
  ) {
    return this.updateEmployeeService.execute({ employeeId: id, serviceId, ...body });
  }

  @Put('employees/:id/services/:serviceId/options')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @ApiOperation({ summary: 'Set employee-specific service options' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Employee service options updated' })
  @ApiNotFoundResponse({ description: 'Employee-service link not found' })
  setEmployeeServiceOptionsEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: SetEmployeeServiceOptionsDto,
  ) {
    return this.setEmployeeServiceOptions.execute({ employeeId: id, serviceId, ...body });
  }

  @Put('employees/:employeeId/services/:serviceId/custom-pricing')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set custom pricing for an employee on a service' })
  @ApiParam({ name: 'employeeId', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Custom pricing updated',
    schema: {
      type: 'object',
      properties: {
        hasCustomPricing: { type: 'boolean', example: true },
        serviceTypes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'link-uuid:IN_PERSON' },
              deliveryType: { type: 'string', example: 'IN_PERSON' },
              price: { type: 'integer', example: 30000 },
              durationMins: { type: 'integer', example: 60 },
              basePrice: { type: 'integer', example: 25000 },
              baseDurationMins: { type: 'integer', example: 50 },
              isCustom: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee-service assignment not found' })
  setEmployeeCustomPricingEndpoint(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: SetEmployeeCustomPricingDto,
  ) {
    return this.setEmployeeCustomPricing.execute({ employeeId, serviceId, ...body });
  }

  @Put('employees/:id/services/:serviceId/durations')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set practitioner-owned duration options for an employee on a service' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Effective durations after update, grouped by delivery type' })
  @ApiNotFoundResponse({ description: 'Employee-service assignment not found' })
  setEmployeeDurationsEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: SetEmployeeDurationsDto,
  ) {
    return this.setEmployeeDurations.execute({ employeeId: id, serviceId, ...body });
  }

  @Put('employees/:id/services/:serviceId/delivery-types')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set the delivery types a practitioner opts out of for a service' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'The persisted disabled delivery types',
    schema: {
      type: 'object',
      properties: {
        disabledDeliveryTypes: {
          type: 'array',
          items: { type: 'string', enum: ['IN_PERSON', 'ONLINE'] },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee-service assignment not found' })
  setEmployeeDeliveryTypesEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: SetEmployeeDeliveryTypesDto,
  ) {
    return this.setEmployeeDeliveryTypes.execute({ employeeId: id, serviceId, ...body });
  }

  @Put('employees/:id/services/:serviceId/pricing-mode')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set whether a practitioner uses custom pricing for a service' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'The persisted pricing mode',
    schema: { type: 'object', properties: { useCustomPricing: { type: 'boolean' } } },
  })
  @ApiNotFoundResponse({ description: 'Employee-service assignment not found' })
  setEmployeePricingModeEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() body: SetEmployeePricingModeDto,
  ) {
    return this.setEmployeePricingMode.execute({ employeeId: id, serviceId, ...body });
  }

  @Get('employees/:id/services/:serviceId/types')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'Get bookable types + duration options for an employee-service pair' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Bookable types with duration options',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'link-uuid:IN_PERSON' },
          employeeServiceId: { type: 'string', format: 'uuid' },
          bookingType: { type: 'string', example: 'in_person' },
          price: { type: 'number', example: 300 },
          duration: { type: 'integer', example: 60 },
          useCustomOptions: { type: 'boolean' },
          isActive: { type: 'boolean' },
          durationOptions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                label: { type: 'string', nullable: true },
                durationMinutes: { type: 'integer', example: 60 },
                price: { type: 'number', example: 300 },
                isDefault: { type: 'boolean' },
                isActive: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee-service link not found' })
  getEmployeeServiceTypesEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.getEmployeeServiceTypes.execute({ employeeId: id, serviceId });
  }

  @Delete('employees/:id/services/:serviceId')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a service from an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Service removed' })
  @ApiNotFoundResponse({ description: 'Employee or service not found' })
  removeEmployeeServiceEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.removeEmployeeService.execute({ employeeId: id, serviceId });
  }
}
