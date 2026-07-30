import { UserFormPage } from "@/components/features/users/user-form-page"
import { PermissionGuard } from "@/components/features/permission-guard"

export default function CreateUserPage() {
  return (
    <PermissionGuard module="user" action="create">
      <UserFormPage mode="create" />
    </PermissionGuard>
  )
}
