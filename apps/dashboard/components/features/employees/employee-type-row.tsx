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
    ? `${t("employees.services.defaultPrice")} ${defaultPrice}`
    : t("employees.services.required")
  const durationPlaceholder = hasDefault
    ? `${t("employees.services.defaultDuration")} ${defaultDuration}`
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
    <div className="group rounded-lg border border-border bg-surface px-3.5 py-3 transition-colors hover:border-primary/30">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground/60 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          onClick={onRemove}
          aria-label={t("common.delete")}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label={t("services.bookingTypes.price")} unit={t("employees.services.sar")}>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={priceDisplay}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder={pricePlaceholder}
            className="h-9 text-sm tabular-nums"
          />
        </Field>

        <Field label={t("services.bookingTypes.duration")} unit={t("employees.services.min")}>
          <Input
            type="number"
            min={1}
            value={durationDisplay}
            onChange={(e) => handleDurationChange(e.target.value)}
            placeholder={durationPlaceholder}
            className="h-9 text-sm tabular-nums"
          />
        </Field>
      </div>
    </div>
  )
}

/* ─── Field ─── */

function Field({
  label,
  unit,
  children,
}: {
  label: string
  unit: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">
        {label} <span className="text-muted-foreground/50">({unit})</span>
      </span>
      {children}
    </label>
  )
}
