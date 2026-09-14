"use client"

import { useParams } from "next/navigation"
import { PermissionGuard } from "@/components/features/permission-guard"
import { PackageFamilyFormPage } from "@/components/features/packages/package-family-form-page"

export default function EditPackageFamilyPage() {
  const { id } = useParams<{ id: string }>()
  return <PermissionGuard module="service" action="update"><PackageFamilyFormPage mode="edit" familyId={id} /></PermissionGuard>
}
