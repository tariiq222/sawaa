import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiExtraModels,
  getSchemaPath,
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
import { CreateEmployeeHandler } from '../../modules/people/employees/create-employee.handler';
import { ListEmployeesHandler } from '../../modules/people/employees/list-employees.handler';
import { GetEmployeeHandler } from '../../modules/people/employees/get-employee.handler';
import { EmployeeOnboardingHandler } from '../../modules/people/employees/employee-onboarding.handler';
import { OnboardEmployeeHandler } from '../../modules/people/employees/onboard-employee.handler';
import { OnboardEmployeeDto } from '../../modules/people/employees/onboard-employee.dto';
import { UpdateEmployeeHandler } from '../../modules/people/employees/update-employee.handler';
import { UpdateEmployeeDto } from '../../modules/people/employees/update-employee.dto';
import { CreateEmployeeDto } from '../../modules/people/employees/create-employee.dto';
import { ListEmployeesDto } from '../../modules/people/employees/list-employees.dto';
import { EmployeeOnboardingDto } from '../../modules/people/employees/employee-onboarding.dto';
import { DeleteEmployeeHandler } from '../../modules/people/employees/delete-employee.handler';
import { EmployeeAvailabilityQueryHandler } from '../../modules/bookings/employee-availability-query.handler';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EmployeeStatsHandler } from '../../modules/people/employees/employee-stats.handler';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

class EmployeeSlotsQuery {
  @IsDateString() date!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) duration?: number;

  @IsOptional() @IsString() branchId?: string;

  @IsOptional() @IsString() serviceId?: string;

  @IsOptional() @IsString() deliveryType?: string;
}

class EmployeeAvailableDaysQuery {
  @IsDateString() startDate!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) days?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) duration?: number;

  @IsOptional() @IsString() branchId?: string;

  @IsOptional() @IsString() serviceId?: string;

  @IsOptional() @IsString() deliveryType?: string;
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
export class DashboardPeopleEmployeesController {
  constructor(
    private readonly createEmployee: CreateEmployeeHandler,
    private readonly listEmployees: ListEmployeesHandler,
    private readonly getEmployee: GetEmployeeHandler,
    private readonly employeeOnboarding: EmployeeOnboardingHandler,
    private readonly onboardEmployee: OnboardEmployeeHandler,
    private readonly updateEmployee: UpdateEmployeeHandler,
    private readonly deleteEmployee: DeleteEmployeeHandler,
    private readonly availabilityQuery: EmployeeAvailabilityQueryHandler,
    private readonly employeeStats: EmployeeStatsHandler,
  ) {}

