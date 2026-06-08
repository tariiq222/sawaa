import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService, RlsTransactionService } from '../../../infrastructure/database';
import { computeVat, toHalalas } from '../money.helper';
import { ApplyInvoiceDiscountDto } from './apply-invoice-discount.dto';

export type ApplyInvoiceDiscountCommand = ApplyInvoiceDiscountDto & {
  invoiceId: string;
  appliedBy: string;
};

@Injectable()
export class ApplyInvoiceDiscountHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rlsTransaction: RlsTransactionService,
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
      const paid = await tx.payment.aggregate({
        where: { invoiceId: cmd.invoiceId, status: 'COMPLETED' },
        _sum: { amount: true },
      });
      if (Number(paid._sum?.amount ?? 0) > 0) {
        throw new BadRequestException('Cannot change the discount after a payment has been recorded');
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
