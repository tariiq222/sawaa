"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@sawaa/ui"
import { Button } from "@sawaa/ui"
import { SurfaceRow } from "@sawaa/ui"
import { useEmployeeServiceMutations } from "@/hooks/use-employee-mutations"
import { EmployeeAvatar } from "@/components/features/shared/employee-avatar"
import { toast } from "sonner"
import type { ServiceEmployee } from "@/lib/types/service"
import { EmployeeCustomPricingRow } from "./employee-custom-pricing-row"
import { EmployeeServiceToggles } from "./employee-service-toggles"
import { EmployeeWorkingInfo } from "./employee-working-info"

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
    updateMut.isPending &&
    updateMut.variables?.serviceId === serviceId

  return (
    <SurfaceRow
      variant="default"
      size="md"
      className="flex h-full flex-col gap-3"
    >
      {/* Header: avatar + name */}
      <div className="flex items-start gap-2">
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
      </div>

      {/* Working info: branches + schedule */}
      <EmployeeWorkingInfo
        employeeId={employee.id}
        branchIds={employee.branchIds}
      />

      {/* Settings toggles card */}
      <EmployeeServiceToggles
        item={item}
        serviceId={serviceId}
        isSaving={isSaving}
        t={t}
      />

      {/* Practitioner durations editor */}
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
