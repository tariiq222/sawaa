import { Controller, Post, Get, Body, Query, UseGuards, Param, ParseUUIDPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiOkResponse, ApiCreatedResponse, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../common/guards/jwt.guard';
import { ApiPublicResponses } from '../../common/swagger';
import { CreatePublicBookingHandler } from '../../modules/bookings/public/create-public-booking.handler';
import { CreatePublicBookingDto } from '../../modules/bookings/public/create-public-booking.dto';
import { ClientSessionGuard } from '../../common/guards/client-session.guard';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { GetBookingStatusHandler } from '../../modules/bookings/public/get-booking-status.handler';
import { ListPublicProgramsHandler } from '../../modules/bookings/public/list-public-programs.handler';
import { GetPublicProgramHandler } from '../../modules/bookings/public/get-public-program.handler';
import { EnrollInProgramHandler } from '../../modules/bookings/enroll-in-program/enroll-in-program.handler';

@ApiTags('Public / Bookings')
@ApiPublicResponses()
@Controller('public/bookings')
export class PublicBookingsController {
  constructor(
    private readonly createPublicBookingHandler: CreatePublicBookingHandler,
    private readonly getBookingStatus: GetBookingStatusHandler,
  ) {}

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
  @ApiBearerAuth()
  @UseGuards(ClientSessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post()
  @ApiOperation({ summary: 'Create a booking (requires a logged-in client session)' })
  @ApiCreatedResponse({
    description: 'Booking created',
    schema: {
      type: 'object',
      additionalProperties: true,
      properties: { invoiceId: { type: 'string', format: 'uuid', nullable: true } },
    },
  })
  async create(
    @Body() dto: CreatePublicBookingDto,
    @ClientSession() client: { id: string },
  ) {
    // SECURITY: clientId comes from the verified client session, never the body.
    // branchId is optional — CreatePublicBookingHandler resolves the main branch when omitted.
    return this.createPublicBookingHandler.execute({
      clientId: client.id,
      branchId: dto.branchId,
      employeeId: dto.employeeId,
      serviceId: dto.serviceId,
      scheduledAt: new Date(dto.startsAt),
      durationOptionId: dto.durationOptionId,
      bookingType: dto.bookingType,
      deliveryType: dto.deliveryType,
      couponCode: dto.couponCode,
      notes: dto.notes,
    });
  }
}

@ApiTags('Public / Bookings')
@ApiPublicResponses()
@Controller('public/programs')
export class PublicProgramsController {
  constructor(
    private readonly listPublicPrograms: ListPublicProgramsHandler,
    private readonly getPublicProgram: GetPublicProgramHandler,
    private readonly enrollInProgram: EnrollInProgramHandler,
  ) {}

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get()
  @ApiOperation({ summary: 'List public programs (isPublic=true, OPEN|MIN_REACHED, not FULL)' })
  @ApiOkResponse({ description: 'Array of programs with computed isFull badge' })
  async list(@Query('departmentId') departmentId?: string) {
    const programs = await this.listPublicPrograms.execute(departmentId);
    return { programs };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @Get(':id')
  @ApiOperation({ summary: 'Get a public program by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ description: 'Program detail' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.getPublicProgram.execute(id);
  }

  @Public()
  @ApiBearerAuth()
  @UseGuards(ClientSessionGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post(':id/enroll')
  @ApiOperation({ summary: 'Self-enroll into a public program' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({
    description: 'Enrollment created',
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['ENROLLED'] },
        bookingId: { type: 'string', format: 'uuid' },
        status: { type: 'string' },
        invoiceId: { type: 'string', format: 'uuid', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @ApiResponse({ status: 409, description: 'Program full or already enrolled' })
  async enroll(
    @Param('id', ParseUUIDPipe) id: string,
    @ClientSession() client: { id: string },
  ) {
    return this.enrollInProgram.execute({
      programId: id,
      clientId: client.id,
      public: true,
    });
  }
}

