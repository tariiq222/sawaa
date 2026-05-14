"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { BookingTypeRow } from "../booking-type-row"
import type { DraftBookingType, DraftDurationOption } from "../booking-types-editor"
import type { ServiceBookingMode } from "@/lib/types/service"

/* ─── Constants ─── */

// DB-10: values are now uppercase enum strings
const BOOKING_TYPES: { value: ServiceBookingMode; labelKey: string }[] = [
  { value: "IN_PERSON", labelKey: "services.bookingTypes.clinic" },
  { value: "ONLINE", labelKey: "services.bookingTypes.online" },
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

  const toggleType = (bookingType: string) => {
    onBookingTypesChange(
      bookingTypes.map((d) =>
        d.bookingType === bookingType ? { ...d, enabled: !d.enabled } : d,
      ),
    )
  }

  const updateType = (
    bookingType: string,
    field: keyof DraftBookingType,
    value: unknown,
  ) => {
    onBookingTypesChange(
      bookingTypes.map((d) =>
        d.bookingType === bookingType ? { ...d, [field]: value } : d,
      ),
    )
  }

  const updateOptions = (
    bookingType: string,
    opts: DraftDurationOption[],
  ) => {
    onBookingTypesChange(
      bookingTypes.map((d) =>
        d.bookingType === bookingType
          ? { ...d, durationOptions: opts }
          : d,
      ),
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("services.create.tabs.pricing")}</CardTitle>
        <CardDescription>
          {t("services.create.tabs.pricingDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {bookingTypes.map((draft) => (
          <BookingTypeRow
            key={draft.bookingType}
            draft={draft}
            label={t(
              BOOKING_TYPES.find((bt) => bt.value === draft.bookingType)
                ?.labelKey ?? "",
            )}
            isAr={isAr}
            t={t}
            onToggle={() => toggleType(draft.bookingType)}
            onUpdate={(field, value) =>
              updateType(draft.bookingType, field, value)
            }
            onUpdateOptions={(opts) =>
              updateOptions(draft.bookingType, opts)
            }
          />
        ))}
        </div>
      </CardContent>
    </Card>
  )
}
