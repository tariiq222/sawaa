"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import { Label } from "@deqah/ui"
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

const ALL_BOOKING_TYPES = [
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
    serviceBookingTypes.map((st) => [st.bookingType, st]),
  )
  const enabledTypeValues = new Set(value.map((v) => v.bookingType))

  /* Types available in the service but not yet added to employee */
  const additionalTypes = ALL_BOOKING_TYPES.filter(
    (bt) => !enabledTypeValues.has(bt.value),
  )

  const updateType = (
    bookingType: string,
    updates: Partial<EmployeeTypeConfigPayload>,
  ) => {
    onChange(
      value.map((v) =>
        v.bookingType === bookingType ? { ...v, ...updates } : v,
      ),
    )
  }

  const removeType = (bookingType: string) => {
    onChange(value.filter((v) => v.bookingType !== bookingType))
  }

  const addType = (bookingType: string) => {
    const serviceDef = serviceTypeMap.get(bookingType)
    onChange([
      ...value,
      {
        bookingType,
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

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {t("services.bookingTypes.noTypes")}
        </p>
      )}

      {value.map((typeConfig) => {
        const serviceDef = serviceTypeMap.get(typeConfig.bookingType)
        const typeLabel = ALL_BOOKING_TYPES.find(
          (bt) => bt.value === typeConfig.bookingType,
        )
        return (
          <EmployeeTypeRow
            key={typeConfig.bookingType}
            config={typeConfig}
            serviceDefault={serviceDef ?? null}
            label={typeLabel ? t(typeLabel.labelKey) : typeConfig.bookingType}
            t={t}
            onUpdate={(updates) =>
              updateType(typeConfig.bookingType, updates)
            }
            onRemove={() => removeType(typeConfig.bookingType)}
          />
        )
      })}

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
