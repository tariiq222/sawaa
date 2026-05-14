import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
  ApiCreatedResponse, ApiOkResponse, ApiNoContentResponse, ApiParam, ApiResponse,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CheckPermissions } from '../../common/guards/casl.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { UserId } from '../../common/auth/user-id.decorator';
import { CurrentUser, type JwtUser } from '../../common/auth/current-user.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ApiErrorDto } from '../../common/swagger';
import { CreateBookingHandler } from '../../modules/bookings/create-booking/create-booking.handler';
import { CreateBookingDto } from '../../modules/bookings/create-booking/create-booking.dto';
import { CreateRecurringBookingHandler } from '../../modules/bookings/create-recurring-booking/create-recurring-booking.handler';
import { CreateRecurringBookingDto } from '../../modules/bookings/create-recurring-booking/create-recurring-booking.dto';
import { ListBookingsHandler } from '../../modules/bookings/list-bookings/list-bookings.handler';
import { ListBookingsDto } from '../../modules/bookings/list-bookings/list-bookings.dto';
import { BookingsStatsHandler } from '../../modules/bookings/bookings-stats/bookings-stats.handler';
import { GetBookingHandler } from '../../modules/bookings/get-booking/get-booking.handler';
import { CancelBookingHandler } from '../../modules/bookings/cancel-booking/cancel-booking.handler';
import { CancelBookingDto } from '../../modules/bookings/cancel-booking/cancel-booking.dto';
import { RescheduleBookingHandler } from '../../modules/bookings/reschedule-booking/reschedule-booking.handler';
import { RescheduleBookingDto } from '../../modules/bookings/reschedule-booking/reschedule-booking.dto';
import { ConfirmBookingHandler } from '../../modules/bookings/confirm-booking/confirm-booking.handler';
import { RetryZoomMeetingHandler } from '../../modules/bookings/retry-zoom-meeting/retry-zoom-meeting.handler';
import { CheckInBookingHandler } from '../../modules/bookings/check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from '../../modules/bookings/complete-booking/complete-booking.handler';
import { CompleteBookingDto } from '../../modules/bookings/complete-booking/complete-booking.dto';
import { NoShowBookingHandler } from '../../modules/bookings/no-show-booking/no-show-booking.handler';
import { AddToWaitlistHandler } from '../../modules/bookings/add-to-waitlist/add-to-waitlist.handler';
import { AddToWaitlistDto } from '../../modules/bookings/add-to-waitlist/add-to-waitlist.dto';
import { ListWaitlistHandler } from '../../modules/bookings/list-waitlist/list-waitlist.handler';
import { ListWaitlistDto } from '../../modules/bookings/list-waitlist/list-waitlist.dto';
import { RemoveWaitlistEntryHandler } from '../../modules/bookings/remove-waitlist-entry/remove-waitlist-entry.handler';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';
import { CheckAvailabilityDto } from '../../modules/bookings/check-availability/check-availability.dto';
import { ListBookingStatusLogHandler } from '../../modules/bookings/list-booking-status-log/list-booking-status-log.handler';
import { FeatureKey } from '@deqah/shared/constants/feature-keys';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/bookings')
export class DashboardBookingsController {
  constructor(
    private readonly createHandler: CreateBookingHandler,
    private readonly createRecurringHandler: CreateRecurringBookingHandler,
    private readonly listHandler: ListBookingsHandler,
    private readonly statsHandler: BookingsStatsHandler,
    private readonly getHandler: GetBookingHandler,
    private readonly cancelHandler: CancelBookingHandler,
    private readonly rescheduleHandler: RescheduleBookingHandler,
    private readonly confirmHandler: ConfirmBookingHandler,
    private readonly retryZoomHandler: RetryZoomMeetingHandler,
    private readonly checkInHandler: CheckInBookingHandler,
    private readonly completeHandler: CompleteBookingHandler,
    private readonly noShowHandler: NoShowBookingHandler,
    private readonly waitlistHandler: AddToWaitlistHandler,
    private readonly listWaitlistHandler: ListWaitlistHandler,
    private readonly removeWaitlistHandler: RemoveWaitlistEntryHandler,
    private readonly availabilityHandler: CheckAvailabilityHandler,
    private readonly statusLogHandler: ListBookingStatusLogHandler,
  ) {}

  @Post()
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Create a booking' })
  @ApiCreatedResponse({
    description: 'Booking created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'PENDING' },
        scheduledAt: { type: 'string', format: 'date-time' },
        clientId: { type: 'string', format: 'uuid' },
        employeeId: { type: 'string', format: 'uuid' },
        organizationId: { type: 'string', format: 'uuid' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  createBooking(@UserId() userId: string, @Body() body: CreateBookingDto) {
    const { scheduledAt, expiresAt, ...rest } = body;
    return this.createHandler.execute({
      ...rest,
      scheduledAt: new Date(scheduledAt),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });
  }

  @Post('recurring')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Create a recurring booking series' })
  @ApiCreatedResponse({
    description: 'Recurring booking series created',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: { type: 'string', example: 'PENDING' },
          scheduledAt: { type: 'string', format: 'date-time' },
          recurringGroupId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
    },
  })
  createRecurringBooking(
    @Body() body: CreateRecurringBookingDto,
  ) {
    const { scheduledAt, expiresAt, until, customDates, ...rest } = body;
    return this.createRecurringHandler.execute({
      ...rest,
      scheduledAt: new Date(scheduledAt),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      until: until ? new Date(until) : undefined,
      customDates: customDates?.map((d) => new Date(d)),
    });
  }

  @Get()
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List bookings' })
  @ApiOkResponse({
    description: 'Paginated list of bookings',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        page: { type: 'number' },
        totalPages: { type: 'number' },
      },
    },
  })
  listBookings(@CurrentUser() user: JwtUser, @Query() q: ListBookingsDto) {
    const { page, limit, fromDate, toDate, ...rest } = q;
    return this.listHandler.execute({
      ...rest,
      page: page ?? 1,
      limit: limit ?? 20,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
      userId: user.sub,
    });
  }

