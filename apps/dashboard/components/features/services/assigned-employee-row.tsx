"use client"

import { useState } from "react"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { SurfaceRow } from "@sawaa/ui"
import { useEmployeeServiceMutations } from "@/hooks/use-employee-mutations"
import { ActiveCell, BufferCell } from "@/components/features/shared/inline-edit-cells"
import { EmployeeAvatar } from "@/components/features/shared/employee-avatar"
import { toast } from "sonner"
import type { ServiceEmployee } from "@/lib/types/service"
import type { UpdateServicePayload } from "@/lib/types/employee"
import { EmployeeCustomPricingRow } from "./employee-custom-pricing-row"
import type { SetCustomPricingPayload } from "@/lib/api/employees"

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
  const minUnit = t("employees.services.minutes")

  const { updateMut, customPricingMut } = useEmployeeServiceMutations(employee.id)
  const isSaving =
    updateMut.isPending &&
    updateMut.variables?.serviceId === serviceId

  /* Optimistic isActive so the Switch flips immediately on click. */
  const [optimisticIsActive, setOptimisticIsActive] = useState<
    boolean | null
  >(null)
  const clearOptimistic = () => setOptimisticIsActive(null)

  const patchAssignment = (patch: UpdateServicePayload) => {
    updateMut.mutate(
      { serviceId, payload: patch },
      {
        onSettled: clearOptimistic,
        onError: () => toast.error(t("employees.services.inlineUpdateError")),
      },
    )
  }

  const handlePatchActive = (next: boolean) => {
    setOptimisticIsActive(next)
    patchAssignment({ isActive: next })
  }

  const displayedIsActive = optimisticIsActive ?? item.isActive

  return (
    <SurfaceRow
      variant="default"
      size="md"
      className="flex h-full flex-col gap-3"
    >
      {/* Header: avatar + name + active switch */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
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
            {item.availableTypes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {item.availableTypes.map((type) => (
                  <Badge key={type} variant="secondary" className="text-xs">
                    {type === "in_person"
                      ? t("services.bookingTypes.clinic")
                      : t("services.bookingTypes.online")}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <ActiveCell
          checked={displayedIsActive}
          isSaving={isSaving}
          ariaLabel={t("employees.services.inlineActiveAria")}
          onChange={handlePatchActive}
        />
      </div>

      {/* Buffer */}
      <div className="flex items-center justify-between gap-2 rounded-lg bg-surface-muted/40 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {t("employees.services.bufferMinutes")}:
        </span>
        <BufferCell
          value={item.bufferMinutes ?? 0}
          isSaving={isSaving}
          ariaLabel={t("employees.services.inlineBufferAria")}
          unitLabel={minUnit}
          emptyHintLabel={t("employees.services.inlineBufferEmpty")}
          onCommit={(next) => patchAssignment({ bufferMinutes: next })}
        />
      </div>

      {/* Custom pricing */}
      <EmployeeCustomPricingRow
        item={item}
        serviceId={serviceId}
        t={t}
        isSaving={customPricingMut.isPending && customPricingMut.variables?.serviceId === serviceId}
        onSave={(payload: SetCustomPricingPayload) =>
          customPricingMut.mutate(
            { serviceId, payload },
            { onError: () => toast.error(t("services.employees.customPricingSaveError")) },
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
