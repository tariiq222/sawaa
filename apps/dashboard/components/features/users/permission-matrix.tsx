"use client"

import { Checkbox } from "@sawaa/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@sawaa/ui"
import { Badge } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import { useRoleMutations } from "@/hooks/use-users"
import { useLocale } from "@/components/locale-provider"
import { STANDARD_ACTION_ORDER } from "@sawaa/shared/constants/permissions-catalog"
import { toast } from "sonner"
import type { Role, Permission, RolePermissionPayload } from "@/lib/types/user"

interface Props {
  role: Role
  allPermissions: Permission[]
}

export function PermissionMatrix({ role, allPermissions }: Props) {
  const { t } = useLocale()
  const { setPermsMut } = useRoleMutations()

  // Group permissions by module — dynamic, driven by what the DB returns
  const moduleMap = new Map<string, string[]>()
  for (const p of allPermissions) {
    const resource = permissionResource(p)
    if (!resource) continue
    if (!moduleMap.has(resource)) moduleMap.set(resource, [])
    moduleMap.get(resource)!.push(p.action)
  }

  // Collect all unique actions across all modules for column headers
  // Order columns by the canonical catalog order, then any extras alphabetically
  const allActions = Array.from(new Set(allPermissions.map((p) => p.action))).sort(
    (a, b) => {
      const ai = STANDARD_ACTION_ORDER.indexOf(a as (typeof STANDARD_ACTION_ORDER)[number])
      const bi = STANDARD_ACTION_ORDER.indexOf(b as (typeof STANDARD_ACTION_ORDER)[number])
      if (ai !== -1 && bi !== -1) return ai - bi
      if (ai !== -1) return -1
      if (bi !== -1) return 1
      return a.localeCompare(b)
    },
  )

  const modules = Array.from(moduleMap.keys()).sort()

  // Build a set of "module:action" for quick lookup
  const rolePerms = new Set(
    role.permissions
      .map((p) => {
        const resource = permissionResource(p)
        return resource ? `${resource}:${p.action}` : null
      })
      .filter((key): key is string => Boolean(key)),
  )

  const isPending = setPermsMut.isPending

  const handleToggle = (module: string, action: string, checked: boolean) => {
    const nextPermissions = buildNextPermissions(role.permissions, {
      subject: module,
      action,
    }, checked)

    setPermsMut.mutate(
      { roleId: role.id, permissions: nextPermissions },
      { onError: () => toast.error(t("users.roles.permError")) },
    )
  }

  if (modules.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">{role.name}</CardTitle>
            <Badge variant="outline" className="text-[10px] tabular-nums">
              0 {t("users.roles.permCount")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("users.roles.noAvailablePermissions")}</p>
        </CardContent>
      </Card>
    )
  }

  // Translate action label — fallback to the raw action string
  const actionLabel = (action: string) => {
    const key = `users.roles.action.${action}`
    const translated = t(key as Parameters<typeof t>[0])
    return translated === key ? action : translated
  }

  // Translate module label — fallback to the raw module string
  const moduleLabel = (mod: string) => {
    const key = `users.roles.modules.${mod}`
    const translated = t(key as Parameters<typeof t>[0])
    return translated === key ? mod : translated
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">{role.name}</CardTitle>
          <div className="flex items-center gap-2">
            {role.isSystem && (
              <Badge variant="secondary" className="text-[10px]">
                {t("users.roles.system")}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {role.permissions.length} {t("users.roles.permCount")}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-start pe-4 pb-2 text-xs font-medium text-muted-foreground">
                  {t("users.roles.module")}
                </th>
                {allActions.map((action) => (
                  <th
                    key={action}
                    className="pb-2 text-center text-xs font-medium text-muted-foreground w-16 whitespace-nowrap px-1"
                  >
                    {actionLabel(action)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((mod) => {
                const moduleActions = moduleMap.get(mod) ?? []
                return (
                  <tr key={mod} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pe-4 text-sm font-medium text-foreground">
                      {moduleLabel(mod)}
                    </td>
                    {allActions.map((action) => {
                      const exists = moduleActions.includes(action)
                      const key = `${mod}:${action}`
                      const checked = rolePerms.has(key)

                      if (!exists) {
                        return (
                          <td key={action} className="py-2.5 text-center px-1">
                            <span className="text-muted-foreground/30">—</span>
                          </td>
                        )
                      }

                      return (
                        <td key={action} className="py-2.5 text-center px-1">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              handleToggle(mod, action, v === true)
                            }
                            disabled={isPending}
                            className="mx-auto"
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function permissionResource(permission: Pick<Permission, "module" | "subject">): string {
  return permission.subject ?? permission.module ?? ""
}

function buildNextPermissions(
  current: Permission[],
  target: RolePermissionPayload,
  checked: boolean,
): RolePermissionPayload[] {
  const byKey = new Map<string, RolePermissionPayload>()
  for (const permission of current) {
    const subject = permissionResource(permission)
    if (!subject) continue
    byKey.set(`${subject}:${permission.action}`, {
      subject,
      action: permission.action,
    })
  }

  const key = `${target.subject}:${target.action}`
  if (checked) {
    byKey.set(key, target)
  } else {
    byKey.delete(key)
  }

  return Array.from(byKey.values())
}

export function PermissionMatrixSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-8 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
