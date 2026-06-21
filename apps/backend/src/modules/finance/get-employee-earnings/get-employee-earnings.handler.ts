import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database';
import { computeCommission } from '../commission.helper';

export interface GetEmployeeEarningsCommand {
  /** Resolved Employee.id (NOT User.id) — caller must translate the JWT first. */
  employeeId: string;
  /** Start of the earnings period (inclusive). */
  from: Date;
  /** End of the earnings period (inclusive). */
  to: Date;
}

export interface EmployeeEarnings {
  period: { from: string; to: string };
  totalEarningsHalalas: number;
  totalRevenueHalalas: number;
  invoiceCount: number;
  byMethod: Record<string, number>;
}

/**
 * Compute an employee's earnings summary for a date range.
 *
 * INFORMATIONAL ONLY: every figure here — the commission total and the
 * per-payment-method split — is a read-only display number for the
 * manager/owner. This handler does NOT move, distribute, or settle any money.
 * No real funds are split based on these values. Keep any future change a
 * display-only calculation.
 */
@Injectable()
export class GetEmployeeEarningsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: GetEmployeeEarningsCommand): Promise<EmployeeEarnings> {
    const { employeeId, from, to } = command;

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

    const serviceIds = [...new Set(bookings.map((b) => b.serviceId).filter((id): id is string => id !== null))];
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
