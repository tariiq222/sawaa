import { Suspense } from "react"
import { CategoryFormPage } from "@/components/features/services/category-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function CreateCategoryRoute() {
  return (
    <PermissionGuard module="category" action="create">
      <Suspense>
        <CategoryFormPage mode="create" />
      </Suspense>
    </PermissionGuard>
  )
}
