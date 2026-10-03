import { ClientCancellationPreviewHandler } from '../../modules/bookings/client/client-cancellation-preview.handler';
import { ClientCancellationPreviewDto, CancellationRefundSummaryDto, PersistedCancellationRefundDto } from '../../modules/bookings/client/client-cancellation-preview.dto';
import { Controller, Get, Patch, Query, Param, Body, UseGuards, ParseUUIDPipe, ParseEnumPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiOkResponse, ApiResponse, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { GetMeHandler } from '../../modules/identity/client-auth/get-me.handler';
import { UpdateClientProfileHandler } from '../../modules/identity/client-auth/update-client-profile.handler';
import { UpdateClientProfileDto } from '../../modules/identity/client-auth/update-client-profile.dto';
import { ListClientInvoicesHandler } from '../../modules/finance/list-client-invoices/list-client-invoices.handler';
import { ListClientBookingsHandler, ClientBookingsTab } from '../../modules/bookings/client/list-client-bookings.handler';
import { ClientCancelBookingHandler } from '../../modules/bookings/client/client-cancel-booking.handler';
import { ClientCancelBookingDto } from '../../modules/bookings/client/client-cancel-booking.dto';
import { ClientRescheduleBookingHandler } from '../../modules/bookings/client/client-reschedule-booking.handler';
import { ClientRescheduleBookingDto } from '../../modules/bookings/client/client-reschedule-booking.dto';
import { GetClientBookingHandler } from '../../modules/bookings/client/get-client-booking.handler';
import { GetBookingInvoiceHandler } from '../../modules/finance/get-invoice/get-booking-invoice.handler';
import { Public } from '../../common/guards/jwt.guard';

@ApiExtraModels(CancellationRefundSummaryDto, PersistedCancellationRefundDto)
@ApiTags('Public / Me')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Public()
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
  @ApiOkResponse({ schema: { type: 'object', description: 'Client profile with membership info' } })
  async meEndpoint(@ClientSession() session: { id: string }) {
    return this.getMe.execute(session.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update authenticated client profile' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Updated client profile' } })
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
  @ApiOkResponse({ schema: { type: 'object', description: 'Paginated bookings list' } })
  async bookingsEndpoint(
    @ClientSession() session: { id: string },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('tab', new ParseEnumPipe(ClientBookingsTab, { optional: true })) tab?: ClientBookingsTab,
  ) {
    return this.listBookings.execute(
      session.id,
      page ? Number.parseInt(page, 10) : 1,
      pageSize ? Number.parseInt(pageSize, 10) : 10,
      tab,
    );
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Get a single client booking by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Booking detail', additionalProperties: true, properties: { cancellationRefund: { $ref: getSchemaPath(PersistedCancellationRefundDto) } } } })
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
    return this.cancelBooking.execute({ bookingId: id, clientId: session.id, ...body });
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

  @Patch('bookings/:id/reschedule')
  @ApiOperation({ summary: 'Reschedule a client booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Updated booking' } })
  async rescheduleBookingEndpoint(
    @ClientSession() session: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ClientRescheduleBookingDto,
  ) {
    return this.rescheduleBooking.execute({
      bookingId: id,
      clientId: session.id,
      newScheduledAt: body.newScheduledAt,
    });
  }
}
