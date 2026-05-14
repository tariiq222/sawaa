import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ClientSessionGuard } from '../../../../common/guards/client-session.guard';
import { ClientSession } from '../../../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../../../common/swagger';
import { ListBookingsHandler } from '../../../../modules/bookings/list-bookings/list-bookings.handler';
import { ListNotificationsHandler } from '../../../../modules/comms/notifications/list-notifications.handler';
import { ListPaymentsHandler } from '../../../../modules/finance/list-payments/list-payments.handler';
import { GetClientHandler } from '../../../../modules/people/clients/get-client.handler';
import { TenantContextService } from '../../../../common/tenant';
import { DEFAULT_ORGANIZATION_ID } from "../../../../common/tenant/tenant.constants";

@ApiTags('Mobile Client / Portal')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Controller('mobile/client/portal')
export class MobileClientHomeController {
  constructor(
    private readonly listBookings: ListBookingsHandler,
    private readonly listNotifications: ListNotificationsHandler,
    private readonly listPayments: ListPaymentsHandler,
    private readonly getClient: GetClientHandler,
    private readonly tenant: TenantContextService,
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
      this.listBookings.execute({ clientId: user.id, fromDate: now, page: 1, limit: 5 }),
      this.listNotifications.execute({ organizationId: DEFAULT_ORGANIZATION_ID, recipientId: user.id, unreadOnly: true, page: 1, limit: 5 }),
      this.listPayments.execute({ clientId: user.id, page: 1, limit: 3 }),
      this.getClient.execute({ clientId: user.id }),
    ]);

    return {
      profile,
      upcomingBookings: (upcomingResult as { data?: unknown[] }).data ?? upcomingResult,
      unreadNotifications: (notificationsResult as { data?: unknown[] }).data ?? notificationsResult,
      recentPayments: (paymentsResult as { data?: unknown[] }).data ?? paymentsResult,
    };
  }
}
