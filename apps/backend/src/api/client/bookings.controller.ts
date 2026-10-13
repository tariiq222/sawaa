import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ClientRoute } from '../../common/auth/client-route.decorator';
import { toClientInvoice } from './client-invoice.projection';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ClientThrottle } from '../../common/throttle/client-throttle';
import { ApiErrorDto, ApiStandardResponses } from '../../common/swagger';
import { ListClientBookingsHandler } from '../../modules/bookings/client/list-client-bookings.handler';
import { GetClientBookingHandler } from '../../modules/bookings/client/get-client-booking.handler';
import { ClientBookingDto } from '../../modules/bookings/client/client-booking.dto';
import { projectClientBookingMutation } from '../../modules/bookings/client/client-booking-mutation.projection';
import { ClientCancellationPreviewHandler } from '../../modules/bookings/client/client-cancellation-preview.handler';
import {
  CancellationRefundSummaryDto,
  ClientCancellationPreviewDto,
  PersistedCancellationRefundDto,
} from '../../modules/bookings/client/client-cancellation-preview.dto';
import { ClientCancelBookingHandler } from '../../modules/bookings/client/client-cancel-booking.handler';
import { ClientRescheduleBookingHandler } from '../../modules/bookings/client/client-reschedule-booking.handler';
import { ClientRescheduleBookingDto } from '../../modules/bookings/client/client-reschedule-booking.dto';
import { GetClientBookingForActionHandler } from '../../modules/bookings/client/get-client-booking-for-action.handler';
import { CreatePublicBookingHandler } from '../../modules/bookings/public/create-public-booking.handler';
import { CreateZoomMeetingHandler } from '../../modules/bookings/create-zoom-meeting/create-zoom-meeting.handler';
import { SubmitRatingHandler } from '../../modules/org-experience/ratings/submit-rating.handler';
import { GetBookingInvoiceHandler } from '../../modules/finance/get-invoice/get-booking-invoice.handler';
import { ClientCreateBookingDto } from '../../modules/bookings/client/client-create-booking.dto';
import { ClientListBookingsQuery } from '../../modules/bookings/client/client-list-bookings.query';
import { ClientCancelBookingRequestDto } from '../../modules/bookings/client/client-cancel-booking-request.dto';
import { ClientRateBookingDto } from '../../modules/bookings/client/client-rate-booking.dto';

