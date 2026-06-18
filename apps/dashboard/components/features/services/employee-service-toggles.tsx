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
  isSaving: boolean
  t: (key: string) => string
}

export function EmployeeServiceToggles({
  item,
  serviceId,
  isSaving,
  t,
}: EmployeeServiceTogglesProps) {
  const { employee } = item
  const minUnit = t("employees.services.minutes")

  const { updateMut, customPricingMut } = useEmployeeServiceMutations(employee.id)

  const [optimisticIsActive, setOptimisticIsActive] = useState<boolean | null>(
    null,
  )
  const [optimisticHasCustomPricing, setOptimisticHasCustomPricing] = useState<
    boolean | null
  >(null)

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
  const displayedHasCustomPricing =
    optimisticHasCustomPricing ?? item.hasCustomPricing

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
            disabled={isSaving}
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
            checked={displayedHasCustomPricing}
            onCheckedChange={(enabled) => {
              setOptimisticHasCustomPricing(enabled)
              customPricingMut.mutate(
                {
                  serviceId,
                  payload: {
                    enabled,
                    types: enabled
                      ? item.serviceTypes.map((st) => ({
                          deliveryType: st.deliveryType as 'IN_PERSON' | 'ONLINE',
                          price: st.price ?? st.basePrice,
                          durationMins: st.durationMins ?? st.baseDurationMins,
                        }))
                      : [],
                  },
                },
                {
                  onSettled: () => setOptimisticHasCustomPricing(null),
                  onSuccess: () =>
                    toast.success(t("services.employees.customPricingSaved")),
                  onError: () =>
                    toast.error(t("services.employees.customPricingSaveError")),
                },
              )
            }}
            disabled={customPricingMut.isPending || item.serviceTypes.length === 0}
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
            isSaving={isSaving}
            ariaLabel={t("employees.services.inlineBufferAria")}
            unitLabel={minUnit}
            emptyHintLabel={t("employees.services.inlineBufferEmpty")}
            onCommit={(next) => patchAssignment({ bufferMinutes: next })}
          />
        </div>
      </div>
      {item.serviceTypes.length === 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground/70">
          {t("services.employees.noTypesForPricing")}
        </p>
      )}
    </div>
  )
}