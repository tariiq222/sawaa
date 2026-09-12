import type { Service } from "./types/service"

export interface PackageEditorOption { value: string; label: string }

export function packageEmployeeLabel(employee: unknown, unavailable: string): string {
  const value = employee as { user?: { firstName?: string | null; lastName?: string | null }; firstName?: string | null; lastName?: string | null; name?: string | null; nameAr?: string | null; nameEn?: string | null }
  const userName = [value.user?.firstName, value.user?.lastName].filter(Boolean).join(" ")
  const directName = [value.firstName, value.lastName].filter(Boolean).join(" ")
  return userName || directName || value.nameAr || value.name || value.nameEn || unavailable
}

export function packageServiceLabel(service: Pick<Service, "nameAr" | "nameEn" | "isHidden" | "category">, locale: "ar" | "en"): string {
  const pick = (ar: string, en?: string | null) => locale === "ar" ? ar : en || ar
  if (!service.category) return pick(service.nameAr, service.nameEn)
  const clinic = pick(service.category.nameAr, service.category.nameEn)
  return service.isHidden ? clinic : `${clinic} › ${pick(service.nameAr, service.nameEn)}`
}
