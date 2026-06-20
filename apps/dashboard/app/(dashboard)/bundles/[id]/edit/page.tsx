"use client"

import { useParams } from "next/navigation"
import { BundleFormPage } from "@/components/features/bundles/bundle-form-page"

export default function EditBundlePage() {
  const { id } = useParams<{ id: string }>()
  return <BundleFormPage mode="edit" bundleId={id} />
}
