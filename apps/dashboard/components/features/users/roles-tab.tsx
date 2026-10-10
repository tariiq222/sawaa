"use client"

import { forwardRef, useImperativeHandle, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { showApiError } from "@/lib/mutation-helpers"
import { cn } from "@/lib/utils"

import { Button } from "@sawaa/ui"
import { EmptyState } from "@/components/features/empty-state"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@sawaa/ui"

import { useRoles, usePermissions, useRoleMutations } from "@/hooks/use-users"
import { useAuth } from "@/components/providers/auth-provider"
import { ErrorBanner } from "@/components/features/error-banner"
import { useLocale } from "@/components/locale-provider"
import { PermissionMatrix, PermissionMatrixSkeleton } from "./permission-matrix"

export interface RolesTabHandle {
  highlightRole: (roleId: string) => void
}

export const RolesTab = forwardRef<RolesTabHandle>(function RolesTab(_props, ref) {
  const { t } = useLocale()
  const { canDo } = useAuth()
  const canManage = canDo("role", "manage")
  const canRead = canDo("role", "read")
  const { data: roles, isLoading: rolesLoading, error: rolesError, refetch: refetchRoles } = useRoles({ enabled: canRead })
  const { data: permissions, isLoading: permsLoading, error: permsError, refetch: refetchPermissions } = usePermissions({ enabled: canRead })
  const { deleteMut } = useRoleMutations()

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [highlightedRoleId, setHighlightedRoleId] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({
    highlightRole(roleId: string) {
      setHighlightedRoleId(roleId)
      window.setTimeout(() => {
        setHighlightedRoleId((current) => (current === roleId ? null : current))
      }, 2000)
    },
  }), [])

  const handleDelete = async () => {
    if (!deleteTarget || !canManage) return
    try {
      await deleteMut.mutateAsync(deleteTarget.id)
      toast.success(t("users.roles.deleted"))
      setDeleteTarget(null)
    } catch (err) {
      showApiError(err, { fallback: t("users.roles.deleteError"), t })
    }
  }

  if (!canRead) return null
  if (rolesError || permsError) return <ErrorBanner message={t("error.server")} onRetry={() => { void refetchRoles(); void refetchPermissions() }} />

  if (rolesLoading || permsLoading) {
    return (
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <PermissionMatrixSkeleton key={`skeleton-${i}`} />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Permission Matrix per Role */}
      {roles && roles.length === 0 ? (
        <EmptyState
          title={t("users.roles.empty.title")}
          description={t("users.roles.empty.description")}
        />
      ) : roles?.map((role) => (
        <div
          key={role.id}
          id={`role-${role.id}`}
          className={cn(
            "relative rounded-lg transition-shadow",
            highlightedRoleId === role.id && "ring-2 ring-primary",
          )}
        >
          <PermissionMatrix role={role} allPermissions={permissions ?? []} />
          {!role.isSystem && canManage && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 end-4 text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget({ id: role.id, name: role.name })}
            >
              <HugeiconsIcon icon={Delete02Icon} size={14} />
              <span className="sr-only">{t("common.delete")}</span>
            </Button>
          )}
        </div>
      ))}

      {/* Delete Confirmation Sheet */}
      <Sheet
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <SheetContent side="end" className="overflow-y-auto w-full sm:max-w-[45vw]">
          <SheetHeader>
            <SheetTitle>{t("users.roles.deleteTitle")}</SheetTitle>
            <SheetDescription>
              {t("users.roles.deleteConfirm")}{" "}
              <strong>{deleteTarget?.name}</strong>
            </SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? t("common.deleting") : t("common.delete")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
})
