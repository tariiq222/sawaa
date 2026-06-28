"use client"

import { Controller, useForm } from "react-hook-form"

import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { EmployeeServiceTypesEditor } from "../employee-service-types-editor"
import type { EmployeeTypeConfigPayload } from "@/lib/types/employee"
import type { AddServiceFormData } from "./draft-service.types"

interface AddServiceFormProps {
  form: ReturnType<typeof useForm<AddServiceFormData>>
  availableServices: { id: string; nameAr: string; nameEn: string; departmentName?: string | null; categoryName?: string | null }[]
  serviceBookingTypes: import("@/lib/types/service").ServiceBookingType[]
  typeConfigs: EmployeeTypeConfigPayload[]
  onTypeConfigsChange: (types: EmployeeTypeConfigPayload[]) => void
  onSubmit: () => void
  onCancel: () => void
  t: (key: string) => string
  locale: string
  isEditing?: boolean
  editingServiceName?: string
}

export function AddServiceForm({
  form,
  availableServices,
  serviceBookingTypes,
  typeConfigs,
  onTypeConfigsChange,
  onSubmit,
  onCancel,
  t,
  locale,
  isEditing = false,
  editingServiceName,
}: AddServiceFormProps) {
  const isAr = locale === "ar"
  const selectedServiceId = form.watch("serviceId")
  const showPricingSection = isEditing ? true : !!selectedServiceId

  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/50 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {isEditing ? t("common.edit") : t("employees.create.addService")}
        </p>
      </div>
      <div className="px-4 py-4 space-y-4">
      {/* Service — read-only when editing, select when adding */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs" htmlFor="asf-service">{t("employees.services.serviceLabel")}</Label>
        {isEditing ? (
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
            {editingServiceName ?? ""}
          </div>
        ) : (
          <>
            <Controller
              control={form.control}
              name="serviceId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger
                    id="asf-service"
                    aria-invalid={form.formState.errors.serviceId ? "true" : undefined}
                    aria-describedby={form.formState.errors.serviceId ? "asf-service-error" : undefined}
                  >
                    <SelectValue
                      placeholder={t("employees.services.selectService")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServices.map((s) => {
                      const name = (isAr ? s.nameAr : s.nameEn) || s.nameAr || s.nameEn
                      if (!name) return null
                      const breadcrumb = [s.departmentName, s.categoryName].filter(Boolean).join(" › ")
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          <span className="flex flex-col gap-0.5">
                            {breadcrumb && (
                              <span className="text-[11px] text-muted-foreground">{breadcrumb}</span>
                            )}
                            <span>{name}</span>
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.serviceId && (
              <p id="asf-service-error" className="text-xs text-destructive">
                {form.formState.errors.serviceId.message}
              </p>
            )}
          </>
        )}
      </div>

      {showPricingSection && (
        <EmployeeServiceTypesEditor
          serviceBookingTypes={serviceBookingTypes}
          value={typeConfigs}
          onChange={onTypeConfigsChange}
          t={t}
          locale={locale}
        />
      )}

      {/* Buffer + Active — side by side */}
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
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

        <div className="flex h-10 items-center justify-between rounded-lg border border-border px-3">
          <Label className="text-xs cursor-pointer">{t("common.active")}</Label>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="button" size="sm" onClick={onSubmit}>
          {isEditing ? t("common.save") : t("employees.create.addService")}
        </Button>
      </div>
      </div>
    </div>
  )
}
