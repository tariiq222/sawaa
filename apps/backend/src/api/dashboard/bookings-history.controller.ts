import { Controller, Get, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiParam } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CheckPermissions } from '../../common/guards/casl.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { CurrentUser, type JwtUser } from '../../common/auth/current-user.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ListBookingStatusLogHandler } from '../../modules/bookings/list-booking-status-log/list-booking-status-log.handler';
import { GetBookingTimelineHandler } from '../../modules/bookings/get-booking-timeline/get-booking-timeline.handler';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

import { BookingStatusLogEntryDto, BookingTimelineEntryDto } from './dto/booking-support-response.dto';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/bookings')
@AuditControllerName('DashboardBookingsController')
export class DashboardBookingsHistoryController {
  constructor(
    private readonly statusLogHandler: ListBookingStatusLogHandler,
    private readonly timelineHandler: GetBookingTimelineHandler,
  ) {}

  @Get(':id/status-log')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Get the status transition log for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Status log entries (oldest first)', type: BookingStatusLogEntryDto, isArray: true })
  getBookingStatusLog(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<BookingStatusLogEntryDto[]> {
    return this.statusLogHandler.execute({
      bookingId: id,
      requesterRole: user.role ?? null,
      requesterUserId: user.sub,
    });
  }

  @Get(':id/timeline')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'Get the full activity timeline for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({
    description:
      'Chronological timeline merging creation, status changes, payments, refunds and activity (oldest first)',
    type: BookingTimelineEntryDto,
    isArray: true,
  })
  getBookingTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<BookingTimelineEntryDto[]> {
    return this.timelineHandler.execute({
      bookingId: id,
      requesterRole: user.role ?? null,
      requesterUserId: user.sub,
    });
  }
}
