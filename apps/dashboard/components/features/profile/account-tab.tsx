"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { LockPasswordIcon } from "@hugeicons/core-free-icons"

import { Avatar, AvatarFallback, AvatarImage, Button } from "@sawaa/ui"

import { ChangePasswordDialog } from "@/components/features/change-password-dialog"
import { ActiveBadge } from "@/components/features/status-badge"
import { FormSection } from "@/components/features/shared/form-section"
import { useAuth } from "@/components/providers/auth-provider"
import { useLocale } from "@/components/locale-provider"

/**
 * Account tab — read-only summary of the **global** User account fields.
 */
export function AccountTab() {
  const { t } = useLocale()
  const { user } = useAuth()
  const [passwordOpen, setPasswordOpen] = useState(false)

  const empty = t("profile.value.empty")
  const initials = (() => {
    const parts = user?.name?.trim().split(/\s+/).filter(Boolean) ?? []
    const i = parts.slice(0, 2).map((p) => p[0]).join("").toUpperCase()
    return i || user?.email?.[0]?.toUpperCase() || "—"
  })()

  const fields: Array<{ label: string; value: string }> = [
    { label: t("profile.field.name"), value: user?.name || empty },
    { label: t("profile.field.email"), value: user?.email || empty },
    { label: t("profile.field.phone"), value: user?.phone || empty },
    { label: t("profile.field.gender"), value: user?.gender || empty },
  ]

  return (
    <div className="flex flex-col gap-6">
      <FormSection title={t("profile.section.account")}>
        <div className="mb-6 flex items-center gap-4">
          <Avatar className="size-16">
            {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name ?? ""} /> : null}
            <AvatarFallback className="bg-primary text-base font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">{user?.name || empty}</h2>
            <span className="text-sm text-muted-foreground">{user?.email || empty}</span>
            <div className="mt-1">
              <ActiveBadge
                active={!!user?.isActive}
                label={user?.isActive ? t("users.status.active") : t("users.status.inactive")}
              />
            </div>
          </div>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.label} className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-sm text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      </FormSection>

      <FormSection title={t("profile.section.security")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              {t("profile.changePassword.title")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("profile.changePassword.desc")}
            </span>
          </div>
          <Button variant="outline" onClick={() => setPasswordOpen(true)} className="gap-2">
            <HugeiconsIcon icon={LockPasswordIcon} size={16} />
            {t("profile.changePassword.button")}
          </Button>
        </div>
      </FormSection>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  )
}
