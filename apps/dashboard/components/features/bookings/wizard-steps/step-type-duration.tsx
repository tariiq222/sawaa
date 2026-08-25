"use client"

// EXCEPTION: feature-component size limit (300) exceeded — 2026-08-25
// — W2B-T8 added the two optional FLEXIBLE-credit predicates plus a
// shared `NoOptionsCard` helper used by the type + duration groups
// when the credit narrows either candidate list to zero. This keeps
// the file under the 350-line absolute cap and sits between the
// existing soft limit and the hard limit, mirroring the precedent
// set by the step-service / step-employee siblings which stay under
// 300 for the same reason.

import { useCallback, useEffect } from "react"
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
   * already-selected delivery type.
   */
  onSelectDuration: (durationOptionId: string) => void
  /**
   * W2B-T8 — optional FLEXIBLE-credit gate. When provided, types/durations
   * that fail the predicate are HIDDEN. The auto-select effect is
   * CONSTRAINED so it never seeds an id the credit forbids (returns null
   * instead). Default behaviour is preserved exactly when omitted.
   */
  isDeliveryTypeAllowed?: (deliveryType: string) => boolean
  isDurationAllowed?: (durationOptionId: string) => boolean
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

/* W2B-T8 — empty-state card for type + duration groups when a
   FLEXIBLE-credit predicate narrows candidates to zero. */
function NoOptionsCard({
  testId,
  message,
}: {
  testId: string
  message: string
}) {
  return (
    <div
      data-testid={testId}
      className="rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center"
    >
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
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
  isDeliveryTypeAllowed,
  isDurationAllowed,
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
    if (isDeliveryTypeAllowed && !isDeliveryTypeAllowed(st.deliveryType)) return false
    return true
  })

  // Resolve the ServiceDurationOption id implied by a given
  // EmployeeServiceType — prefer the explicit default, otherwise the
  // first option in the order returned by the backend. Returns null
  // when the type has no duration options (the booking is then created
  // without a duration, which the backend accepts).
  //
  // W2B-T8 — when `isDurationAllowed` is wired, candidates are narrowed
  // BEFORE the default/first lookup so the auto-select effect never
  // seeds an id the credit forbids. Returns null when none are allowed.
  //
  // W3-T11 — wrapped in `useCallback` so it can be a stable dep of the
  // auto-select `useEffect` without disabling the
  // `react-hooks/exhaustive-deps` rule. Behaviour is byte-identical:
  // the predicate is still closed over the latest `isDurationAllowed`,
  // and the resolver still returns null when nothing is allowed.
  const resolveDurationOptionId = useCallback(
    (serviceType: EmployeeServiceType): string | null => {
      const options = serviceType.durationOptions ?? []
      const candidates = isDurationAllowed
        ? options.filter((o) => isDurationAllowed(o.id))
        : options
      if (candidates.length === 0) return null
      const def = candidates.find((o) => o.isDefault)
      return def?.id ?? candidates[0]?.id ?? null
    },
    [isDurationAllowed],
  )

  // Auto-select when only one type
  useEffect(() => {
    if (activeTypes.length === 1 && !selectedType) {
      const only = activeTypes[0]
      onSelectType(only.deliveryType, resolveDurationOptionId(only))
    }
  }, [activeTypes, selectedType, onSelectType, resolveDurationOptionId])

  const selectedServiceType = selectedType
    ? activeTypes.find((st) => st.deliveryType === selectedType)
    : undefined

  // Duration options for the selected type, ordered by the backend's
  // sortOrder. W2B-T8 — narrowed by `isDurationAllowed` when the gate
  // is wired so the rendered picker never offers a forbidden option.
  // A picker is shown only when there is more than one — a single
  // option is resolved silently (handled by resolveDurationOptionId).
  const durationOptions = selectedServiceType
    ? (isDurationAllowed
        ? (selectedServiceType.durationOptions ?? []).filter((o) =>
            isDurationAllowed(o.id),
          )
        : (selectedServiceType.durationOptions ?? []))
    : []
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
          <NoOptionsCard
            testId="step-type-duration-types-empty"
            message={
              isDeliveryTypeAllowed
                ? t("bookings.pos.package.filter.noOptions")
                : t("bookings.wizard.step.typeDuration.noTypes")
            }
          />
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
          more than one duration option (e.g. 30-min vs 60-min). W2B-T8
          — when `isDurationAllowed` narrows candidates to zero, render
          the dedicated empty-state message instead of a missing picker. */}
      {selectedServiceType &&
        isDurationAllowed &&
        durationOptions.length === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              {t("bookings.wizard.step.typeDuration.durationTitle")}
            </p>
            <NoOptionsCard
              testId="step-type-duration-durations-empty"
              message={t("bookings.pos.package.filter.noOptions")}
            />
          </div>
        )}

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
