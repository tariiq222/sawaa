"use client"

import { useLocale } from "@/components/locale-provider"
import { BookingTypeRow } from "../booking-type-row"
import { FormSection } from "@/components/features/shared/form-section"
import type { DraftBookingType } from "../booking-types-editor"
import type { ServiceDeliveryType } from "@/lib/types/service"

/* ─── Constants ─── */

// DB-10: values are now uppercase enum strings
const DELIVERY_TYPES: { value: ServiceDeliveryType; labelKey: string }[] = [
  { value: "IN_PERSON", labelKey: "services.deliveryTypes.inPerson" },
  { value: "ONLINE", labelKey: "services.deliveryTypes.online" },
]

/* ─── Props ─── */

interface PricingTabProps {
  bookingTypes: DraftBookingType[]
  onBookingTypesChange: (types: DraftBookingType[]) => void
}

/* ─── Component ─── */

export function PricingTab({
  bookingTypes,
  onBookingTypesChange,
}: PricingTabProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"

  const toggleType = (deliveryType: string) => {
    onBookingTypesChange(
      bookingTypes.map((d) =>
        d.deliveryType === deliveryType ? { ...d, enabled: !d.enabled } : d,
      ),
    )
  }

  const updateType = (
    deliveryType: string,
    field: keyof DraftBookingType,
    value: unknown,
  ) => {
    onBookingTypesChange(
      bookingTypes.map((d) =>
        d.deliveryType === deliveryType ? { ...d, [field]: value } : d,
      ),
    )
  }

  return (
    <FormSection title={t("services.create.tabs.pricing")}>
      <p className="mb-4 text-sm text-muted-foreground">{t("services.create.tabs.pricingDesc")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 items-start">
        {bookingTypes.map((draft) => (
          <BookingTypeRow
            key={draft.deliveryType}
            draft={draft}
            label={t(
              DELIVERY_TYPES.find((bt) => bt.value === draft.deliveryType)
                ?.labelKey ?? "",
            )}
            isAr={isAr}
            t={t}
            onToggle={() => toggleType(draft.deliveryType)}
            onUpdate={(field, value) =>
              updateType(draft.deliveryType, field, value)
            }
          />
        ))}
      </div>
    </FormSection>
  )
}
