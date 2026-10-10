import type { CreateCategoryFormData, EditCategoryFormData } from "@/lib/schemas/service.schema"
import type { UpdateCategoryPayload } from "@/lib/types/service-payloads"

export function buildCategoryCreatePayload(data: EditCategoryFormData): CreateCategoryFormData {
  const departmentId = !data.departmentId || data.departmentId === "__none__" ? undefined : data.departmentId
  return {
    nameAr: data.nameAr!,
    nameEn: data.nameEn || undefined,
    sortOrder: data.sortOrder,
    departmentId,
    kind: data.kind ?? "CLINIC",
    bookingMode: data.kind === "SERVICE_GROUP" ? "SERVICES" : (data.bookingMode ?? "DIRECT"),
    iconName: data.iconName ?? undefined,
    iconBgColor: data.iconBgColor ?? undefined,
  }
}

export function buildCategoryUpdatePayload(
  id: string,
  data: EditCategoryFormData,
  imageUrl: string | null | undefined,
  departmentId: string | null,
): UpdateCategoryPayload & { id: string } {
  return {
    id,
    nameAr: data.nameAr,
    nameEn: data.nameEn === undefined ? undefined : (data.nameEn || null),
    sortOrder: data.sortOrder,
    isActive: data.isActive,
    departmentId,
    kind: data.kind,
    iconName: data.iconName,
    iconBgColor: data.iconBgColor,
    imageUrl,
  }
}
