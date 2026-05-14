"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { halalasToSar, sarToHalalas } from "@/lib/money"
import type { ServiceBookingType } from "@/lib/types/service"
import type { EmployeeTypeConfigPayload } from "@/lib/types/employee"

/* ─── Key counter ─── */

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
  const defaultPrice = serviceDefault ? halalasToSar(serviceDefault.price).toFixed(2) : ""
  const defaultDuration = serviceDefault ? String(serviceDefault.durationMins) : ""
  const hasDefault = !!serviceDefault

  const pricePlaceholder = hasDefault
    ? `${t("employees.services.defaultPrice")}: ${defaultPrice} ${t("employees.services.sar")}`
    : t("employees.services.required")
  const durationPlaceholder = hasDefault
    ? `${t("employees.services.defaultPrice")}: ${defaultDuration} ${t("employees.services.min")}`
    : t("employees.services.required")

  const priceDisplay =
    config.price != null ? halalasToSar(config.price).toFixed(2) : ""
  const durationDisplay =
    config.duration != null ? String(config.duration) : ""

  const handlePriceChange = (val: string) => {
    if (val === "") {
      onUpdate({ price: null })
    } else {
      onUpdate({ price: sarToHalalas(parseFloat(val)) })
    }
  }

  const handleDurationChange = (val: string) => {
    if (val === "") {
      onUpdate({ duration: null })
    } else {
      onUpdate({ duration: parseInt(val, 10) })
    }
  }

  const toggleCustomOptions = (checked: boolean) => {
    onUpdate({ useCustomOptions: checked })
    if (checked && (!config.durationOptions || config.durationOptions.length === 0)) {
      onUpdate({ useCustomOptions: true, durationOptions: [] })
    }
  }

  const addDurationOption = () => {
    onUpdate({
      durationOptions: [
        ...(config.durationOptions ?? []),
        {
          label: "",
          labelAr: "",
          durationMinutes: 30,
          price: 0,
          isDefault: false,
          sortOrder: (config.durationOptions ?? []).length,
        },
      ],
    })
  }

  const removeDurationOption = (index: number) => {
    const opts = [...(config.durationOptions ?? [])]
    opts.splice(index, 1)
    onUpdate({ durationOptions: opts })
  }

  const updateDurationOption = (
    index: number,
    field: string,
    value: unknown,
  ) => {
    const opts = [...(config.durationOptions ?? [])]
    opts[index] = { ...opts[index], [field]: value }
    onUpdate({ durationOptions: opts })
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {hasDefault && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              ({t("employees.services.defaultLabel")}: {defaultPrice} {t("employees.services.sar")} / {defaultDuration} {t("employees.services.min")})
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
        </Button>
      </div>

      {/* Price & Duration */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">
            {t("services.bookingTypes.price")} ({t("employees.services.sar")})
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={priceDisplay}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder={pricePlaceholder}
            className="h-9 text-sm tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">
            {t("services.bookingTypes.duration")} ({t("employees.services.min")})
          </Label>
          <Input
            type="number"
            min={1}
            value={durationDisplay}
            onChange={(e) => handleDurationChange(e.target.value)}
            placeholder={durationPlaceholder}
            className="h-9 text-sm tabular-nums"
          />
        </div>
      </div>

      {/* Custom duration options toggle */}
      <div className="flex items-center justify-between rounded border border-border p-2">
        <Label className="text-xs cursor-pointer">
          {t("employees.services.useCustomOptions")}
        </Label>
        <Switch
          checked={config.useCustomOptions ?? false}
          onCheckedChange={toggleCustomOptions}
        />
      </div>

      {/* Duration options repeater */}
      {config.useCustomOptions && (
        <div className="space-y-2 ps-3 border-s-2 border-border">
          {(config.durationOptions ?? []).map((opt, i) => (
            <EmployeeDurationOptionRow
              key={`${config.bookingType}-opt-${i}`}
              option={opt}
              t={t}
              onUpdate={(field, val) => updateDurationOption(i, field, val)}
              onRemove={() => removeDurationOption(i)}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={addDurationOption}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5 me-1" />
            {t("services.bookingTypes.addOption")}
          </Button>
        </div>
      )}
    </div>
  )
}

/* ─── Duration Option Row ─── */

interface DurOptProps {
  option: NonNullable<EmployeeTypeConfigPayload["durationOptions"]>[number]
  t: (key: string) => string
  onUpdate: (field: string, value: unknown) => void
  onRemove: () => void
}

function EmployeeDurationOptionRow({
  option,
  t,
  onUpdate,
  onRemove,
}: DurOptProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-border p-2">
      <div className="flex flex-1 items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <Label className="text-[10px] text-muted-foreground">
            {t("employees.services.durationMin")}
          </Label>
          <Input
            type="number"
            min={5}
            value={option.durationMinutes}
            onChange={(e) => onUpdate("durationMinutes", Number(e.target.value))}
            className="h-8 w-20 text-xs tabular-nums sm:w-24"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <Label className="text-[10px] text-muted-foreground">
            {t("employees.services.priceSar")}
          </Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={option.price}
            onChange={(e) => onUpdate("price", Number(e.target.value))}
            className="h-8 w-20 text-xs tabular-nums sm:w-24"
          />
        </div>
        <div className="flex flex-col items-center gap-0.5 pt-3">
          <Switch
            checked={option.isDefault ?? false}
            onCheckedChange={(v) => onUpdate("isDefault", v)}
          />
          <Label className="text-[10px] cursor-pointer">
            {t("services.bookingTypes.default")}
          </Label>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-6 text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
      </Button>
    </div>
  )
}
