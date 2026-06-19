"use client"

import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { Input, PhoneInput, Switch, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sawaa/ui"
import { FormSection, FormField } from "@/components/features/shared/form-section"
import { useLocale } from "@/components/locale-provider"
import type { BranchFormData } from "@/lib/schemas/branch.schema"

const TIMEZONES = [
  "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Bahrain",
  "Asia/Qatar", "Africa/Cairo", "Europe/London", "America/New_York",
]

interface BranchFormFieldsProps {
  form: UseFormReturn<BranchFormData>
  isEdit: boolean
  mode: "create" | "edit"
}

export function BranchFormFields({ form, isEdit, mode }: BranchFormFieldsProps) {
  const { t } = useLocale()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ── Branch Name ── */}
      <FormSection
        title={t("branches.section.names")}
        description={t("branches.section.namesDescription")}
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label={t("branches.field.nameEn")}
            required
            error={form.formState.errors.nameEn?.message as string | undefined}
          >
            <Input {...form.register("nameEn")} placeholder={isEdit ? undefined : "Main Branch"} />
          </FormField>
          <FormField
            label={t("branches.field.nameAr")}
            required
            error={form.formState.errors.nameAr?.message as string | undefined}
          >
            <Input {...form.register("nameAr")} dir="rtl" placeholder={isEdit ? undefined : t("settings.branches.examplePlaceholder")} />
          </FormField>
        </div>
      </FormSection>

      {/* ── Settings ── */}
      <FormSection
        title={t("branches.section.settings")}
        description={t("branches.section.settingsDescription")}
      >
        <div className="space-y-4">
          <FormField label={t("branches.field.timezone")}>
            <Select value={form.watch("timezone")} onValueChange={(v) => form.setValue("timezone", v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor={`${mode}-branch-main`} className="cursor-pointer text-sm">
              {t("branches.field.isMain")}
            </Label>
            <Switch id={`${mode}-branch-main`} checked={form.watch("isMain")} onCheckedChange={(v) => form.setValue("isMain", v)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor={`${mode}-branch-active`} className="cursor-pointer text-sm">
              {t("branches.field.isActive")}
            </Label>
            <Switch id={`${mode}-branch-active`} checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v)} />
          </div>
        </div>
      </FormSection>

      {/* ── Contact Info (full width) ── */}
      <FormSection
        title={t("branches.section.contact")}
        description={t("branches.section.contactDescription")}
        className="lg:col-span-2"
      >
        <div className="space-y-4">
          <FormField label={t("branches.field.address")}>
            <Input {...form.register("address")} />
          </FormField>
          <FormField label={t("branches.field.phone")}>
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <PhoneInput
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          </FormField>
        </div>
      </FormSection>
    </div>
  )
}
