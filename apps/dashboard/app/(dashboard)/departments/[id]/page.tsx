"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { PermissionGuard } from "@/components/features/permission-guard"
import { useLocale } from "@/components/locale-provider"

export default function DepartmentDetailRoute() {
  return (
    <PermissionGuard module="department" action="read">
      <DepartmentDetailInner />
    </PermissionGuard>
  )
}

function DepartmentDetailInner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useLocale()

  useEffect(() => {
    router.replace(`/departments/${id}/edit`)
  }, [id, router])

  return (
    <div className="p-6">
      <p className="text-muted-foreground">{t("common.redirectingToEdit")}</p>
    </div>
  )
}
