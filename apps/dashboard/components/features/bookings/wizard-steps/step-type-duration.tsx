"use client"

import { useEffect, useMemo } from "react"
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
import type { EmployeeServiceType, EmployeeDurationOption } from "@/lib/types/employee"
import type { DeliveryType } from "@/lib/types/booking"

/* ─── Types ─── */

interface StepTypeDurationProps {
  employeeId: string
  serviceId: string
  selectedType: string | null
  selectedDurationOptionId: string | null
  onSelectType: (type: string) => void
  onSelectDuration: (durationOptionId: string, label: string) => void
  onSkipDuration: () => void
}

/* ─── Helpers ─── */

const DELIVERY_TYPE_META: Record<DeliveryType, { icon: IconSvgElement }> = {
  in_person: { icon: Building01Icon },
  online: { icon: VideoReplayIcon },
}

function getTypeLabel(type: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    IN_PERSON: t("bookings.wizard.step.typeDuration.inPerson"),
    ONLINE: t("bookings.wizard.step.typeDuration.online"),
    in_person: t("bookings.wizard.step.typeDuration.inPerson"),
    online: t("bookings.wizard.step.typeDuration.online"),
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
  const label = getTypeLabel(type, t)

  return (
    <WizardCard onClick={onSelect} selected={selected} className="py-6">
      <div className="flex flex-col items-center gap-2">
        <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10">
          {meta ? (
            <HugeiconsIcon
              icon={meta.icon}
              size={26}
              className="text-primary"
            />
          ) : null}
        </div>
        <span className="text-sm font-bold text-foreground leading-tight text-center">
          {label}
        </span>
      </div>
    </WizardCard>
  )
}

/* ─── Duration card ─── */

function DurationCard({
  option,
  selected,
  onSelect,
  t,
  locale,
}: {
  option: EmployeeDurationOption
  selected: boolean
  onSelect: () => void
  t: (key: string) => string
  locale: string
}) {
  const label = locale === "ar" && option.labelAr ? option.labelAr : option.label

  return (
    <WizardCard onClick={onSelect} selected={selected} className="py-5">
      <div className="flex flex-col items-center gap-1">
        <span className="text-base font-bold text-foreground">
          {label}
        </span>
        <span className="text-sm text-muted-foreground">
          {option.durationMinutes} {t("bookings.wizard.step.typeDuration.minutes")}
        </span>
        {option.price > 0 && (
          <span className="text-sm text-primary font-semibold">
            {formatPrice(Number(option.price))} {t("bookings.wizard.step.service.currency")}
          </span>
        )}
      </div>
    </WizardCard>
  )
}

/* ─── Main step ─── */

export function StepTypeDuration({
  employeeId,
  serviceId,
  selectedType,
  selectedDurationOptionId,
  onSelectType,
  onSelectDuration,
  onSkipDuration,
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

  // Auto-select when only one type
  useEffect(() => {
    if (activeTypes.length === 1 && !selectedType) {
      onSelectType(activeTypes[0].deliveryType)
    }
  }, [activeTypes, selectedType, onSelectType])

  const selectedServiceType = selectedType
    ? activeTypes.find((st) => st.deliveryType === selectedType)
    : undefined

  const durationOptions: EmployeeDurationOption[] = useMemo(
    () => selectedServiceType?.durationOptions ?? [],
    [selectedServiceType]
  )

  // Auto-select when no duration options → skip
  useEffect(() => {
    if (selectedType && durationOptions.length === 0 && !isLoading) {
      onSkipDuration()
    }
  }, [selectedType, durationOptions.length, isLoading, onSkipDuration])

  // Auto-select when only one duration option
  useEffect(() => {
    if (durationOptions.length === 1 && !selectedDurationOptionId) {
      const opt = durationOptions[0]
      const label = locale === "ar" && opt.labelAr ? opt.labelAr : opt.label
      onSelectDuration(opt.id, label)
    }
  }, [durationOptions, selectedDurationOptionId, locale, onSelectDuration])

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
                onSelect={() => onSelectType(st.deliveryType)}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {/* Duration section — only after type selected and options exist */}
      {selectedType && durationOptions.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {t("bookings.wizard.step.typeDuration.durationTitle")}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {durationOptions.map((opt) => (
              <DurationCard
                key={opt.id}
                option={opt}
                selected={selectedDurationOptionId === opt.id}
                onSelect={() => {
                  const label = locale === "ar" && opt.labelAr ? opt.labelAr : opt.label
                  onSelectDuration(opt.id, label)
                }}
                t={t}
                locale={locale}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
