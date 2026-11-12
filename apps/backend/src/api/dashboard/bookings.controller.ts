import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
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
import { DeleteBookingHandler } from '../../modules/bookings/delete-booking/delete-booking.handler';
import { CheckAvailabilityHandler } from '../../modules/bookings/check-availability/check-availability.handler';
import { CheckAvailabilityDto } from '../../modules/bookings/check-availability/check-availability.dto';

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
    private readonly deleteHandler: DeleteBookingHandler,
    private readonly availabilityHandler: CheckAvailabilityHandler,
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
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              payAtClinic: { type: 'boolean', description: 'Client selected payment at the center; independent of financial payment status', example: true },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
            hasNextPage: { type: 'boolean' },
            hasPreviousPage: { type: 'boolean' },
          },
        },
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
        payAtClinic: { type: 'boolean', description: 'Client selected payment at the center; independent of financial payment status', example: true },
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
}
