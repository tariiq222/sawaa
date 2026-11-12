import { GetLateSessionContextHandler } from "../../modules/bookings/get-late-session-context/get-late-session-context.handler";
import { GetLateSessionContextResponseDto } from "../../modules/bookings/get-late-session-context/get-late-session-context.dto";
import { RecordLateSessionHandler } from '../../modules/bookings/record-late-session/record-late-session.handler';
import { RecordLateSessionDto } from '../../modules/bookings/record-late-session/record-late-session.dto';
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiCreatedResponse, ApiOkResponse } from '@nestjs/swagger';
import { JwtGuard } from '../../common/guards/jwt.guard';
import { CheckPermissions } from '../../common/guards/casl.guard';
import { CaslGuard } from '../../common/guards/casl.guard';
import { CurrentUser, type JwtUser } from '../../common/auth/current-user.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { AuditControllerName } from '../../common/interceptors/audit-controller-name.decorator';

@ApiTags('Dashboard / Bookings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('dashboard/bookings')
@AuditControllerName('DashboardBookingsController')
export class DashboardBookingsLateEntryController {
  constructor(
    private readonly recordLateSessionHandler: RecordLateSessionHandler,
    private readonly lateSessionContextHandler: GetLateSessionContextHandler,
  ) {}

  @Get('late-entry/context')
  @CheckPermissions({ action: 'create', subject: 'Booking' })
  @ApiOperation({ summary: 'Get permitted late session VAT and manual payment context' })
  @ApiOkResponse({ description: 'Current VAT rate and enabled manual payment methods only', type: GetLateSessionContextResponseDto })
  getLateSessionContext() {
    return this.lateSessionContextHandler.execute();
  }

  @Post('late-entry')
  @CheckPermissions({ action: 'create', subject: 'Booking' })
  @ApiOperation({ summary: 'Record a previous session and its actual financial facts' })
  @ApiCreatedResponse({ description: 'Session and financial facts recorded atomically', schema: { type:'object', properties: { booking:{type:'object',additionalProperties:true},invoice:{type:'object',nullable:true,additionalProperties:true},payment:{type:'object',nullable:true,additionalProperties:true},outstanding:{type:'integer'},isLateEntry:{type:'boolean',enum:[true]},lateEntryRecordedAt:{type:'string',format:'date-time'},lateEntryRecordedBy:{type:'string'} } } })
  recordLateSession(@CurrentUser() user: JwtUser, @Body() body: RecordLateSessionDto) {
    return this.recordLateSessionHandler.execute(body, user);
  }
}
