"use client"

import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { Building02Icon } from "@hugeicons/core-free-icons"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchDepartments } from "@/lib/api/departments"

/* ─── Skeleton ─── */

function StepDepartmentSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="h-16 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}

/* ─── Step component ─── */

interface StepDepartmentProps {
  onSelect: (departmentId: string, departmentName: string) => void
}

export function StepDepartment({ onSelect }: StepDepartmentProps) {
  const { t, locale } = useLocale()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.departments.list({ isActive: true, perPage: 100 }),
    queryFn: () => fetchDepartments({ isActive: true, perPage: 100 }),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return <StepDepartmentSkeleton />

  const departments = data?.items ?? []

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {departments.map((department) => {
        const name =
          locale === "ar" ? department.nameAr : (department.nameEn || department.nameAr)
        // bookableCategoriesCount is optional on older payloads; only disable
        // when the backend explicitly reports zero bookable categories.
        const isEmpty = department.bookableCategoriesCount === 0

        return (
          <WizardCard
            key={department.id}
            onClick={() => onSelect(department.id, name)}
            disabled={isEmpty}
            disabledReason={t("bookings.pos.disabled.department")}
            className="px-4 py-3.5"
          >
            <div className="flex items-center gap-3 text-start">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <HugeiconsIcon icon={Building02Icon} size={18} className="text-primary" />
              </div>
              <span className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
                {name}
              </span>
            </div>
          </WizardCard>
        )
      })}

      {departments.length === 0 && (
        <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
          {t("bookings.pos.empty.departments")}
        </p>
      )}
    </div>
  )
}
