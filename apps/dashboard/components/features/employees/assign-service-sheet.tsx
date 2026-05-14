"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@deqah/ui"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { useServices } from "@/hooks/use-services"
import {
  useEmployeeServices,
  useEmployeeServiceMutations,
} from "@/hooks/use-employees"
import { EmployeeServiceTypesEditor } from "./employee-service-types-editor"
import type { EmployeeService, EmployeeTypeConfigPayload } from "@/lib/types/employee"
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
  const { data: assignedServices } =
    useEmployeeServices(employeeId)
  const { assignMut } = useEmployeeServiceMutations(employeeId)

  /* Types state managed outside of react-hook-form */
  const [typeConfigs, setTypeConfigs] = useState<EmployeeTypeConfigPayload[]>([])

  const availableServices = useMemo(() => {
    const assignedIds = new Set(
      (assignedServices ?? []).map(
        (ps: EmployeeService) => ps.serviceId,
      ),
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
    }
  }, [open, form])

  const selectedServiceId = form.watch("serviceId")

  useEffect(() => {
    setTypeConfigs([
      { bookingType: "in_person", price: null, duration: null, useCustomOptions: false, isActive: true, durationOptions: [] },
      { bookingType: "online", price: null, duration: null, useCustomOptions: false, isActive: true, durationOptions: [] },
    ])
  }, [selectedServiceId])

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await assignMut.mutateAsync({
        serviceId: data.serviceId,
        availableTypes: typeConfigs.map((tc) => tc.bookingType),
        bufferMinutes: data.bufferMinutes,
        isActive: data.isActive,
        types: typeConfigs,
      })
      toast.success(t("employees.services.assignSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to assign service",
      )
    }
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
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
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t(
                          "employees.services.selectService",
                        )}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableServices.map((s) => {
                        const name = (locale === "ar" ? s.nameAr : s.nameEn) || s.nameAr || s.nameEn
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

            {/* Per-type config */}
            {selectedServiceId && typeConfigs.length > 0 && (
              <EmployeeServiceTypesEditor
                serviceBookingTypes={[]}
                value={typeConfigs}
                onChange={setTypeConfigs}
                t={t}
                locale={locale}
              />
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
            disabled={assignMut.isPending}
          >
            {assignMut.isPending
              ? t("employees.services.saving")
              : t("common.save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
