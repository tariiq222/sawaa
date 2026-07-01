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
import { endOfDayInTz, startOfDayInTz } from '../../common/helpers/date-tz.helper';
import { CreateBookingHandler } from '../../modules/bookings/create-booking/create-booking.handler';
import { CreateBookingDto } from '../../modules/bookings/create-booking/create-booking.dto';
import { ListBookingsHandler } from '../../modules/bookings/list-bookings/list-bookings.handler';
import { ListBookingsDto } from '../../modules/bookings/list-bookings/list-bookings.dto';
import { BookingsStatsHandler } from '../../modules/bookings/bookings-stats/bookings-stats.handler';
import { GetBookingHandler } from '../../modules/bookings/get-booking/get-booking.handler';
import { CancelBookingHandler } from '../../modules/bookings/cancel-booking/cancel-booking.handler';
import { CancelBookingDto } from '../../modules/bookings/cancel-booking/cancel-booking.dto';
import { DeleteBookingHandler } from '../../modules/bookings/delete-booking/delete-booking.handler';
import { RescheduleBookingHandler } from '../../modules/bookings/reschedule-booking/reschedule-booking.handler';
import { RescheduleBookingDto } from '../../modules/bookings/reschedule-booking/reschedule-booking.dto';
import { ConfirmBookingHandler } from '../../modules/bookings/confirm-booking/confirm-booking.handler';
import { RetryZoomMeetingHandler } from '../../modules/bookings/retry-zoom-meeting/retry-zoom-meeting.handler';
import { CheckInBookingHandler } from '../../modules/bookings/check-in-booking/check-in-booking.handler';
import { CompleteBookingHandler } from '../../modules/bookings/complete-booking/complete-booking.handler';
import { CompleteBookingDto } from '../../modules/bookings/complete-booking/complete-booking.dto';
import { NoShowBookingHandler } from '../../modules/bookings/no-show-booking/no-show-booking.handler';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';
import { CheckAvailabilityDto } from '../../modules/bookings/check-availability/check-availability.dto';
import { ListBookingStatusLogHandler } from '../../modules/bookings/list-booking-status-log/list-booking-status-log.handler';
import { GetBookingTimelineHandler } from '../../modules/bookings/get-booking-timeline/get-booking-timeline.handler';
import { ApproveCancelBookingHandler } from '../../modules/bookings/approve-cancel-booking/approve-cancel-booking.handler';
import { ApproveCancelBookingDto } from '../../modules/bookings/approve-cancel-booking/approve-cancel-booking.dto';
import { RejectCancelBookingHandler } from '../../modules/bookings/reject-cancel-booking/reject-cancel-booking.handler';
import { RejectCancelBookingDto } from '../../modules/bookings/reject-cancel-booking/reject-cancel-booking.dto';
import { BookFromCreditHandler } from '../../modules/bookings/book-from-credit/book-from-credit.handler';
import { BookFromCreditDto } from '../../modules/bookings/book-from-credit/book-from-credit.dto';
import { GetMatchingCreditsHandler } from '../../modules/bookings/get-matching-credits/get-matching-credits.handler';
import { GetMatchingCreditsDto } from '../../modules/bookings/get-matching-credits/get-matching-credits.dto';
import { TransferCreditHandler } from '../../modules/bookings/transfer-credit/transfer-credit.handler';
import { TransferCreditDto } from '../../modules/bookings/transfer-credit/transfer-credit.dto';
import { ApiQuery } from '@nestjs/swagger';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/bookings')
export class DashboardBookingsController {
  constructor(
    private readonly createHandler: CreateBookingHandler,
    private readonly listHandler: ListBookingsHandler,
    private readonly statsHandler: BookingsStatsHandler,
    private readonly getHandler: GetBookingHandler,
    private readonly cancelHandler: CancelBookingHandler,
    private readonly deleteHandler: DeleteBookingHandler,
    private readonly rescheduleHandler: RescheduleBookingHandler,
    private readonly confirmHandler: ConfirmBookingHandler,
    private readonly retryZoomHandler: RetryZoomMeetingHandler,
    private readonly checkInHandler: CheckInBookingHandler,
    private readonly completeHandler: CompleteBookingHandler,
    private readonly noShowHandler: NoShowBookingHandler,
    private readonly availabilityHandler: CheckAvailabilityHandler,
    private readonly statusLogHandler: ListBookingStatusLogHandler,
    private readonly timelineHandler: GetBookingTimelineHandler,
    private readonly approveCancelHandler: ApproveCancelBookingHandler,
    private readonly rejectCancelHandler: RejectCancelBookingHandler,
    private readonly bookFromCreditHandler: BookFromCreditHandler,
    private readonly matchingCreditsHandler: GetMatchingCreditsHandler,
    private readonly transferCreditHandler: TransferCreditHandler,
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
      fromDate: startOfDayInTz(fromDate),
      toDate: endOfDayInTz(toDate),
      userId: user.sub,
      role: user.role ?? null,
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

  @Post('from-credit')
  @CheckPermissions({ action: 'create', subject: 'Booking' })
  @ApiOperation({ summary: 'Book an appointment by consuming session-package credit' })
  @ApiCreatedResponse({
    description: 'Zero-value booking created from a package credit',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'CONFIRMED' },
        scheduledAt: { type: 'string', format: 'date-time' },
        packageCreditId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Slot unavailable, missing credit selector, or past date', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'No usable package credit found', type: ApiErrorDto })
  @ApiResponse({ status: 409, description: 'No remaining credit or slot conflict (concurrent over-draw rejected)', type: ApiErrorDto })
  bookFromCredit(@UserId() userId: string, @Body() body: BookFromCreditDto) {
    const { scheduledAt, ...rest } = body;
    return this.bookFromCreditHandler.execute({
      ...rest,
      scheduledAt: new Date(scheduledAt),
      userId,
    });
  }

  @Get('matching-credits')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List a client\'s usable session-package credits matching a service/employee/duration' })
  @ApiQuery({ name: 'clientId', description: 'Client ID', example: '00000000-0000-4000-a000-000000000001' })
  @ApiQuery({ name: 'serviceId', description: 'Service ID', example: '00000000-0000-4000-a000-000000000004' })
  @ApiQuery({ name: 'employeeId', description: 'Employee ID', example: '00000000-0000-4000-a000-000000000003' })
  @ApiQuery({ name: 'durationOptionId', description: 'Duration option ID', example: '00000000-0000-4000-a000-000000000005' })
  @ApiOkResponse({
    description: 'Matching ACTIVE credits with remaining capacity (FIFO order)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          creditId: { type: 'string', format: 'uuid' },
          purchaseId: { type: 'string', format: 'uuid' },
          totalQuantity: { type: 'number' },
          usedQuantity: { type: 'number' },
          remaining: { type: 'number' },
        },
      },
    },
  })
  getMatchingCredits(@Query() q: GetMatchingCreditsDto) {
    return this.matchingCreditsHandler.execute(q);
  }

  @Post('credits/:creditId/transfer')
  // Credit management is part of booking management — same subject as creating
  // a booking from a credit, but transfer is a stronger mutation so it requires
  // `manage:Booking` (OWNER/ADMIN/MANAGER), not plain `create`.
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Transfer a session-package credit to another practitioner' })
  @ApiParam({ name: 'creditId', description: 'Package credit ID', example: '00000000-0000-4000-a000-000000000006' })
  @ApiOkResponse({
    description: 'Credit re-pointed to the target employee (price snapshot unchanged)',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        employeeId: { type: 'string', format: 'uuid' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Target employee does not provide the service/duration, is inactive, or is the current owner', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Credit or target employee not found', type: ApiErrorDto })
  transferCredit(
    @UserId() userId: string,
    @Param('creditId', ParseUUIDPipe) creditId: string,
    @Body() body: TransferCreditDto,
  ) {
    return this.transferCreditHandler.execute({
      creditId,
      toEmployeeId: body.toEmployeeId,
      userId,
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
          reason: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  getBookingStatusLog(@Param('id', ParseUUIDPipe) id: string) {
    return this.statusLogHandler.execute({ bookingId: id });
  }

  @Get(':id/timeline')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Get the full activity timeline for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description:
      'Chronological timeline merging creation, status changes, payments, refunds and activity (oldest first)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          kind: {
            type: 'string',
            enum: ['CREATED', 'STATUS_CHANGE', 'RESCHEDULE', 'PAYMENT', 'REFUND', 'ACTIVITY'],
          },
          at: { type: 'string', format: 'date-time' },
          actor: { type: 'string', nullable: true },
          fromStatus: { type: 'string', nullable: true },
          toStatus: { type: 'string', nullable: true },
          reason: { type: 'string', nullable: true },
          amount: { type: 'integer', nullable: true, description: 'Halalas' },
          method: { type: 'string', nullable: true },
          paymentStatus: { type: 'string', nullable: true },
          refundStatus: { type: 'string', nullable: true },
          meta: { type: 'object', nullable: true, additionalProperties: true },
        },
      },
    },
  })
  getBookingTimeline(@Param('id', ParseUUIDPipe) id: string) {
    return this.timelineHandler.execute({ bookingId: id });
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
  getBooking(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    // AUTHZ-005: pass caller identity so the handler scopes EMPLOYEE reads to
    // their own assigned bookings (privileged roles keep full access).
    return this.getHandler.execute({
      bookingId: id,
      role: user.role ?? null,
      userId: user.sub,
    });
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

  @Delete(':id')
  @CheckPermissions({ action: 'delete', subject: 'Booking' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a terminal booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiNoContentResponse({ description: 'Booking deleted' })
  @ApiResponse({ status: 400, description: 'Booking is not terminal or has a paid/pending payment', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  deleteBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deleteHandler.execute({ bookingId: id, changedBy: userId });
  }

  @Patch(':id/approve-cancel')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending cancel request' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Cancel request approved',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'CANCELLED' },
        autoRefund: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  approveCancelBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApproveCancelBookingDto,
  ) {
    return this.approveCancelHandler.execute({
      bookingId: id,
      approvedBy: userId,
      approverNotes: body.approverNotes,
      refundType: body.refundType,
      refundAmount: body.refundAmount,
    });
  }

  @Patch(':id/reject-cancel')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending cancel request' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description: 'Cancel request rejected; booking returns to CONFIRMED',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        status: { type: 'string', example: 'CONFIRMED' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  rejectCancelBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectCancelBookingDto,
  ) {
    return this.rejectCancelHandler.execute({
      bookingId: id,
      rejectedBy: userId,
      rejectReason: body.rejectReason,
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
