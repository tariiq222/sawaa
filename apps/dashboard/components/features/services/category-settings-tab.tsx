"use client"

import { useQuery } from "@tanstack/react-query"
import { Button } from "@sawaa/ui"
import { getDirectClinicService } from "@sawaa/shared/catalog"

import { useLocale } from "@/components/locale-provider"
import { fetchServices } from "@/lib/api/services"
import { queryKeys } from "@/lib/query-keys"
import { BookingTypesEditor } from "./booking-types-editor"

interface CategorySettingsTabProps {
  categoryId: string | undefined
  mode: "create" | "edit"
  bookingMode?: "DIRECT" | "SERVICES"
}

export function CategorySettingsTab({
  categoryId,
  mode,
  bookingMode,
}: CategorySettingsTabProps) {
  const { t } = useLocale()

  if (mode === "create" || !categoryId) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("services.categories.settings.saveFirst")}
      </p>
    )
  }

  return (
    <CategorySettingsTabEdit
      categoryId={categoryId}
      useClinicTerminology={bookingMode === "DIRECT"}
    />
  )
}

function CategorySettingsTabEdit({
  categoryId,
  useClinicTerminology,
}: {
  categoryId: string
  useClinicTerminology: boolean
}) {
  const { t } = useLocale()
  const listFilters = { categoryId, limit: 100, includeHidden: true }

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.services.list(listFilters),
    queryFn: () => fetchServices(listFilters),
    staleTime: 5 * 60 * 1000,
  })

  const services = data?.items ?? []
  // DIRECT clinic settings must resolve the hidden row explicitly; a visible first row is never a substitute.
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
      <div className="flex flex-col items-start gap-3 rounded-md border border-border p-4">
        <p className="text-sm font-medium text-foreground">{t("services.categories.settings.internalServiceMissing.title")}</p>
        <p className="text-sm text-muted-foreground">{t("services.categories.settings.internalServiceMissing.desc")}</p>
        <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
          {t("services.categories.settings.internalServiceMissing.retry")}
        </Button>
      </div>
    )
  }

  return <BookingTypesEditor serviceId={directService.id} useClinicTerminology={useClinicTerminology} />
}
