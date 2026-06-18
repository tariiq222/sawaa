"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, AlertCircleIcon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"

import type { DraftBookingType, DraftDurationOption } from "./booking-types-editor"
import { nextOptionKey } from "./booking-types-editor"

interface DurationOptionsEditorProps {
  draft: DraftBookingType
  onUpdate: (field: keyof DraftBookingType, value: unknown) => void
  t: (key: string) => string
  useClinicTerminology?: boolean
  readOnly?: boolean
}

export function DurationOptionsEditor({
  draft,
  onUpdate,
  t,
  useClinicTerminology = false,
  readOnly = false,
}: DurationOptionsEditorProps) {
  const options = draft.durationOptions

  const addOption = () => {
    const newOption: DraftDurationOption = {
      key: nextOptionKey(),
      durationMins: draft.durationMins,
      price: draft.price,
    }
    onUpdate("durationOptions", [...options, newOption])
  }

  const removeOption = (key: string) => {
    onUpdate("durationOptions", options.filter((o) => o.key !== key))
  }

  const updateOption = (key: string, field: keyof DraftDurationOption, value: number) => {
    onUpdate(
      "durationOptions",
      options.map((o) => (o.key === key ? { ...o, [field]: value } : o)),
    )
  }

  return (
    <div className="space-y-2">
      {draft.price === 0 && (
        <p className="flex items-center gap-1 text-xs text-warning">
          <HugeiconsIcon
            icon={AlertCircleIcon}
            strokeWidth={2}
            className="size-3.5 shrink-0"
          />
          <span>{t(useClinicTerminology ? "services.bookingTypes.clinicZeroPriceWarning" : "services.bookingTypes.zeroPriceWarning")}</span>
        </p>
      )}
      <div className="overflow-hidden rounded-lg border border-border/60">
        {/* Header */}
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
          <span>{t("services.bookingTypes.duration")} ({t("services.bookingTypes.durationUnit")})</span>
          <span>{t("services.bookingTypes.price")} ({t("services.bookingTypes.priceCurrency")})</span>
          <span className="w-7" aria-hidden />
        </div>

        {/* Base (default) row */}
        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-t border-border/60 px-3 py-2">
          <Input
            type="number"
            min={1}
            value={draft.durationMins}
            onChange={(e) => onUpdate("durationMins", Number(e.target.value))}
            disabled={readOnly}
            className="h-8 text-sm tabular-nums"
            aria-label={t("services.bookingTypes.duration")}
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            value={draft.price}
            onChange={(e) => onUpdate("price", Number(e.target.value))}
            disabled={readOnly}
            className="h-8 text-sm tabular-nums"
            aria-label={t("services.bookingTypes.price")}
          />
          <span className="w-7" aria-hidden />
        </div>

        {/* Extra rows */}
        {options.map((opt) => (
          <div
            key={opt.key}
            className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 border-t border-border/60 px-3 py-2"
          >
            <Input
              type="number"
              min={1}
              value={opt.durationMins}
              onChange={(e) => updateOption(opt.key, "durationMins", Number(e.target.value))}
              disabled={readOnly}
              className="h-8 text-sm tabular-nums"
              aria-label={t("services.bookingTypes.duration")}
            />
            <Input
              type="number"
              min={0}
              step="0.01"
              value={opt.price}
              onChange={(e) => updateOption(opt.key, "price", Number(e.target.value))}
              disabled={readOnly}
              className="h-8 text-sm tabular-nums"
              aria-label={t("services.bookingTypes.price")}
            />
            {readOnly ? (
              <span className="w-7" aria-hidden />
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 text-destructive hover:text-destructive"
                onClick={() => removeOption(opt.key)}
                aria-label={t("common.delete")}
              >
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={addOption}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-4" />
          {t("services.bookingTypes.addDuration")}
        </Button>
      )}
    </div>
  )
}
