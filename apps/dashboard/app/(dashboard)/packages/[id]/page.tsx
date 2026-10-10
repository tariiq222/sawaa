"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { ErrorBanner } from "@/components/features/error-banner"
import { usePackage } from "@/hooks/use-packages"
import { PermissionGuard } from "@/components/features/permission-guard"
import { useLocale } from "@/components/locale-provider"

export default function PackageDetailRoute() {
  return (
    <PermissionGuard module="service" action="read">
      <PackageDetailInner />
    </PermissionGuard>
  )
}

function PackageDetailInner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useLocale()
  const { data: pkg, isLoading, error, refetch } = usePackage(id ?? "")

  useEffect(() => {
    if (!isLoading && !error && pkg) {
      router.replace(`/packages/${id}/edit`)
    }
  }, [pkg, isLoading, error, id, router])

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">{t("common.loading")}</div>
  }

  if (error) return <ErrorBanner message={t("common.errorLoading")} onRetry={() => refetch()} />
  if (!pkg) return <div className="p-6 text-muted-foreground">{t("packages.notFound.title")}</div>

  return (
    <div className="p-6">
      <p className="text-muted-foreground">{t("common.redirectingToEdit")}</p>
    </div>
  )
}
