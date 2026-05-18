"use client"

import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserIcon } from "@hugeicons/core-free-icons"
import Image from "next/image"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchEmployees } from "@/lib/api/employees"
import { fetchServiceEmployees } from "@/lib/api/services"
import type { Employee } from "@/lib/types/employee"
import type { ServiceEmployee } from "@/lib/types/service"

/* ─── Helpers ─── */

function getEmployeeNameFromFull(p: Employee, locale: string): string {
  if (locale === "ar" && p.nameAr) return p.nameAr
  return `${p.user.firstName} ${p.user.lastName}`.trim()
}

/* ─── Skeleton ─── */

function StepEmployeeSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="h-28 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}

/* ─── Avatar ─── */

interface EmployeeAvatarProps {
  avatarUrl: string | null | undefined
  name: string
}

function EmployeeAvatar({ avatarUrl, name }: EmployeeAvatarProps) {
  if (avatarUrl) {
    return (
      <div className="relative size-9 shrink-0 overflow-hidden rounded-full">
        <Image
          src={avatarUrl}
          alt={name}
          fill
          className="object-cover"
          sizes="36px"
        />
      </div>
    )
  }

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
      <HugeiconsIcon icon={UserIcon} size={18} className="text-primary" />
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

  if (loadingByService || loadingAll) return <StepEmployeeSkeleton />

  const employees: Employee[] = serviceId
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

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {employees.map((p) => {
        const name = getEmployeeNameFromFull(p, locale)
        const title = p.title ?? ""

        return (
          <WizardCard
            key={p.id}
            onClick={() => onSelect(p.id, name)}
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
