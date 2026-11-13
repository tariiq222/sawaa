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
import {
  EmployeeAvailabilityExceptionRecordDto,
  EmployeeAvailabilityUpdateResponseDto,
  EmployeeAvailabilityWindowRecordDto,
  EmployeeBreakRecordDto,
  EmployeeBreaksResponseDto,
  EmployeeScheduleResponseDto,
} from './dto/employee-response.dto';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../common/guards/casl.guard';
import { UpdateAvailabilityHandler } from '../../modules/people/employees/update-availability.handler';
import { GetAvailabilityHandler } from '../../modules/people/employees/get-availability.handler';
import { UpdateAvailabilityDto } from '../../modules/people/employees/update-availability.dto';
import { ListEmployeeExceptionsHandler } from '../../modules/people/employees/list-employee-exceptions.handler';
import { CreateEmployeeExceptionHandler } from '../../modules/people/employees/create-employee-exception.handler';
import { CreateEmployeeExceptionDto } from '../../modules/people/employees/create-employee-exception.dto';
import { DeleteEmployeeExceptionHandler } from '../../modules/people/employees/delete-employee-exception.handler';
import { GetEmployeeBreaksHandler } from '../../modules/people/employees/get-employee-breaks/get-employee-breaks.handler';
import { SetEmployeeBreaksHandler } from '../../modules/people/employees/set-employee-breaks/set-employee-breaks.handler';
import { SetEmployeeBreaksDto } from '../../modules/people/employees/set-employee-breaks/set-employee-breaks.dto';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

@ApiTags('Dashboard / People')
@ApiBearerAuth()
@ApiStandardResponses()
@ApiExtraModels(
  ClientResponseDto, EmployeeResponseDto,
  EmployeeScheduleResponseDto, EmployeeAvailabilityUpdateResponseDto,
  EmployeeBreaksResponseDto, EmployeeAvailabilityWindowRecordDto,
  EmployeeAvailabilityExceptionRecordDto, EmployeeBreakRecordDto,
  PaginatedClientsDto, PaginatedEmployeesDto,
  EmployeeStatsResponseDto, SetClientActiveResponseDto,
  UploadAvatarResponseDto,
)
@Controller('dashboard/people')
@UseGuards(JwtGuard, CaslGuard)
@AuditControllerName('DashboardPeopleController')
export class DashboardPeopleEmployeeScheduleController {
  constructor(
    private readonly updateAvailability: UpdateAvailabilityHandler,
    private readonly getAvailability: GetAvailabilityHandler,
    private readonly listEmployeeExceptions: ListEmployeeExceptionsHandler,
    private readonly createEmployeeException: CreateEmployeeExceptionHandler,
    private readonly deleteEmployeeException: DeleteEmployeeExceptionHandler,
    private readonly getEmployeeBreaks: GetEmployeeBreaksHandler,
    private readonly setEmployeeBreaks: SetEmployeeBreaksHandler,
  ) {}

  @Get('employees/:id/availability')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: "Get an employee's availability schedule" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ type: EmployeeScheduleResponseDto, description: 'Availability windows and exceptions' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  getAvailabilityEndpoint(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeScheduleResponseDto> {
    return this.getAvailability.execute({ employeeId: id });
  }

  @Get('employees/:id/breaks')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: "Get an employee's break schedule" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ type: EmployeeBreaksResponseDto, description: 'Break windows for the employee' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  getBreaksEndpoint(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeBreaksResponseDto> {
    return this.getEmployeeBreaks.execute({ employeeId: id });
  }

  @Put('employees/:id/breaks')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Set an employee's break schedule" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ type: EmployeeBreaksResponseDto, description: 'Updated break windows' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  putBreaksEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetEmployeeBreaksDto,
  ): Promise<EmployeeBreaksResponseDto> {
    return this.setEmployeeBreaks.execute({ employeeId: id, ...body });
  }

  @Get('employees/:id/vacations')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: "List an employee's vacations (exceptions)" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ type: EmployeeAvailabilityExceptionRecordDto, isArray: true, description: 'List of vacation/exception records' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  listVacationsEndpoint(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeAvailabilityExceptionRecordDto[]> {
    return this.listEmployeeExceptions.execute({ employeeId: id });
  }

  @Post('employees/:id/vacations')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a vacation exception for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiCreatedResponse({ type: EmployeeAvailabilityExceptionRecordDto, description: 'Vacation created' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  createVacationEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateEmployeeExceptionDto,
  ): Promise<EmployeeAvailabilityExceptionRecordDto> {
    return this.createEmployeeException.execute({ employeeId: id, ...body });
  }

  @Delete('employees/:id/vacations/:vacationId')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a vacation exception' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'vacationId', description: 'Vacation exception UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Vacation deleted' })
  @ApiNotFoundResponse({ description: 'Employee or vacation not found' })
  async deleteVacationEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('vacationId', ParseUUIDPipe) vacationId: string,
  ): Promise<void> {
    await this.deleteEmployeeException.execute({ employeeId: id, exceptionId: vacationId });
  }

  @Patch('employees/:id/availability')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @ApiOperation({ summary: "Update an employee's availability windows and exceptions" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ type: EmployeeAvailabilityUpdateResponseDto, description: 'Updated availability windows and exceptions' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  updateAvailabilityEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAvailabilityDto,
  ): Promise<EmployeeAvailabilityUpdateResponseDto> {
    return this.updateAvailability.execute({
      employeeId: id,
      windows: body.windows,
      exceptions: body.exceptions,
    });
  }

  @Get('employees/:id/exceptions')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: "List availability exceptions for an employee" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ type: EmployeeAvailabilityExceptionRecordDto, isArray: true, description: 'List of availability exceptions' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  listEmployeeExceptionsEndpoint(@Param('id', ParseUUIDPipe) id: string): Promise<EmployeeAvailabilityExceptionRecordDto[]> {
    return this.listEmployeeExceptions.execute({ employeeId: id });
  }

  @Post('employees/:id/exceptions')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an availability exception for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiCreatedResponse({ type: EmployeeAvailabilityExceptionRecordDto, description: 'Exception created' })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  createEmployeeExceptionEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateEmployeeExceptionDto,
  ): Promise<EmployeeAvailabilityExceptionRecordDto> {
    return this.createEmployeeException.execute({ employeeId: id, ...body });
  }

  @Delete('employees/:id/exceptions/:exceptionId')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an availability exception' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiParam({ name: 'exceptionId', description: 'Exception UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Exception deleted' })
  @ApiNotFoundResponse({ description: 'Employee or exception not found' })
  async deleteEmployeeExceptionEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ): Promise<void> {
    await this.deleteEmployeeException.execute({ employeeId: id, exceptionId });
  }
}
