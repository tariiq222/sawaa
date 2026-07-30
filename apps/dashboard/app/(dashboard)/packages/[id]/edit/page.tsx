"use client"

import { useParams } from "next/navigation"
import { PackageFormPage } from "@/components/features/packages/package-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function EditPackagePage() {
  const { id } = useParams<{ id: string }>()
  return (
    <PermissionGuard module="service" action="update">
      <PackageFormPage mode="edit" packageId={id} />
    </PermissionGuard>
  )
}
