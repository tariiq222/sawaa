import { Controller, Get, UseGuards } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { ClientSessionGuard } from '../../../../common/guards/client-session.guard';
import { ClientSession } from '../../../../common/auth/client-session.decorator';
import { ApiStandardResponses } from '../../../../common/swagger';
import { PrismaService } from '../../../../infrastructure/database';

@ApiTags('Mobile Client / Portal')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(ClientSessionGuard)
@Controller('mobile/client/portal/summary')
export class MobileClientSummaryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Get account summary statistics for the authenticated client' })
  @ApiOkResponse({
    description: 'Total bookings count, last visit date, and outstanding balance.',
    schema: {
      type: 'object',
      properties: {
        totalBookings: { type: 'number', example: 8 },
        lastVisit: { type: 'string', format: 'date-time', nullable: true },
        outstandingBalance: { type: 'number', example: 250 },
      },
    },
  })
  async summary(@ClientSession() user: ClientSession) {
    const [totalBookings, lastBooking, unpaidInvoices] = await Promise.all([
      this.prisma.booking.count({ where: { clientId: user.id } }),
      this.prisma.booking.findFirst({
        where: { clientId: user.id, status: BookingStatus.COMPLETED },
        orderBy: { scheduledAt: 'desc' },
        select: { scheduledAt: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          clientId: user.id,
          status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        },
        _sum: { total: true },
      }),
    ]);

    return {
      totalBookings,
      lastVisit: lastBooking?.scheduledAt ?? null,
      outstandingBalance: Number(unpaidInvoices._sum.total ?? 0),
    };
  }
}
