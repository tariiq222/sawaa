"use client"
import { Suspense } from "react"
import { useParams } from "next/navigation"
import { CategoryFormPage } from "@/components/features/services/category-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function EditCategoryRoute() {
  const params = useParams()
  return (
    <PermissionGuard module="category" action="update">
      <Suspense>
        <CategoryFormPage mode="edit" categoryId={params.id as string} />
      </Suspense>
    </PermissionGuard>
  )
}
