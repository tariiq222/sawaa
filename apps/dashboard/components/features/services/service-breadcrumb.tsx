"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

interface ServiceBreadcrumbProps {
  departmentName?: string | null
  departmentId?: string | null
  categoryName?: string | null
  categoryId?: string | null
  serviceName: string
  dir: "rtl" | "ltr"
}

export function ServiceBreadcrumb({
  departmentName,
  departmentId,
  categoryName,
  categoryId,
  serviceName,
  dir,
}: ServiceBreadcrumbProps) {
  if (!categoryName) return null

  const chevronClass = `shrink-0 ${dir === "rtl" ? "rotate-180" : ""}`

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
      {departmentName && departmentId && (
        <>
          <a
            href={`/categories?departmentId=${departmentId}`}
            className="hover:text-foreground transition-colors"
          >
            {departmentName}
          </a>
          <HugeiconsIcon icon={ArrowRight01Icon} size={10} className={chevronClass} />
        </>
      )}
      {categoryId && (
        <>
          <a
            href={`/categories/${categoryId}/edit`}
            className="hover:text-foreground transition-colors"
          >
            {categoryName}
          </a>
          <HugeiconsIcon icon={ArrowRight01Icon} size={10} className={chevronClass} />
        </>
      )}
      {!categoryId && categoryName && (
        <>
          <span>{categoryName}</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={10} className={chevronClass} />
        </>
      )}
      <span className="text-foreground font-medium">{serviceName}</span>
    </div>
  )
}
