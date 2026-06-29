import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  InvoiceStatus,
  PackagePurchaseStatus,
  PaymentStatus,
  Prisma,
  RefundStatus,
} from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../../infrastructure/database';
import { EventBusService } from '../../../../infrastructure/events';
import { RefundCompletedEvent } from '../../events/refund-completed.event';
import { computeRefundAccounting } from '../../refund-payment/refund-vat.helper';
import { decimalToHalalas } from '../../money.helper';
import { DEFAULT_ORG_ID } from '../../../../common/constants';
import { RefundPackagePurchaseDto } from './refund-package-purchase.dto';

export type RefundPackagePurchaseCommand = RefundPackagePurchaseDto & {
  purchaseId: string;
  /** Acting user id (set by the controller). */
  userId?: string;
};

/**
 * Manual refund of a session-package purchase — finance-sensitive.
 *
 * Design notes (what this does vs. the gateway refund path):
 *  - The package can be sold either at the desk (manual CASH/MADA/BANK_TRANSFER
 *    payment, which has NO Moyasar gatewayRef) or online (ONLINE_CARD via the
 *    Moyasar webhook). The existing RefundPaymentHandler.execute() ONLY handles
 *    gateway payments (it calls Moyasar and rejects payments without a
 *    gatewayRef). A manual package refund must work for BOTH, and the money is
 *    returned out-of-band by the manager (cash back / bank transfer). So this
 *    handler does NOT call Moyasar; it RECORDS the refund using the existing
 *    RefundRequest table + RefundCompletedEvent (the established finance refund
 *    mechanism) without reinventing it, and marks the invoice/payment refunded.
 *  - The package-specific part is: mark PackagePurchase REFUNDED + VOID its
 *    credits so they can no longer be consumed.
 *
 * Everything runs in ONE transaction so a partial failure cannot leave a
 * refunded purchase with still-bookable credits (or vice-versa). The
 * RefundCompletedEvent is published only after the transaction commits.
 *
 * Concurrency (P1): the purchase row is locked with SELECT ... FOR UPDATE at
 * the top of the transaction and the terminal-state guard runs INSIDE the lock
 * (matching the gateway refund path in RefundPaymentHandler). Two concurrent
 * refund requests therefore serialise: the first wins, the second sees the row
 * already REFUNDED (or the outstanding balance exhausted) and is rejected — no
 * double refund. The refund is also clamped to the purchase's outstanding
 * (un-refunded) balance so a caller can never over-refund.
 *
 * Partial vs. full refund (P1):
 *  - A FULL refund (the new cumulative refunded amount reaches amountPaid)
 *    marks the purchase REFUNDED and VOIDS its remaining credits
 *    (`usedQuantity = totalQuantity` → remaining 0). This is belt-and-suspenders
 *    with the explicit REFUNDED-purchase guard in BookFromCreditHandler.
 *  - A PARTIAL refund (refundAmount < outstanding) returns only part of the
 *    money and KEEPS the purchase ACTIVE with its credits untouched. We never
 *    void credits on a partial refund: doing so would silently destroy the
 *    still-paid sessions the client kept. The money ledger records the partial
 *    refund; the credits remain bookable until a full refund (or full
 *    consumption) ends the purchase.
 */
@Injectable()
export class RefundPackagePurchaseHandler {
  private readonly logger = new Logger(RefundPackagePurchaseHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly eventBus: EventBusService,
  ) {}

