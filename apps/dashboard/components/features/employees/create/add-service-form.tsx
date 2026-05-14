"use client"

import { Controller, useForm } from "react-hook-form"

import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { EmployeeServiceTypesEditor } from "../employee-service-types-editor"
import type { EmployeeTypeConfigPayload } from "@/lib/types/employee"
import type { AddServiceFormData } from "./draft-service.types"

/* ─── Props ─── */

interface AddServiceFormProps {
  form: ReturnType<typeof useForm<AddServiceFormData>>
  availableServices: { id: string; nameAr: string; nameEn: string }[]
  serviceBookingTypes: import("@/lib/types/service").ServiceBookingType[]
  typeConfigs: EmployeeTypeConfigPayload[]
  onTypeConfigsChange: (types: EmployeeTypeConfigPayload[]) => void
  onSubmit: () => void
  onCancel: () => void
  t: (key: string) => string
  locale: string
}

/* ─── Component ─── */

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
}: AddServiceFormProps) {
  const isAr = locale === "ar"
  const selectedServiceId = form.watch("serviceId")

  return (
    <div className="rounded-lg border border-border p-4 space-y-4">
      <Label className="text-sm font-semibold">
        {t("employees.create.addService")}
      </Label>

      {/* Service Select */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">{t("employees.services.serviceLabel")}</Label>
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
                  const name = (isAr ? s.nameAr : s.nameEn) || s.nameAr || s.nameEn
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
      {selectedServiceId && (
        <EmployeeServiceTypesEditor
          serviceBookingTypes={serviceBookingTypes}
          value={typeConfigs}
          onChange={onTypeConfigsChange}
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
      <div className="flex items-center justify-between rounded-lg border border-border p-2">
        <Label className="text-xs cursor-pointer">{t("common.active")}</Label>
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="button" size="sm" onClick={onSubmit}>
          {t("employees.create.addService")}
        </Button>
      </div>
    </div>
  )
}
