import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { IsDateString, IsOptional } from 'class-validator';
import {
  ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiOkResponse,
} from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ApiStandardResponses } from '../../../common/swagger';
import { JwtGuard } from '../../../common/guards/jwt.guard';
import { CaslGuard, CheckPermissions } from '../../../common/guards/casl.guard';
import { CurrentUser, JwtUser } from '../../../common/auth/current-user.decorator';
import { PrismaService } from '../../../infrastructure/database';
import { resolveEmployeeId } from './resolve-employee-id.helper';
import { computeCommission } from '../../../modules/finance/commission.helper';

export class EarningsQuery {
  @ApiPropertyOptional({ description: 'Start of earnings period (ISO 8601); defaults to first day of current month', example: '2026-04-01' })
  @IsOptional() @IsDateString() from?: string;

  @ApiPropertyOptional({ description: 'End of earnings period (ISO 8601); defaults to last day of current month', example: '2026-04-30' })
  @IsOptional() @IsDateString() to?: string;
}

@ApiTags('Mobile Employee / Earnings')
@ApiBearerAuth()
@ApiStandardResponses()
@UseGuards(JwtGuard, CaslGuard)
@Controller('mobile/employee/earnings')
export class MobileEmployeeEarningsController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'Get earnings summary for the authenticated employee within a date range' })
  @ApiOkResponse({
    description: 'Earnings totals (employee commission share) and breakdown by payment method for the requested period',
    schema: {
      type: 'object',
      properties: {
        period: {
          type: 'object',
          properties: {
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time' },
          },
        },
        totalEarningsHalalas: {
          type: 'number',
          description: 'Employee commission share in halalas (subtotal × effective commission rate)',
          example: 31500,
        },
        totalRevenueHalalas: {
          type: 'number',
          description: 'Sum of invoice subtotals (pre-VAT) in halalas — gross context figure',
          example: 45000,
        },
        invoiceCount: { type: 'number', example: 12 },
        byMethod: {
          type: 'object',
          description: 'Employee commission share by payment method in halalas — proportionally split from employee total earnings',
          additionalProperties: { type: 'number' },
          example: { ONLINE_CARD: 21000, CASH: 10500 },
        },
      },
    },
  })
  @ApiQuery({ name: 'from', required: false, description: 'Start of earnings period (ISO 8601)', example: '2026-04-01' })
  @ApiQuery({ name: 'to', required: false, description: 'End of earnings period (ISO 8601)', example: '2026-04-30' })
  @Get()
  @CheckPermissions({ action: 'read', subject: 'Employee' })
  async earnings(
    @CurrentUser() user: JwtUser,
    @Query() q: EarningsQuery,
  ) {
    const now = new Date();
    const from = q.from
      ? new Date(q.from)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = q.to
      ? new Date(q.to)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const employeeId = await resolveEmployeeId(this.prisma, user);

    // Fetch employee's default commission rate.
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId },
      select: { commissionRate: true },
    });

    // Default to 1.0 (100%) if the employee row is not found — safe fallback.
    const defaultEmployeeRate = employee?.commissionRate ?? new Prisma.Decimal('1.0');

    // Fetch paid invoices for this employee, including the linked booking's
    // serviceId so we can resolve per-service commission overrides.
    const invoices = await this.prisma.invoice.findMany({
      where: {
        employeeId,
        status: InvoiceStatus.PAID,
        paidAt: { gte: from, lte: to },
      },
      select: {
        subtotal: true,
        total: true,
        bookingId: true,
        payments: { select: { amount: true, method: true } },
      },
    });

    // Collect unique serviceIds from the linked bookings so we can batch-fetch
    // commissionRateOverride values.
    const bookingIds = invoices
      .map((inv) => inv.bookingId)
      .filter((id): id is string => id != null);

    const bookings = bookingIds.length > 0
      ? await this.prisma.booking.findMany({
          where: { id: { in: bookingIds } },
          select: { id: true, serviceId: true },
        })
      : [];

    const bookingServiceMap = new Map(bookings.map((b) => [b.id, b.serviceId]));

    const serviceIds = [...new Set(bookings.map((b) => b.serviceId))];
    const services = serviceIds.length > 0
      ? await this.prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, commissionRateOverride: true },
        })
      : [];

    const serviceOverrideMap = new Map(
      services.map((s) => [s.id, s.commissionRateOverride]),
    );

    // Aggregate employee earnings using commission logic.
    let totalEarningsHalalas = 0;
    let totalRevenueHalalas = 0;
    const byMethod: Record<string, number> = {};

    for (const inv of invoices) {
      const serviceId = inv.bookingId ? bookingServiceMap.get(inv.bookingId) : undefined;
      const serviceOverride = serviceId ? serviceOverrideMap.get(serviceId) : undefined;

      const { employeeShareHalalas } = computeCommission({
        subtotalHalalas: inv.subtotal,
        employeeRate: defaultEmployeeRate,
        serviceOverride: serviceOverride ?? null,
      });

      totalEarningsHalalas += employeeShareHalalas;
      totalRevenueHalalas += new Prisma.Decimal(inv.subtotal).toNumber();

      // byMethod reflects the employee's proportional share of each payment method.
      // Formula: employeeShareForPayment = employeeShareHalalas * (payment.amount / invoice.total)
      // This distributes the commission proportionally across payment methods used for
      // the invoice, so the byMethod totals sum to totalEarningsHalalas.
      const invTotal = new Prisma.Decimal(inv.total).toNumber();
      if (invTotal > 0) {
        for (const p of inv.payments) {
          const paymentAmount = new Prisma.Decimal(p.amount).toNumber();
          const proportion = paymentAmount / invTotal;
          const methodShare = Math.round(employeeShareHalalas * proportion);
          byMethod[p.method] = (byMethod[p.method] ?? 0) + methodShare;
        }
      }
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totalEarningsHalalas,
      totalRevenueHalalas,
      invoiceCount: invoices.length,
      byMethod,
    };
  }
}
