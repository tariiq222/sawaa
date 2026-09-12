/**
 * Package savings — Sawaa Dashboard
 *
 * Discounts live on package items; the package-level discount fields are
 * deprecated and always zero. The list reads the server-computed totals.
 * All values are integer halalas.
 */

import type { SessionPackage } from "@/lib/types/package"

const halalas = (v: number | string | undefined) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function packageSavings(p: Pick<SessionPackage, "discountAmount" | "freeValue">) {
  return { discount: halalas(p.discountAmount), freeValue: halalas(p.freeValue) }
}
