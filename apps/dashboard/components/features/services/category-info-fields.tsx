"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sawaa/ui"
import { FormField } from "@/components/features/shared/form-section"
import type { EditCategoryFormData } from "@/lib/schemas/service.schema"
import type { Department } from "@/lib/types/department"

export function CategoryInfoFields({form, departmentOptions, isAr, t}: {form: UseFormReturn<EditCategoryFormData>; departmentOptions: Department[]; isAr: boolean; t: (key:string)=>string}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      <FormField label={t("services.categories.create.nameAr")} required error={form.formState.errors.nameAr ? t(form.formState.errors.nameAr.message ?? "common.required") : undefined}><Input id="nameAr" {...form.register("nameAr")} placeholder={t("services.categories.create.nameAr")} /></FormField>
      <FormField label={t("services.categories.create.nameEn")}><Input id="nameEn" {...form.register("nameEn")} placeholder={t("services.categories.create.nameEn")} /></FormField>
      <FormField label={t("services.categories.create.department")}>
        <Controller
          name="departmentId"
          control={form.control}
          render={({ field }) => (
            <Select key={field.value || "none"} value={field.value ?? ""} onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("services.categories.create.departmentPlaceholder")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("services.categories.create.departmentPlaceholder")}</SelectItem>
                {departmentOptions.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {isAr ? dept.nameAr : (dept.nameEn ?? dept.nameAr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {t("services.categories.create.departmentHint")}
        </p>
      </FormField>
      <FormField label={t("services.categories.create.sortOrder")}><Input id="sortOrder" type="number" min={0} max={999} {...form.register("sortOrder", { valueAsNumber: true })} placeholder="0" /></FormField>
    </div>
  )
}
