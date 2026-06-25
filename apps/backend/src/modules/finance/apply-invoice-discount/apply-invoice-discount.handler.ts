import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { MoyasarApiClient } from '../moyasar-api/moyasar-api.client';
import { DEFAULT_ORG_ID } from '../../../common/constants';
import { computeVat, toHalalas } from '../money.helper';
import { ApplyInvoiceDiscountDto } from './apply-invoice-discount.dto';

export type ApplyInvoiceDiscountCommand = ApplyInvoiceDiscountDto & {
  invoiceId: string;
  appliedBy: string;
};

// Moyasar payment states in which the customer's money has actually moved (or
// been authorized to move). A discount must never change an invoice whose card
// payment reached one of these — the gateway would settle at the pre-discount
// amount = silent overcharge.
const MOYASAR_SETTLED_STATES = ['paid', 'captured', 'authorized'] as const;

@Injectable()
export class ApplyInvoiceDiscountHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
    private readonly moyasar: MoyasarApiClient,
  ) {}

  async execute(cmd: ApplyInvoiceDiscountCommand) {
    if (cmd.discountAmt > 0 && !cmd.discountReasonId) {
      throw new BadRequestException('A discount reason is required when applying a discount');
    }

    return this.rlsTransaction.withTransaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: cmd.invoiceId } });
      if (!invoice) throw new NotFoundException(`Invoice ${cmd.invoiceId} not found`);

      // A discount changes subtotal/VAT/total, so it is only safe while the
      // invoice is still unpaid. Once any payment has landed the totals are
      // locked against the amount the client already paid.
      if (invoice.status !== InvoiceStatus.ISSUED && invoice.status !== InvoiceStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot change the discount of an invoice in status ${invoice.status}`,
        );
      }
      // Z3: a discount lowers subtotal/VAT/total, but the original `aggregate
      // COMPLETED` guard only saw settled money. An invoice with a PENDING card
      // payment stays ISSUED, so it slipped past both guards; the webhook later
      // settled PAID at the higher pre-discount amount (`hasExistingRow` skips
      // amount_mismatch) = silent overcharge. Block on the EXISTENCE of any
      // non-final payment, and reconcile in-flight card rows against Moyasar so
      // an abandoned attempt cannot lock the invoice against discounts forever.
      const inFlight = await tx.payment.findMany({
        where: {
          invoiceId: cmd.invoiceId,
          status: {
            in: [
              PaymentStatus.COMPLETED,
              PaymentStatus.PENDING_VERIFICATION,
              PaymentStatus.PENDING,
            ],
          },
        },
        select: { id: true, status: true, gatewayRef: true },
      });

      // Settled money (COMPLETED) or a bank transfer awaiting manual review
      // (PENDING_VERIFICATION) — both are committed against the current total.
      if (inFlight.some((p) => p.status === PaymentStatus.COMPLETED)) {
        throw new BadRequestException('Cannot change the discount after a payment has been recorded');
      }
      if (inFlight.some((p) => p.status === PaymentStatus.PENDING_VERIFICATION)) {
        throw new BadRequestException(
          'لا يمكن تعديل الخصم أثناء وجود تحويل بنكي قيد المراجعة',
        );
      }

      // PENDING card rows: ask Moyasar for the truth. A settled/authorized
      // session blocks the discount; an abandoned `initiated`/`failed`/`voided`
      // session is discarded here so a late webhook is rejected as an
      // amount_mismatch instead of settling an overcharge against the old total.
      for (const p of inFlight.filter((x) => x.status === PaymentStatus.PENDING)) {
        if (!p.gatewayRef) {
          // No gateway session yet (e.g. an unfinished manual entry) — block to
          // stay safe; we cannot prove the money has not moved.
          throw new BadRequestException('لا يمكن تعديل الخصم أثناء وجود دفعة قيد التنفيذ');
        }
        let gatewayStatus: string;
        try {
          const gw = await this.moyasar.getPaymentStatus(DEFAULT_ORG_ID, p.gatewayRef);
          gatewayStatus = gw.status;
        } catch {
          // Fail closed: if we cannot confirm the gateway state, do not risk an
          // overcharge — refuse the discount and let the operator retry.
          throw new BadRequestException(
            'تعذّر التحقق من حالة دفعة قيد التنفيذ، حاول مرة أخرى لاحقاً',
          );
        }
        if ((MOYASAR_SETTLED_STATES as readonly string[]).includes(gatewayStatus)) {
          throw new BadRequestException('Cannot change the discount after a payment has been recorded');
        }
        await tx.payment.delete({ where: { id: p.id } });
      }

      const subtotal = toHalalas(invoice.subtotal);
      const discountAmt = toHalalas(cmd.discountAmt);
      if (discountAmt.greaterThan(subtotal)) {
        throw new BadRequestException('Discount cannot exceed the invoice subtotal');
      }

      let reasonId: string | null = null;
      if (cmd.discountAmt > 0) {
        const reason = await tx.discountReason.findFirst({
          where: { id: cmd.discountReasonId, isActive: true },
          select: { id: true },
        });
        if (!reason) throw new BadRequestException('Discount reason not found or inactive');
        reasonId = reason.id;
      }

      const vatBase = subtotal.minus(discountAmt);
      const vatRate = new Prisma.Decimal(invoice.vatRate.toString());
      const { vatAmtHalalas, totalHalalas } = computeVat(vatBase, vatRate);

      return tx.invoice.update({
        where: { id: cmd.invoiceId },
        data: {
          discountAmt,
          vatAmt: vatAmtHalalas,
          total: totalHalalas,
          discountReasonId: reasonId,
          discountAppliedBy: cmd.discountAmt > 0 ? cmd.appliedBy : null,
          discountAppliedAt: cmd.discountAmt > 0 ? new Date() : null,
          ...(cmd.note !== undefined && { notes: cmd.note }),
        },
      });
    });
  }
}
