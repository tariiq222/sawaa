"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetHeader,
  SheetTitle,
  Skeleton,
} from "@sawaa/ui"
import { toast } from "sonner"

import { useLocale } from "@/components/locale-provider"
import { useServiceEmployees } from "@/hooks/use-services"
import { useEmployeeServiceMutations } from "@/hooks/use-employee-mutations"
import { EmployeeAvatar } from "@/components/features/shared/employee-avatar"
import { EmployeeServiceToggles } from "@/components/features/services/employee-service-toggles"
import { EmployeeCustomPricingRow } from "@/components/features/services/employee-custom-pricing-row"
import type { EmployeeService } from "@/lib/types/employee"

/* ─── Props ─── */

interface EditEmployeeServiceSheetProps {
  employeeId: string
  employeeService: EmployeeService | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function EditEmployeeServiceSheet({
  employeeId: _employeeId,
  employeeService: ps,
  open,
  onOpenChange,
}: EditEmployeeServiceSheetProps) {
  const { locale, t } = useLocale()

  const serviceId = ps?.serviceId ?? ""
  const { data: serviceEmployees, isLoading } = useServiceEmployees(serviceId)

  // Find the ServiceEmployee record for this specific EmployeeService assignment
  // (matched by EmployeeService.id which equals ServiceEmployee.id)
  const serviceEmployee = serviceEmployees?.find((se) => se.id === ps?.id)

  const { durationsMut, deliveryTypesMut, pricingModeMut } = useEmployeeServiceMutations(
    serviceEmployee?.employee.id ?? "",
  )

  const isAr = locale === "ar"

  const serviceName = ps ? (isAr ? ps.service.nameAr : ps.service.nameEn) : ""

  // Identity of the practitioner whose pricing this sheet edits — resolved
  // once the ServiceEmployee record loads. Same display logic as the row.
  const emp = serviceEmployee?.employee
  const employeeName = emp
    ? isAr && emp.nameAr
      ? emp.nameAr
      : `${emp.user.firstName} ${emp.user.lastName}`
    : ""

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          {emp ? (
            <div className="flex items-center gap-3">
              <EmployeeAvatar
                avatarUrl={emp.avatarUrl}
                name={employeeName}
                className="size-10"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <SheetTitle className="truncate">{employeeName}</SheetTitle>
                <SheetDescription className="truncate">
                  {serviceName}
                </SheetDescription>
              </div>
            </div>
          ) : (
            <>
              <SheetTitle>{serviceName}</SheetTitle>
              <SheetDescription>
                {t("employees.services.editDesc")}
              </SheetDescription>
            </>
          )}
        </SheetHeader>

        <SheetBody>
          {isLoading || !serviceEmployee ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <EmployeeServiceToggles
                item={serviceEmployee}
                serviceId={serviceId}
                t={t}
              />
              <EmployeeCustomPricingRow
                item={serviceEmployee}
                serviceId={serviceId}
                employeeId={serviceEmployee.employee.id}
                t={t}
                isSaving={durationsMut.isPending}
                onSave={async (payload) => {
                  try {
                    await durationsMut.mutateAsync({ serviceId, payload })
                    toast.success(t("services.employees.durations.saved"))
                  } catch (err) {
                    toast.error(t("services.employees.durations.saveError"))
                    throw err
                  }
                }}
                onToggleType={async (disabledDeliveryTypes) => {
                  try {
                    await deliveryTypesMut.mutateAsync({ serviceId, disabledDeliveryTypes })
                    toast.success(t("services.employees.durations.saved"))
                  } catch (err) {
                    toast.error(t("services.employees.durations.saveError"))
                    throw err
                  }
                }}
                useCustomPricing={serviceEmployee.useCustomPricing}
                onToggleCustomPricing={async (useCustomPricing) => {
                  try {
                    await pricingModeMut.mutateAsync({ serviceId, useCustomPricing })
                    toast.success(t("services.employees.durations.saved"))
                  } catch (err) {
                    toast.error(t("services.employees.durations.saveError"))
                    throw err
                  }
                }}
              />
            </div>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
