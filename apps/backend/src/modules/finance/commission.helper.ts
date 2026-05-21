import { Prisma } from '@prisma/client';

/**
 * Input for computing a commission split between employee and organisation.
 *
 * All money values are in integer halalas (1 SAR = 100 halalas).
 * Rates are Prisma.Decimal values in the range 0.0000–1.0000.
 */
export interface CommissionInput {
  /** Booking subtotal in halalas (before VAT, after any discount). */
  subtotalHalalas: number | Prisma.Decimal;
  /** Default commission rate for the employee (Employee.commissionRate). */
  employeeRate: Prisma.Decimal;
  /** Optional per-service override (Service.commissionRateOverride). Null → use employeeRate. */
  serviceOverride?: Prisma.Decimal | null;
}

export interface CommissionResult {
  /** Amount the employee earns, in halalas (integer). */
  employeeShareHalalas: number;
  /** Amount the organisation retains, in halalas (integer). */
  organizationShareHalalas: number;
  /** The rate that was actually applied (serviceOverride if provided, otherwise employeeRate). */
  effectiveRate: Prisma.Decimal;
}

/**
 * Compute how many halalas go to the employee vs. the organisation for a
 * single invoice subtotal.
 *
 * Rules:
 * - Use Prisma.Decimal throughout — never coerce to float before the final
 *   rounding step, to avoid IEEE-754 drift.
 * - Employee share = round(subtotal × rate, 0, ROUND_HALF_UP).
 * - Organisation share = subtotal − employee share  (guarantees no halala is
 *   lost or double-counted).
 */
export function computeCommission(input: CommissionInput): CommissionResult {
  const { subtotalHalalas, employeeRate, serviceOverride } = input;

  const effectiveRate: Prisma.Decimal =
    serviceOverride != null ? new Prisma.Decimal(serviceOverride) : new Prisma.Decimal(employeeRate);

  const subtotal = new Prisma.Decimal(subtotalHalalas);

  // Round to 0 decimal places (halalas are integers).
  const employeeDecimal = subtotal
    .mul(effectiveRate)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);

  const employeeShareHalalas = employeeDecimal.toNumber();
  const organizationShareHalalas = subtotal.toNumber() - employeeShareHalalas;

  return { employeeShareHalalas, organizationShareHalalas, effectiveRate };
}
