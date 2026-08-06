"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { fetchIntakeForm } from "@/lib/api/intake-forms"
import { PermissionGuard } from "@/components/features/permission-guard"
import { useLocale } from "@/components/locale-provider"

export default function IntakeFormDetailRoute() {
  return (
    <PermissionGuard module="setting" action="read">
      <IntakeFormDetailInner />
    </PermissionGuard>
  )
}

function IntakeFormDetailInner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { t } = useLocale()
  const { data: form, isLoading, error } = useQuery({
    queryKey: ["intake-forms", "detail", id ?? ""],
    queryFn: () => fetchIntakeForm(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (!isLoading && !error && form) {
      router.replace(`/intake-forms/${id}/edit`)
    }
  }, [form, isLoading, error, id, router])

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>
  }

  return (
    <div className="p-6">
      <p className="text-muted-foreground">{t("common.redirectingToEdit")}</p>
    </div>
  )
}
