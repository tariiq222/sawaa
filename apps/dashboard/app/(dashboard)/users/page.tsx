import { Suspense } from "react"
import { UserListPage } from "@/components/features/users/user-list-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function UsersRoute() {
  return (
    <PermissionGuard module="user" action="read">
      <Suspense>
        <UserListPage />
      </Suspense>
    </PermissionGuard>
  )
}
