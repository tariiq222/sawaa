"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"

import { Button } from "@deqah/ui"
import { Separator } from "@deqah/ui"
import {
  useServiceBookingTypes,
  useServiceBookingTypesMutation,
} from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { BookingTypeRow } from "./booking-type-row"
import type { ServiceBookingType, ServiceBookingMode } from "@/lib/types/service"
import { sarToHalalas, halalasToSarNumber } from "@/lib/money"

/* ─── Constants ─── */

// DB-10: values are now uppercase enum strings ('IN_PERSON' | 'ONLINE').
const BOOKING_TYPES: { value: ServiceBookingMode; labelKey: string }[] = [
  { value: "IN_PERSON", labelKey: "services.bookingTypes.clinic" },
  { value: "ONLINE", labelKey: "services.bookingTypes.online" },
]

/* ─── Draft Types ─── */

export interface DraftDurationOption {
  key: string
  label: string
  labelAr: string
  durationMins: number
  price: number // SAR display
  isDefault: boolean
  sortOrder: number
}

export interface DraftBookingType {
  bookingType: ServiceBookingMode
  enabled: boolean
  price: number // SAR display
  durationMins: number // minutes
  durationOptions: DraftDurationOption[]
}

/* ─── Key counter ─── */

let optionKeyCounter = 0
export function nextOptionKey() {
  return `opt-${++optionKeyCounter}`
}

/* ─── Props ─── */

interface BookingTypesEditorProps {
  serviceId: string
}

/* ─── Component ─── */

export function BookingTypesEditor({ serviceId }: BookingTypesEditorProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const [dirty, setDirty] = useState(false)
  const [types, setTypes] = useState<DraftBookingType[]>(buildEmptyDrafts())

  const { data: existing, isLoading } = useServiceBookingTypes(serviceId)
  const mutation = useServiceBookingTypesMutation(serviceId)

  /* Sync server data into local state */
  useEffect(() => {
    if (!existing || dirty) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTypes(mergeDraftsFromServer(existing))
  }, [existing, dirty])

  const toggleType = (bookingType: string) => {
    setTypes((prev) =>
      prev.map((d) =>
        d.bookingType === bookingType
          ? { ...d, enabled: !d.enabled }
          : d,
      ),
    )
    setDirty(true)
  }

  const updateType = (
    bookingType: string,
    field: keyof DraftBookingType,
    value: unknown,
  ) => {
    setTypes((prev) =>
      prev.map((d) =>
        d.bookingType === bookingType ? { ...d, [field]: value } : d,
      ),
    )
    setDirty(true)
  }

  const handleSave = async () => {
    const enabledTypes = types.filter((d) => d.enabled)
    if (enabledTypes.length === 0) {
      toast.error(t("services.bookingTypes.noTypes"))
      return
    }
    try {
      await mutation.mutateAsync({
        types: enabledTypes.map((d) => ({
          bookingType: d.bookingType,
          price: sarToHalalas(d.price),
          durationMins: d.durationMins,
          isActive: true,
          durationOptions: d.durationOptions.map((o, i) => ({
            label: o.label,
            labelAr: o.labelAr || undefined,
            durationMins: o.durationMins,
            price: sarToHalalas(o.price),
            isDefault: o.isDefault,
            sortOrder: i,
          })),
        })),
      })
      setDirty(false)
      toast.success(t("services.bookingTypes.saved"))
    } catch {
      toast.error(t("services.bookingTypes.saveFailed"))
    }
  }

  return (
    <div className="space-y-3">
      <Separator />
      <p className="text-sm font-medium text-foreground">
        {t("services.bookingTypes")}
      </p>

      {isLoading && (
        <p className="text-sm text-muted-foreground">
          {t("services.bookingTypes.loading")}
        </p>
      )}

      <div className="space-y-3">
        {types.map((draft) => (
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
            onUpdateOptions={(opts) => {
              updateType(draft.bookingType, "durationOptions", opts)
            }}
          />
        ))}
      </div>

      {dirty && (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={mutation.isPending}
          onClick={handleSave}
        >
          {mutation.isPending
            ? t("services.bookingTypes.saving")
            : t("services.bookingTypes.save")}
        </Button>
      )}
    </div>
  )
}

/* ─── Helpers ─── */

function buildEmptyDrafts(): DraftBookingType[] {
  // DB-10: enum values are now uppercase
  return [
    { bookingType: "IN_PERSON", enabled: false, price: 0, durationMins: 30, durationOptions: [] },
    { bookingType: "ONLINE", enabled: false, price: 0, durationMins: 30, durationOptions: [] },
  ]
}

export function mergeDraftsFromServer(
  serverTypes: ServiceBookingType[],
): DraftBookingType[] {
  const map = new Map(serverTypes.map((st) => [st.bookingType, st]))
  // DB-10: enum values are now uppercase
  return (["IN_PERSON", "ONLINE"] as const).map(
    (bt) => {
      const server = map.get(bt)
      if (!server) {
        return { bookingType: bt, enabled: false, price: 0, durationMins: 30, durationOptions: [] }
      }
      return {
        bookingType: bt,
        enabled: server.isActive,
        price: halalasToSarNumber(server.price),
        durationMins: server.durationMins,
        durationOptions: (server.durationOptions ?? []).map((o) => ({
          key: o.id,
          label: o.label,
          labelAr: o.labelAr ?? "",
          durationMins: o.durationMins,
          price: halalasToSarNumber(o.price),
          isDefault: o.isDefault,
          sortOrder: o.sortOrder,
        })),
      }
    },
  )
}
