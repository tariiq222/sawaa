"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"

import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit02Icon } from "@hugeicons/core-free-icons"

import { Button } from "@sawaa/ui"
import { Separator } from "@sawaa/ui"
import {
  useServiceBookingTypes,
  useServiceBookingTypesMutation,
} from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { BookingTypeRow } from "./booking-type-row"
import type { ServiceBookingType, ServiceDeliveryType } from "@/lib/types/service"
import { sarToHalalas, halalasToSarNumber } from "@/lib/money"

/* ─── Constants ─── */

// DB-10: values are now uppercase enum strings ('IN_PERSON' | 'ONLINE').
const DELIVERY_TYPES: { value: ServiceDeliveryType; labelKey: string }[] = [
  { value: "IN_PERSON", labelKey: "services.deliveryTypes.inPerson" },
  { value: "ONLINE", labelKey: "services.deliveryTypes.online" },
]

/* ─── Draft Types ─── */

export interface DraftBookingType {
  deliveryType: ServiceDeliveryType
  enabled: boolean
  price: number // SAR display
  durationMins: number // minutes
  useCustomAvailability: boolean
  availabilityWindows: DraftAvailabilityWindow[]
  durationOptions: DraftDurationOption[]
  defaultOptionId?: string
}

export interface DraftAvailabilityWindow {
  key: string
  dayOfWeek: number
  startTime: string
  endTime: string
  isActive: boolean
}

export interface DraftDurationOption {
  key: string
  id?: string
  durationMins: number
  price: number // SAR display value
}

/* ─── Key counter (used by ServiceAvailabilityWindowsEditor and DurationOptionsEditor) ─── */

let windowKeyCounter = 0
export function nextOptionKey() {
  return `win-${++windowKeyCounter}`
}

/* ─── Duration options payload builder ─── */

export function buildDurationOptionsPayload(draft: DraftBookingType) {
  if (draft.durationOptions.length === 0 && !draft.defaultOptionId) return []
  return [
    {
      ...(draft.defaultOptionId ? { id: draft.defaultOptionId } : {}),
      label: `${draft.durationMins} min`,
      labelAr: `${draft.durationMins} دقيقة`,
      durationMins: draft.durationMins,
      price: sarToHalalas(draft.price),
      isDefault: true,
      sortOrder: 0,
    },
    ...draft.durationOptions.map((o, i) => ({
      ...(o.id ? { id: o.id } : {}),
      label: `${o.durationMins} min`,
      labelAr: `${o.durationMins} دقيقة`,
      durationMins: o.durationMins,
      price: sarToHalalas(o.price),
      isDefault: false,
      sortOrder: i + 1,
    })),
  ]
}

/* ─── Props ─── */

interface BookingTypesEditorProps {
  serviceId: string
  useClinicTerminology?: boolean
}

/* ─── Component ─── */

export function BookingTypesEditor({ serviceId, useClinicTerminology = false }: BookingTypesEditorProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const [dirty, setDirty] = useState(false)
  const [editing, setEditing] = useState(false)
  const [types, setTypes] = useState<DraftBookingType[]>(buildEmptyDrafts())

  const { data: existing, isLoading } = useServiceBookingTypes(serviceId)
  const mutation = useServiceBookingTypesMutation(serviceId)

  /* Sync server data into local state */
  useEffect(() => {
    if (!existing || dirty) return
    const drafts = mergeDraftsFromServer(existing)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTypes(drafts)
    // Locked by default once something is saved; unlocked for a fresh service.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditing(!drafts.some((d) => d.enabled))
  }, [existing, dirty])

  const toggleType = (deliveryType: string) => {
    setTypes((prev) =>
      prev.map((d) =>
        d.deliveryType === deliveryType
          ? { ...d, enabled: !d.enabled }
          : d,
      ),
    )
    setDirty(true)
  }

  const updateType = (
    deliveryType: string,
    field: keyof DraftBookingType,
    value: unknown,
  ) => {
    setTypes((prev) =>
      prev.map((d) =>
        d.deliveryType === deliveryType ? { ...d, [field]: value } : d,
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
          deliveryType: d.deliveryType,
          price: sarToHalalas(d.price),
          durationMins: d.durationMins,
          isActive: true,
          useCustomAvailability: false,
          durationOptions: buildDurationOptionsPayload(d),
          availabilityWindows: [],
        })),
      })
      setDirty(false)
      setEditing(false)
      toast.success(t("services.bookingTypes.saved"))
    } catch {
      toast.error(t("services.deliveryTypes.saveFailed"))
    }
  }

  return (
    <div className="space-y-3">
      <Separator />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {t("services.deliveryTypes.title")}
        </p>
        {!editing && !isLoading && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setEditing(true)}
          >
            <HugeiconsIcon icon={PencilEdit02Icon} strokeWidth={2} className="size-4" />
            {t("common.edit")}
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">
          {t("services.deliveryTypes.loading")}
        </p>
      )}

      <div className="grid items-start gap-3 sm:grid-cols-2">
        {types.map((draft) => (
          <BookingTypeRow
            key={draft.deliveryType}
            draft={draft}
            label={t(
              DELIVERY_TYPES.find((bt) => bt.value === draft.deliveryType)
                ?.labelKey ?? "",
            )}
            isAr={isAr}
            t={t}
            useClinicTerminology={useClinicTerminology}
            readOnly={!editing}
            onToggle={() => toggleType(draft.deliveryType)}
            onUpdate={(field, value) =>
              updateType(draft.deliveryType, field, value)
            }
          />
        ))}
      </div>

      {editing && (
        <Button
          type="button"
          size="sm"
          className="w-full"
          disabled={mutation.isPending}
          onClick={handleSave}
        >
          {mutation.isPending
            ? t("services.deliveryTypes.saving")
            : t("services.deliveryTypes.save")}
        </Button>
      )}
    </div>
  )
}

/* ─── Helpers ─── */

function buildEmptyDrafts(): DraftBookingType[] {
  // DB-10: enum values are now uppercase
  return [
    { deliveryType: "IN_PERSON", enabled: false, price: 0, durationMins: 30, useCustomAvailability: false, availabilityWindows: [], durationOptions: [], defaultOptionId: undefined },
    { deliveryType: "ONLINE", enabled: false, price: 0, durationMins: 30, useCustomAvailability: false, availabilityWindows: [], durationOptions: [], defaultOptionId: undefined },
  ]
}

export function mergeDraftsFromServer(
  serverTypes: ServiceBookingType[],
): DraftBookingType[] {
  const map = new Map(serverTypes.map((st) => [st.deliveryType, st]))
  // DB-10: enum values are now uppercase
  return (["IN_PERSON", "ONLINE"] as const).map(
    (dt) => {
      const server = map.get(dt)
      if (!server) {
        return { deliveryType: dt, enabled: false, price: 0, durationMins: 30, useCustomAvailability: false, availabilityWindows: [], durationOptions: [], defaultOptionId: undefined }
      }
      return {
        deliveryType: dt,
        enabled: server.isActive,
        price: halalasToSarNumber(server.price),
        durationMins: server.durationMins,
        useCustomAvailability: false,
        availabilityWindows: [],
        durationOptions: (server.durationOptions ?? [])
          .filter((o) => !o.isDefault)
          .map((o) => ({ key: o.id, id: o.id, durationMins: o.durationMins, price: halalasToSarNumber(o.price) })),
        defaultOptionId: server.durationOptions?.find((o) => o.isDefault)?.id,
      }
    },
  )
}
