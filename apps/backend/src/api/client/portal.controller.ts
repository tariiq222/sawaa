import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ClientRoute } from '../../common/auth/client-route.decorator';
import { ClientSession } from '../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../common/swagger';
import { ListClientUpcomingBookingsHandler } from '../../modules/bookings/client/list-client-upcoming-bookings.handler';
import { GetClientPortalSummaryHandler } from '../../modules/bookings/client/get-client-portal-summary.handler';
import { ListNotificationsHandler } from '../../modules/comms/notifications/list-notifications.handler';
import { ListPaymentsHandler } from '../../modules/finance/list-payments/list-payments.handler';
import { GetMeHandler } from '../../modules/identity/client-auth/get-me.handler';
import { CLIENT_PAGE_SCHEMA, toClientPage } from './client-page';
import { projectClientPayment } from './client-payment.projection';

/** List handlers answer `{ items, meta }`; the home payload exposes plain arrays. */
function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const page = result as { items?: unknown[]; data?: unknown[] } | null;
  return page?.items ?? page?.data ?? [];
}

export class ClientUpcomingQuery {
  @ApiPropertyOptional({ description: 'Page number (1-based)', example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;

  @ApiPropertyOptional({ description: 'Number of results per page', example: 10 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

@ApiTags('Client / Portal')
@ApiStandardResponses()
@ClientRoute()
@Controller('client/portal')
export class ClientPortalController {
  constructor(
    private readonly upcomingHandler: ListClientUpcomingBookingsHandler,
    private readonly summaryHandler: GetClientPortalSummaryHandler,
    private readonly listNotifications: ListNotificationsHandler,
    private readonly listPayments: ListPaymentsHandler,
    private readonly getMe: GetMeHandler,
  ) {}

  @Get('home')
  @ApiOperation({ summary: 'Get home screen aggregated data for the authenticated client' })
  @ApiOkResponse({
    description: 'Client profile, upcoming bookings, unread notifications, and recent payments.',
    schema: {
      type: 'object',
      properties: {
        profile: { type: 'object', description: 'Client profile' },
        upcomingBookings: { type: 'array', items: { type: 'object' } },
        unreadNotifications: { type: 'array', items: { type: 'object' } },
        recentPayments: { type: 'array', items: { type: 'object' } },
      },
    },
  })
  async home(@ClientSession() session: ClientSession) {
    const now = new Date();
    const [upcomingResult, notificationsResult, paymentsResult, profile] = await Promise.all([
      this.upcomingHandler.execute({ clientId: session.id, now, page: 1, limit: 5 }),
      this.listNotifications.execute({ recipientId: session.id, unreadOnly: true, page: 1, limit: 5 }),
      this.listPayments.execute({ clientId: session.id, page: 1, limit: 3 }),
      this.getMe.execute(session.id),
    ]);
    return {
      profile,
      upcomingBookings: rowsOf(upcomingResult),
      unreadNotifications: rowsOf(notificationsResult),
      recentPayments: (paymentsResult.items ?? []).map(projectClientPayment),
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get account summary statistics for the authenticated client' })
  @ApiOkResponse({
    description: 'Total bookings count, last visit date, and outstanding balance.',
    schema: {
      type: 'object',
      properties: {
        totalBookings: { type: 'integer', minimum: 0, example: 8 },
        lastVisit: { type: 'string', format: 'date-time', nullable: true },
        outstandingBalance: { type: 'integer', minimum: 0, example: 25000, description: 'Outstanding balance across all client invoices, in halalas' },
      },
    },
  })
  summary(@ClientSession() session: ClientSession) {
    return this.summaryHandler.execute(session.id);
  }

  @Get('upcoming')
  @ApiOperation({ summary: 'List upcoming bookings for the authenticated client' })
  @ApiOkResponse({
    description: 'Paginated list of upcoming bookings (PENDING, CONFIRMED or DEPOSIT_PAID), nearest first.',
    schema: CLIENT_PAGE_SCHEMA,
  })
  async upcoming(@ClientSession() session: ClientSession, @Query() q: ClientUpcomingQuery) {
    const result = await this.upcomingHandler.execute({ clientId: session.id, page: q.page, limit: q.pageSize });
    return toClientPage(result.data, result.meta.total, result.meta.page, result.meta.limit);
  }
}
