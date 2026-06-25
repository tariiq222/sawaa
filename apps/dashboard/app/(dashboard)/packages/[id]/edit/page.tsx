"use client"

import { useParams } from "next/navigation"
import { PackageFormPage } from "@/components/features/packages/package-form-page"

export default function EditPackagePage() {
  const { id } = useParams<{ id: string }>()
  return <PackageFormPage mode="edit" packageId={id} />
}