  @Get('stats')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Today\'s booking counters + revenue for the dashboard StatsGrid' })
  @ApiOkResponse({
    description: 'Today/pending counts and today revenue',
    schema: {
      type: 'object',
      properties: {
        todayCount: { type: 'number', example: 12 },
        pendingCount: { type: 'number', example: 3 },
        completedToday: { type: 'number', example: 7 },
        revenueToday: { type: 'number', example: 1500 },
      },
    },
  })
  getStats() {
    return this.statsHandler.execute();
  }

  @Get('availability')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Check employee availability for a date' })
  @ApiOkResponse({
    description: 'Available time slots',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  checkAvailability(@Query() q: CheckAvailabilityDto) {
    const { date, ...rest } = q;
    return this.availabilityHandler.execute({
      ...rest,
      date: new Date(date),
    });
  }

  @Get(':id/status-log')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Get the status transition log for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Status log entries (oldest first)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          fromStatus: { type: 'string', nullable: true },
          toStatus: { type: 'string' },
          changedBy: { type: 'string', format: 'uuid', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  getBookingStatusLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.statusLogHandler.execute({ bookingId: id });
  }

  @Post('waitlist')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Add a client to the waitlist' })
  @ApiCreatedResponse({
    description: 'Waitlist entry created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        clientId: { type: 'string', format: 'uuid' },
        serviceId: { type: 'string', format: 'uuid', nullable: true },
        preferredDate: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  addToWaitlist(@Body() body: AddToWaitlistDto) {
    const { preferredDate, ...rest } = body;
    return this.waitlistHandler.execute({
      ...rest,
      preferredDate: preferredDate ? new Date(preferredDate) : undefined,
    });
  }

  @Get('waitlist')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List waitlist entries' })
  @ApiOkResponse({
    description: 'List of waitlist entries',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          clientId: { type: 'string', format: 'uuid' },
          serviceId: { type: 'string', format: 'uuid', nullable: true },
          preferredDate: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  listWaitlist(@Query() query: ListWaitlistDto) {
    return this.listWaitlistHandler.execute({ ...query });
  }

  @Delete('waitlist/:id')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a waitlist entry' })
  @ApiParam({ name: 'id', description: 'Waitlist entry ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Waitlist entry removed' })
  @ApiResponse({ status: 404, description: 'Waitlist entry not found', type: ApiErrorDto })
  removeWaitlistEntry(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.removeWaitlistHandler.execute({ id });
  }

  @Get(':id')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Get a booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Booking detail',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string' },
        scheduledAt: { type: 'string', format: 'date-time' },
        durationMins: { type: 'number' },
        clientId: { type: 'string', format: 'uuid' },
        employeeId: { type: 'string', format: 'uuid' },
        zoomJoinUrl: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  getBooking(@Param('id', ParseUUIDPipe) id: string) {
    return this.getHandler.execute({ bookingId: id });
  }

  @Patch(':id/cancel')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Booking cancelled',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'CANCELLED' },
        refundType: { type: 'string', nullable: true, example: 'FULL' },
        cancelledAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  cancelBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelBookingDto,
  ) {
    return this.cancelHandler.execute({
      bookingId: id,
      changedBy: userId,
      ...body,
    });
  }

  @Patch(':id/reschedule')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Reschedule a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking rescheduled', schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, scheduledAt: { type: 'string', format: 'date-time' }, status: { type: 'string' } } } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  rescheduleBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleBookingDto,
  ) {
    return this.rescheduleHandler.execute({
      bookingId: id,
      newScheduledAt: new Date(body.newScheduledAt),
      newDurationMins: body.newDurationMins,
      changedBy: userId,
    });
  }

  @Patch(':id/confirm')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking confirmed', schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, status: { type: 'string', example: 'CONFIRMED' } } } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  confirmBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.confirmHandler.execute({ bookingId: id, changedBy: userId });
  }

  @Post(':id/zoom/retry')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry creating Zoom meeting for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Zoom meeting retry attempted',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        zoomMeetingId: { type: 'string', nullable: true },
        zoomJoinUrl: { type: 'string', nullable: true },
        zoomStartUrl: { type: 'string', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  retryZoomMeeting(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.retryZoomHandler.execute({ bookingId: id });
  }

  @Patch(':id/check-in')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check in a client for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Client checked in', schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, status: { type: 'string', example: 'CHECKED_IN' }, checkedInAt: { type: 'string', format: 'date-time', nullable: true } } } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  checkInBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.checkInHandler.execute({ bookingId: id, changedBy: userId });
  }

  @Patch(':id/complete')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a booking as complete' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking marked complete', schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, status: { type: 'string', example: 'COMPLETED' }, completedAt: { type: 'string', format: 'date-time', nullable: true } } } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  completeBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteBookingDto,
  ) {
    return this.completeHandler.execute({
      bookingId: id,
      changedBy: userId,
      ...body,
    });
  }

  @Patch(':id/no-show')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a booking as no-show' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking marked as no-show', schema: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, status: { type: 'string', example: 'NO_SHOW' } } } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  noShowBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.noShowHandler.execute({ bookingId: id, changedBy: userId });
  }
}
