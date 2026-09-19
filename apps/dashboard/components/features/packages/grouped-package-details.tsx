"use client"

import type { UseFormReturn } from "react-hook-form"
import { Input, Label, Textarea, Switch } from "@sawaa/ui"
import { FormSection } from "@/components/features/shared/form-section"
import { ServiceAvatarPicker } from "@/components/features/shared/service-avatar-picker"
import { useLocale } from "@/components/locale-provider"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"

interface Props {
  form: UseFormReturn<GroupedPackageFormData>
  onImageSelect: (file: File) => void
  translateError: (message?: string) => string | undefined
}

export function GroupedPackageDetails({ form, onImageSelect, translateError }: Props) {
  const { t } = useLocale()
  const errors = form.formState.errors
  const value = form.watch()
  return (
    <FormSection>
      <div className="flex flex-wrap items-start gap-4">
        <ServiceAvatarPicker
          iconName={value.iconName}
          iconBgColor={value.iconBgColor}
          imageUrl={value.imageUrl}
          serviceName={value.nameAr || value.nameEn}
          onIconChange={(name, color) => {
            form.setValue("iconName", name, { shouldDirty: true })
            form.setValue("iconBgColor", color, { shouldDirty: true })
            form.setValue("imageUrl", null, { shouldDirty: true })
          }}
          onImageChange={(file) => {
            form.setValue("imageUrl", URL.createObjectURL(file), { shouldDirty: true })
            form.setValue("iconName", null, { shouldDirty: true })
            form.setValue("iconBgColor", null, { shouldDirty: true })
            onImageSelect(file)
          }}
          onClear={() => {
            form.setValue("iconName", null, { shouldDirty: true })
            form.setValue("iconBgColor", null, { shouldDirty: true })
            form.setValue("imageUrl", null, { shouldDirty: true })
          }}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-semibold">{t("packages.grouped.details.title")}</p>
          <p className="text-xs text-muted-foreground">{t("packages.grouped.details.description")}</p>
        </div>
        <div className="ms-auto flex items-center gap-4 rounded-lg border border-border bg-surface-muted px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={value.isActive} onCheckedChange={(checked) => form.setValue("isActive", checked, { shouldDirty: true })} />
            {t("packages.edit.isActive")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={value.isPublic} onCheckedChange={(checked) => form.setValue("isPublic", checked, { shouldDirty: true })} />
            {t("packages.edit.isPublic")}
          </label>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("packages.create.nameAr")} htmlFor="nameAr" required error={translateError(errors.nameAr?.message)}><Input id="nameAr" {...form.register("nameAr")} dir="rtl" /></Field>
        <Field label={t("packages.create.nameEn")} htmlFor="nameEn" error={translateError(errors.nameEn?.message)}><Input id="nameEn" {...form.register("nameEn")} dir="ltr" /></Field>
        <Field label={t("packages.create.descriptionAr")} htmlFor="descriptionAr" error={translateError(errors.descriptionAr?.message)}><Textarea id="descriptionAr" {...form.register("descriptionAr")} dir="rtl" rows={3} /></Field>
        <Field label={t("packages.create.descriptionEn")} htmlFor="descriptionEn" error={translateError(errors.descriptionEn?.message)}><Textarea id="descriptionEn" {...form.register("descriptionEn")} dir="ltr" rows={3} /></Field>
        <Field label={t("packages.create.sortOrder")} htmlFor="sortOrder" error={translateError(errors.sortOrder?.message)}><Input id="sortOrder" type="number" min={0} {...form.register("sortOrder", { valueAsNumber: true })} inputMode="numeric" /></Field>
      </div>
    </FormSection>
  )
}

function Field({ label, htmlFor, required, error, children }: { label: string; htmlFor: string; required?: boolean; error?: string; children: React.ReactNode }) { return <div className="flex flex-col gap-1.5"><Label htmlFor={htmlFor}>{label}{required && <span className="ms-0.5 text-destructive">*</span>}</Label>{children}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div> }
