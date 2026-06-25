"use client"

import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Building01Icon,
  VideoReplayIcon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { formatPrice } from "@/lib/money"
import { queryKeys } from "@/lib/query-keys"
import { fetchEmployeeServiceTypes } from "@/lib/api/employees-schedule"
import type { EmployeeServiceType } from "@/lib/types/employee"
import type { DeliveryType } from "@/lib/types/booking"

/* ─── Types ─── */

interface StepTypeDurationProps {
  employeeId: string
  serviceId: string
  selectedType: string | null
  /**
   * Phase 3 — also receive the resolved durationOptionId so the form
   * state can carry the full (service, employee, duration) triple that
   * the matching-credits lookup and the from-credit booking require.
   */
  onSelectType: (
    type: string,
    durationOptionId: string | null,
  ) => void
}

/* ─── Helpers ─── */

const DELIVERY_TYPE_META: Record<DeliveryType, { icon: IconSvgElement }> = {
  IN_PERSON: { icon: Building01Icon },
  ONLINE: { icon: VideoReplayIcon },
}

function getTypeLabel(type: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    IN_PERSON: t("bookings.wizard.step.typeDuration.inPerson"),
    ONLINE: t("bookings.wizard.step.typeDuration.online"),
  }
  return map[type] ?? map[type?.toUpperCase()] ?? type
}

/* ─── Skeleton ─── */

function StepTypeDurationSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-5 w-32 animate-pulse rounded bg-muted" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}

/* ─── Type card ─── */

function TypeCard({
  serviceType,
  selected,
  onSelect,
  t,
}: {
  serviceType: EmployeeServiceType
  selected: boolean
  onSelect: () => void
  t: (key: string) => string
}) {
  const type = serviceType.deliveryType as DeliveryType
  const meta = DELIVERY_TYPE_META[type]
  const label = getTypeLabel(serviceType.deliveryType, t)

  return (
    <WizardCard onClick={onSelect} selected={selected} className="py-5">
      <div className="flex items-center justify-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          {meta ? (
            <HugeiconsIcon
              icon={meta.icon}
              size={22}
              className="text-primary"
            />
          ) : null}
        </div>
        <span className="text-sm font-bold text-foreground leading-tight">
          {label}
        </span>
      </div>
    </WizardCard>
  )
}

/* ─── Main step ─── */

export function StepTypeDuration({
  employeeId,
  serviceId,
  selectedType,
  onSelectType,
}: StepTypeDurationProps) {
  const { t } = useLocale()
  const { data: serviceTypes = [], isLoading } = useQuery<EmployeeServiceType[]>({
    queryKey: queryKeys.employees.serviceTypes(employeeId, serviceId),
    queryFn: () => fetchEmployeeServiceTypes(employeeId, serviceId),
    enabled: !!employeeId && !!serviceId,
    staleTime: 0,
  })

  const activeTypes = serviceTypes.filter((st) => {
    if (!st.isActive) return false
    return true
  })

  // Resolve the ServiceDurationOption id implied by a given
  // EmployeeServiceType — prefer the explicit default, otherwise the
  // first option in the order returned by the backend. Returns null
  // when the type has no duration options (the booking is then created
  // without a duration, which the backend accepts).
  const resolveDurationOptionId = (
    serviceType: EmployeeServiceType,
  ): string | null => {
    const options = serviceType.durationOptions ?? []
    if (options.length === 0) return null
    const def = options.find((o) => o.isDefault)
    return def?.id ?? options[0]?.id ?? null
  }

  // Auto-select when only one type
  useEffect(() => {
    if (activeTypes.length === 1 && !selectedType) {
      const only = activeTypes[0]
      onSelectType(only.deliveryType, resolveDurationOptionId(only))
    }
  }, [activeTypes, selectedType, onSelectType])

  const selectedServiceType = selectedType
    ? activeTypes.find((st) => st.deliveryType === selectedType)
    : undefined

  if (isLoading) return <StepTypeDurationSkeleton />

  return (
    <div className="flex flex-col gap-5">
      {/* Type section */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
          {t("bookings.wizard.step.typeDuration.typeTitle")}
        </p>
        {activeTypes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {t("bookings.wizard.step.typeDuration.noTypes")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {activeTypes.map((st) => (
              <TypeCard
                key={st.id}
                serviceType={st}
                selected={selectedType === st.deliveryType}
                onSelect={() =>
                  onSelectType(
                    st.deliveryType,
                    resolveDurationOptionId(st),
                  )
                }
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* Price + duration info line — shown when a type is selected */}
      {selectedServiceType && (
        <p className="text-sm text-muted-foreground">
          {formatPrice(Number(selectedServiceType.price))} {t("bookings.wizard.step.service.currency")} · {selectedServiceType.duration} {t("bookings.wizard.step.typeDuration.minutes")}
        </p>
      )}
    </div>
  )
}
