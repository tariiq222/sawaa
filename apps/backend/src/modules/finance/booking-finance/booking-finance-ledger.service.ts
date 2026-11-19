import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { computeVat } from '../money.helper';
import { resolveVatRate } from '../create-invoice/create-invoice.handler';
import {
  BookingHasBlockingPaymentError,
  BookingInvoiceAlreadyExistsError,
  type BookingInvoiceInTxResult,
  type CreateBookingInvoiceInTxCommand,
} from './booking-finance-ledger.types';

/**
 * Payment states that must stop a booking delete. This is a finance policy, so
 * it lives here rather than in the bookings handler that used to own it.
 */
export const BLOCKING_PAYMENT_STATUSES = [
  PaymentStatus.COMPLETED,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
  PaymentStatus.PENDING_VERIFICATION,
] as const;

const LOCK_NOT_AVAILABLE = '55P03';

/**
 * The narrow booking↔finance seam (MNT-17).
 *
 * Every method takes the caller's `Prisma.TransactionClient`. The service never
 * opens a transaction, never uses `PrismaService`, and never reorders the
 * caller's locks: callers that already hold locks keep holding them across the
 * call, so the write order is unchanged.
 */
@Injectable()
export class BookingFinanceLedgerService {
  /** Creates the booking invoice inside the caller's transaction. */
  async createBookingInvoiceInTx(
    tx: Prisma.TransactionClient,
    cmd: CreateBookingInvoiceInTxCommand,
  ): Promise<BookingInvoiceInTxResult> {
    const invoice = await this.buildAndCreate(tx, cmd);
    return toResult(invoice);
  }

  /**
   * Creates the invoice only when the booking has none, mirroring the current
   * silent no-op in `complete-booking`.
   */
  async ensureBookingInvoiceInTx(
    tx: Prisma.TransactionClient,
    cmd: CreateBookingInvoiceInTxCommand,
  ): Promise<BookingInvoiceInTxResult | null> {
    const existing = await tx.invoice.findUnique({
      where: { bookingId: cmd.bookingId },
      select: { id: true },
    });
    if (existing) return null;
    const invoice = await this.buildAndCreate(tx, cmd);
    return toResult(invoice);
  }

  /** Increments a coupon's used count; P2025 surfaces exactly as it does today. */
  async consumeCouponUsageInTx(
    tx: Prisma.TransactionClient,
    command: { couponId: string },
  ): Promise<void> {
    await tx.coupon.update({
      where: { id: command.couponId },
      data: { usedCount: { increment: 1 } },
      select: { id: true },
    });
  }

  /** Decrements a coupon's used count, guarded by `usedCount > 0`. */
  async releaseCouponUsageInTx(
    tx: Prisma.TransactionClient,
    command: { code: string },
  ): Promise<{ released: boolean }> {
    const { count } = await tx.coupon.updateMany({
      where: { code: command.code, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
    return { released: count > 0 };
  }

  /**
   * Deletes the booking's invoice and its financial dependents, preserving the
   * exact lock order used by `delete-booking`:
   *
   *   Invoice (FOR UPDATE NOWAIT)
   *     → PaymentCollectionIdempotency
   *     → RefundRequest
   *     → Payment
   *     → blocking-payment check
   *     → delete refundRequest, paymentCollectionIdempotency, payment, invoice
   *
   * `55P03` (lock not available) is left to propagate; the caller maps it to
   * its existing `ConflictException`.
   */
  async deleteBookingInvoiceAndFinancialsInTx(
    tx: Prisma.TransactionClient,
    command: { bookingId: string },
  ): Promise<{ invoiceId: string | null }> {
    const invoiceRows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Invoice"
      WHERE "bookingId" = ${command.bookingId}
      FOR UPDATE NOWAIT
    `;
    const invoice = invoiceRows[0];
    if (!invoice) return { invoiceId: null };

    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "PaymentCollectionIdempotency"
      WHERE "invoiceId" = ${invoice.id}
      ORDER BY "id" FOR UPDATE NOWAIT
    `;
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "RefundRequest"
      WHERE "invoiceId" = ${invoice.id}
      ORDER BY "id" FOR UPDATE NOWAIT
    `;
    await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "Payment"
      WHERE "invoiceId" = ${invoice.id}
      ORDER BY "id" FOR UPDATE NOWAIT
    `;

    const blocking = await tx.payment.findFirst({
      where: {
        invoiceId: invoice.id,
        status: { in: [...BLOCKING_PAYMENT_STATUSES] },
      },
      select: { id: true },
    });
    if (blocking) throw new BookingHasBlockingPaymentError(command.bookingId);

    await tx.refundRequest.deleteMany({ where: { invoiceId: invoice.id } });
    await tx.paymentCollectionIdempotency.deleteMany({
      where: { invoiceId: invoice.id },
    });
    await tx.payment.deleteMany({ where: { invoiceId: invoice.id } });
    await tx.invoice.delete({ where: { id: invoice.id } });

    return { invoiceId: invoice.id };
  }

  private async buildAndCreate(
    tx: Prisma.TransactionClient,
    cmd: CreateBookingInvoiceInTxCommand,
  ): Promise<Prisma.InvoiceGetPayload<Record<string, never>>> {
    if (cmd.issueMode === 'ISSUED' && !cmd.issuedAt) {
      throw new Error('issuedAt is required when issueMode is ISSUED');
    }

    const subtotalDec = toDecimal(cmd.subtotal);
    const discountAmtDec = toDecimal(cmd.discountAmt ?? 0);
    const vatBaseDec = subtotalDec.minus(discountAmtDec);
    const vatRateDec =
      cmd.vatRate !== undefined
        ? toDecimal(cmd.vatRate)
        : await resolveVatRate(tx);
    const { vatAmtHalalas, totalHalalas } = computeVat(vatBaseDec, vatRateDec);

    const existing = await tx.invoice.findUnique({
      where: { bookingId: cmd.bookingId },
      select: { id: true },
    });
    if (existing) {
      throw new BookingInvoiceAlreadyExistsError(cmd.bookingId, existing.id);
    }

    return tx.invoice.create({
      data: {
        branchId: cmd.branchId,
        clientId: cmd.clientId,
        employeeId: cmd.employeeId,
        bookingId: cmd.bookingId,
        subtotal: subtotalDec,
        discountAmt: discountAmtDec,
        vatRate: vatRateDec,
        vatAmt: vatAmtHalalas,
        total: totalHalalas,
        ...(cmd.currency !== undefined ? { currency: cmd.currency } : {}),
        status: cmd.issueMode,
        ...(cmd.issueMode === 'ISSUED' ? { issuedAt: cmd.issuedAt } : {}),
      },
    });
  }
}

function toDecimal(value: number | Prisma.Decimal): Prisma.Decimal {
  return value instanceof Prisma.Decimal
    ? value
    : new Prisma.Decimal(value.toString());
}

function toResult(invoice: {
  id: string;
  subtotal: Prisma.Decimal;
  discountAmt: Prisma.Decimal;
  vatRate: Prisma.Decimal;
  vatAmt: Prisma.Decimal;
  total: Prisma.Decimal;
  status: string;
  issuedAt: Date | null;
}): BookingInvoiceInTxResult {
  return {
    id: invoice.id,
    subtotal: invoice.subtotal,
    discountAmt: invoice.discountAmt,
    vatRate: invoice.vatRate,
    vatAmt: invoice.vatAmt,
    total: invoice.total,
    status: invoice.status === 'ISSUED' ? 'ISSUED' : 'DRAFT',
    issuedAt: invoice.issuedAt,
  };
}

export { LOCK_NOT_AVAILABLE };
