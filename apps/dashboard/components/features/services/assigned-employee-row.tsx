"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon } from "@hugeicons/core-free-icons"

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
  onView: () => void
}

/* ─── Component ─── */

export function AssignedEmployeeRow({
  item,
  serviceId,
  isAr,
  t,
  onView,
}: AssignedEmployeeRowProps) {
  const { employee } = item
  const fullName = `${employee.user.firstName} ${employee.user.lastName}`
  const displayName = isAr && employee.nameAr ? employee.nameAr : fullName
  const toastId = `emp-save-${employee.id}-${serviceId}`

  const { updateMut, durationsMut, deliveryTypesMut, pricingModeMut } = useEmployeeServiceMutations(employee.id)
  const isSaving =
    updateMut.isPending && updateMut.variables?.serviceId === serviceId

  const [optimisticActive, setOptimisticActive] = useState<boolean | null>(null)
  const displayedActive = optimisticActive ?? item.isActive

  const [customPricing, setCustomPricing] = useState<boolean>(item.useCustomPricing ?? false)

  const toggleCustomPricing = async (next: boolean) => {
    const prev = customPricing
    setCustomPricing(next)
    try {
      await pricingModeMut.mutateAsync({ serviceId, useCustomPricing: next })
      toast.success(t("services.employees.durations.saved"), { id: toastId })
    } catch {
      // Turning OFF should always succeed; revert on failure.
      // Turning ON can be rejected by the backend until the practitioner has at
      // least one custom duration — keep the section open so they can add one,
      // then pricing-mode is persisted automatically once durations are saved.
      if (!next) {
        setCustomPricing(prev)
        toast.error(t("services.employees.durations.saveError"), { id: toastId })
      }
    }
  }

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
      {/* Header: avatar + name + active toggle */}
      <div className="flex items-center gap-3 min-w-0">
        <EmployeeAvatar avatarUrl={employee.avatarUrl} name={displayName} className="size-10 shrink-0" />

        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
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

        {/* Toggles card: active + custom pricing */}
        <div className="ms-auto flex shrink-0 items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
          <div className="flex items-center gap-2">
            <Label htmlFor={`active-${employee.id}`} className="cursor-pointer text-xs font-medium text-foreground">
              {t("services.create.isActive")}
            </Label>
            <Switch
              id={`active-${employee.id}`}
              checked={displayedActive}
              onCheckedChange={toggleActive}
              disabled={isSaving}
              size="sm"
              aria-label={t("employees.services.inlineActiveAria")}
            />
          </div>
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-2">
            <Label htmlFor={`custom-${employee.id}`} className="cursor-pointer text-xs font-medium text-foreground">
              {t("services.employees.durations.customPricing")}
            </Label>
            <Switch
              id={`custom-${employee.id}`}
              checked={customPricing}
              onCheckedChange={toggleCustomPricing}
              size="sm"
              aria-label={t("services.employees.durations.customPricing")}
            />
          </div>
        </div>
      </div>

      {/* Custom price + duration per delivery type */}
      <EmployeeCustomPricingRow
        item={item}
        serviceId={serviceId}
        employeeId={employee.id}
        t={t}
        isSaving={durationsMut.isPending && durationsMut.variables?.serviceId === serviceId}
        onSave={async (payload) => {
          try {
            await durationsMut.mutateAsync({ serviceId, payload })
            if (customPricing && !item.useCustomPricing) {
              await pricingModeMut.mutateAsync({ serviceId, useCustomPricing: true })
            }
            toast.success(t("services.employees.durations.saved"), { id: toastId })
          } catch (err) {
            toast.error(t("services.employees.durations.saveError"), { id: toastId })
            throw err
          }
        }}
        onToggleType={async (disabledDeliveryTypes) => {
          try {
            await deliveryTypesMut.mutateAsync({ serviceId, disabledDeliveryTypes })
            toast.success(t("services.employees.durations.saved"), { id: toastId })
          } catch (err) {
            toast.error(t("services.employees.durations.saveError"), { id: toastId })
            throw err
          }
        }}
        useCustomPricing={customPricing}
      />

      {/* Footer actions */}
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={onView}
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
