import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ClientSessionGuard } from '../../../../common/guards/client-session.guard';
import { ClientSession } from '../../../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../../../common/swagger';
import { Public } from '../../../../common/guards/jwt.guard';
import { GetClientPortalSummaryHandler } from '../../../../modules/bookings/client/get-client-portal-summary.handler';

@ApiTags('Mobile Client / Portal')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Public()
@Controller('mobile/client/portal/summary')
export class MobileClientSummaryController {
  constructor(private readonly summaryHandler: GetClientPortalSummaryHandler) {}

  @Get()
  @ApiOperation({ summary: 'Get account summary statistics for the authenticated client' })
  @ApiOkResponse({
    description: 'Total bookings count, last visit date, and outstanding balance.',
    schema: {
      type: 'object',
      properties: {
        totalBookings: { type: 'integer', minimum: 0, example: 8 },
        lastVisit: { type: 'string', format: 'date-time', nullable: true },
        outstandingBalance: {
          type: 'integer',
          minimum: 0,
          example: 25000,
          description: 'Outstanding balance across all client invoices, in halalas',
        },
      },
    },
  })
  summary(@ClientSession() user: ClientSession) {
    return this.summaryHandler.execute(user.id);
  }
}
