import { ClientCancelBookingDto } from '../../../modules/bookings/client/client-cancel-booking.dto';
import { ClientThrottle } from '../../../common/throttle/client-throttle';
import { PickType } from '@nestjs/swagger';
import { ClientCancellationPreviewHandler } from '../../../modules/bookings/client/client-cancellation-preview.handler';
import { ClientCancellationPreviewDto, PersistedCancellationRefundDto, CancellationRefundSummaryDto } from '../../../modules/bookings/client/client-cancellation-preview.dto';
import { ClientCancelBookingHandler } from '../../../modules/bookings/client/client-cancel-booking.handler';
import { ClientCancellationOutcomeHandler } from '../../../modules/bookings/client/client-cancellation-outcome.handler';
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation,
  ApiCreatedResponse, ApiOkResponse, ApiParam, ApiResponse, ApiExtraModels, getSchemaPath,
} from '@nestjs/swagger';
import { BookingStatus, CancellationReason, DeliveryType } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClientRoute } from '../../../common/auth/client-route.decorator';
import { ClientSession } from '../../../common/auth/client-session.decorator';
import { ApiStandardResponses, ApiErrorDto } from '../../../common/swagger';
import { ListClientBookingsHandler } from '../../../modules/bookings/client/list-client-bookings.handler';
import { GetClientBookingHandler } from '../../../modules/bookings/client/get-client-booking.handler';
import { ClientBookingDto } from '../../../modules/bookings/client/client-booking.dto';
import { projectClientBookingMutation } from '../../../modules/bookings/client/client-booking-mutation.projection';
import { toListResponse } from '../../../common/dto';
import { CreateBookingHandler } from '../../../modules/bookings/create-booking/create-booking.handler';
import { CancelBookingHandler } from '../../../modules/bookings/cancel-booking/cancel-booking.handler';
import { RequestCancelBookingHandler } from '../../../modules/bookings/request-cancel-booking/request-cancel-booking.handler';
import { ClientRescheduleBookingHandler } from '../../../modules/bookings/client/client-reschedule-booking.handler';
import { ClientRescheduleBookingDto } from '../../../modules/bookings/client/client-reschedule-booking.dto';
import { SubmitRatingHandler } from '../../../modules/org-experience/ratings/submit-rating.handler';
import { CreateZoomMeetingHandler } from '../../../modules/bookings/create-zoom-meeting/create-zoom-meeting.handler';
import { IsBoolean, Max, MaxLength } from 'class-validator';
import { GetClientBookingForActionHandler } from '../../../modules/bookings/client/get-client-booking-for-action.handler';
export class MobileRateBookingDto {
  @ApiProperty({ description: 'Rating score from 1 to 5', example: 5 })
  @IsInt() @Min(1) @Max(5) score!: number;

  @ApiPropertyOptional({ description: 'Optional comment (max 2000 chars)', example: 'Great session' })
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;

  @ApiPropertyOptional({ description: 'Make this rating publicly visible', example: true })
  @IsOptional() @IsBoolean() isPublic?: boolean;
}

