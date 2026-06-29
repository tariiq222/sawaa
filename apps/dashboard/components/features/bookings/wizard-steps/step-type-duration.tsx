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
  /**
   * Currently selected duration option id, used to highlight the active
   * duration choice when the selected type exposes more than one option.
   */
  selectedDurationOptionId: string | null
  /**
   * Called when the operator picks a specific duration option for the
   * already-selected delivery type. Lets the receptionist choose between
   * e.g. 30-min and 60-min sessions instead of always getting the default.
   */
  onSelectDuration: (durationOptionId: string) => void
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
  selectedDurationOptionId,
  onSelectDuration,
}: StepTypeDurationProps) {
  const { t, locale } = useLocale()
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

  // Duration options for the selected type, ordered by the backend's
  // sortOrder. A picker is shown only when there is more than one — a
  // single option is resolved silently (handled by resolveDurationOptionId).
  const durationOptions = selectedServiceType?.durationOptions ?? []
  const showDurationPicker = durationOptions.length > 1
  const activeDurationId =
    selectedDurationOptionId ??
    (selectedServiceType ? resolveDurationOptionId(selectedServiceType) : null)
  const selectedOption = durationOptions.find((o) => o.id === activeDurationId)

  // Price + duration shown in the info line follow the selected duration
  // option when present, falling back to the type-level price/duration.
  const infoPrice = selectedOption
    ? Number(selectedOption.price)
    : selectedServiceType?.price != null
      ? Number(selectedServiceType.price)
      : null
  const infoDuration = selectedOption
    ? selectedOption.durationMinutes
    : selectedServiceType?.duration ?? null

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

      {/* Duration section — shown only when the selected type exposes
          more than one duration option (e.g. 30-min vs 60-min). */}
      {selectedServiceType && showDurationPicker && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {t("bookings.wizard.step.typeDuration.durationTitle")}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {durationOptions.map((opt) => {
              const label = locale === "ar" ? opt.labelAr ?? opt.label : opt.label
              return (
                <WizardCard
                  key={opt.id}
                  onClick={() => onSelectDuration(opt.id)}
                  selected={opt.id === activeDurationId}
                  className="py-4"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-bold text-foreground leading-tight">
                      {label || `${opt.durationMinutes} ${t("bookings.wizard.step.typeDuration.minutes")}`}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {opt.durationMinutes} {t("bookings.wizard.step.typeDuration.minutes")} · {formatPrice(Number(opt.price))} {t("bookings.wizard.step.service.currency")}
                    </span>
                  </div>
                </WizardCard>
              )
            })}
          </div>
        </div>
      )}

      {/* Price + duration info line — follows the selected duration option */}
      {selectedServiceType && infoPrice != null && infoDuration != null && (
        <p className="text-sm text-muted-foreground">
          {formatPrice(infoPrice)} {t("bookings.wizard.step.service.currency")} · {infoDuration} {t("bookings.wizard.step.typeDuration.minutes")}
        </p>
      )}
    </div>
  )
}
