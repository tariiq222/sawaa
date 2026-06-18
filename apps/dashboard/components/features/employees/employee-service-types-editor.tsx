"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import type { ServiceBookingType } from "@/lib/types/service"
import type { EmployeeTypeConfigPayload } from "@/lib/types/employee"
import { EmployeeTypeRow } from "./employee-type-row"

/* ─── Props ─── */

interface EmployeeServiceTypesEditorProps {
  serviceBookingTypes: ServiceBookingType[]
  value: EmployeeTypeConfigPayload[]
  onChange: (types: EmployeeTypeConfigPayload[]) => void
  t: (key: string) => string
  locale: string
}

/* ─── Constants ─── */

const ALL_DELIVERY_TYPES = [
  { value: "in_person", labelKey: "employees.services.inPerson" },
  { value: "online", labelKey: "employees.services.online" },
] as const

/* ─── Component ─── */

export function EmployeeServiceTypesEditor({
  serviceBookingTypes,
  value,
  onChange,
  t,
  // locale,
}: EmployeeServiceTypesEditorProps) {
  const serviceTypeMap = new Map<string, ServiceBookingType>(
    serviceBookingTypes.map((st) => [st.deliveryType.toLowerCase(), st]),
  )
  const enabledTypeValues = new Set(value.map((v) => v.deliveryType))

  /* Types available in the service but not yet added to employee */
  const additionalTypes = ALL_DELIVERY_TYPES.filter(
    (bt) => !enabledTypeValues.has(bt.value),
  )

  const updateType = (
    deliveryType: string,
    updates: Partial<EmployeeTypeConfigPayload>,
  ) => {
    onChange(
      value.map((v) =>
        v.deliveryType === deliveryType ? { ...v, ...updates } : v,
      ),
    )
  }

  const removeType = (deliveryType: string) => {
    onChange(value.filter((v) => v.deliveryType !== deliveryType))
  }

  const addType = (deliveryType: string) => {
    const serviceDef = serviceTypeMap.get(deliveryType)
    onChange([
      ...value,
      {
        deliveryType,
        price: serviceDef ? null : undefined,
        duration: serviceDef ? null : undefined,
        useCustomOptions: false,
        isActive: true,
        durationOptions: [],
      },
    ])
  }

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("employees.services.types")}
      </Label>

      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          {t("services.bookingTypes.noTypes")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[7rem_minmax(0,1fr)_minmax(0,1fr)_auto_2rem] items-center gap-x-3 gap-y-2 px-3 py-2">
            {/* Header */}
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("employees.services.types")}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("services.bookingTypes.price")} ({t("employees.services.sar")})
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("services.bookingTypes.duration")} ({t("employees.services.min")})
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("employees.services.useCustomOptions")}
            </span>
            <span aria-hidden />

            {value.map((typeConfig) => {
              const serviceDef = serviceTypeMap.get(typeConfig.deliveryType)
              const typeLabel = ALL_DELIVERY_TYPES.find(
                (bt) => bt.value === typeConfig.deliveryType,
              )
              return (
                <EmployeeTypeRow
                  key={typeConfig.deliveryType}
                  config={typeConfig}
                  serviceDefault={serviceDef ?? null}
                  label={typeLabel ? t(typeLabel.labelKey) : typeConfig.deliveryType}
                  t={t}
                  onUpdate={(updates) =>
                    updateType(typeConfig.deliveryType, updates)
                  }
                  onRemove={() => removeType(typeConfig.deliveryType)}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Add additional type */}
      {additionalTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {additionalTypes.map((bt) => (
            <Button
              key={bt.value}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => addType(bt.value)}
            >
              <HugeiconsIcon icon={Add01Icon} size={12} />
              {t(bt.labelKey)}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
