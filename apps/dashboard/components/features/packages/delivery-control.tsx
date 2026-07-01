"use client"

/**
 * DeliveryControl — Sawaa Dashboard (packages feature)
 *
 * Compact, secondary 3-way delivery-type control: «الكل» (ANY),
 * «حضوري» (INCLUDE IN_PERSON) or «أونلاين» (INCLUDE ONLINE). Unlike the general
 * ScopeControl it is single-choice, so it maps straight to a scope.
 */

import { Label } from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import { cn } from "@/lib/utils"
import type { ScopeFormData } from "@/lib/schemas/package.schema"

const ANY = "__any__"
const VALUES = ["IN_PERSON", "ONLINE"] as const

interface DeliveryControlProps {
  scope: ScopeFormData
  onChange: (next: ScopeFormData) => void
}

export function DeliveryControl({ scope, onChange }: DeliveryControlProps) {
  const { t } = useLocale()
  const current = scope.mode === "INCLUDE" && scope.ids.length === 1 ? scope.ids[0] : ANY

  const set = (v: string) =>
    onChange(v === ANY ? { mode: "ANY", ids: [] } : { mode: "INCLUDE", ids: [v] })

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{t("packages.items.deliveryLabel")}</Label>
      <div
        role="group"
        aria-label={t("packages.items.deliveryLabel")}
        className="inline-flex rounded-lg border border-border bg-surface-muted p-0.5"
      >
        {[ANY, ...VALUES].map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={current === v}
            onClick={() => set(v)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              current === v
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === ANY ? t("packages.scope.any") : t(`packages.items.deliveryType.${v}`)}
          </button>
        ))}
      </div>
    </div>
  )
}