  @Post('employees')
  @CheckPermissions({ action: 'create', subject: 'Employee' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an employee' })
  @ApiCreatedResponse({ type: EmployeeResponseDto, description: 'Employee created' })
  createEmployeeEndpoint(@Body() body: CreateEmployeeDto, @Request() req: { user: { sub: string } }) {
    return this.createEmployee.execute({ ...body, actorUserId: req.user.sub });
  }

  @Post('employees/onboarding')
  @CheckPermissions({ action: 'create', subject: 'Employee' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Onboard a new employee with full profile details' })
  @ApiCreatedResponse({
    description: 'Employee onboarded',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Employee onboarded successfully' },
        employee: { $ref: getSchemaPath(EmployeeResponseDto) },
      },
    },
  })
  onboardEmployeeEndpoint(@Body() body: OnboardEmployeeDto) {
    return this.onboardEmployee.execute(body);
  }

  @Get('employees')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'List employees' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name, email, or phone', example: 'Khalid' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status', example: true })
  @ApiQuery({ name: 'gender', required: false, description: 'Filter by gender', example: 'MALE' })
  @ApiQuery({ name: 'employmentType', required: false, description: 'Filter by employment type', example: 'FULL_TIME' })
  @ApiQuery({ name: 'onboardingStatus', required: false, description: 'Filter by onboarding status', example: 'COMPLETE' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Filter by branch UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 20 })
  @ApiOkResponse({ type: PaginatedEmployeesDto, description: 'Paginated list of employees' })
  listEmployeesEndpoint(
    @Query() query: ListEmployeesDto,
    @Query('isActive') rawIsActive?: string,
  ) {
    // Global ValidationPipe has enableImplicitConversion: true, which runs
    // Boolean(string) against query params — making any non-empty string truthy
    // (so "false" becomes true). Parse the raw value explicitly instead.
    const isActive =
      rawIsActive === 'true' ? true : rawIsActive === 'false' ? false : undefined;
    return this.listEmployees.execute({
      ...query,
      isActive,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  @Get('employees/stats')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'Get employee statistics' })
  @ApiOkResponse({ type: EmployeeStatsResponseDto, description: 'Employee statistics summary' })
  employeeStatsEndpoint() {
    return this.employeeStats.execute();
  }

  @Get('employees/:id')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'Get an employee by ID' })
  @ApiParam({ name: 'id', description: 'Employee UUID or reference (e.g. EMP-1024)', example: 'EMP-1024' })
  @ApiOkResponse({ type: EmployeeResponseDto, description: 'Employee record' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  getEmployeeEndpoint(@Param('id') id: string) {
    return this.getEmployee.execute({ employeeId: id });
  }

  @Patch('employees/:id')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @ApiOperation({ summary: 'Update an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ type: EmployeeResponseDto, description: 'Updated employee record' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  updateEmployeeEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateEmployeeDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.updateEmployee.execute({ ...body, employeeId: id, actorUserId: req.user.sub });
  }

  @Post('employees/:id/onboarding')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an onboarding step for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ type: EmployeeResponseDto, description: 'Onboarding step processed — returns updated employee' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  employeeOnboardingEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EmployeeOnboardingDto,
  ) {
    return this.employeeOnboarding.execute({ employeeId: id, ...body });
  }

  @Delete('employees/:id')
  @CheckPermissions({ action: 'delete', subject: 'Employee' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Employee deleted' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  deleteEmployeeEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.deleteEmployee.execute({ employeeId: id });
  }

  @Get('employees/:id/slots')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: 'Available booking slots for an employee on a given date' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiQuery({ name: 'date', description: 'Date (ISO 8601, YYYY-MM-DD)', example: '2026-05-01' })
  @ApiQuery({ name: 'branchId', description: 'Branch UUID (defaults to main branch)', required: false, example: '00000000-0000-0000-0000-000000000000' })
  @ApiQuery({ name: 'duration', description: 'Slot duration in minutes', required: false, example: 30 })
  @ApiOkResponse({
    description: 'Available slots',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          startTime: { type: 'string', example: '09:00', description: 'HH:MM UTC' },
          endTime: { type: 'string', example: '09:30', description: 'HH:MM UTC' },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  getEmployeeSlotsEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: EmployeeSlotsQuery,
  ) {
    return this.availabilityQuery.slots({ employeeId: id, ...q });
  }

  @Get('employees/:id/available-days')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({
    summary: 'Days that have at least one bookable slot — used to disable empty day chips in the wizard',
  })
  @ApiParam({ name: 'id', description: 'Employee UUID' })
  @ApiQuery({ name: 'startDate', description: 'First day to evaluate (YYYY-MM-DD)' })
  @ApiQuery({ name: 'days', description: 'Number of days to evaluate (default 30, max 90)', required: false })
  @ApiQuery({ name: 'duration', description: 'Slot duration in minutes', required: false })
  @ApiQuery({ name: 'branchId', description: 'Branch UUID (defaults to main)', required: false })
  @ApiQuery({ name: 'serviceId', description: 'Service UUID', required: false })
  @ApiQuery({ name: 'deliveryType', description: 'IN_PERSON | ONLINE', required: false })
  @ApiOkResponse({
    description: 'Array of ISO dates that have ≥1 available slot',
    schema: { type: 'array', items: { type: 'string', example: '2026-05-25' } },
  })
  getEmployeeAvailableDaysEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: EmployeeAvailableDaysQuery,
  ) {
    return this.availabilityQuery.availableDays({ employeeId: id, ...q });
  }
}
