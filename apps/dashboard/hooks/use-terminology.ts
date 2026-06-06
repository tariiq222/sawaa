"use client"

/**
 * Single-tenant terminology helper.
 *
 * The dashboard no longer resolves vertical-specific terminology from a public
 * endpoint. Keep the hook and exported types for existing imports, but resolve
 * known labels locally and otherwise fall back to the caller-provided string.
 */

import { useLocale } from "@/components/locale-provider"

/* ─── Types ─── */

export interface TerminologyToken {
  ar: string
  en: string
}

export type TerminologyPack = Record<string, TerminologyToken>

/* ─── Query Key ─── */

export const terminologyQueryKey = (slug: string | undefined) =>
  ["terminology", slug] as const

const singleTenantTerminology: TerminologyPack = {
  "appointment.plural": { ar: "الحجوزات", en: "Bookings" },
  "client.plural": { ar: "المستفيدين", en: "Clients" },
  "employee.plural": { ar: "الممارسون", en: "Employees" },
}

/* ─── Hook ─── */

export function useTerminology(_verticalSlug?: string) {
  const { locale } = useLocale()

  /**
   * Resolve a terminology key to a localized string. Unknown keys fall back to
   * the optional `fallback` argument, then the key itself.
   */
  const t = (key: string, fallback?: string): string => {
    const token = singleTenantTerminology[key]
    if (!token) return fallback ?? key
    return token[locale] ?? token.ar ?? fallback ?? key
  }

  return {
    t,
    isLoading: false,
    pack: singleTenantTerminology,
  }
}
