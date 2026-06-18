"use client"

import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Button, Badge, Skeleton } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { fetchServices } from "@/lib/api/services"
import { queryKeys } from "@/lib/query-keys"
import { useLocale } from "@/components/locale-provider"

interface Props {
  categoryId: string | undefined
}

export function CategoryServicesTab({ categoryId }: Props) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const isAr = locale === "ar"

  const listFilters = { categoryId: categoryId!, perPage: 50, includeHidden: false }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.services.list(listFilters),
    queryFn: () => fetchServices(listFilters),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  })

  if (!categoryId) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("services.categories.services.saveFirst")}
      </p>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full rounded" />
        <Skeleton className="h-10 w-full rounded" />
        <Skeleton className="h-10 w-full rounded" />
      </div>
    )
  }

  const services = data?.items ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => router.push("/services/create")}
        >
          <HugeiconsIcon icon={Add01Icon} size={16} className="me-1.5" />
          {t("services.categories.services.addService")}
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-sm font-medium text-foreground">
            {t("services.categories.services.empty")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("services.categories.services.emptyDesc")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {services.map((svc) => {
            const primary = isAr ? svc.nameAr : (svc.nameEn ?? svc.nameAr)
            const secondary = isAr ? svc.nameEn : svc.nameAr
            return (
              <li
                key={svc.id}
                className="flex items-center justify-between rounded-md border border-border px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{primary}</span>
                  {secondary && primary !== secondary && (
                    <span className="text-xs text-muted-foreground">{secondary}</span>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={
                    svc.isActive
                      ? "border-success/30 bg-success/10 text-success"
                      : "border-muted-foreground/30 bg-muted text-muted-foreground"
                  }
                >
                  {svc.isActive
                    ? t("services.categories.status.active")
                    : t("services.categories.status.inactive")}
                </Badge>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
