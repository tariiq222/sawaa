import { Suspense } from "react"
import { UserListPage } from "@/components/features/users/user-list-page"

export default function UsersRoute() {
  return (
    <Suspense>
      <UserListPage />
    </Suspense>
  )
}
