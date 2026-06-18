"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"

import { formatPrice } from "@/lib/money"
import type { ServiceBookingType } from "@/lib/types/service"
import type { EmployeeTypeConfigPayload } from "@/lib/types/employee"

/* ─── Props ─── */

interface EmployeeTypeRowProps {
  config: EmployeeTypeConfigPayload
  serviceDefault: ServiceBookingType | null
  label: string
  t: (key: string) => string
  onUpdate: (updates: Partial<EmployeeTypeConfigPayload>) => void
  onRemove: () => void
}

/* ─── Component ─── */

export function EmployeeTypeRow({
  config,
  serviceDefault,
  label,
  t,
  onUpdate,
  onRemove,
}: EmployeeTypeRowProps) {
  // serviceDefault.price is in halalas; render as a SAR-major string.
  const defaultPrice = serviceDefault ? formatPrice(serviceDefault.price) : ""
  const defaultDuration = serviceDefault ? String(serviceDefault.durationMins) : ""
  const hasDefault = !!serviceDefault

  const pricePlaceholder = hasDefault
    ? `${t("employees.services.defaultPrice")}: ${defaultPrice} ${t("employees.services.sar")}`
    : t("employees.services.required")
  const durationPlaceholder = hasDefault
    ? `${t("employees.services.defaultDuration")}: ${defaultDuration} ${t("employees.services.min")}`
    : t("employees.services.required")

  const priceDisplay =
    config.price != null ? Number(config.price).toFixed(2) : ""
  const durationDisplay =
    config.duration != null ? String(config.duration) : ""

  const handlePriceChange = (val: string) => {
    if (val === "") {
      onUpdate({ price: null })
    } else {
      onUpdate({ price: parseFloat(val) })
    }
  }

  const handleDurationChange = (val: string) => {
    if (val === "") {
      onUpdate({ duration: null })
    } else {
      onUpdate({ duration: parseInt(val, 10) })
    }
  }

  return (
    <>
      {/* Type label + default hint */}
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hasDefault && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {defaultPrice} {t("employees.services.sar")} · {defaultDuration} {t("employees.services.min")}
          </span>
        )}
      </div>

      {/* Price */}
      <Input
        type="number"
        min={0}
        step="0.01"
        value={priceDisplay}
        onChange={(e) => handlePriceChange(e.target.value)}
        placeholder={pricePlaceholder}
        className="h-9 text-sm tabular-nums"
      />

      {/* Duration */}
      <Input
        type="number"
        min={1}
        value={durationDisplay}
        onChange={(e) => handleDurationChange(e.target.value)}
        placeholder={durationPlaceholder}
        className="h-9 text-sm tabular-nums"
      />

      {/* Remove */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
        onClick={onRemove}
        aria-label={t("common.delete")}
      >
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
      </Button>
    </>
  )
}
