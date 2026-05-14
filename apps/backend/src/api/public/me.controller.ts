import { Controller, Get, Patch, Query, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../common/swagger';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { GetMeHandler } from '../../modules/identity/client-auth/get-me.handler';
import { ListClientBookingsHandler } from '../../modules/bookings/client/list-client-bookings.handler';
import { ClientCancelBookingHandler } from '../../modules/bookings/client/client-cancel-booking.handler';
import { ClientCancelBookingDto } from '../../modules/bookings/client/client-cancel-booking.dto';
import { ClientRescheduleBookingHandler } from '../../modules/bookings/client/client-reschedule-booking.handler';
import { ClientRescheduleBookingDto } from '../../modules/bookings/client/client-reschedule-booking.dto';
import { GetBookingInvoiceHandler } from '../../modules/finance/get-invoice/get-booking-invoice.handler';

@ApiTags('Public / Me')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Controller('public/me')
export class PublicMeController {
  constructor(
    private readonly getMe: GetMeHandler,
    private readonly listBookings: ListClientBookingsHandler,
    private readonly cancelBooking: ClientCancelBookingHandler,
    private readonly rescheduleBooking: ClientRescheduleBookingHandler,
    private readonly getBookingInvoice: GetBookingInvoiceHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get authenticated client profile' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Client profile with membership info' } })
  async meEndpoint(@ClientSession() session: { id: string }) {
    return this.getMe.execute(session.id);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List client bookings' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiOkResponse({ schema: { type: 'object', description: 'Paginated bookings list' } })
  async bookingsEndpoint(
    @ClientSession() session: { id: string },
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.listBookings.execute(
      session.id,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 10,
    );
  }

  @Patch('bookings/:id/cancel')
  @ApiOperation({ summary: 'Cancel a client booking' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Updated booking' } })
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
    const { newScheduledAt, newDurationMins } = body;
    return this.rescheduleBooking.execute({
      bookingId: id,
      clientId: session.id,
      newScheduledAt,
      newDurationMins,
    });
  }
}
