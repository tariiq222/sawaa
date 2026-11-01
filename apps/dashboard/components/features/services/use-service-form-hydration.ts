"use client"

import { useEffect, useRef, type RefObject } from "react"
import type { UseFormReturn } from "react-hook-form"
import type { CreateServiceFormData } from "@/components/features/services/create/form-schema"
import type { Service } from "@/lib/types/service"
import { halalasToSar } from "@/lib/money"

/**
 * Hydration guard for the service edit form: signedImageQueryOptions
 * refetches the detail every ~4 minutes to rotate the presigned imageUrl, and
 * each response is a new object — resetting on object identity would wipe
 * unsaved edits. A full reset therefore happens only when the service id
 * changes (first load or navigation to another service); a rotation of the
 * same id refreshes imageUrl alone, and only while the user is not holding a
 * pending file / blob preview or an explicit removal.
 */
export function useServiceFormHydration(
  form: UseFormReturn<CreateServiceFormData>,
  service: Service | null | undefined,
  isEdit: boolean,
  pendingAvatarFile: RefObject<File | null>,
) {
  const hydratedServiceId = useRef<string | null>(null)
  useEffect(() => {
    if (!service || !isEdit) return
    const formImageUrl = form.getValues("imageUrl")
    const userOwnsImageState = pendingAvatarFile.current !== null ||
      formImageUrl === null ||
      formImageUrl?.startsWith("blob:")
    if (hydratedServiceId.current === service.id) {
      if (service.imageUrl && !userOwnsImageState) {
        form.setValue("imageUrl", service.imageUrl, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: false,
        })
      }
      return
    }
    hydratedServiceId.current = service.id
    form.reset({
      nameEn: service.nameEn ?? "",
      nameAr: service.nameAr,
      descriptionEn: service.descriptionEn ?? "",
      descriptionAr: service.descriptionAr ?? "",
      categoryId: service.categoryId ?? "",
      isActive: service.isActive,
      isHidden: service.isHidden,
      hidePriceOnBooking: service.hidePriceOnBooking,
      hideDurationOnBooking: service.hideDurationOnBooking,
      iconName: service.iconName ?? null,
      iconBgColor: service.iconBgColor ?? null,
      imageUrl: service.imageUrl ?? null,
      bufferMinutes: service.bufferMinutes ?? undefined,
      depositEnabled: service.depositEnabled,
      depositAmount: service.depositAmount != null ? halalasToSar(service.depositAmount) : null,
      minLeadMinutes: service.minLeadMinutes ?? null,
      maxAdvanceDays: service.maxAdvanceDays ?? null,
    })
  }, [service, isEdit, form, pendingAvatarFile])
}
