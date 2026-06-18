"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon, Building01Icon, Video01Icon } from "@hugeicons/core-free-icons"

import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import type { DraftBookingType } from "./booking-types-editor"
import { DurationOptionsEditor } from "./duration-options-editor"

const TYPE_ICON: Record<string, typeof Building01Icon> = {
  IN_PERSON: Building01Icon,
  ONLINE: Video01Icon,
}

/* ─── Props ─── */

interface BookingTypeRowProps {
  draft: DraftBookingType
  label: string
  isAr: boolean
  t: (key: string) => string
  onToggle: () => void
  onUpdate: (field: keyof DraftBookingType, value: unknown) => void
  useClinicTerminology?: boolean
}

/* ─── Component ─── */

export function BookingTypeRow({
  draft,
  label,
  t,
  onToggle,
  onUpdate,
  useClinicTerminology = false,
}: BookingTypeRowProps) {

  const Icon = TYPE_ICON[draft.deliveryType] ?? Building01Icon

  const SectionHeader = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className={
            "flex size-9 shrink-0 items-center justify-center rounded-lg " +
            (draft.enabled
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground/60")
          }
        >
          <HugeiconsIcon icon={Icon} strokeWidth={2} className="size-5" />
        </span>
        <span
          className={
            "text-sm font-medium " +
            (draft.enabled ? "text-foreground" : "text-muted-foreground")
          }
        >
          {label}
        </span>
      </div>
      <Switch
        checked={draft.enabled}
        onCheckedChange={onToggle}
        aria-label={label}
      />
    </div>
  )

  if (!draft.enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/30 p-4">
        {SectionHeader}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface-solid p-4 shadow-sm space-y-4">
      {SectionHeader}

      {/* Price & Duration */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            {t("services.bookingTypes.price")} ({t("services.bookingTypes.priceCurrency")})
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={draft.price}
            onChange={(e) => onUpdate("price", Number(e.target.value))}
            className="h-8 text-sm tabular-nums"
          />
          {draft.enabled && draft.price === 0 && (
            <p className="flex items-center gap-1 text-xs text-warning">
              <HugeiconsIcon
                icon={AlertCircleIcon}
                strokeWidth={2}
                className="size-3.5 shrink-0"
              />
              <span>{t(useClinicTerminology ? "services.bookingTypes.clinicZeroPriceWarning" : "services.bookingTypes.zeroPriceWarning")}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            {t("services.bookingTypes.duration")} ({t("services.bookingTypes.durationUnit")})
          </Label>
          <Input
            type="number"
            min={1}
            value={draft.durationMins}
            onChange={(e) => onUpdate("durationMins", Number(e.target.value))}
            className="h-8 text-sm tabular-nums"
          />
        </div>
      </div>

      <DurationOptionsEditor draft={draft} onUpdate={onUpdate} t={t} />

    </div>
  )
}
