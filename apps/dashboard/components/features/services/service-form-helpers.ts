import { setServiceBookingTypes } from "@/lib/api/services"
import type { CreateServiceFormData } from "@/components/features/services/create/form-schema"
import type { DraftBookingType } from "@/components/features/services/booking-types-editor"

export function buildPayload(data: CreateServiceFormData) {
  return {
    nameEn: data.nameEn,
    nameAr: data.nameAr,
    descriptionEn: data.descriptionEn || undefined,
    descriptionAr: data.descriptionAr || undefined,
    categoryId: data.categoryId || undefined,
    isActive: data.isActive,
    isHidden: data.isHidden,
    hidePriceOnBooking: data.hidePriceOnBooking,
    hideDurationOnBooking: data.hideDurationOnBooking,
    iconName: data.iconName ?? null,
    iconBgColor: data.iconBgColor ?? null,
    imageUrl: data.imageUrl?.startsWith("blob:") ? undefined : (data.imageUrl ?? null),
    bufferMinutes: data.bufferMinutes,
    depositEnabled: data.depositEnabled,
    depositAmount: data.depositEnabled ? (data.depositAmount ?? undefined) : undefined,
    allowRecurring: data.allowRecurring,
    allowedRecurringPatterns: data.allowedRecurringPatterns as import("@/lib/types/service").RecurringPattern[] | undefined,
    maxRecurrences: data.maxRecurrences,
    maxParticipants: data.maxParticipants,
    minLeadMinutes: data.minLeadMinutes,
    maxAdvanceDays: data.maxAdvanceDays,
  }
}

export function buildBookingTypesPayload(bookingTypes: DraftBookingType[]) {
  return bookingTypes.filter((bt) => bt.enabled).map((d) => ({
    bookingType: d.bookingType,
    price: Math.round(d.price * 100),
    durationMins: d.durationMins,
    isActive: true,
  }))
}

export async function saveBookingTypesApi(serviceId: string, bookingTypes: DraftBookingType[]) {
  const types = buildBookingTypesPayload(bookingTypes)
  if (types.length === 0) return
  await setServiceBookingTypes(serviceId, { types })
}

export async function saveBookingTypesMutation(
  serviceId: string,
  bookingTypes: DraftBookingType[],
  mutation: { mutateAsync: (payload: { types: ReturnType<typeof buildBookingTypesPayload> }) => Promise<unknown> },
) {
  const types = buildBookingTypesPayload(bookingTypes)
  if (types.length === 0) return
  await mutation.mutateAsync({ types })
}
