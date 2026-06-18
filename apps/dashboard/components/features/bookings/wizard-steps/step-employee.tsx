"use client"

import { useMemo } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"

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

/* ─── Helpers ─── */

function getEmployeeNameFromFull(p: Employee, locale: string): string {
  if (locale === "ar" && p.nameAr) return p.nameAr
  return `${p.user.firstName} ${p.user.lastName}`.trim()
}

/* ─── Skeleton ─── */

function StepEmployeeSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="h-28 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}

/* ─── Step component ─── */

interface StepEmployeeProps {
  serviceId: string
  onSelect: (employeeId: string, employeeName: string) => void
}

export function StepEmployee({ serviceId, onSelect }: StepEmployeeProps) {
  const { t, locale } = useLocale()

  const { data: serviceEmployees, isLoading: loadingByService } = useQuery<ServiceEmployee[]>({
    queryKey: queryKeys.services.employees(serviceId),
    queryFn: () => fetchServiceEmployees(serviceId),
    enabled: !!serviceId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: allEmployees, isLoading: loadingAll } = useQuery({
    queryKey: queryKeys.employees.list({ isActive: true, perPage: 100 }),
    queryFn: () => fetchEmployees({ isActive: true, perPage: 100 }),
    enabled: !serviceId,
    staleTime: 5 * 60 * 1000,
  })

  const employees: Employee[] = useMemo(
    () =>
      serviceId
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
        : (allEmployees?.items ?? []).filter((p) => p.isActive),
    [serviceId, serviceEmployees, allEmployees],
  )

  // Fetch each candidate's weekly schedule in parallel. An employee with no
  // active availability window can never be booked, so the wizard disables it.
  const availabilityQueries = useQueries({
    queries: employees.map((p) => ({
      queryKey: queryKeys.employees.availability(p.id),
      queryFn: () => fetchAvailability(p.id),
      staleTime: 5 * 60 * 1000,
    })),
  })
  const noScheduleById = useMemo(() => {
    const map: Record<string, boolean> = {}
    employees.forEach((p, i) => {
      const q = availabilityQueries[i]
      // Only mark as "no schedule" once we have data; while loading keep it
      // enabled so a card is never wrongly disabled mid-fetch.
      if (q?.data !== undefined) {
        map[p.id] = !q.data.some((w) => w.isActive)
      }
    })
    return map
  }, [employees, availabilityQueries])

  if (loadingByService || loadingAll) return <StepEmployeeSkeleton />

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {employees.map((p) => {
        const name = getEmployeeNameFromFull(p, locale)
        const title = p.title ?? ""
        const noSchedule = noScheduleById[p.id] === true

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
              </div>
            </div>
          </WizardCard>
        )
      })}

      {employees.length === 0 && (
        <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
          {t("bookings.wizard.noEmployees")}
        </p>
      )}
    </div>
  )
}
