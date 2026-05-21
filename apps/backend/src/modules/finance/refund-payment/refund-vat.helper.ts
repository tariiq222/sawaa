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
   * Pass 0 if this is the first refund against the invoice.
   */
  alreadyRefundedVatAmt?: Decimal | string | number;
  /**
   * Set to true when this is the LAST refund operation (i.e. will fully
   * refund the invoice). When true, the VAT portion is computed as
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
  let refundedVatPortion: Decimal;
  if (input.isLastRefund) {
    // Remaining pattern: assign all un-refunded VAT to this operation
    refundedVatPortion = vatAmt.minus(alreadyRefundedVat);
    // Floor to 0 to guard against over-refund of VAT (should not happen in normal flow)
    if (refundedVatPortion.lt(0)) {
      refundedVatPortion = new Decimal(0);
    }
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