@ApiExtraModels(CancellationRefundSummaryDto, PersistedCancellationRefundDto, ClientBookingDto)
@ApiTags('Client / Bookings')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/bookings')
export class ClientBookingsController {
  constructor(
    private readonly list: ListClientBookingsHandler,
    private readonly get: GetClientBookingHandler,
    private readonly createBooking: CreatePublicBookingHandler,
    private readonly cancellationPreview: ClientCancellationPreviewHandler,
    private readonly cancelBooking: ClientCancelBookingHandler,
    private readonly reschedule: ClientRescheduleBookingHandler,
    private readonly bookingAction: GetClientBookingForActionHandler,
    private readonly rate: SubmitRatingHandler,
    private readonly zoom: CreateZoomMeetingHandler,
    private readonly bookingInvoice: GetBookingInvoiceHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List my bookings' })
  @ApiOkResponse({
    description: 'Paginated list of the authenticated client bookings',
    schema: {
      type: 'object',
      required: ['items', 'total', 'page', 'pageSize'],
      properties: {
        items: { type: 'array', items: { $ref: getSchemaPath(ClientBookingDto) } },
        total: { type: 'integer' },
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
      },
    },
  })
  listMyBookings(@ClientSession() session: ClientSession, @Query() q: ClientListBookingsQuery) {
    return this.list.execute({
      clientId: session.id,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
      tab: q.tab,
      status: q.status,
      tabSemantics: 'date',
      enumCase: 'upper',
    });
  }

  @ClientThrottle('money')
  @Post()
  @ApiOperation({ summary: 'Create a booking' })
  @ApiCreatedResponse({
    description: 'Booking created',
    schema: {
      type: 'object',
      additionalProperties: true,
      properties: {
        id: { type: 'string', format: 'uuid' },
        bookingNumber: { type: 'string' },
        status: { type: 'string' },
        paymentStatus: { type: 'string' },
        invoiceId: { type: 'string', format: 'uuid', nullable: true },
      },
    },
  })
  create(@ClientSession() session: ClientSession, @Body() body: ClientCreateBookingDto) {
    // SECURITY: clientId comes from the verified session, never the body.
    return this.createBooking.execute({
      clientId: session.id,
      branchId: body.branchId,
      employeeId: body.employeeId,
      serviceId: body.serviceId,
      scheduledAt: new Date(body.scheduledAt),
      durationOptionId: body.durationOptionId,
      bookingType: body.bookingType,
      deliveryType: body.deliveryType,
      couponCode: body.couponCode,
      notes: body.notes,
      payAtClinic: body.payAtClinic,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a booking by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Booking detail', type: ClientBookingDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  getBooking(@ClientSession() session: ClientSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.get.execute(id, session.id, { enumCase: 'upper' });
  }

  @Get(':id/cancellation-preview')
  @ApiOperation({ summary: 'Preview client cancellation eligibility and refund terms' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ClientCancellationPreviewDto })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  preview(@ClientSession() session: ClientSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.cancellationPreview.execute(id, session.id);
  }

  @ClientThrottle('write')
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['status', 'booking', 'requiresApproval'],
      properties: {
        status: { type: 'string', enum: ['CANCELLED', 'CANCEL_REQUESTED'] },
        booking: { type: 'object' },
        requiresApproval: { type: 'boolean' },
        refund: { $ref: getSchemaPath(CancellationRefundSummaryDto) },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Cancellation terms changed; refresh the preview' })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  async cancel(
    @ClientSession() session: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClientCancelBookingRequestDto,
  ) {
    const result = await this.cancelBooking.execute({
      bookingId: id,
      clientId: session.id,
      reason: body.notes,
      cancellationReason: body.reason,
      acceptedRefundTerms: body.acceptedRefundTerms,
      quoteToken: body.quoteToken,
      sourceActionId: body.sourceActionId,
    });
    return { ...result, booking: projectClientBookingMutation(result.booking) };
  }

  @ClientThrottle('write')
  @Patch(':id/reschedule')
  @ApiOperation({ summary: 'Reschedule a booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Booking rescheduled', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  async rescheduleBooking(
    @ClientSession() session: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClientRescheduleBookingDto,
  ) {
    const result = await this.reschedule.execute({ bookingId: id, clientId: session.id, newScheduledAt: body.newScheduledAt });
    return { ...result, booking: projectClientBookingMutation(result.booking) };
  }

  @ClientThrottle('write')
  @Post(':id/rate')
  @ApiOperation({ summary: 'Submit a rating for a completed booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ description: 'Rating submitted', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  async rateBooking(
    @ClientSession() session: ClientSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClientRateBookingDto,
  ) {
    const booking = await this.bookingAction.executeForRate(id, session.id);
    return this.rate.execute({
      bookingId: id,
      clientId: booking.clientId,
      employeeId: booking.employeeId,
      score: body.score,
      comment: body.comment,
      isPublic: body.isPublic,
    });
  }

  @Get(':id/join')
  @ApiOperation({ summary: 'Get (or lazily create) the Zoom join URL for an ONLINE booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Zoom join URL and appointment time', schema: { type: 'object' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  async join(@ClientSession() session: ClientSession, @Param('id', ParseUUIDPipe) id: string) {
    const booking = await this.bookingAction.executeForJoin(id, session.id);
    if (booking.zoomJoinUrl) {
      return { joinUrl: booking.zoomJoinUrl, scheduledAt: booking.scheduledAt };
    }
    const updated = await this.zoom.execute({ bookingId: id });
    return { joinUrl: updated.zoomJoinUrl, scheduledAt: updated.scheduledAt };
  }

  @Get(':id/invoice')
  @ApiOperation({ summary: 'Get the invoice for a booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Invoice details; `hasReceipt` replaces the receipt storage key' } })
  @ApiResponse({ status: 404, description: 'Booking not found', type: ApiErrorDto })
  async invoice(@ClientSession() session: ClientSession, @Param('id', ParseUUIDPipe) id: string) {
    return toClientInvoice(await this.bookingInvoice.execute(id, session.id));
  }
}
