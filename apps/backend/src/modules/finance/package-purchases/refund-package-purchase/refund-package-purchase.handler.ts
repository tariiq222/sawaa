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
 * Credit voiding: `usedQuantity = totalQuantity` for every credit of the
 * purchase → remaining = 0. This is belt-and-suspenders with the explicit
 * REFUNDED-purchase guard in BookFromCreditHandler (which rejects any booking
 * whose parent purchase is not ACTIVE): even a credit row read before the
 * refund cannot be consumed afterwards.
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
    // 1. Load + validate the purchase (outside the tx — cheap pre-checks).
    const purchase = await this.prisma.packagePurchase.findFirst({
      where: { id: cmd.purchaseId },
      select: { id: true, status: true, amountPaid: true, clientId: true, notes: true },
    });
    if (!purchase) {
      throw new NotFoundException('Package purchase not found');
    }
    if (purchase.status === PackagePurchaseStatus.REFUNDED) {
      throw new BadRequestException('Package purchase is already refunded');
    }

    const amountPaid = decimalToHalalas(purchase.amountPaid);
    const refundAmount = Math.round(cmd.refundAmount);
    if (refundAmount < 0 || refundAmount > amountPaid) {
      throw new BadRequestException(
        `Refund amount ${refundAmount} must be between 0 and the amount paid (${amountPaid} halalas)`,
      );
    }

    // 2. One transaction: REFUNDED + void credits + record the financial refund.
    const result = await this.rlsTransaction.withTransaction(async (tx) => {
      const refundedAt = new Date();
      const noteSuffix = cmd.notes ? `Refund: ${cmd.notes}` : 'Refund (manual)';
      const mergedNotes = purchase.notes ? `${purchase.notes}\n${noteSuffix}` : noteSuffix;

      // 2a. Mark the purchase REFUNDED.
      await tx.packagePurchase.update({
        where: { id: cmd.purchaseId },
        data: {
          status: PackagePurchaseStatus.REFUNDED,
          refundedAt,
          refundAmount: new Prisma.Decimal(refundAmount),
          notes: mergedNotes,
        },
      });

      // 2b. VOID the credits — remaining → 0 for every credit of this purchase.
      // Single SQL statement (column-to-column assignment) so we never load rows.
      await tx.$executeRaw`
        UPDATE "PackageCredit"
        SET "usedQuantity" = "totalQuantity"
        WHERE "purchaseId" = ${cmd.purchaseId}
      `;

      // 2c. Record the financial refund against the purchase's invoice + its
      // payment, if any. A zero-amount refund (cancellation with no money back)
      // and a payment-less invoice (rare cash edge) skip the money ledger but
      // still leave the purchase REFUNDED + credits voided.
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

      return { refundedAt, recordedInvoiceId, recordedPaymentId, recordedCurrency };
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
      status: PackagePurchaseStatus.REFUNDED,
      refundAmount,
      refundedAt: result.refundedAt,
    };
  }
}
