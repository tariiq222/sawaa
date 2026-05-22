"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, UserMultiple02Icon, UserCheck01Icon, ShieldKeyIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { ListPageShell } from "@/components/features/list-page-shell"
import { ErrorBanner } from "@/components/features/error-banner"
import { PageHeader } from "@/components/features/page-header"
import { StatsGrid } from "@/components/features/stats-grid"
import { StatCard } from "@/components/features/stat-card"
import { DataTable } from "@/components/features/data-table"
import { FilterBar } from "@/components/features/filter-bar"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { getUserColumns } from "@/components/features/users/user-columns"
import { RolesTab } from "@/components/features/users/roles-tab"
import { DeleteUserDialog } from "@/components/features/users/delete-user-dialog"
import { CreateRoleDialog } from "@/components/features/users/create-role-dialog"
import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@sawaa/ui"
import { useUsers, useRoles, useUserMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import { useAuth } from "@/components/providers/auth-provider"
import type { User } from "@/lib/types/user"

export function UserListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get("tab") === "roles" ? "roles" : "users"
  const { t, locale } = useLocale()
  const { canDo } = useAuth()
  const { users, meta, isLoading, error, search, setSearch } = useUsers()
  const canReadRoles = canDo("role", "read")
  const { data: roles } = useRoles({ enabled: canReadRoles })
  const { activateMut, deactivateMut } = useUserMutations()

  const [activeTab, setActiveTab] = useState(defaultTab)
  const [createRoleOpen, setCreateRoleOpen] = useState(false)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)

  const handleToggleActive = useCallback(async (user: User) => {
    try {
      if (user.isActive) {
        await deactivateMut.mutateAsync(user.id)
        toast.success(t("users.toast.deactivated"))
      } else {
        await activateMut.mutateAsync(user.id)
        toast.success(t("users.toast.activated"))
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.toast.actionFailed"))
    }
  }, [activateMut, deactivateMut, t])

  const canEditUser = canDo("user", "update")
  const canDeleteUser = canDo("user", "delete")
  const columns = getUserColumns(
    (canEditUser || canDeleteUser) ? {
      onEdit: canEditUser ? (u) => router.push(`/users/${u.id}/edit`) : undefined,
      onDelete: canDeleteUser ? setDeleteUser : undefined,
      onToggleActive: canEditUser ? handleToggleActive : undefined,
    } : undefined,
    t,
    locale,
  )
  const isUsersTab = activeTab === "users"
  const isRolesTab = activeTab === "roles"

  return (
    <ListPageShell>
      <Breadcrumbs />

      <PageHeader
        title={t("users.title")}
        description={t("users.description")}
      >
        {isUsersTab && canDo("User", "create") && (
          <Button className="gap-2 rounded-full px-5" onClick={() => router.push("/users/create")}>
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("users.addUser")}
          </Button>
        )}
        {isRolesTab && canDo("User", "create") && (
          <Button className="gap-2 rounded-full px-5" onClick={() => setCreateRoleOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} size={16} />
            {t("users.roles.createRole")}
          </Button>
        )}
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="users">{t("users.tabs.users")}</TabsTrigger>
          {canReadRoles && <TabsTrigger value="roles">{t("users.tabs.roles")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="users" className="mt-6 flex flex-col gap-6">
          {isLoading && !meta ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={`skeleton-${i}`} className="h-24 rounded-lg" />)}
            </div>
          ) : (
            <StatsGrid>
              <StatCard title={t("users.stats.total")} value={meta?.total ?? 0} icon={UserMultiple02Icon} iconColor="primary" />
              <StatCard title={t("users.stats.active")} value={users.filter((u) => u.isActive).length} icon={UserCheck01Icon} iconColor="success" />
              <StatCard title={t("users.stats.roles")} value={roles?.length ?? 0} icon={ShieldKeyIcon} iconColor="accent" />
              <StatCard title={t("users.stats.inactive")} value={users.filter((u) => !u.isActive).length} icon={UserCheck01Icon} iconColor="warning" />
            </StatsGrid>
          )}

          {error && <ErrorBanner message={error} />}

          <FilterBar
            search={{ value: search, onChange: setSearch, placeholder: t("users.searchPlaceholder") }}
            hasFilters={search.length > 0}
            onReset={() => setSearch("")}
            resultCount={meta && !isLoading ? `${meta.total} ${t("users.stats.total")}` : undefined}
          />

          {isLoading && users.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={`row-${i}`} className="h-12 rounded-lg" />)}
            </div>
          ) : (
            <DataTable columns={columns} data={users} emptyTitle={t("users.empty.title")} emptyDescription={t("users.empty.description")} emptyAction={canDo("User", "create") ? { label: t("users.addUser"), onClick: () => router.push("/users/create") } : undefined} />
          )}
        </TabsContent>

        {canReadRoles && <TabsContent value="roles" className="mt-6"><RolesTab /></TabsContent>}
      </Tabs>

      <CreateRoleDialog open={createRoleOpen} onOpenChange={setCreateRoleOpen} />
      <DeleteUserDialog user={deleteUser} open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)} />
    </ListPageShell>
  )
}
