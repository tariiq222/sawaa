/**
 * Package savings — Sawaa Dashboard
 *
 * Discounts live on package items; the package-level discount fields are
 * deprecated and always zero. The list reads the server-computed totals.
 * All values are integer halalas.
 */

/**
 * Accepts the wire's numeric money plus the Prisma decimal-string form the
 * legacy tests pin; `Number()` coercion is unchanged, so behaviour is identical.
 */
const halalas = (v: number | string | undefined) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * The `Pick` is deliberately wider than the derived `SessionPackage` fields
 * (which are `number`): the helper keeps tolerating the decimal-string form so
 * `package-savings.spec.ts` (unchanged from HEAD) still pins that behaviour.
 */
export function packageSavings(p: { discountAmount: number | string; freeValue?: number | string }) {
  return { discount: halalas(p.discountAmount), freeValue: halalas(p.freeValue) }
}
