"use client"

import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { PageHeader } from "@/components/features/page-header"
import { ServiceBreadcrumb } from "@/components/features/services/service-breadcrumb"
import { useLocale } from "@/components/locale-provider"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { formatRef } from "@/lib/utils"
import type { Service, ServiceCategory } from "@/lib/types/service"

interface ServiceFormPageHeaderProps {
  isEdit: boolean
  service?: Service
  categories: ServiceCategory[]
  categoryId?: string
}

export function ServiceFormPageHeader({ isEdit, service, categories, categoryId }: ServiceFormPageHeaderProps) {
  const { t, locale } = useLocale()
  const isAr = locale === "ar"
  const dir = isAr ? "rtl" : "ltr"
  const { options: departments } = useDepartmentOptions()
  const breadcrumbs = isEdit && service
    ? [{ label: t("nav.dashboard"), href: "/" }, { label: t("nav.services"), href: "/services" }, { label: isAr ? (service.nameAr ?? "…") : (service.nameEn ?? service.nameAr ?? "…"), href: `/services/${formatRef("SVC", service.ref)}/edit` }, { label: t("nav.edit") }]
    : undefined
  const category = categories.find((item) => item.id === (categoryId || service?.categoryId)) ?? service?.category ?? null
  const department = category?.department ?? departments.find((item) => item.id === category?.departmentId) ?? null

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      {category && (
        <ServiceBreadcrumb
          departmentName={department ? (isAr ? department.nameAr : (department.nameEn ?? department.nameAr)) : null}
          departmentId={department?.id}
          categoryName={isAr ? category.nameAr : (category.nameEn ?? category.nameAr)}
          categoryId={category.id}
          serviceName={isEdit && service ? (isAr ? (service.nameAr ?? "") : (service.nameEn ?? service.nameAr ?? "")) : t("services.create.title")}
          dir={dir}
        />
      )}
      <PageHeader
        title={t(isEdit ? "services.edit.title" : "services.create.pageTitle")}
        description={isEdit ? (isAr ? service?.nameAr : (service?.nameEn ?? service?.nameAr)) : t("services.create.pageDescription")}
      />
    </>
  )
}
