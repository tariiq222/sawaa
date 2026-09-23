"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { useEmployeeServiceMutations } from "@/hooks/use-employee-mutations"
import { BufferCell } from "@/components/features/shared/inline-edit-cells"
import type { ServiceEmployee } from "@/lib/types/service"
import type { UpdateServicePayload } from "@/lib/types/employee"

interface EmployeeServiceTogglesProps {
  item: ServiceEmployee
  serviceId: string
  t: (key: string) => string
  customPricing: boolean
  onToggleCustomPricing: (next: boolean) => void
}

export function EmployeeServiceToggles({
  item,
  serviceId,
  t,
  customPricing,
  onToggleCustomPricing,
}: EmployeeServiceTogglesProps) {
  const { employee } = item
  const minUnit = t("employees.services.minutes")

  const { updateMut } = useEmployeeServiceMutations(employee.id)

  const [optimisticIsActive, setOptimisticIsActive] = useState<boolean | null>(
    null,
  )

  const clearOptimistic = () => setOptimisticIsActive(null)

  const patchAssignment = (patch: UpdateServicePayload) => {
    updateMut.mutate(
      { serviceId, payload: patch },
      {
        onSettled: clearOptimistic,
        onSuccess: () => toast.success(t("employees.services.inlineUpdateSuccess")),
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
    <div className="rounded-lg border border-border bg-surface-muted/60 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
        {t("services.create.tabs.display")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="flex items-center justify-between gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5">
          <Label
            htmlFor={`active-${employee.id}`}
            className="cursor-pointer text-[11px] leading-none"
          >
            {t("services.create.isActive")}
          </Label>
          <Switch
            id={`active-${employee.id}`}
            checked={displayedIsActive}
            onCheckedChange={handlePatchActive}
            disabled={updateMut.isPending}
            className="scale-90"
            aria-label={t("employees.services.inlineActiveAria")}
          />
        </div>
        <div className="flex items-center justify-between gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5">
          <Label
            htmlFor={`pricing-${employee.id}`}
            className="cursor-pointer text-[11px] leading-none"
          >
            {t("services.employees.customPricing")}
          </Label>
          <Switch
            id={`pricing-${employee.id}`}
            checked={customPricing}
            onCheckedChange={onToggleCustomPricing}
            className="scale-90"
            aria-label={t("services.employees.customPricing")}
          />
        </div>
        <div className="flex items-center justify-between gap-1.5 rounded-md border border-border bg-surface px-2 py-1.5">
          <Label className="text-[11px] leading-none text-muted-foreground">
            {t("employees.services.bufferMinutes")}
          </Label>
          <BufferCell
            value={item.bufferMinutes ?? 0}
            isSaving={updateMut.isPending}
            ariaLabel={t("employees.services.inlineBufferAria")}
            unitLabel={minUnit}
            emptyHintLabel={t("employees.services.inlineBufferEmpty")}
            onCommit={(next) => patchAssignment({ bufferMinutes: next })}
          />
        </div>
      </div>
    </div>
  )
}