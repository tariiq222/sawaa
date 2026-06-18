"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { Switch } from "@sawaa/ui"
import { halalasToSarNumber, sarToHalalas } from "@/lib/money"
import type { ServiceEmployee, ServiceEmployeeServiceType } from "@/lib/types/service"
import type { SetCustomPricingPayload } from "@/lib/api/employees"

interface Props {
  item: ServiceEmployee
  serviceId: string
  t: (key: string) => string
  isSaving: boolean
  onSave: (payload: SetCustomPricingPayload) => void
}

// Local inline-edit field
interface FieldProps {
  value: number
  suffix: string
  isSaving: boolean
  min?: number
  step?: number
  ariaLabel: string
  onCommit: (next: number) => void
}

function InlineNumberField({ value, suffix, isSaving, min = 0, step = 1, ariaLabel, onCommit }: FieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  if (editing) {
    return (
      <span className="flex items-center gap-1">
        <input
          type="number"
          className="w-20 rounded border border-border bg-background px-1.5 py-0.5 text-sm tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          value={draft}
          min={min}
          step={step}
          autoFocus
          disabled={isSaving}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const parsed = parseFloat(draft)
              if (!isNaN(parsed) && parsed >= min) {
                onCommit(parsed)
                setEditing(false)
              }
            } else if (e.key === "Escape") {
              setEditing(false)
            }
          }}
          onBlur={() => {
            const parsed = parseFloat(draft)
            if (!isNaN(parsed) && parsed >= min) {
              onCommit(parsed)
            }
            setEditing(false)
          }}
          aria-label={ariaLabel}
        />
        <button
          type="button"
          className="text-success hover:opacity-80"
          onClick={() => {
            const parsed = parseFloat(draft)
            if (!isNaN(parsed) && parsed >= min) {
              onCommit(parsed)
              setEditing(false)
            }
          }}
          aria-label="confirm"
        >
          <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="size-3.5" />
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      className="flex items-center gap-1 text-sm tabular-nums text-foreground hover:text-primary disabled:opacity-50"
      disabled={isSaving}
      onClick={() => {
        setDraft(String(value))
        setEditing(true)
      }}
      aria-label={ariaLabel}
    >
      <span>{value} {suffix}</span>
      <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} className="size-3 text-muted-foreground" />
    </button>
  )
}

export function EmployeeCustomPricingRow({ item, serviceId: _serviceId, t, isSaving, onSave }: Props) {
  const activeTypes = item.serviceTypes.filter((st) => st.isActive)
  const hasTypes = item.serviceTypes.length > 0

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onSave({
        enabled: true,
        types: item.serviceTypes.map((st) => ({
          deliveryType: st.deliveryType as 'IN_PERSON' | 'ONLINE',
          price: st.price ?? st.basePrice,
          durationMins: st.durationMins ?? st.baseDurationMins,
        })),
      })
    } else {
      onSave({ enabled: false, types: [] })
    }
  }

  const handlePriceCommit = (st: ServiceEmployeeServiceType, sarValue: number) => {
    onSave({
      enabled: true,
      types: item.serviceTypes.map((s) =>
        s.id === st.id
          ? {
              deliveryType: s.deliveryType as 'IN_PERSON' | 'ONLINE',
              price: sarToHalalas(sarValue),
              durationMins: s.durationMins ?? s.baseDurationMins,
            }
          : {
              deliveryType: s.deliveryType as 'IN_PERSON' | 'ONLINE',
              price: s.price ?? s.basePrice,
              durationMins: s.durationMins ?? s.baseDurationMins,
            },
      ),
    })
  }

  const handleDurationCommit = (st: ServiceEmployeeServiceType, mins: number) => {
    onSave({
      enabled: true,
      types: item.serviceTypes.map((s) =>
        s.id === st.id
          ? {
              deliveryType: s.deliveryType as 'IN_PERSON' | 'ONLINE',
              price: s.price ?? s.basePrice,
              durationMins: mins,
            }
          : {
              deliveryType: s.deliveryType as 'IN_PERSON' | 'ONLINE',
              price: s.price ?? s.basePrice,
              durationMins: s.durationMins ?? s.baseDurationMins,
            },
      ),
    })
  }

  const typeLabel = (deliveryType: string) =>
    deliveryType === 'IN_PERSON'
      ? t("services.bookingTypes.clinic")
      : t("services.bookingTypes.online")

  return (
    <div className="space-y-2">
      {/* Toggle row */}
      <div className="flex items-center gap-2">
        <Switch
          checked={item.hasCustomPricing}
          onCheckedChange={handleToggle}
          disabled={isSaving || !hasTypes}
          aria-label={t("services.employees.customPricing")}
        />
        <span className={hasTypes ? "text-sm text-foreground" : "text-sm text-muted-foreground"}>
          {t("services.employees.customPricing")}
        </span>
      </div>
      {!hasTypes && (
        <p className="text-xs text-muted-foreground/70">
          {t("services.employees.noTypesForPricing")}
        </p>
      )}

      {/* Custom pricing rows */}
      {item.hasCustomPricing && activeTypes.length > 0 && (
        <div className="space-y-1.5 ps-7">
          {activeTypes.map((st) => (
            <div key={st.id} className="flex flex-wrap items-center gap-3 text-sm">
              <span className="w-20 shrink-0 text-muted-foreground text-xs">{typeLabel(st.deliveryType)}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{t("services.employees.priceLabel")}:</span>
                <InlineNumberField
                  value={halalasToSarNumber(st.price ?? st.basePrice)}
                  suffix={t("services.bookingTypes.priceCurrency")}
                  isSaving={isSaving}
                  min={0}
                  step={0.01}
                  ariaLabel={t("services.employees.priceLabel")}
                  onCommit={(sarVal) => handlePriceCommit(st, sarVal)}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{t("services.employees.durationLabel")}:</span>
                <InlineNumberField
                  value={st.durationMins ?? st.baseDurationMins}
                  suffix={t("employees.services.minutes")}
                  isSaving={isSaving}
                  min={1}
                  step={1}
                  ariaLabel={t("services.employees.durationLabel")}
                  onCommit={(mins) => handleDurationCommit(st, mins)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Base prices (when custom pricing is off) */}
      {!item.hasCustomPricing && activeTypes.length > 0 && (
        <div className="space-y-1 ps-7">
          {activeTypes.map((st) => (
            <div key={st.id} className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">{typeLabel(st.deliveryType)}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {halalasToSarNumber(st.basePrice)} {t("services.bookingTypes.priceCurrency")}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {st.baseDurationMins} {t("employees.services.minutes")}
              </span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t("services.employees.usingBasePrice")}</p>
        </div>
      )}
    </div>
  )
}
