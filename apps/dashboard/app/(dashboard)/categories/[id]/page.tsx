"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { PermissionGuard } from "@/components/features/permission-guard"
import { useLocale } from "@/components/locale-provider"

export default function CategoryDetailRoute() {
  return (
    <PermissionGuard module="category" action="read">
      <CategoryDetailInner />
    </PermissionGuard>
  )
}

function CategoryDetailInner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useLocale()

  useEffect(() => {
    router.replace(`/categories/${id}/edit`)
  }, [id, router])

  return (
    <div className="p-6">
      <p className="text-muted-foreground">{t("common.redirectingToEdit")}</p>
    </div>
  )
}
