"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import { ServiceFormPage } from "@/components/features/services/service-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function EditServicePage() {
  const params = useParams()
  return (
    <PermissionGuard module="service" action="update">
      <Suspense>
        <ServiceFormPage mode="edit" serviceId={params.id as string} />
      </Suspense>
    </PermissionGuard>
  )
}
