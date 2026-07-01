/**
 * Package item summary — Sawaa Dashboard
 *
 * Builds the one-line human-readable scope summary shown per item, e.g.
 * «١٠ جلسات — أي معالج · استشارة فردية · أونلاين». Pure: takes already-resolved
 * labels + a `t()` function, returns a string. No React, no data fetching.
 */

import type { ScopeFormData } from "@/lib/schemas/package.schema"

type TFn = (key: string) => string

export interface SummaryInput {
  paid: number
  free: number
  service: ScopeFormData
  practitioner: ScopeFormData
  delivery: ScopeFormData
  /** Resolved service labels (in selection order). */
  serviceNames: string[]
  /** Resolved practitioner labels (in selection order). */
  practitionerNames: string[]
}

/** Join selected labels, or the ANY/EXCLUDE fallback phrase for a dimension. */
function scopePhrase(
  scope: ScopeFormData,
  names: string[],
  t: TFn,
  keys: { any: string; exclude: string },
): string {
  if (scope.mode === "ANY" || names.length === 0) return t(keys.any)
  const joined = names.join("، ")
  return scope.mode === "EXCLUDE" ? `${t(keys.exclude)} ${joined}` : joined
}

export function buildItemSummary(input: SummaryInput, t: TFn): string {
  const total = input.paid + input.free
  if (total < 1) return ""

  const parts: string[] = []

  parts.push(
    scopePhrase(input.service, input.serviceNames, t, {
      any: "packages.summary.anyService",
      exclude: "packages.summary.exceptPrefix",
    }),
  )
  parts.push(
    scopePhrase(input.practitioner, input.practitionerNames, t, {
      any: "packages.summary.anyPractitioner",
      exclude: "packages.summary.exceptPrefix",
    }),
  )

  if (input.delivery.mode === "INCLUDE" && input.delivery.ids.length === 1) {
    parts.push(t(`packages.items.deliveryType.${input.delivery.ids[0]}`))
  }

  const sessions = `${total} ${t("packages.summary.sessions")}`
  return `${sessions} — ${parts.join(" · ")}`
}
