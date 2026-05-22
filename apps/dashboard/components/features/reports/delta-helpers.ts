import type { KpiDeltaTone } from "./kpi-card"

export interface Delta {
  text: string
  tone: KpiDeltaTone
}

/**
 * Compute a delta chip for two numeric values.
 *
 * Tone rules:
 *  - up   → current > previous (good)
 *  - down → current < previous (bad)
 *  - flat → equal, or no previous available
 *
 * If `inverse` is true, "up" means current decreased (used for things like
 * no-show rate where lower is better).
 */
export function computeDelta(
  current: number,
  previous: number | undefined,
  opts: { inverse?: boolean; format?: "percent" | "count" } = {},
): Delta | undefined {
  if (previous === undefined || previous === null) return undefined
  if (current === previous) {
    return { text: "ثابت", tone: "flat" }
  }
  if (previous === 0) {
    return current > 0
      ? { text: "+جديد", tone: opts.inverse ? "down" : "up" }
      : { text: "—", tone: "flat" }
  }
  const diff = current - previous
  const pct = (diff / previous) * 100
  const isUp = diff > 0
  const tone: KpiDeltaTone = opts.inverse
    ? isUp
      ? "down"
      : "up"
    : isUp
      ? "up"
      : "down"
  const sign = isUp ? "+" : "−"
  if (opts.format === "count") {
    return { text: `${sign}${Math.abs(diff).toFixed(0)}`, tone }
  }
  return { text: `${sign}${Math.abs(pct).toFixed(0)}٪`, tone }
}
