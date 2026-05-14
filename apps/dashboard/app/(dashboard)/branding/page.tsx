"use client"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Skeleton } from "@deqah/ui"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { useLocale } from "@/components/locale-provider"
import { useBranding, useUpdateBranding } from "@/hooks/use-branding"
import { useAuth } from "@/components/providers/auth-provider"

import { BrandingForm } from "@/components/features/branding/branding-form"
import type { UpdateBrandingPayload } from "@/lib/types/branding"

export default function BrandingPage() {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const { data: branding, isLoading } = useBranding()
  const mutation = useUpdateBranding()

  if (!canDo("branding", "edit")) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">{t("common.noPermission")}</p>
        </div>
      </ListPageShell>
    )
  }

  const handleSave = (data: UpdateBrandingPayload) => {
    mutation.mutate(data)
  }

  if (isLoading) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader title={t("branding.title")} description={t("branding.description")} />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full sm:w-96" />
          <Skeleton className="h-[300px] rounded-lg" />
        </div>
      </ListPageShell>
    )
  }

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={t("branding.title")} description={t("branding.description")} />

      <BrandingForm
        branding={branding ?? null}
        onSave={handleSave}
        isPending={mutation.isPending}
      />
    </ListPageShell>
  )
}
