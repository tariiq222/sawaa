"use client"

import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { PencilEdit01Icon, File01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@deqah/ui"
import { Badge } from "@deqah/ui"
import { Skeleton } from "@deqah/ui"
import { useIntakeForms } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"

interface Props {
  serviceId: string
}

export function IntakeFormsTab({ serviceId }: Props) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const isAr = locale === "ar"
  const { data: forms, isLoading } = useIntakeForms(serviceId)

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    )
  }

  if (!forms || forms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <HugeiconsIcon icon={File01Icon} strokeWidth={1.5} className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {t("services.intake.emptyTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("services.intake.emptyDesc")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {forms.map((form) => (
        <div
          key={form.id}
          className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {isAr ? form.nameAr : (form.nameEn ?? form.nameAr)}
              </span>
              {!form.isActive && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {t("services.intake.inactive")}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {form.fields.length} {t("services.intake.fields")}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => router.push(`/intake-forms/${form.id}/edit`)}
          >
            <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} className="size-3.5" />
            {t("common.edit")}
          </Button>
        </div>
      ))}
    </div>
  )
}
