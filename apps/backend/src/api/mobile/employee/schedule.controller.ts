import { Controller, Get, Patch, Body, Query, UseGuards } from '@nestjs/common';
import { endOfDayInTz, startOfDayInTz, todayRangeInTz } from '../../../common/helpers/date-tz.helper';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiOkResponse,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/swagger';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../../common/guards/casl.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ResolveEmployeeIdHandler } from '../../../modules/people/employees/resolve-employee-id.handler';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import {
  UpdateAvailabilityHandler,
  AvailabilityWindow,
  AvailabilityException,
} from '../../../modules/people/employees/update-availability.handler';
import { GetAvailabilityHandler } from '../../../modules/people/employees/get-availability.handler';
import { IsArray, ValidateNested } from 'class-validator';

export class EmployeeScheduleQuery {
  @ApiPropertyOptional({ description: 'Start of date range (ISO 8601)', example: '2026-04-01' })
  @IsOptional() @IsDateString() fromDate?: string;

  @ApiPropertyOptional({ description: 'End of date range (ISO 8601)', example: '2026-04-07' })
  @IsOptional() @IsDateString() toDate?: string;

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Results per page', example: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class UpdateAvailabilityBody {
  @ApiProperty({ description: 'Weekly availability windows', type: [AvailabilityWindow] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => AvailabilityWindow) windows!: AvailabilityWindow[];
  @ApiPropertyOptional({ description: 'Date-range exceptions (holidays, leave)', type: [AvailabilityException] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AvailabilityException) exceptions?: AvailabilityException[];
}

class EmployeeAvailabilityWindowResponseDto {
  @ApiProperty({ description: 'Availability window UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000010' }) id!: string;
  @ApiProperty({ description: 'Day of week (0=Sunday through 6=Saturday)', minimum: 0, maximum: 6, example: 1 }) dayOfWeek!: number;
  @ApiProperty({ example: '09:00' }) startTime!: string;
  @ApiProperty({ example: '17:00' }) endTime!: string;
  @ApiProperty({ example: true }) isActive!: boolean;
}

class EmployeeAvailabilityExceptionResponseDto {
  @ApiProperty({ description: 'Availability exception UUID', format: 'uuid', example: '00000000-0000-4000-a000-000000000011' }) id!: string;
  @ApiProperty({ description: 'Inclusive first date of the time-off range', type: String, format: 'date-time', example: '2026-09-20T00:00:00.000Z' }) startDate!: Date;
  @ApiProperty({ description: 'Inclusive last date of the time-off range', type: String, format: 'date-time', example: '2026-09-21T00:00:00.000Z' }) endDate!: Date;
  @ApiProperty({ description: 'Reason for the time-off exception', type: String, example: 'Annual leave', nullable: true }) reason!: string | null;
}

class EmployeeAvailabilityResponseDto {
  @ApiProperty({ description: 'Employee whose availability is returned', format: 'uuid', example: '00000000-0000-4000-a000-000000000001' }) employeeId!: string;
  @ApiProperty({ description: 'Recurring weekly availability windows', type: [EmployeeAvailabilityWindowResponseDto], example: [{ id: '00000000-0000-4000-a000-000000000010', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isActive: true }] }) windows!: EmployeeAvailabilityWindowResponseDto[];
  @ApiProperty({ description: 'Date ranges when the employee is unavailable', type: [EmployeeAvailabilityExceptionResponseDto], example: [{ id: '00000000-0000-4000-a000-000000000011', startDate: '2026-09-20T00:00:00.000Z', endDate: '2026-09-21T00:00:00.000Z', reason: 'Annual leave' }] }) exceptions!: EmployeeAvailabilityExceptionResponseDto[];
}

@ApiTags('Mobile Employee / Schedule')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('mobile/employee/schedule')
export class MobileEmployeeScheduleController {
  constructor(
    private readonly resolveEmployeeId: ResolveEmployeeIdHandler,
    private readonly listBookings: ListBookingsHandler,
    private readonly updateAvailability: UpdateAvailabilityHandler,
    private readonly getAvailability: GetAvailabilityHandler,
  ) {}

  @ApiOperation({ summary: 'Get today\'s bookings for the authenticated employee' })
  @ApiOkResponse({
    description: 'Paginated list of today\'s bookings',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, scheduledAt: { type: 'string', format: 'date-time' }, status: { type: 'string' }, clientId: { type: 'string', format: 'uuid' } } } },
        total: { type: 'number' },
        page: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @Get('today')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  async today(@CurrentUser() user: JwtUser) {
    const { start: today, end: tomorrow } = todayRangeInTz();
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    return this.listBookings.execute({
      employeeId,
      fromDate: today,
      toDate: tomorrow,
      page: 1,
      limit: 50,
    });
  }

  @ApiOperation({ summary: 'Get weekly bookings for the authenticated employee' })
  @ApiOkResponse({
    description: 'Paginated list of bookings within the given date range',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, scheduledAt: { type: 'string', format: 'date-time' }, status: { type: 'string' }, clientId: { type: 'string', format: 'uuid' } } } },
        total: { type: 'number' },
        page: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  @ApiQuery({ name: 'fromDate', required: false, description: 'Start of date range (ISO 8601)', example: '2026-04-01' })
  @ApiQuery({ name: 'toDate', required: false, description: 'End of date range (ISO 8601)', example: '2026-04-07' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Results per page', example: 100 })
  @Get('weekly')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  async weekly(
    @CurrentUser() user: JwtUser,
    @Query() q: EmployeeScheduleQuery,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    return this.listBookings.execute({
      employeeId,
      fromDate: startOfDayInTz(q.fromDate),
      toDate: endOfDayInTz(q.toDate),
      page: q.page ?? 1,
      limit: q.limit ?? 100,
    });
  }

  @ApiOperation({ summary: 'Update availability windows and exceptions for the authenticated employee' })
  @ApiOkResponse({ description: 'Availability updated successfully', type: EmployeeAvailabilityResponseDto })
  @Patch('availability')
  @CheckPermissions({ action: 'update', subject: 'Booking' })
  async updateAvailabilityEndpoint(
    @CurrentUser() user: JwtUser,
    @Body() body: UpdateAvailabilityBody,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    const result = await this.updateAvailability.execute({
      employeeId,
      windows: body.windows,
      exceptions: body.exceptions,
    });
    return { employeeId, ...result };
  }

  @ApiOperation({ summary: 'Get availability windows and exceptions for the authenticated employee' })
  @ApiOkResponse({ description: 'Availability windows and exceptions', type: EmployeeAvailabilityResponseDto })
  @Get('availability')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  async getAvailabilityEndpoint(@CurrentUser() user: JwtUser) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    const result = await this.getAvailability.execute({ employeeId });
    return { employeeId, windows: result.schedule, exceptions: result.exceptions };
  }
}
