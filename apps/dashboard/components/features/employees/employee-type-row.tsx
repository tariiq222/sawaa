"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"

import { formatPrice, halalasToSarNumber } from "@/lib/money"
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

  const toggleCustomOptions = (checked: boolean) => {
    const defaultOptions = serviceDefault?.durationOptions ?? []
    if (checked && defaultOptions.length > 0) {
      onUpdate({
        useCustomOptions: true,
        durationOptions: defaultOptions.map((option) => ({
          id: option.id,
          label: option.label,
          labelAr: option.labelAr ?? undefined,
          durationMinutes: option.durationMins,
          price: halalasToSarNumber(option.price),
          isDefault: option.isDefault,
          sortOrder: option.sortOrder,
        })),
      })
      return
    }
    onUpdate({ useCustomOptions: checked })
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

      {/* Custom options toggle */}
      <div className="flex justify-center">
        <Switch
          checked={config.useCustomOptions ?? false}
          onCheckedChange={toggleCustomOptions}
          aria-label={t("employees.services.useCustomOptions")}
        />
      </div>

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

      {/* Duration options repeater — spans full width under the row */}
      {config.useCustomOptions && (
        <div className="col-span-full space-y-2 ps-3 border-s-2 border-border">
          {(config.durationOptions ?? []).map((opt, i) => (
            <EmployeeDurationOptionRow
              key={`${config.deliveryType}-opt-${i}`}
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
    </>
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
        aria-label={t("services.bookingTypes.removeOption")}
      >
        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3.5" />
      </Button>
    </div>
  )
}
