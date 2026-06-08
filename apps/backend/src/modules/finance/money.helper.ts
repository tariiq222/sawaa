import { Prisma } from '@prisma/client';

/**
 * Convert any money value to a Prisma.Decimal rounded to 0 decimal places
 * (whole halalas). Uses ROUND_HALF_UP (0.5 → 1, not 0.5 → 0 banker's rounding).
 *
 * Use this whenever you receive a raw number / string and need a canonical
 * Decimal representation for arithmetic.
 */
export const toHalalas = (d: Prisma.Decimal | string | number): Prisma.Decimal =>
  new Prisma.Decimal(d.toString()).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

/**
 * Compute VAT amount and gross total from a subtotal (net, already in halalas).
 *
 * Algorithm:
 *   vatAmtHalalas = round_half_up(subtotal × vatRate)   — single rounding step, Decimal-only
 *   totalHalalas  = subtotal + vatAmtHalalas             — exact integer addition, no second rounding
 *
 * Invariant guaranteed: subtotal + vatAmtHalalas === totalHalalas (always, no drift).
 *
 * Both inputs must already be whole-halala Decimals (or convertible to them).
 * vatRate is a fractional rate such as 0 (e.g. 0.15 = 15%), not a percentage.
 */
export function computeVat(
  subtotalHalalas: Prisma.Decimal,
  vatRate: Prisma.Decimal,
): {
  vatAmtHalalas: Prisma.Decimal;
  totalHalalas: Prisma.Decimal;
} {
  // Single Decimal multiplication — no float conversion anywhere
  const vatAmtHalalas = subtotalHalalas
    .times(vatRate)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

  // Exact integer addition — vatAmtHalalas is already 0dp, subtotal is 0dp
  const totalHalalas = subtotalHalalas.plus(vatAmtHalalas);

  return { vatAmtHalalas, totalHalalas };
}

/**
 * Allocate the VAT portion for one partial refund proportionally.
 *
 * Formula: round_half_up(refundAmt × (totalVat / totalInvoice))
 *
 * WARNING — accumulation drift with repeated calls:
 * Each call independently rounds its portion. If you call this for every
 * individual refund (e.g., 7 × 1/7 of an invoice), the sum of rounded
 * portions may differ from totalInvoiceVatHalalas by ±1 halala.
 *
 * To guarantee that a sequence of partial refunds sums to exactly totalVat
 * on a full refund, the caller must track vatRefundedSoFar and on the LAST
 * refund compute:
 *
 *   lastVatPortion = totalInvoiceVatHalalas - vatRefundedSoFar
 *
 * rather than calling allocateVatPortion() again. The helper below does NOT
 * do this automatically because it does not know whether the current refund
 * is the last one. See RefundPaymentHandler for the correct pattern.
 *
 * @param refundAmtHalalas     Amount being refunded in this operation (gross, VAT-inclusive)
 * @param totalInvoiceHalalas  Original invoice gross total
 * @param totalInvoiceVatHalalas Original invoice VAT amount
 *
 * @throws Error if totalInvoiceHalalas is zero (would divide by zero)
 */
export function allocateVatPortion(
  refundAmtHalalas: Prisma.Decimal,
  totalInvoiceHalalas: Prisma.Decimal,
  totalInvoiceVatHalalas: Prisma.Decimal,
): Prisma.Decimal {
  if (totalInvoiceHalalas.isZero()) {
    return new Prisma.Decimal(0);
  }

  // vatRatio stays as high-precision Decimal — no float conversion
  const vatRatio = totalInvoiceVatHalalas.div(totalInvoiceHalalas);

  return refundAmtHalalas
    .times(vatRatio)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}
