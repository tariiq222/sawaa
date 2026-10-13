import { ClientCancellationPreviewHandler } from '../../modules/bookings/client/client-cancellation-preview.handler';
import { ClientThrottle } from '../../common/throttle/client-throttle';
import { ClientCancellationPreviewDto, CancellationRefundSummaryDto, PersistedCancellationRefundDto } from '../../modules/bookings/client/client-cancellation-preview.dto';
import { Controller, Get, Patch, Query, Param, Body, ParseUUIDPipe, ParseEnumPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiOkResponse, ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { GetMeHandler } from '../../modules/identity/client-auth/get-me.handler';
import { UpdateClientProfileHandler } from '../../modules/identity/client-auth/update-client-profile.handler';
import { UpdateClientProfileDto } from '../../modules/identity/client-auth/update-client-profile.dto';
import { ClientProfileDto } from '../../modules/identity/client-auth/client-profile.dto';
import { ListClientInvoicesHandler } from '../../modules/finance/list-client-invoices/list-client-invoices.handler';
import { ListClientBookingsHandler, ClientBookingsTab } from '../../modules/bookings/client/list-client-bookings.handler';
import { ClientCancelBookingHandler } from '../../modules/bookings/client/client-cancel-booking.handler';
import { ClientCancelBookingDto } from '../../modules/bookings/client/client-cancel-booking.dto';
import { ClientRescheduleBookingHandler } from '../../modules/bookings/client/client-reschedule-booking.handler';
import { ClientRescheduleBookingDto } from '../../modules/bookings/client/client-reschedule-booking.dto';
import { GetClientBookingHandler } from '../../modules/bookings/client/get-client-booking.handler';
import { ClientBookingDto } from '../../modules/bookings/client/client-booking.dto';
import { projectClientBookingMutation } from '../../modules/bookings/client/client-booking-mutation.projection';
import { GetBookingInvoiceHandler } from '../../modules/finance/get-invoice/get-booking-invoice.handler';
import { ClientRoute } from '../../common/auth/client-route.decorator';

@ApiExtraModels(CancellationRefundSummaryDto, PersistedCancellationRefundDto, ClientBookingDto)
@ApiTags('Public / Me')
@ApiStandardResponses()
@ClientRoute()
@Controller('public/me')
export class PublicMeController {
  constructor(
    private readonly getMe: GetMeHandler,
    private readonly updateClientProfile: UpdateClientProfileHandler,
    private readonly listClientInvoices: ListClientInvoicesHandler,
    private readonly listBookings: ListClientBookingsHandler,
    private readonly cancelBooking: ClientCancelBookingHandler,
    private readonly rescheduleBooking: ClientRescheduleBookingHandler,
    private readonly getClientBooking: GetClientBookingHandler,
    private readonly getBookingInvoice: GetBookingInvoiceHandler,
    private readonly cancellationPreview: ClientCancellationPreviewHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get authenticated client profile' })
  @ApiOkResponse({ type: ClientProfileDto, description: 'Client profile record' })
  async meEndpoint(@ClientSession() session: { id: string }) {
    return this.getMe.execute(session.id);
  }

  @ClientThrottle('write')
  @Patch()
  @ApiOperation({ summary: 'Update authenticated client profile' })
  @ApiOkResponse({ type: ClientProfileDto, description: 'Updated client profile' })
  @ApiResponse({ status: 409, description: 'Phone number already used by another account' })
  async updateProfileEndpoint(
    @ClientSession() session: { id: string },
    @Body() body: UpdateClientProfileDto,
  ) {
    return this.updateClientProfile.execute(session.id, body);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'List client invoices' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ schema: {
    type: 'object', description: 'Paginated invoices with the full client outstanding balance',
    required: ['items', 'total', 'page', 'pageSize', 'outstandingBalance'],
    properties: {
      items: { type: 'array', items: { type: 'object' } },
      total: { type: 'integer', minimum: 0 },
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', minimum: 1 },
      outstandingBalance: { type: 'integer', minimum: 0, description: 'Outstanding balance across all client invoices, in halalas' },
    },
  } })
  async invoicesEndpoint(
    @ClientSession() session: { id: string },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.listClientInvoices.execute(
      session.id,
      page ? Number.parseInt(page, 10) : 1,
      pageSize ? Number.parseInt(pageSize, 10) : 20,
    );
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List client bookings' })
  @ApiQuery({ name: 'tab', required: false, enum: ClientBookingsTab })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({
    description: 'Paginated bookings list',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { $ref: getSchemaPath(ClientBookingDto) } },
        total: { type: 'integer' }, page: { type: 'integer' }, pageSize: { type: 'integer' },
      },
    },
  })
  async bookingsEndpoint(
    @ClientSession() session: { id: string },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('tab', new ParseEnumPipe(ClientBookingsTab, { optional: true })) tab?: ClientBookingsTab,
  ) {
    return this.listBookings.execute({
      clientId: session.id,
      page: page ? Number.parseInt(page, 10) : 1,
      pageSize: pageSize ? Number.parseInt(pageSize, 10) : 10,
      tab,
    });
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Get a single client booking by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Booking detail', type: ClientBookingDto })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingEndpoint(
    @ClientSession() session: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getClientBooking.execute(id, session.id);
  }

  @Get('bookings/:id/cancellation-preview')
  @ApiOperation({ summary: 'Preview client cancellation eligibility and refund terms' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ClientCancellationPreviewDto })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async cancellationPreviewEndpoint(
    @ClientSession() session: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cancellationPreview.execute(id, session.id);
  }

  @ClientThrottle('write')
  @Patch('bookings/:id/cancel')
  @ApiOperation({ summary: 'Cancel a client booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { type: 'object', required: ['status', 'booking', 'requiresApproval'], properties: { status: { type: 'string', enum: ['CANCELLED', 'CANCEL_REQUESTED'] }, booking: { type: 'object' }, requiresApproval: { type: 'boolean' }, refund: { $ref: getSchemaPath(CancellationRefundSummaryDto) } } } })
  @ApiResponse({ status: 409, description: 'Cancellation terms changed; refresh the preview' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async cancelBookingEndpoint(
    @ClientSession() session: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClientCancelBookingDto,
  ) {
    const result = await this.cancelBooking.execute({ bookingId: id, clientId: session.id, ...body });
    return { ...result, booking: projectClientBookingMutation(result.booking) };
  }

  @Get('bookings/:id/invoice')
  @ApiOperation({ summary: 'Get invoice for a booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Invoice details' } })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async bookingInvoiceEndpoint(
    @ClientSession() session: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.getBookingInvoice.execute(id, session.id);
  }

  @ClientThrottle('write')
  @Patch('bookings/:id/reschedule')
  @ApiOperation({ summary: 'Reschedule a client booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Updated booking' } })
  async rescheduleBookingEndpoint(
    @ClientSession() session: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClientRescheduleBookingDto,
  ) {
    const result = await this.rescheduleBooking.execute({
      bookingId: id,
      clientId: session.id,
      newScheduledAt: body.newScheduledAt,
    });
    return { ...result, booking: projectClientBookingMutation(result.booking) };
  }
}
