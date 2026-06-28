"use client"

import { useQuery } from "@tanstack/react-query"
import { HugeiconsIcon } from "@hugeicons/react"
import { ClinicIcon } from "@hugeicons/core-free-icons"

import { WizardCard } from "@/components/features/bookings/wizard-card"
import { useLocale } from "@/components/locale-provider"
import { queryKeys } from "@/lib/query-keys"
import { fetchCategories } from "@/lib/api/services"

/* ─── Skeleton ─── */

function StepCategorySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`skeleton-${i}`} className="h-16 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  )
}

/* ─── Step component ─── */

interface StepCategoryProps {
  departmentId: string
  onSelect: (
    categoryId: string,
    categoryName: string,
    bookingMode: "DIRECT" | "SERVICES" | null,
  ) => void
}

export function StepCategory({ departmentId, onSelect }: StepCategoryProps) {
  const { t, locale } = useLocale()

  const filters = { departmentId, isActive: true, limit: 100 }
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.services.categories(filters),
    queryFn: () => fetchCategories(filters),
    enabled: !!departmentId,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) return <StepCategorySkeleton />

  const categories = data?.items ?? []

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const name =
          locale === "ar" ? category.nameAr : (category.nameEn || category.nameAr)
        // Legacy categories (no bookingMode on the response) are treated as
        // SERVICES — the wizard always shows the service step.
        const bookingMode: "DIRECT" | "SERVICES" | null =
          category.bookingMode ?? null

        // _count.services counts only bookable (non-hidden) services.
        // DIRECT categories always have a single hidden internal service, so
        // their count is 0 — but they are never "empty" in the booking sense.
        const count = category._count?.services
        const isEmpty = bookingMode !== "DIRECT" && count === 0

        return (
          <WizardCard
            key={category.id}
            onClick={() => onSelect(category.id, name, bookingMode)}
            disabled={isEmpty}
            disabledReason={t("bookings.pos.disabled.category")}
            className="px-4 py-3.5"
          >
            <div className="flex items-center gap-3 text-start">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <HugeiconsIcon icon={ClinicIcon} size={18} className="text-primary" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                  {name}
                </span>
                {typeof count === "number" && (
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {count} {t("bookings.pos.category.servicesCount")}
                  </span>
                )}
              </div>
            </div>
          </WizardCard>
        )
      })}

      {categories.length === 0 && (
        <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
          {t("bookings.pos.empty.categories")}
        </p>
      )}
    </div>
  )
}
