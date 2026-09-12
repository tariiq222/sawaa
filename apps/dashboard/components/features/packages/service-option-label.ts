/**
 * Package service picker label — Sawaa Dashboard
 *
 * Direct-booking clinics book through one hidden internal service, so the
 * clinic name is the only meaningful label for it. Services inside a
 * multi-service clinic read as «clinic › service».
 */

import type { Service } from "@/lib/types/service"

type LabelledService = Pick<Service, "nameAr" | "nameEn" | "isHidden" | "category">

export function serviceOptionLabel(service: LabelledService, locale: "ar" | "en"): string {
  const pick = (ar: string, en?: string | null) => (locale === "ar" ? ar : en || ar)
  const category = service.category
  if (!category) return pick(service.nameAr, service.nameEn)
  const clinicName = pick(category.nameAr, category.nameEn)
  if (service.isHidden) return clinicName
  return `${clinicName} › ${pick(service.nameAr, service.nameEn)}`
}
