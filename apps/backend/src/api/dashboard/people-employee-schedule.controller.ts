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
  @ApiOkResponse({
    description: 'Availability windows and exceptions',
    schema: {
      type: 'object',
      properties: {
        schedule: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              dayOfWeek: { type: 'integer', minimum: 0, maximum: 6, example: 1 },
              startTime: { type: 'string', example: '09:00' },
              endTime: { type: 'string', example: '17:00' },
              isActive: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  getAvailabilityEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getAvailability.execute({ employeeId: id });
  }

  @Get('employees/:id/breaks')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: "Get an employee's break schedule" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Break windows for the employee',
    schema: {
      type: 'object',
      properties: {
        breaks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              dayOfWeek: { type: 'integer', minimum: 0, maximum: 6, example: 1 },
              startTime: { type: 'string', example: '13:00' },
              endTime: { type: 'string', example: '14:00' },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  getBreaksEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getEmployeeBreaks.execute({ employeeId: id });
  }

  @Put('employees/:id/breaks')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Set an employee's break schedule" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Updated break windows',
    schema: {
      type: 'object',
      properties: {
        breaks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              dayOfWeek: { type: 'integer', minimum: 0, maximum: 6, example: 1 },
              startTime: { type: 'string', example: '13:00' },
              endTime: { type: 'string', example: '14:00' },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  putBreaksEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetEmployeeBreaksDto,
  ) {
    return this.setEmployeeBreaks.execute({ employeeId: id, ...body });
  }

  @Get('employees/:id/vacations')
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  @ApiOperation({ summary: "List an employee's vacations (exceptions)" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'List of vacation/exception records',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          reason: { type: 'string', nullable: true },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  listVacationsEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.listEmployeeExceptions.execute({ employeeId: id });
  }

  @Post('employees/:id/vacations')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a vacation exception for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiCreatedResponse({
    description: 'Vacation created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        employeeId: { type: 'string', format: 'uuid' },
        startDate: { type: 'string', format: 'date-time' },
        endDate: { type: 'string', format: 'date-time' },
        reason: { type: 'string', nullable: true },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  createVacationEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateEmployeeExceptionDto,
  ) {
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
  deleteVacationEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('vacationId', ParseUUIDPipe) vacationId: string,
  ) {
    return this.deleteEmployeeException.execute({ employeeId: id, exceptionId: vacationId });
  }

  @Patch('employees/:id/availability')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @ApiOperation({ summary: "Update an employee's availability windows and exceptions" })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Updated availability windows and exceptions',
    schema: {
      type: 'object',
      properties: {
        windows: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              dayOfWeek: { type: 'integer', minimum: 0, maximum: 6 },
              startTime: { type: 'string', example: '09:00' },
              endTime: { type: 'string', example: '17:00' },
              isActive: { type: 'boolean' },
            },
          },
        },
        exceptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              startDate: { type: 'string', format: 'date-time' },
              endDate: { type: 'string', format: 'date-time' },
              reason: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  updateAvailabilityEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAvailabilityDto,
  ) {
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
  @ApiOkResponse({
    description: 'List of availability exceptions',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          employeeId: { type: 'string', format: 'uuid' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          reason: { type: 'string', nullable: true },
          isStartTimeOnly: { type: 'boolean' },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  listEmployeeExceptionsEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.listEmployeeExceptions.execute({ employeeId: id });
  }

  @Post('employees/:id/exceptions')
  @CheckPermissions({ action: 'update', subject: 'Employee' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an availability exception for an employee' })
  @ApiParam({ name: 'id', description: 'Employee UUID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiCreatedResponse({
    description: 'Exception created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        employeeId: { type: 'string', format: 'uuid' },
        startDate: { type: 'string', format: 'date-time' },
        endDate: { type: 'string', format: 'date-time' },
        reason: { type: 'string', nullable: true },
        isStartTimeOnly: { type: 'boolean' },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Employee not found' })
  createEmployeeExceptionEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateEmployeeExceptionDto,
  ) {
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
  deleteEmployeeExceptionEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ) {
    return this.deleteEmployeeException.execute({ employeeId: id, exceptionId });
  }
}