  async execute(cmd: RefundPackagePurchaseCommand) {
    // Up-front amount sanity check (the real clamp happens under the lock).
    const refundAmount = Math.round(cmd.refundAmount);
    if (refundAmount < 0) {
      throw new BadRequestException(
        `Refund amount ${refundAmount} must be zero or positive`,
      );
    }

    // One transaction: lock the purchase, validate under the lock, mark
    // REFUNDED (full) / keep ACTIVE (partial), void credits on a full refund,
    // and record the financial refund.
    const result = await this.rlsTransaction.withTransaction(async (tx) => {
      // P1 (concurrency): lock the purchase row for the duration of the tx so
      // two concurrent refunds serialise. SELECT ... FOR UPDATE — same pattern
      // as the gateway refund path.
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          status: PackagePurchaseStatus;
          amountPaid: Prisma.Decimal;
          refundAmount: Prisma.Decimal | null;
          clientId: string;
          notes: string | null;
        }>
      >`SELECT id, status, "amountPaid", "refundAmount", "clientId", notes
          FROM "PackagePurchase"
          WHERE id = ${cmd.purchaseId}
          FOR UPDATE`;

      const purchase = rows[0];
      if (!purchase) {
        throw new NotFoundException('Package purchase not found');
      }
      if (purchase.status === PackagePurchaseStatus.REFUNDED) {
        throw new BadRequestException('Package purchase is already refunded');
      }

      const amountPaid = decimalToHalalas(purchase.amountPaid);
      const alreadyRefunded = decimalToHalalas(purchase.refundAmount ?? 0);
      // P1 (money-safety): clamp the refund to the outstanding (un-refunded)
      // balance, read under the same FOR UPDATE lock. A caller can never
      // over-refund — refund more than was paid, or stack partials past it.
      const outstanding = amountPaid - alreadyRefunded;
      if (refundAmount > outstanding) {
        throw new BadRequestException(
          `Refund amount ${refundAmount} exceeds the outstanding balance of ${outstanding} halalas`,
        );
      }

      // Full vs. partial (P1-2):
      //  - FULL: the new cumulative refunded amount reaches amountPaid
      //    (outstanding becomes 0), OR an explicit zero-money cancellation
      //    (refundAmount 0) which terminates the purchase without returning
      //    money. A full refund ends the purchase + voids remaining credits.
      //  - PARTIAL: a strictly-positive refund below the outstanding balance.
      //    Keeps the purchase ACTIVE with credits intact so the still-paid
      //    sessions survive — voiding them here was the bug.
      const newCumulativeRefund = alreadyRefunded + refundAmount;
      const isFullRefund = refundAmount === 0 || newCumulativeRefund >= amountPaid;

      const refundedAt = new Date();
      const noteSuffix = cmd.notes ? `Refund: ${cmd.notes}` : 'Refund (manual)';
      const mergedNotes = purchase.notes ? `${purchase.notes}\n${noteSuffix}` : noteSuffix;

      // P1 (concurrency): updateMany with a status != REFUNDED guard. If a
      // concurrent transaction already flipped the row to REFUNDED, count is 0
      // and we bail — a second guard layer on top of the row lock.
      const { count } = await tx.packagePurchase.updateMany({
        where: { id: cmd.purchaseId, status: { not: PackagePurchaseStatus.REFUNDED } },
        data: {
          status: isFullRefund ? PackagePurchaseStatus.REFUNDED : purchase.status,
          refundedAt: isFullRefund ? refundedAt : undefined,
          refundAmount: new Prisma.Decimal(newCumulativeRefund),
          notes: mergedNotes,
        },
      });
      if (count === 0) {
        throw new BadRequestException('Package purchase is already refunded');
      }

      // VOID the credits ONLY on a full refund — remaining → 0 for every
      // credit of this purchase. A partial refund leaves credits untouched so
      // the client's remaining paid sessions stay bookable (P1-2).
      if (isFullRefund) {
        await tx.$executeRaw`
          UPDATE "PackageCredit"
          SET "usedQuantity" = "totalQuantity"
          WHERE "purchaseId" = ${cmd.purchaseId}
        `;
      }

      // Record the financial refund against the purchase's invoice + its
      // payment, if any. A zero-amount refund (cancellation with no money back)
      // and a payment-less invoice (rare cash edge) skip the money ledger but
      // still update the purchase status (REFUNDED on full / unchanged on
      // partial) and, on a full refund, void the credits.
      let recordedInvoiceId: string | null = null;
      let recordedPaymentId: string | null = null;
      let recordedCurrency = 'SAR';

      if (refundAmount > 0) {
        const invoice = await tx.invoice.findFirst({
          where: { packagePurchaseId: cmd.purchaseId },
          select: {
            id: true,
            total: true,
            vatAmt: true,
            refundedAmount: true,
            currency: true,
            clientId: true,
            payments: {
              where: { status: { in: [PaymentStatus.COMPLETED, PaymentStatus.PARTIALLY_REFUNDED] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, refundedAmount: true },
            },
          },
        });

        if (invoice) {
          recordedInvoiceId = invoice.id;
          recordedCurrency = invoice.currency;
          const payment = invoice.payments[0];

          if (payment) {
            recordedPaymentId = payment.id;

            const accounting = computeRefundAccounting({
              invoiceTotal: invoice.total,
              invoiceVatAmt: invoice.vatAmt,
              alreadyRefundedAmount: invoice.refundedAmount,
              thisRefundAmount: refundAmount,
            });

            // Persist a COMPLETED RefundRequest — the existing finance refund
            // record. gatewayRef stays null (no Moyasar call; manual refund).
            await tx.refundRequest.create({
              data: {
                id: randomUUID(),
                invoiceId: invoice.id,
                paymentId: payment.id,
                clientId: invoice.clientId,
                amount: new Prisma.Decimal(refundAmount),
                reason: cmd.notes ?? 'Manual package-purchase refund',
                status: RefundStatus.COMPLETED,
                processedAt: refundedAt,
                processedBy: cmd.userId ?? 'system',
              },
            });

            const paymentStatus =
              accounting.newInvoiceStatus === 'REFUNDED'
                ? PaymentStatus.REFUNDED
                : PaymentStatus.PARTIALLY_REFUNDED;
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: paymentStatus,
                refundedAmount: { increment: refundAmount },
                failureReason: `Manual package-purchase refund (${cmd.purchaseId})`,
              },
            });

            await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                status: accounting.newInvoiceStatus as InvoiceStatus,
                refundedAmount: accounting.newRefundedAmount,
                refundedVatAmt: accounting.newRefundedVatAmt,
              },
            });
          } else {
            this.logger.warn(
              `Package purchase ${cmd.purchaseId} refunded ${refundAmount} halalas with no recordable payment on invoice ${invoice.id} — marked REFUNDED on the purchase only`,
            );
          }
        } else {
          this.logger.warn(
            `Package purchase ${cmd.purchaseId} has no linked invoice — refund recorded on the purchase only`,
          );
        }
      }

      return {
        refundedAt,
        recordedInvoiceId,
        recordedPaymentId,
        recordedCurrency,
        isFullRefund,
        newCumulativeRefund,
        purchaseStatus: isFullRefund ? PackagePurchaseStatus.REFUNDED : purchase.status,
      };
    });

    // 3. Publish the refund-completed event after commit (package refund →
    // bookingId is null). Only meaningful when a real invoice refund was
    // recorded; skip the event for a zero/ledger-less refund.
    if (result.recordedInvoiceId && result.recordedPaymentId && refundAmount > 0) {
      const event = new RefundCompletedEvent({
        refundRequestId: cmd.purchaseId,
        organizationId: DEFAULT_ORG_ID,
        invoiceId: result.recordedInvoiceId,
        paymentId: result.recordedPaymentId,
        bookingId: null,
        amount: refundAmount,
        currency: result.recordedCurrency,
      });
      await this.eventBus
        .publish(event.eventName, event.toEnvelope())
        .catch((err) =>
          this.logger.error('Failed to publish RefundCompletedEvent for package refund', err),
        );
    }

    return {
      purchaseId: cmd.purchaseId,
      status: result.purchaseStatus,
      refundAmount,
      // Cumulative amount refunded against this purchase (this refund + prior).
      totalRefunded: result.newCumulativeRefund,
      isFullRefund: result.isFullRefund,
      refundedAt: result.isFullRefund ? result.refundedAt : null,
    };
  }
}
