"use client"

import { CategoryListPage } from "@/components/features/services/category-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function CategoriesRoute() {
  return (
    <PermissionGuard module="category" action="read">
      <CategoryListPage />
    </PermissionGuard>
  )
}
