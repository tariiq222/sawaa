import { Decimal } from '@prisma/client/runtime/client';
import { allocateVatPortion } from '../money.helper';

export interface ComputeRefundAccountingInput {
  invoiceTotal: Decimal | string | number;
  invoiceVatAmt: Decimal | string | number;
  alreadyRefundedAmount: Decimal | string | number;
  /** Amount being refunded in this operation (gross, VAT-inclusive, halalas) */
  thisRefundAmount: number;
  /**
   * Cumulative VAT already refunded on previous refund operations.
   * Required to implement the "remaining VAT" pattern and avoid drift on the
   * final refund operation.
   *
   * Pass the invoice's refundedVatAmt; it is 0 for the first refund.
   */
  alreadyRefundedVatAmt?: Decimal | string | number;
  /**
   * Set to true when this is the LAST refund operation (i.e. will fully
   * refund the invoice). When omitted it is derived from the amounts. When true, the VAT portion is computed as
   * (totalVat - alreadyRefundedVatAmt) rather than proportionally, which
   * guarantees that sum(vatPortions) === totalVat with zero drift.
   */
  isLastRefund?: boolean;
}

export interface ComputeRefundAccountingResult {
  refundedVatPortion: number;
  newRefundedAmount: number;
  newRefundedVatAmt: number;
  newInvoiceStatus: 'REFUNDED' | 'PARTIALLY_REFUNDED';
}

/**
 * Compute the VAT portion of a refund proportional to (refund / total),
 * the new cumulative refunded amount + VAT, and the new invoice status.
 *
 * VAT is allocated proportionally because refunds are against the gross
 * (VAT-inclusive) total — every riyal refunded carries (vatAmt/total) of VAT.
 *
 * Drift-free guarantee:
 *   For a FULL refund in one operation: exact (no rounding at all).
 *   For multiple partial refunds: use isLastRefund=true on the final operation
 *   to assign remaining VAT as (totalVat - alreadyRefundedVatAmt), preventing
 *   the accumulation of ±1 halala rounding errors across operations.
 *
 * Status flips to REFUNDED only when newRefundedAmount >= invoiceTotal
 * (within a 1 halala tolerance to absorb whole-halala arithmetic).
 */
export function computeRefundAccounting(
  input: ComputeRefundAccountingInput,
): ComputeRefundAccountingResult {
  const total = new Decimal(input.invoiceTotal);
  const vatAmt = new Decimal(input.invoiceVatAmt);
  const alreadyRefunded = new Decimal(input.alreadyRefundedAmount);
  const alreadyRefundedVat = new Decimal(input.alreadyRefundedVatAmt ?? 0);
  const thisRefund = new Decimal(input.thisRefundAmount);

  // Compute VAT portion for this refund using allocateVatPortion (pure Decimal).
  // On the last refund, use the remaining-VAT pattern to eliminate drift.
  // When the caller does not say, a refund that settles the invoice (within the
  // 1-halala tolerance) is the last one and takes the remaining VAT.
  const isLastRefund = input.isLastRefund
    ?? alreadyRefunded.plus(thisRefund).gte(total.minus(new Decimal('1')));

  let refundedVatPortion: Decimal;
  if (isLastRefund) {
    // Remaining pattern: this operation closes the invoice, so its share is
    // whatever brings the cumulative VAT to exactly the invoice VAT. It can
    // be negative when earlier proportional shares rounded up (e.g. refunds of
    // 4 + 4 on an 11500/1500 invoice each round to 1).
    refundedVatPortion = vatAmt.minus(alreadyRefundedVat);
  } else {
    refundedVatPortion = allocateVatPortion(thisRefund, total, vatAmt);
  }

  const newRefundedAmount = alreadyRefunded.plus(thisRefund);
  const newRefundedVatAmt = alreadyRefundedVat.plus(refundedVatPortion);

  // 1-halala tolerance (amounts are integers)
  const tolerance = new Decimal('1');
  const isFullyRefunded = newRefundedAmount.gte(total.minus(tolerance));

  return {
    refundedVatPortion: refundedVatPortion.toNumber(),
    newRefundedAmount: newRefundedAmount.toNumber(),
    newRefundedVatAmt: newRefundedVatAmt.toNumber(),
    newInvoiceStatus: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
  };
}
