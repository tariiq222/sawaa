"use client"

import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon } from "@hugeicons/core-free-icons"
import Image from "next/image"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchServiceEmployees } from "@/lib/api/services"
import type { ServiceEmployee } from "@/lib/types/service"
import type { WizardState } from "../use-wizard-state"
import { StepTypeDuration } from "./step-type-duration"
import { StepDatetime } from "./step-datetime"

interface StepSchedulingProps {
  serviceId: string
  state: WizardState
  onSelectEmployee: (employeeId: string, employeeName: string) => void
  onSelectType: (type: string) => void
  onSelectDuration: (durationOptionId: string, label: string) => void
  onSkipDuration: () => void
  onSelectDate: (date: string) => void
  onSelectTime: (startTime: string) => void
  maxAdvanceDays: number
}

interface EmployeeOption {
  id: string
  name: string
  title: string
  avatarUrl: string | null | undefined
}

function EmployeeAvatar({ avatarUrl, name }: { avatarUrl: string | null | undefined; name: string }) {
  if (avatarUrl) {
    return (
      <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
        <Image src={avatarUrl} alt={name} fill className="object-cover" sizes="40px" />
      </div>
    )
  }
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <HugeiconsIcon icon={UserIcon} size={18} className="text-primary" />
    </div>
  )
}

function EmployeeListItem({
  option,
  selected,
  onSelect,
}: {
  option: EmployeeOption
  selected: boolean
  onSelect: () => void
}) {
  return (
    <WizardCard onClick={onSelect} selected={selected} className="px-4 py-3">
      <div className="flex items-center gap-3">
        <EmployeeAvatar avatarUrl={option.avatarUrl} name={option.name} />
        <div className="flex min-w-0 flex-col items-end gap-0.5 text-end">
          <span className="w-full truncate text-sm font-semibold text-foreground">
            {option.name}
          </span>
          {option.title && (
            <span className="w-full truncate text-xs text-muted-foreground">
              {option.title}
            </span>
          )}
        </div>
      </div>
    </WizardCard>
  )
}

export function StepScheduling({
  serviceId,
  state,
  onSelectEmployee,
  onSelectType,
  onSelectDuration,
  onSkipDuration,
  onSelectDate,
  onSelectTime,
  maxAdvanceDays,
}: StepSchedulingProps) {
  const { t, locale } = useLocale()

  const { data: serviceEmployees, isLoading } = useQuery<ServiceEmployee[]>({
    queryKey: queryKeys.services.employees(serviceId),
    queryFn: () => fetchServiceEmployees(serviceId),
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  })

  const employees: EmployeeOption[] = (serviceEmployees ?? [])
    .filter((e) => e.isActive && e.employee.isActive)
    .map((e) => {
      const emp = e.employee
      const name =
        locale === "ar" && emp.nameAr
          ? emp.nameAr
          : `${emp.user.firstName} ${emp.user.lastName}`.trim()
      return {
        id: emp.id,
        name,
        title: emp.title ?? "",
        avatarUrl: emp.avatarUrl,
      }
    })

  const hasEmployee = !!state.employeeId

  return (
    <div className="flex flex-col gap-0 md:flex-row md:gap-6">
      <aside className="shrink-0 md:w-72">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("bookings.wizard.stepLabel.employee")}
        </p>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={`emp-skel-${i}`} className="h-16 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("bookings.wizard.noEmployees")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {employees.map((emp) => (
              <EmployeeListItem
                key={emp.id}
                option={emp}
                selected={state.employeeId === emp.id}
                onSelect={() => onSelectEmployee(emp.id, emp.name)}
              />
            ))}
          </div>
        )}
      </aside>

      <div className="mt-6 flex-1 border-t border-border pt-6 md:mt-0 md:border-s md:border-t-0 md:border-border md:ps-6 md:pt-0">
        {!hasEmployee ? (
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {t("bookings.wizard.step.scheduling.pickEmployee")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <StepTypeDuration
              employeeId={state.employeeId!}
              serviceId={serviceId}
              selectedType={state.type}
              selectedDurationOptionId={state.durationOptionId}
              onSelectType={onSelectType}
              onSelectDuration={onSelectDuration}
              onSkipDuration={onSkipDuration}
            />
            {state.type && (
              <StepDatetime
                employeeId={state.employeeId!}
                serviceId={serviceId}
                bookingType={state.type}
                durationOptionId={state.durationOptionId}
                selectedDate={state.date}
                selectedTime={state.startTime}
                onSelectDate={onSelectDate}
                onSelectTime={onSelectTime}
                maxAdvanceDays={maxAdvanceDays}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
