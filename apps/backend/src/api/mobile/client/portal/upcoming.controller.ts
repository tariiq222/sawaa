import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';
import { ClientSessionGuard } from '../../../../common/guards/client-session.guard';
import { ClientSession } from '../../../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../../../common/swagger';
import { Public } from '../../../../common/guards/jwt.guard';
import { ListClientUpcomingBookingsHandler } from '../../../../modules/bookings/client/list-client-upcoming-bookings.handler';

export class UpcomingQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

@ApiTags('Mobile Client / Portal')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Public()
@Controller('mobile/client/portal/upcoming')
export class MobileClientUpcomingController {
  constructor(private readonly upcomingHandler: ListClientUpcomingBookingsHandler) {}

  @Get()
  @ApiOperation({ summary: 'List upcoming bookings for the authenticated client' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)', example: 10 })
  @ApiOkResponse({
    description: 'Paginated list of upcoming bookings with status pending, confirmed or deposit_paid, sorted by nearest future appointment.',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, scheduledAt: { type: 'string', format: 'date-time' }, status: { type: 'string' }, employeeId: { type: 'string', format: 'uuid', nullable: true } } } },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  upcoming(
    @ClientSession() user: ClientSession,
    @Query() q: UpcomingQuery,
  ) {
    return this.upcomingHandler.execute({ clientId: user.id, page: q.page, limit: q.limit });
  }
}