export class MobileCreateBookingDto {
  @ApiProperty({ description: 'Branch where the booking takes place', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Employee performing the service', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() employeeId!: string;

  @ApiProperty({ description: 'Service to be performed', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() serviceId!: string;

  @ApiProperty({ description: 'ISO 8601 start datetime', example: '2026-05-01T09:00:00.000Z' })
  @IsDateString() scheduledAt!: string;

  @ApiPropertyOptional({ description: 'Specific duration option to resolve price and duration', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsUUID() durationOptionId?: string;

  @ApiPropertyOptional({
    description: 'Session delivery channel. Omitted defaults to IN_PERSON.',
    enum: DeliveryType,
    enumName: 'DeliveryType',
    example: DeliveryType.IN_PERSON,
  })
  @IsOptional() @IsEnum(DeliveryType) deliveryType?: DeliveryType;

  @ApiPropertyOptional({ description: 'Free-text notes for the booking', example: 'Please prepare the room in advance' })
  @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({
    description:
      'Client chose to pay at the center. When true the booking is confirmed without an online invoice; the amount is collected at reception. Rejected when the deployment has pay-at-center disabled.',
    example: false,
  })
  @IsOptional() @IsBoolean() payAtClinic?: boolean;
}

export class MobileCancelBookingDto extends PickType(ClientCancelBookingDto, ['acceptedRefundTerms', 'quoteToken', 'sourceActionId'] as const) {
  @ApiProperty({ description: 'Reason for cancellation', enum: CancellationReason, enumName: 'CancellationReason', example: CancellationReason.CLIENT_REQUESTED })
  @IsEnum(CancellationReason) reason!: CancellationReason;

  @ApiPropertyOptional({ description: 'Free-text notes about the cancellation', example: 'Change of plans' })
  @IsOptional() @IsString() cancelNotes?: string;


}

export class MobileListBookingsDto {
  @ApiPropertyOptional({ description: 'Filter by appointment tab before pagination', enum: ['upcoming', 'past', 'cancelled'] })
  @IsOptional() @IsIn(['upcoming', 'past', 'cancelled']) tab?: 'upcoming' | 'past' | 'cancelled';

  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Records per page', example: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;

  @ApiPropertyOptional({ description: 'Filter by booking status', enum: BookingStatus, enumName: 'BookingStatus', example: BookingStatus.CONFIRMED })
  @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
}

@ApiExtraModels(PersistedCancellationRefundDto, CancellationRefundSummaryDto, ClientBookingDto)
@ApiTags('Mobile Client / Bookings')
@ApiStandardResponses()
@ClientRoute()
@Controller('mobile/client/bookings')
export class MobileClientBookingsController {
  constructor(
    private readonly list: ListClientBookingsHandler,
    private readonly get: GetClientBookingHandler,
    private readonly create: CreateBookingHandler,
    private readonly cancel: CancelBookingHandler,
    private readonly requestCancel: RequestCancelBookingHandler,
    private readonly reschedule: ClientRescheduleBookingHandler,
    private readonly rate: SubmitRatingHandler,
    private readonly bookingAction: GetClientBookingForActionHandler,
    private readonly zoom: CreateZoomMeetingHandler,
    private readonly cancellationPreview: ClientCancellationPreviewHandler,
    private readonly clientCancel: ClientCancelBookingHandler,
    private readonly cancellationOutcome: ClientCancellationOutcomeHandler,
  ) {}

  @ClientThrottle('money')
  @Post()
  @ApiOperation({ summary: 'Create a booking' })
  @ApiCreatedResponse({
    description: 'Booking created',
    schema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        invoiceId: { type: 'string', format: 'uuid', nullable: true },
      },
    },
  })
  createBooking(
    @ClientSession() user: ClientSession,
    @Body() body: MobileCreateBookingDto,
  ) {
    return this.create.execute({
      clientId: user.id,
      branchId: body.branchId,
      employeeId: body.employeeId,
      serviceId: body.serviceId,
      scheduledAt: new Date(body.scheduledAt),
      durationOptionId: body.durationOptionId,
      // Without this the ONLINE choice made in the mobile booking flow was
      // dropped and normalizeBookingTypes defaulted the session to IN_PERSON.
      deliveryType: body.deliveryType,
      notes: body.notes,
      payAtClinic: body.payAtClinic,
      source: 'ONLINE',
    });
  }

  @Get()
  @ApiOperation({ summary: 'List my bookings' })
  @ApiOkResponse({
    description: 'Paginated list of the authenticated client bookings',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: getSchemaPath(ClientBookingDto) } },
        meta: { type: 'object', additionalProperties: true },
      },
    },
  })
  async listMyBookings(
    @ClientSession() user: ClientSession,
    @Query() q: MobileListBookingsDto,
  ) {
    const result = await this.list.execute({
      clientId: user.id,
      page: q.page ?? 1,
      pageSize: q.limit ?? 20,
      status: q.status,
      tab: q.tab,
      // Mobile tabs classify by lifecycle status and keep lower-case enums.
      tabSemantics: 'lifecycle',
      enumCase: 'lower',
    });
    // Mobile envelope is `{ items, meta }`; the handler's flat envelope is the web one.
    return toListResponse(result.items, result.total, result.page, result.pageSize);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by ID' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking detail', type: ClientBookingDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  getBooking(
    @ClientSession() user: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.get.execute(id, user.id, { enumCase: 'lower' });
  }

  @Get(':id/cancellation-preview')
  @ApiOperation({ summary: 'Preview client cancellation eligibility and refund terms' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ClientCancellationPreviewDto })
  cancellationPreviewEndpoint(@ClientSession() user: ClientSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.cancellationPreview.execute(id, user.id);
  }

  @ClientThrottle('write')
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking cancelled; enabled policy includes refund and requiresApproval', schema: { type: 'object', additionalProperties: true, properties: { refund: { $ref: getSchemaPath(CancellationRefundSummaryDto) }, requiresApproval: { type: 'boolean' }, booking: { type: 'object' } } } })
  @ApiResponse({ status: 409, description: 'Cancellation terms changed; refresh the preview' })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  async cancelBooking(
    @ClientSession() user: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MobileCancelBookingDto,
  ) {
    const result = await this.clientCancel.execute({
      bookingId: id, clientId: user.id, reason: body.cancelNotes,
      cancellationReason: body.reason,
      acceptedRefundTerms: body.acceptedRefundTerms, quoteToken: body.quoteToken, sourceActionId: body.sourceActionId,
    });
    const booking = projectClientBookingMutation(result.booking);
    return { ...booking, ...result, booking };
  }

  @Get(':id/join')
  @ApiOperation({ summary: 'Get (or lazily create) the Zoom join URL for an ONLINE booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Zoom join URL', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  async joinBooking(
    @ClientSession() user: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const booking = await this.bookingAction.executeForJoin(id, user.id);
    if (booking.zoomJoinUrl) {
      return { joinUrl: booking.zoomJoinUrl, scheduledAt: booking.scheduledAt };
    }
    const updated = await this.zoom.execute({ bookingId: id });
    return { joinUrl: updated.zoomJoinUrl, scheduledAt: updated.scheduledAt };
  }

  @ClientThrottle('write')
  @Post(':id/rate')
  @ApiOperation({ summary: 'Submit a rating for a completed booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiCreatedResponse({ description: 'Rating submitted', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  async rateBooking(
    @ClientSession() user: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MobileRateBookingDto,
  ) {
    const booking = await this.bookingAction.executeForRate(id, user.id);
    return this.rate.execute({
      bookingId: id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      score: body.score,
      comment: body.comment,
      isPublic: body.isPublic,
    });
  }

  @ClientThrottle('write')
  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule a booking' })
  @ApiParam({ name: 'id', description: 'Booking ID', example: '00000000-0000-0000-0000-000000000000' })
  @ApiOkResponse({ description: 'Booking rescheduled', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  async rescheduleBooking(
    @ClientSession() user: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClientRescheduleBookingDto,
  ) {
    const result = await this.reschedule.execute({
      bookingId: id,
      clientId: user.id,
      newScheduledAt: body.newScheduledAt,
    });
    return { ...result, booking: projectClientBookingMutation(result.booking) };
  }
}
