"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@sawaa/ui"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { useServiceBookingTypes, useServices } from "@/hooks/use-services"
import { useEmployeeServices } from "@/hooks/use-employees"
import { useEmployeeServiceMutations } from "@/hooks/use-employee-mutations"
import { EmployeeServiceTypesEditor } from "./employee-service-types-editor"
import { sarToHalalas } from "@/lib/money"
import {
  buildEmployeeServiceOptionsPayload,
  makeDefaultEmployeeTypeConfigs,
} from "./employee-service-option-overrides"
import type {
  EmployeeService,
  EmployeeTypeConfigPayload,
} from "@/lib/types/employee"
import {
  assignServiceSchema,
  type AssignServiceFormData,
} from "@/lib/schemas/employee.schema"

/* ─── Props ─── */

interface AssignServiceSheetProps {
  employeeId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/* ─── Component ─── */

export function AssignServiceSheet({
  employeeId,
  open,
  onOpenChange,
}: AssignServiceSheetProps) {
  const { locale, t } = useLocale()
  const { services } = useServices()
  const { data: assignedServices } = useEmployeeServices(employeeId)
  const { assignMut, optionsMut } = useEmployeeServiceMutations(employeeId)

  /* Types state managed outside of react-hook-form */
  const [typeConfigs, setTypeConfigs] = useState<EmployeeTypeConfigPayload[]>(
    []
  )
  const [useCustomPricing, setUseCustomPricing] = useState(false)

  const availableServices = useMemo(() => {
    const assignedIds = new Set(
      (assignedServices ?? []).map((ps: EmployeeService) => ps.serviceId)
    )
    return (services ?? []).filter((s) => !assignedIds.has(s.id))
  }, [services, assignedServices])

  const form = useForm<AssignServiceFormData>({
    resolver: zodResolver(assignServiceSchema),
    defaultValues: {
      serviceId: "",
      bufferMinutes: 0,
      isActive: true,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset()
      setTypeConfigs([])
      setUseCustomPricing(false)
    }
  }, [open, form])

  const selectedServiceId = form.watch("serviceId")
  const { data: serviceBookingTypes = [] } = useServiceBookingTypes(
    selectedServiceId || null,
  )

  useEffect(() => {
    setTypeConfigs(makeDefaultEmployeeTypeConfigs(serviceBookingTypes))
    setUseCustomPricing(false)
  }, [selectedServiceId, serviceBookingTypes])

  const handleCustomPricingChange = (enabled: boolean) => {
    setUseCustomPricing(enabled)
    setTypeConfigs((current) =>
      current.map((typeConfig) => ({
        ...typeConfig,
        useCustomOptions: enabled,
      })),
    )
  }

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      // The editor inputs collect SAR-major prices; convert back to halalas
      // (the API/DB convention) before submitting.
      const typesPayload: EmployeeTypeConfigPayload[] = typeConfigs.map(
        (tc) => ({
          ...tc,
          price: tc.price != null ? sarToHalalas(tc.price) : tc.price,
          durationOptions: (tc.durationOptions ?? []).map((o) => ({
            ...o,
            price: sarToHalalas(o.price),
          })),
        })
      )
      await assignMut.mutateAsync({
        serviceId: data.serviceId,
        availableTypes: typeConfigs.map((tc) => tc.deliveryType),
        bufferMinutes: data.bufferMinutes,
        isActive: data.isActive,
        types: typesPayload,
      })
      const optionsPayload = buildEmployeeServiceOptionsPayload({
        typeConfigs,
        serviceBookingTypes,
        useCustomPricing,
      })
      if (optionsPayload) {
        await optionsMut.mutateAsync({
          serviceId: data.serviceId,
          payload: optionsPayload,
        })
      }
      toast.success(t("employees.services.assignSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to assign service"
      )
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="end">
        <SheetHeader>
          <SheetTitle>{t("employees.services.assign")}</SheetTitle>
          <SheetDescription>
            {t("employees.services.assignDesc")}
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <form
            id="assign-service-form"
            onSubmit={onSubmit}
            className="flex flex-col gap-5"
          >
            {/* Service Select */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("detail.service")}</Label>
              <Controller
                control={form.control}
                name="serviceId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t("employees.services.selectService")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServices.map((s) => {
                        const name =
                          (locale === "ar" ? s.nameAr : s.nameEn) ||
                          s.nameAr ||
                          s.nameEn
                        if (!name) return null
                        return (
                          <SelectItem key={s.id} value={s.id}>
                            {name}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.serviceId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.serviceId.message}
                </p>
              )}
            </div>

            {/* Custom pricing */}
            {selectedServiceId && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="space-y-1">
                    <Label className="text-xs cursor-pointer">
                      {t("employees.services.useCustomPricingTimes")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("employees.services.defaultsUsedHint")}
                    </p>
                  </div>
                  <Switch
                    checked={useCustomPricing}
                    onCheckedChange={handleCustomPricingChange}
                  />
                </div>
                {useCustomPricing ? (
                  <EmployeeServiceTypesEditor
                    serviceBookingTypes={serviceBookingTypes}
                    value={typeConfigs}
                    onChange={setTypeConfigs}
                    t={t}
                    locale={locale}
                  />
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                    {t("employees.services.usingServiceDefaults")}
                  </p>
                )}
              </div>
            )}

            {/* Buffer */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                {t("employees.services.bufferMinutes")}
              </Label>
              <Input
                type="number"
                min="0"
                className="tabular-nums"
                {...form.register("bufferMinutes")}
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center justify-between">
              <Label>{t("common.active")}</Label>
              <Controller
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
            </div>
          </form>
        </SheetBody>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="assign-service-form"
            disabled={assignMut.isPending || optionsMut.isPending}
          >
            {assignMut.isPending || optionsMut.isPending
              ? t("employees.services.saving")
              : t("common.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
