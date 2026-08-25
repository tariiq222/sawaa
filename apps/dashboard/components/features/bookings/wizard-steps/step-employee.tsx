"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchEmployees } from "@/lib/api/employees"
import { fetchAvailability } from "@/lib/api/employees-schedule"
import { fetchServiceEmployees } from "@/lib/api/services"
import type { Employee } from "@/lib/types/employee"
import type { ServiceEmployee } from "@/lib/types/service"

import { EmployeeAvatar, normalizeEmployeeAvatarSrc } from "@/components/features/shared/employee-avatar"
export { EmployeeAvatar, normalizeEmployeeAvatarSrc }

import {
  formatLocalizedDate,
  getDeliveryTypeMeta,
  getTodayInRiyadh,
  useNearestSlotHints,
} from "@/components/features/bookings/wizard-steps/step-employee-hint"

function getEmployeeNameFromFull(p: Employee, locale: string): string {
  if (locale === "ar" && p.nameAr) return p.nameAr
  return `${p.user.firstName} ${p.user.lastName}`.trim()
}

function StepEmployeeSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="h-28 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}

interface StepEmployeeProps {
  serviceId: string
  onSelect: (employeeId: string, employeeName: string) => void
  /**
   * W2B-T8 — optional FLEXIBLE-credit gate. When provided, practitioners
   * whose id fails the predicate are HIDDEN from the rendered grid
   * (not merely disabled). Default behaviour — render every practitioner
   * — is preserved exactly when the prop is omitted.
   */
  isEmployeeAllowed?: (employeeId: string) => boolean
}

export function StepEmployee({
  serviceId,
  onSelect,
  isEmployeeAllowed,
}: StepEmployeeProps) {
  const { t, locale } = useLocale()

  const { data: serviceEmployees, isLoading: loadingByService } = useQuery<ServiceEmployee[]>({
    queryKey: queryKeys.services.employees(serviceId),
    queryFn: () => fetchServiceEmployees(serviceId),
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: allEmployees, isLoading: loadingAll } = useQuery({
    queryKey: queryKeys.employees.list({ isActive: true, limit: 100 }),
    queryFn: () => fetchEmployees({ isActive: true, limit: 100 }),
    enabled: !serviceId,
    staleTime: 5 * 60 * 1000,
  })

  const employees: Employee[] = useMemo(
    () => {
      const resolved: Employee[] = serviceId
        ? (serviceEmployees ?? [])
            .filter((e) => e.isActive && e.employee.isActive)
            .map((e) => ({
              id: e.employee.id,
              nameAr: e.employee.nameAr,
              title: e.employee.title,
              avatarUrl: e.employee.avatarUrl,
              isActive: e.employee.isActive,
              user: e.employee.user,
            } as unknown as Employee))
        : (allEmployees?.items ?? []).filter((p) => p.isActive)
      if (!isEmployeeAllowed) return resolved
      return resolved.filter((p) => isEmployeeAllowed(p.id))
    },
    [serviceId, serviceEmployees, allEmployees, isEmployeeAllowed],
  )

  // Weekly schedule per practitioner — drives the existing
  // "no schedule → disabled card" behaviour and disables the hint.
  const availabilityData = useQuery({
    queryKey: ["step-employee", "availability-batch", employees.map((p) => p.id)],
    queryFn: async () => {
      const results = await Promise.all(
        employees.map((p) => fetchAvailability(p.id).catch(() => [])),
      )
      return results
    },
    enabled: employees.length > 0,
    staleTime: 5 * 60 * 1000,
  })
  const noScheduleById = useMemo(() => {
    const map: Record<string, boolean> = {}
    employees.forEach((p, i) => {
      const arr = availabilityData.data?.[i]
      if (arr !== undefined) {
        map[p.id] = !arr.some((w) => w.isActive)
      }
    })
    return map
  }, [employees, availabilityData.data])

  // Map of practitioner → their active IN_PERSON/ONLINE service types for
  // the selected service. Drives the "nearest slot" hint comparisons.
  const serviceTypesByEmployee = useMemo(() => {
    const map = new Map<string, ServiceEmployee["serviceTypes"]>()
    if (!serviceId || !serviceEmployees) return map
    for (const se of serviceEmployees) {
      if (se.isActive && se.employee?.isActive) {
        map.set(se.employee.id, se.serviceTypes ?? [])
      }
    }
    return map
  }, [serviceId, serviceEmployees])

  const today = getTodayInRiyadh()
  const nearestByEmployee = useNearestSlotHints({
    employees,
    serviceTypesByEmployee,
    serviceId,
    noScheduleById,
  })

  if (loadingByService || loadingAll) return <StepEmployeeSkeleton />

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {employees.map((p) => {
        const name = getEmployeeNameFromFull(p, locale)
        const title = p.title ?? ""
        const noSchedule = noScheduleById[p.id] === true
        const nearest = noSchedule ? null : nearestByEmployee[p.id] ?? null
        const isToday = nearest?.date === today
        const typeMeta = nearest ? getDeliveryTypeMeta(nearest.deliveryType) : null

        return (
          <WizardCard
            key={p.id}
            onClick={() => onSelect(p.id, name)}
            disabled={noSchedule}
            disabledReason={t("bookings.pos.disabled.employee")}
            className="px-4 py-3.5"
          >
            <div className="flex items-center gap-3 text-start">
              <EmployeeAvatar avatarUrl={p.avatarUrl} name={name} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {name}
                </span>
                {title && (
                  <span className="truncate text-xs text-muted-foreground">
                    {title}
                  </span>
                )}
                {nearest && typeMeta && (
                  <div
                    data-testid="step-employee-nearest-slot"
                    className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground tabular-nums"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <HugeiconsIcon
                        icon={typeMeta.icon}
                        size={14}
                        className="shrink-0 text-primary/70"
                      />
                      <span className="truncate font-medium text-foreground/80">
                        {t(typeMeta.labelKey)}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span aria-hidden="true">·</span>
                      <span className="truncate">
                        {isToday
                          ? t("bookings.wizard.step.employee.availableToday")
                          : t("bookings.wizard.step.employee.nextAvailable")}
                      </span>
                    </span>
                    {!isToday && (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span aria-hidden="true">·</span>
                        <span className="whitespace-nowrap text-foreground/70">
                          {formatLocalizedDate(nearest.date, locale)}
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <span aria-hidden="true">·</span>
                      <span className="whitespace-nowrap font-semibold text-foreground/90">
                        {nearest.time}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </WizardCard>
        )
      })}

      {employees.length === 0 && (
        <p
          data-testid={isEmployeeAllowed ? "step-employee-empty-filter" : undefined}
          className="col-span-full py-6 text-center text-sm text-muted-foreground"
        >
          {isEmployeeAllowed
            ? t("bookings.pos.package.filter.noOptions")
            : t("bookings.wizard.noEmployees")}
        </p>
      )}
    </div>
  )
}
