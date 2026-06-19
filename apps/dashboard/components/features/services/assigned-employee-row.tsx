"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { SurfaceRow } from "@sawaa/ui"
import { useEmployeeServiceMutations } from "@/hooks/use-employee-mutations"
import { EmployeeAvatar } from "@/components/features/shared/employee-avatar"
import { toast } from "sonner"
import type { ServiceEmployee } from "@/lib/types/service"
import { EmployeeCustomPricingRow } from "./employee-custom-pricing-row"

/* ─── Props ─── */

interface AssignedEmployeeRowProps {
  item: ServiceEmployee
  serviceId: string
  isAr: boolean
  t: (key: string) => string
  onEdit: () => void
  onView: () => void
}

/* ─── Component ─── */

export function AssignedEmployeeRow({
  item,
  serviceId,
  isAr,
  t,
  onEdit,
  onView,
}: AssignedEmployeeRowProps) {
  const { employee } = item
  const fullName = `${employee.user.firstName} ${employee.user.lastName}`
  const displayName = isAr && employee.nameAr ? employee.nameAr : fullName

  const { updateMut, durationsMut } = useEmployeeServiceMutations(employee.id)
  const isSaving =
    updateMut.isPending && updateMut.variables?.serviceId === serviceId

  const [optimisticActive, setOptimisticActive] = useState<boolean | null>(null)
  const displayedActive = optimisticActive ?? item.isActive

  const toggleActive = (next: boolean) => {
    setOptimisticActive(next)
    updateMut.mutate(
      { serviceId, payload: { isActive: next } },
      {
        onSettled: () => setOptimisticActive(null),
        onSuccess: () => toast.success(t("employees.services.inlineUpdateSuccess")),
        onError: () => toast.error(t("employees.services.inlineUpdateError")),
      },
    )
  }

  return (
    <SurfaceRow
      variant="default"
      size="md"
      className="flex h-full flex-col gap-3"
    >
      {/* Header: avatar + name + available types */}
      <div className="flex items-start gap-3 min-w-0">
        <EmployeeAvatar avatarUrl={employee.avatarUrl} name={displayName} className="size-10" />

        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{displayName}</span>
            {!employee.isActive && (
              <Badge variant="outline" className="text-xs text-warning border-warning/20 bg-warning/10">
                {t("services.employees.employeeInactive")}
              </Badge>
            )}
          </div>
          {employee.title && (
            <span className="text-xs text-muted-foreground">{employee.title}</span>
          )}
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2">
        <Label
          htmlFor={`active-${employee.id}`}
          className="cursor-pointer text-xs leading-none"
        >
          {t("services.create.isActive")}
        </Label>
        <Switch
          id={`active-${employee.id}`}
          checked={displayedActive}
          onCheckedChange={toggleActive}
          disabled={isSaving}
          className="scale-90"
          aria-label={t("employees.services.inlineActiveAria")}
        />
      </div>

      {/* Custom price + duration per delivery type */}
      <EmployeeCustomPricingRow
        item={item}
        serviceId={serviceId}
        employeeId={employee.id}
        t={t}
        isSaving={durationsMut.isPending && durationsMut.variables?.serviceId === serviceId}
        onSave={(payload) =>
          durationsMut.mutate(
            { serviceId, payload },
            {
              onSuccess: () => toast.success(t("services.employees.durations.saved")),
              onError: () => toast.error(t("services.employees.durations.saveError")),
            },
          )
        }
      />

      {/* Footer actions */}
      <div className="mt-auto flex items-center justify-end gap-2 border-t border-border/60 pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onEdit}
        >
          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} className="size-3.5" />
          {t("common.edit")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onView}
        >
          {t("common.view")}
          <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} className="size-3.5" />
        </Button>
      </div>
    </SurfaceRow>
  )
}
