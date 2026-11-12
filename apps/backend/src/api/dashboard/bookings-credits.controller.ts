import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CheckPermissions } from '../../common/guards/casl.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { UserId } from '../../common/auth/user-id.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ApiErrorDto } from '../../common/swagger';
import { BookFromCreditHandler } from '../../modules/bookings/book-from-credit/book-from-credit.handler';
import { BookFromCreditDto } from '../../modules/bookings/book-from-credit/book-from-credit.dto';
import { GetMatchingCreditsHandler } from '../../modules/bookings/get-matching-credits/get-matching-credits.handler';
import { GetMatchingCreditsDto } from '../../modules/bookings/get-matching-credits/get-matching-credits.dto';
import { TransferCreditHandler } from '../../modules/bookings/transfer-credit/transfer-credit.handler';
import { TransferCreditDto } from '../../modules/bookings/transfer-credit/transfer-credit.dto';
import { ApiQuery } from '@nestjs/swagger';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

import { BookingRecordDto } from './dto/booking-record-response.dto';
import { MatchingCreditDto, PackageCreditRecordDto } from './dto/booking-support-response.dto';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/bookings')
@AuditControllerName('DashboardBookingsController')
export class DashboardBookingsCreditsController {
  constructor(
    private readonly bookFromCreditHandler: BookFromCreditHandler,
    private readonly matchingCreditsHandler: GetMatchingCreditsHandler,
    private readonly transferCreditHandler: TransferCreditHandler,
  ) {}

  @Post('from-credit')
  @CheckPermissions({ action: 'create', subject: 'Booking' })
  @ApiOperation({ summary: 'Book an appointment by consuming session-package credit' })
  @ApiCreatedResponse({ description: 'Zero-value booking created from a package credit', type: BookingRecordDto })
  @ApiResponse({ status: 400, description: 'Slot unavailable, missing credit selector, or past date', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'No usable package credit found', type: ApiErrorDto })
  @ApiResponse({ status: 409, description: 'No remaining credit or slot conflict (concurrent over-draw rejected)', type: ApiErrorDto })
  bookFromCredit(@UserId() userId: string, @Body() body: BookFromCreditDto): Promise<BookingRecordDto> {
    const { scheduledAt, ...rest } = body;
    return this.bookFromCreditHandler.execute({
      ...rest,
      scheduledAt: new Date(scheduledAt),
      userId,
    });
  }

  @Get('matching-credits')
  @CheckPermissions({ action: 'read', subject: 'Booking' })
  @ApiOperation({ summary: 'List a client\'s usable session-package credits matching a service/employee/duration' })
  @ApiQuery({ name: 'clientId', description: 'Client ID', example: '00000000-0000-4000-a000-000000000001' })
  @ApiQuery({ name: 'serviceId', description: 'Service ID', example: '00000000-0000-4000-a000-000000000004' })
  @ApiQuery({ name: 'employeeId', description: 'Employee ID', example: '00000000-0000-4000-a000-000000000003' })
  @ApiQuery({ name: 'durationOptionId', description: 'Duration option ID', example: '00000000-0000-4000-a000-000000000005' })
  @ApiOkResponse({ description: 'Matching ACTIVE credits with remaining capacity (FIFO order)', type: MatchingCreditDto, isArray: true })
  getMatchingCredits(@Query() q: GetMatchingCreditsDto): Promise<MatchingCreditDto[]> {
    return this.matchingCreditsHandler.execute(q);
  }

  @Post('credits/:creditId/transfer')
  // Credit management is part of booking management — same subject as creating
  // a booking from a credit, but transfer is a stronger mutation so it requires
  // `manage:Booking` (OWNER/ADMIN/MANAGER), not plain `create`.
  @CheckPermissions({ action: 'manage', subject: 'Booking' })
  @ApiOperation({ summary: 'Transfer a session-package credit to another practitioner' })
  @ApiParam({ name: 'creditId', description: 'Package credit ID', example: '00000000-0000-4000-a000-000000000006' })
  @ApiOkResponse({ description: 'Credit re-pointed to the target employee (price snapshot unchanged)', type: PackageCreditRecordDto })
  @ApiResponse({ status: 400, description: 'Target employee does not provide the service/duration, is inactive, or is the current owner', type: ApiErrorDto })
  @ApiResponse({ status: 404, description: 'Credit or target employee not found', type: ApiErrorDto })
  transferCredit(
    @UserId() userId: string,
    @Param('creditId', ParseUUIDPipe) creditId: string,
    @Body() body: TransferCreditDto,
  ): Promise<PackageCreditRecordDto> {
    return this.transferCreditHandler.execute({
      creditId,
      toEmployeeId: body.toEmployeeId,
      reason: body.reason,
      targetDurationOptionId: body.targetDurationOptionId,
      userId,
    });
  }
}
