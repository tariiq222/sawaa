"use client"

import Link from "next/link"
import { useLocale } from "@/components/locale-provider"
import { formatRef } from "@/lib/utils"
import type { CreateCategoryContext } from "@/components/features/services/service-form-context"

export function ServiceCategoryContextNotice({ context }: { context: CreateCategoryContext }) {
  const { t } = useLocale()
  if (context.status === "valid") return null

  const messageKey = context.status === "loading"
    ? "services.create.categoryContextLoading"
    : context.status === "error"
      ? "services.create.categoryContextError"
      : context.status === "direct"
        ? "services.create.categoryContextDirect"
        : "services.create.categoryContextInvalid"
  const href = context.status === "direct"
    ? `/categories/${formatRef("CAT", context.category.ref)}/edit?tab=info`
    : "/categories"

  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
      <span>{t(messageKey)}</span>
      <Link href={href} className="font-medium underline underline-offset-4">
        {t("services.create.categoryContextManage")}
      </Link>
    </div>
  )
}
