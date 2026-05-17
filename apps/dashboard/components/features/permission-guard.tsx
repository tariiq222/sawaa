"use client"

import type { ReactNode } from "react"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"
import { ListPageShell } from "@/components/features/list-page-shell"
import { Breadcrumbs } from "@/components/features/breadcrumbs"

interface PermissionGuardProps {
  module: string
  action: string
  children: ReactNode
}

export function PermissionGuard({ module, action, children }: PermissionGuardProps) {
  const { canDo } = useAuth()
  const { t } = useLocale()

  if (!canDo(module, action)) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">{t("common.noPermission")}</p>
        </div>
      </ListPageShell>
    )
  }

  return <>{children}</>
}
