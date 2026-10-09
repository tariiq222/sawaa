import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ClientSessionGuard } from '../../../../common/guards/client-session.guard';
import { ClientSession } from '../../../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../../../common/swagger';
import { ListClientUpcomingBookingsHandler } from '../../../../modules/bookings/client/list-client-upcoming-bookings.handler';
import { ListNotificationsHandler } from '../../../../modules/comms/notifications/list-notifications.handler';
import { ListPaymentsHandler } from '../../../../modules/finance/list-payments/list-payments.handler';
import { GetClientHandler } from '../../../../modules/people/clients/get-client.handler';
import { Public } from '../../../../common/guards/jwt.guard';

/** List handlers answer `{ items, meta }`; the home payload exposes plain arrays. */
function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const page = result as { items?: unknown[]; data?: unknown[] } | null;
  return page?.items ?? page?.data ?? [];
}

@ApiTags('Mobile Client / Portal')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Public()
@Controller('mobile/client/portal')
export class MobileClientHomeController {
  constructor(
    private readonly upcomingHandler: ListClientUpcomingBookingsHandler,
    private readonly listNotifications: ListNotificationsHandler,
    private readonly listPayments: ListPaymentsHandler,
    private readonly getClient: GetClientHandler,
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
  async home(@ClientSession() user: ClientSession) {
    const now = new Date();
    const [upcomingResult, notificationsResult, paymentsResult, profile] = await Promise.all([
      this.upcomingHandler.execute({ clientId: user.id, now, page: 1, limit: 5 }),
      this.listNotifications.execute({ recipientId: user.id, unreadOnly: true, page: 1, limit: 5 }),
      this.listPayments.execute({ clientId: user.id, page: 1, limit: 3 }),
      this.getClient.execute({ clientId: user.id }),
    ]);

    return {
      profile,
      upcomingBookings: rowsOf(upcomingResult),
      unreadNotifications: rowsOf(notificationsResult),
      recentPayments: rowsOf(paymentsResult),
    };
  }
}
