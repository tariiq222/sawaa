import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CancellationReason } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/swagger';
import { endOfDayInTz, startOfDayInTz } from '../../../common/helpers/date-tz.helper';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../../common/guards/casl.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { ResolveEmployeeIdHandler } from '../../../modules/people/employees/resolve-employee-id.handler';
import { AssertEmployeeBookingOwnershipHandler } from '../../../modules/bookings/assert-employee-booking-ownership/assert-employee-booking-ownership.handler';
import { ListBookingsHandler } from '../../../modules/bookings/list-bookings/list-bookings.handler';
import { ListBookingsDto } from '../../../modules/bookings/list-bookings/list-bookings.dto';
import { GetBookingHandler } from '../../../modules/bookings/get-booking/get-booking.handler';
import { CheckInBookingHandler } from '../../../modules/bookings/check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from '../../../modules/bookings/complete-booking/complete-booking.handler';
import { CompleteBookingDto } from '../../../modules/bookings/complete-booking/complete-booking.dto';
import { CancelBookingHandler } from '../../../modules/bookings/cancel-booking/cancel-booking.handler';
import { RequestCancelBookingHandler } from '../../../modules/bookings/request-cancel-booking/request-cancel-booking.handler';
import { GetEmployeeMeetingStartHandler } from '../../../modules/bookings/get-employee-meeting-start/get-employee-meeting-start.handler';
import { CreateEmployeeBookingHandler } from '../../../modules/bookings/create-employee-booking/create-employee-booking.handler';
import { CreateEmployeeBookingDto } from '../../../modules/bookings/create-employee-booking/create-employee-booking.dto';

export class EmployeeCancelBookingDto {
  @ApiPropertyOptional({
    description: 'Cancellation reason',
    enum: CancellationReason,
    enumName: 'CancellationReason',
    example: CancellationReason.EMPLOYEE_UNAVAILABLE,
  })
  @IsOptional()
  @IsEnum(CancellationReason)
  reason?: CancellationReason;

  @ApiPropertyOptional({ description: 'Free-text notes about the cancellation', example: 'Emergency leave' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelNotes?: string;
}

export class EmployeeCancelRequestDto {
  @ApiPropertyOptional({
    description: 'Cancellation reason',
    enum: CancellationReason,
    enumName: 'CancellationReason',
    example: CancellationReason.EMPLOYEE_UNAVAILABLE,
  })
  @IsOptional()
  @IsEnum(CancellationReason)
  reason?: CancellationReason;

  @ApiPropertyOptional({ description: 'Free-text notes about the cancellation request', example: 'Need to reschedule' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancelNotes?: string;
}

@ApiTags('Mobile Employee / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('mobile/employee/bookings')
export class MobileEmployeeBookingsController {
  constructor(
    private readonly resolveEmployeeId: ResolveEmployeeIdHandler,
    private readonly assertEmployeeBookingOwnership: AssertEmployeeBookingOwnershipHandler,
    private readonly listHandler: ListBookingsHandler,
    private readonly getHandler: GetBookingHandler,
    private readonly checkInHandler: CheckInBookingHandler,
    private readonly completeHandler: CompleteBookingHandler,
    private readonly cancelHandler: CancelBookingHandler,
    private readonly requestCancelHandler: RequestCancelBookingHandler,
    private readonly createEmployeeHandler: CreateEmployeeBookingHandler,
    private readonly meetingStartHandler: GetEmployeeMeetingStartHandler,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckPermissions({ action: 'create', subject: 'Booking' })
  @ApiOperation({ summary: 'Create a new booking on the authenticated employee calendar' })
  @ApiCreatedResponse({ description: 'Booking created', schema: { type: 'object' } })
  async createMyBooking(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateEmployeeBookingDto,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    return this.createEmployeeHandler.execute({
      ...dto,
      employeeId,
    });
  }

  @Get()
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List bookings assigned to the authenticated employee' })
  @ApiOkResponse({ description: 'Paginated list of bookings', schema: { type: 'object' } })
  async listMyBookings(@CurrentUser() user: JwtUser, @Query() q: ListBookingsDto) {
    const { page, limit, fromDate, toDate, ...rest } = q;
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    return this.listHandler.execute({
      ...rest,
      employeeId,
      page: page ?? 1,
      limit: limit ?? 20,
      fromDate: startOfDayInTz(fromDate),
      toDate: endOfDayInTz(toDate),
    });
  }

  @Get(':id')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Get a booking assigned to the authenticated employee' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking detail', schema: { type: 'object' } })
  async getBooking(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    await this.assertEmployeeBookingOwnership.execute({ bookingId: id, employeeId });
    return this.getHandler.execute({ bookingId: id });
  }

  @Get(':id/start-meeting')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Get the Zoom host link and timing for an assigned online booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Meeting start details; startUrl is null until the meeting has been created',
    schema: {
      type: 'object',
      properties: {
        bookingId: { type: 'string', format: 'uuid' },
        scheduledAt: { type: 'string', format: 'date-time' },
        durationMins: { type: 'integer' },
        meetingStatus: { type: 'string', nullable: true, enum: ['PENDING', 'CREATED', 'FAILED', 'CANCELLED'] },
        startUrl: { type: 'string', nullable: true },
      },
    },
  })
  async startMeeting(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    await this.assertEmployeeBookingOwnership.execute({ bookingId: id, employeeId });
    return this.meetingStartHandler.execute({ bookingId: id, employeeId });
  }

  @Post(':id/start')
  @CheckPermissions({ action: 'update', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start the session for an assigned booking (check-in)' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking marked as started', schema: { type: 'object' } })
  async start(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    await this.assertEmployeeBookingOwnership.execute({ bookingId: id, employeeId });
    return this.checkInHandler.execute({ bookingId: id, changedBy: user.sub });
  }

  @Post(':id/complete')
  @CheckPermissions({ action: 'update', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an assigned booking as complete' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking marked complete', schema: { type: 'object' } })
  async complete(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteBookingDto,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    await this.assertEmployeeBookingOwnership.execute({ bookingId: id, employeeId });
    return this.completeHandler.execute({
      bookingId: id,
      changedBy: user.sub,
      ...body,
    });
  }

  @Post(':id/employee-cancel')
  @CheckPermissions({ action: 'delete', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an assigned booking (employee-initiated, immediate)' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking cancelled', schema: { type: 'object' } })
  async employeeCancel(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EmployeeCancelBookingDto,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    await this.assertEmployeeBookingOwnership.execute({ bookingId: id, employeeId });
    return this.cancelHandler.execute({
      bookingId: id,
      changedBy: user.sub,
      reason: body.reason ?? CancellationReason.EMPLOYEE_UNAVAILABLE,
      cancelNotes: body.cancelNotes,
      source: 'employee',
    });
  }

  @Post(':id/cancel-request')
  @CheckPermissions({ action: 'update', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request cancellation for an assigned booking (requires admin approval)' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Cancellation request submitted', schema: { type: 'object' } })
  async cancelRequest(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EmployeeCancelRequestDto,
  ) {
    const employeeId = await this.resolveEmployeeId.execute({
      userId: user.sub,
      employeeId: user.employeeId,
    });
    await this.assertEmployeeBookingOwnership.execute({ bookingId: id, employeeId });
    return this.requestCancelHandler.execute({
      bookingId: id,
      reason: body.reason ?? CancellationReason.EMPLOYEE_UNAVAILABLE,
      cancelNotes: body.cancelNotes,
      requestedBy: user.sub,
    });
  }

}
