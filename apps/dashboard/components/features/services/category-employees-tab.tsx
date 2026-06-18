"use client"

import { useQuery } from "@tanstack/react-query"

import { useLocale } from "@/components/locale-provider"
import { fetchServices } from "@/lib/api/services"
import { queryKeys } from "@/lib/query-keys"
import { ServiceEmployeesTab } from "./service-employees-tab"

interface CategoryEmployeesTabProps {
  categoryId: string | undefined
  mode: "create" | "edit"
}

export function CategoryEmployeesTab({
  categoryId,
  mode,
}: CategoryEmployeesTabProps) {
  const { t } = useLocale()

  if (mode === "create" || !categoryId) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("services.categories.settings.saveFirst")}
      </p>
    )
  }

  return <CategoryEmployeesTabEdit categoryId={categoryId} />
}

function CategoryEmployeesTabEdit({ categoryId }: { categoryId: string }) {
  const { t } = useLocale()

  const listFilters = { categoryId, perPage: 100, includeHidden: true }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.services.list(listFilters),
    queryFn: () => fetchServices(listFilters),
    staleTime: 5 * 60 * 1000,
  })

  const services = data?.items ?? []
  const hiddenService = services.find((s) => s.isHidden) ?? services[0]

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("services.categories.settings.creatingService")}
      </p>
    )
  }

  if (!hiddenService) {
    return (
      <div className="flex flex-col gap-2 py-6">
        <p className="text-sm font-medium text-foreground">
          {t("services.categories.employees.notReady.title")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("services.categories.employees.notReady.desc")}
        </p>
      </div>
    )
  }

  return (
    <ServiceEmployeesTab
      serviceId={hiddenService.id}
      serviceNameAr={hiddenService.nameAr}
      serviceNameEn={hiddenService.nameEn ?? undefined}
    />
  )
}
