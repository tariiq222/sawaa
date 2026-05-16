import { Controller, Post, Get, Body, UseGuards, Param, Query, ParseUUIDPipe, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiOkResponse, ApiCreatedResponse, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { CreateGuestBookingHandler } from '../../modules/bookings/public/create-guest-booking.handler';
import { CreateGuestBookingDto } from '../../modules/bookings/public/create-guest-booking.dto';
import { OtpSessionGuard } from '../../modules/identity/otp/otp-session.guard';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ListPublicGroupSessionsHandler } from '../../modules/bookings/public/list-public-group-sessions.handler';
import { GetPublicGroupSessionHandler } from '../../modules/bookings/public/get-public-group-session.handler';
import { BookGroupSessionHandler } from '../../modules/bookings/public/book-group-session.handler';
import { GetBookingStatusHandler } from '../../modules/bookings/public/get-booking-status.handler';
import type { OtpSessionPayload } from '../../modules/identity/otp/otp-session.service';
import type { Request } from 'express';
@ApiTags('Public / Bookings')
@ApiPublicResponses()
@Controller('public/bookings')
export class PublicBookingsController {
  constructor(
    private readonly createGuestBookingHandler: CreateGuestBookingHandler,
    private readonly listGroupSessions: ListPublicGroupSessionsHandler,
    private readonly getGroupSession: GetPublicGroupSessionHandler,
    private readonly bookGroupSession: BookGroupSessionHandler,
    private readonly getBookingStatus: GetBookingStatusHandler,
  ) {}

  @Public()
  @Get('group-sessions')
  @ApiOperation({ summary: 'List public group session slots' })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiOkResponse({ schema: { type: 'array', items: { type: 'object' }, description: 'List of available group sessions' } })
  async listGroupSessionsEndpoint(@Query('branchId') branchId?: string) {
    return this.listGroupSessions.execute(branchId);
  }

  @Public()
  @Get('group-sessions/:id')
  @ApiOperation({ summary: 'Get a group session by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { type: 'object', description: 'Group session details' } })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getGroupSessionEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getGroupSession.execute(id);
  }

  @ApiBearerAuth()
  @UseGuards(ClientSessionGuard)
  @Post('group-sessions/:id/book')
  @ApiOperation({ summary: 'Book or join waitlist for a group session' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ schema: { type: 'object', properties: { type: { type: 'string', enum: ['BOOKED', 'WAITLISTED'] }, bookingId: { type: 'string', nullable: true }, waitlistPosition: { type: 'number', nullable: true } } } })
  @ApiResponse({ status: 409, description: 'Session full' })
  async bookGroupSessionEndpoint(
    @Param('id', ParseUUIDPipe) id: string,
    @ClientSession() client: { id: string },
  ) {
    return this.bookGroupSession.execute({
      groupSessionId: id,
      clientId: client.id,
    });
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get(':id/status')
  @ApiOperation({ summary: 'Get booking status (public, for payment confirmation pages)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: { type: 'object', properties: { bookingId: { type: 'string' }, status: { type: 'string' }, paymentStatus: { type: 'string' } } } })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingStatusEndpoint(@Param('id', ParseUUIDPipe) id: string) {
    return this.getBookingStatus.execute(id);
  }

  @Public()
  @UseGuards(OtpSessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 1 } })
  @Post()
  @ApiOperation({ summary: 'Create a guest booking (requires OTP session)' })
  async create(
    @Body() dto: CreateGuestBookingDto,
    @Req() req: Request,
  ) {
    const session = (req as Request & { otpSession: OtpSessionPayload }).otpSession;
    return this.createGuestBookingHandler.execute({
      ...dto,
      identifier: session.identifier,
      sessionJti: session.jti,
      sessionExp: session.exp ?? Math.floor(Date.now() / 1000) + 1800,
      sessionChannel: session.channel,
    });
  }
}
