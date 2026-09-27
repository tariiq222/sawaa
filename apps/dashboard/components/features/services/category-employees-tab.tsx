"use client"

import { useQuery } from "@tanstack/react-query"
import { Button } from "@sawaa/ui"
import { getDirectClinicService } from "@sawaa/shared/catalog"

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

  const listFilters = { categoryId, limit: 100, includeHidden: true }

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.services.list(listFilters),
    queryFn: () => fetchServices(listFilters),
    staleTime: 5 * 60 * 1000,
  })

  const services = data?.items ?? []
  // Employee assignments edit the same hidden DIRECT row used by booking settings.
  // See docs/architecture/clinic-service-booking-contract.md.
  const directService = getDirectClinicService(services)

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("services.categories.settings.loadingService")}
      </p>
    )
  }

  if (error || !directService) {
    return (
      <div className="flex flex-col gap-2 py-6">
        <p className="text-sm font-medium text-foreground">
          {t("services.categories.settings.internalServiceMissing.title")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("services.categories.settings.internalServiceMissing.desc")}
        </p>
        <Button type="button" variant="outline" className="w-fit" onClick={() => void refetch()} disabled={isFetching}>
          {t("services.categories.settings.internalServiceMissing.retry")}
        </Button>
      </div>
    )
  }

  return (
    <ServiceEmployeesTab
      serviceId={directService.id}
      serviceNameAr={directService.nameAr}
      serviceNameEn={directService.nameEn ?? undefined}
    />
  )
}
