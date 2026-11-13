import {
  Controller,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiParam, ApiResponse } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CheckPermissions } from '../../common/guards/casl.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { UserId } from '../../common/auth/user-id.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ApiErrorDto } from '../../common/swagger';
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
import { RestoreNoShowBookingHandler } from '../../modules/bookings/restore-no-show-booking/restore-no-show-booking.handler';
import { RestoreNoShowBookingDto } from '../../modules/bookings/restore-no-show-booking/restore-no-show-booking.dto';
import { ApproveCancelBookingHandler } from '../../modules/bookings/approve-cancel-booking/approve-cancel-booking.handler';
import { ApproveCancelBookingDto } from '../../modules/bookings/approve-cancel-booking/approve-cancel-booking.dto';
import { RejectCancelBookingHandler } from '../../modules/bookings/reject-cancel-booking/reject-cancel-booking.handler';
import { RejectCancelBookingDto } from '../../modules/bookings/reject-cancel-booking/reject-cancel-booking.dto';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

import { ApprovedCancelBookingRecordDto, BookingRecordDto, CancelledBookingRecordDto } from './dto/booking-record-response.dto';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/bookings')
@AuditControllerName('DashboardBookingsController')
export class DashboardBookingsLifecycleController {
  constructor(
    private readonly cancelHandler: CancelBookingHandler,
    private readonly rescheduleHandler: RescheduleBookingHandler,
    private readonly confirmHandler: ConfirmBookingHandler,
    private readonly retryZoomHandler: RetryZoomMeetingHandler,
    private readonly checkInHandler: CheckInBookingHandler,
    private readonly completeHandler: CompleteBookingHandler,
    private readonly noShowHandler: NoShowBookingHandler,
    private readonly restoreNoShowHandler: RestoreNoShowBookingHandler,
    private readonly approveCancelHandler: ApproveCancelBookingHandler,
    private readonly rejectCancelHandler: RejectCancelBookingHandler,
  ) {}

  @Patch(':id/cancel')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking cancelled', type: CancelledBookingRecordDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  cancelBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelBookingDto,
  ): Promise<CancelledBookingRecordDto> {
    return this.cancelHandler.execute({
      bookingId: id,
      changedBy: userId,
      ...body,
    });
  }

  @Patch(':id/approve-cancel')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending cancel request' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Cancel request approved', type: ApprovedCancelBookingRecordDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  approveCancelBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ApproveCancelBookingDto,
  ): Promise<ApprovedCancelBookingRecordDto> {
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
  @ApiOkResponse({ description: 'Cancel request rejected; booking returns to CONFIRMED', type: BookingRecordDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  rejectCancelBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectCancelBookingDto,
  ): Promise<BookingRecordDto> {
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
  @ApiOkResponse({ description: 'Booking rescheduled', type: BookingRecordDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  rescheduleBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleBookingDto,
  ): Promise<BookingRecordDto> {
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
  @ApiOkResponse({ description: 'Booking confirmed', type: BookingRecordDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  confirmBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingRecordDto> {
    return this.confirmHandler.execute({ bookingId: id, changedBy: userId });
  }

  @Post(':id/zoom/retry')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry creating Zoom meeting for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Zoom meeting retry attempted', type: BookingRecordDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  retryZoomMeeting(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingRecordDto> {
    return this.retryZoomHandler.execute({ bookingId: id });
  }

  @Patch(':id/check-in')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check in a client for a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Client checked in', type: BookingRecordDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  checkInBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingRecordDto> {
    return this.checkInHandler.execute({ bookingId: id, changedBy: userId });
  }

  @Patch(':id/complete')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a booking as complete' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking marked complete', type: BookingRecordDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  completeBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteBookingDto,
  ): Promise<BookingRecordDto> {
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
  @ApiOkResponse({ description: 'Booking marked as no-show', type: BookingRecordDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  noShowBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BookingRecordDto> {
    return this.noShowHandler.execute({ bookingId: id, changedBy: userId });
  }

  @Patch(':id/restore-no-show')
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a no-show booking to confirmed' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking restored to CONFIRMED while preserving attendance and suppressing automatic no-show', type: BookingRecordDto })
  @ApiResponse({ status: 400, description: 'Booking is not in NO_SHOW, or credit bucket is full', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  restoreNoShowBooking(
    @UserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RestoreNoShowBookingDto,
  ): Promise<BookingRecordDto> {
    return this.restoreNoShowHandler.execute({
      bookingId: id,
      changedBy: userId,
      reason: body.reason,
    });
  }
}
