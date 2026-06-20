"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Delete02Icon } from "@hugeicons/core-free-icons"

import { Button, Label, Switch, SurfaceRow } from "@sawaa/ui"
import { EmployeeAvatar } from "@/components/features/shared/employee-avatar"
import { useRouter } from "next/navigation"
import { useLocale } from "@/components/locale-provider"

interface PendingEmployee {
  id: string
  avatarUrl?: string | null
  nameAr?: string | null
  specialty?: string | null
  specialtyAr?: string | null
  user: { firstName: string; lastName: string }
}

interface PendingEmployeeRowProps {
  employee: PendingEmployee
  isActive: boolean
  onActiveChange: (next: boolean) => void
  onRemove: () => void
}

export function PendingEmployeeRow({
  employee,
  isActive,
  onActiveChange,
  onRemove,
}: PendingEmployeeRowProps) {
  const { t, locale } = useLocale()
  const router = useRouter()
  const isAr = locale === "ar"
  const fullName = `${employee.user.firstName} ${employee.user.lastName}`
  const displayName = isAr && employee.nameAr ? employee.nameAr : fullName
  const specialty = isAr ? (employee.specialtyAr || employee.specialty) : employee.specialty

  return (
    <SurfaceRow variant="default" size="md" className="flex h-full flex-col gap-3">
      {/* Header: avatar + name + toggles card + delete */}
      <div className="flex items-center gap-3 min-w-0">
        <EmployeeAvatar avatarUrl={employee.avatarUrl} name={displayName} className="size-10 shrink-0" />

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
          <span className="text-sm font-medium text-foreground">{displayName}</span>
          {specialty && (
            <span className="text-xs text-muted-foreground">{specialty}</span>
          )}
        </div>

        {/* Toggles card */}
        <div className="ms-auto flex shrink-0 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
          <div className="flex items-center gap-2">
            <Label
              htmlFor={`pending-active-${employee.id}`}
              className="cursor-pointer text-xs font-medium text-foreground"
            >
              {t("services.create.isActive")}
            </Label>
            <Switch
              id={`pending-active-${employee.id}`}
              checked={isActive}
              onCheckedChange={onActiveChange}
              size="sm"
            />
          </div>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Label className="cursor-not-allowed text-xs font-medium text-muted-foreground">
              {t("services.employees.durations.customPricing")}
            </Label>
            <Switch
              checked={false}
              disabled
              size="sm"
            />
          </div>
        </div>

        {/* Delete button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-error"
          onClick={onRemove}
        >
          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-4" />
        </Button>
      </div>

      {/* Custom pricing note */}
      <p className="text-xs text-muted-foreground">
        {t("services.employees.customPricingAfterSave")}
      </p>

      {/* Footer */}
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => router.push(`/employees/${employee.id}/edit`)}
        >
          {t("common.view")}
          <HugeiconsIcon
            icon={ArrowRight01Icon}
            strokeWidth={2}
            className="size-3.5 rtl:rotate-180"
          />
        </Button>
      </div>
    </SurfaceRow>
  )
}
