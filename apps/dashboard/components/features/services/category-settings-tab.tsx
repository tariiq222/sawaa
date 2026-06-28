"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useLocale } from "@/components/locale-provider"
import { useServiceMutations } from "@/hooks/use-services"
import { fetchServices } from "@/lib/api/services"
import { queryKeys } from "@/lib/query-keys"
import { BookingTypesEditor } from "./booking-types-editor"

interface CategorySettingsTabProps {
  categoryId: string | undefined
  mode: "create" | "edit"
  categoryNameAr: string
  bookingMode?: "DIRECT" | "SERVICES"
}

export function CategorySettingsTab({
  categoryId,
  mode,
  categoryNameAr,
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
      categoryNameAr={categoryNameAr}
      useClinicTerminology={bookingMode === "DIRECT"}
    />
  )
}

function CategorySettingsTabEdit({
  categoryId,
  categoryNameAr,
  useClinicTerminology,
}: {
  categoryId: string
  categoryNameAr: string
  useClinicTerminology: boolean
}) {
  const { t } = useLocale()
  const queryClient = useQueryClient()
  const { createMut } = useServiceMutations()
  const createdRef = useRef(false)
  const [createdServiceId, setCreatedServiceId] = useState<string | null>(null)

  const listFilters = { categoryId, limit: 100, includeHidden: true }

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.services.list(listFilters),
    queryFn: () => fetchServices(listFilters),
    staleTime: 5 * 60 * 1000,
  })

  const services = data?.items ?? []

  // Auto-create the hidden internal service when 0 services exist
  useEffect(() => {
    if (isLoading) return
    if (services.length > 0) return
    if (createdRef.current) return
    if (createMut.isPending) return

    createdRef.current = true
    createMut
      .mutateAsync({
        nameAr: categoryNameAr || "خدمة",
        nameEn: categoryNameAr || "Service",
        categoryId,
        durationMins: 30,
        price: 0,
        isHidden: true,
      })
      .then((created) => {
        setCreatedServiceId(created.id)
        queryClient.invalidateQueries({
          queryKey: queryKeys.services.list(listFilters),
        })
      })
      .catch(() => {
        // allow retry on next render
        createdRef.current = false
        toast.error(t("services.categories.settings.createServiceFailed"))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, services.length])

  if (isLoading || createMut.isPending) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("services.categories.settings.creatingService")}
      </p>
    )
  }

  const serviceId = services[0]?.id ?? createdServiceId

  if (!serviceId) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("services.categories.settings.creatingService")}
      </p>
    )
  }

  return <BookingTypesEditor serviceId={serviceId} useClinicTerminology={useClinicTerminology} />
}
