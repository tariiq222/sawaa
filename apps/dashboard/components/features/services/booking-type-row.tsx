"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import type { DraftBookingType, DraftDurationOption } from "./booking-types-editor"
import { nextOptionKey } from "./booking-types-editor"

/* ─── Props ─── */

interface BookingTypeRowProps {
  draft: DraftBookingType
  label: string
  isAr: boolean
  t: (key: string) => string
  onToggle: () => void
  onUpdate: (field: keyof DraftBookingType, value: unknown) => void
  onUpdateOptions: (opts: DraftDurationOption[]) => void
}

/* ─── Component ─── */

export function BookingTypeRow({
  draft,
  label,
  t,
  onToggle,
  onUpdate,
  onUpdateOptions,
}: BookingTypeRowProps) {

  if (!draft.enabled) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border p-5 text-center">
        <span className="text-xs text-muted-foreground/70">{label}</span>
        <Switch checked={false} onCheckedChange={onToggle} aria-label={label} />
      </div>
    )
  }

  const addOption = () => {
    onUpdateOptions([
      ...draft.durationOptions,
      {
        key: nextOptionKey(),
        label: "",
        labelAr: "",
        durationMins: 30,
        price: 0,
        isDefault: false,
        sortOrder: draft.durationOptions.length,
      },
    ])
  }

  const removeOption = (key: string) => {
    onUpdateOptions(draft.durationOptions.filter((o) => o.key !== key))
  }

  const updateOption = (
    key: string,
    field: keyof DraftDurationOption,
    value: unknown,
  ) => {
    onUpdateOptions(
      draft.durationOptions.map((o) =>
        o.key === key ? { ...o, [field]: value } : o,
      ),
    )
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      {/* Header: label + toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <Switch checked onCheckedChange={onToggle} aria-label={label} />
      </div>

      {/* Price & Duration */}
      <div className="grid grid-cols-2 gap-2">
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

      {/* Duration Options */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3">
          {draft.durationOptions.map((opt) => (
            <DurationOptionMiniRow
              key={opt.key}
              option={opt}
              t={t}
              onUpdate={(field, value) => updateOption(opt.key, field, value)}
              onRemove={() => removeOption(opt.key)}
            />
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={addOption}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5 me-1" />
          {t("services.bookingTypes.addOption")}
        </Button>
      </div>
    </div>
  )
}

/* ─── Duration Option Mini Row ─── */

function DurationOptionMiniRow({
  option,
  t,
  onUpdate,
  onRemove,
}: {
  option: DraftDurationOption
  t: (key: string) => string
  onUpdate: (field: keyof DraftDurationOption, value: unknown) => void
  onRemove: () => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-2.5">
      {/* Header: default toggle + delete */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id={`opt-default-${option.key}`}
            checked={option.isDefault}
            onCheckedChange={(v) => onUpdate("isDefault", v)}
          />
          <Label htmlFor={`opt-default-${option.key}`} className="text-xs cursor-pointer">
            {t("services.bookingTypes.default")}
          </Label>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          onClick={onRemove}
          aria-label={t("services.bookingTypes.removeOption")}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
        </Button>
      </div>

      {/* Duration + Price */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <Label className="text-xs text-muted-foreground">
            {t("services.bookingTypes.durationMinLabel")}
          </Label>
          <Input
            type="number"
            min={5}
            value={option.durationMins}
            onChange={(e) => onUpdate("durationMins", Number(e.target.value))}
            className="h-7 text-xs tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <Label className="text-xs text-muted-foreground">
            {t("services.bookingTypes.priceSARLabel")}
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={option.price}
            onChange={(e) => onUpdate("price", Number(e.target.value))}
            className="h-7 text-xs tabular-nums"
          />
        </div>
      </div>

      {/* Label EN + AR */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <Label className="text-xs text-muted-foreground">
            {t("services.bookingTypes.labelEn")}
          </Label>
          <Input
            value={option.label}
            onChange={(e) => onUpdate("label", e.target.value)}
            placeholder={t("services.bookingTypes.placeholderEn")}
            className="h-7 text-xs"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <Label className="text-xs text-muted-foreground">
            {t("services.bookingTypes.labelAr")}
          </Label>
          <Input
            value={option.labelAr ?? ""}
            onChange={(e) => onUpdate("labelAr", e.target.value)}
            placeholder={t("services.bookingTypes.placeholderAr")}
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  )
}
