"use client"

import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import {
  Building06Icon,
  Location01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import { Input } from "@deqah/ui"
import { PhoneInput } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { Card, CardContent } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { SectionHeader } from "@/components/features/section-header"
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
      <Card>
        <CardContent className="pt-6">
          <SectionHeader
            icon={Building06Icon}
            title={t("branches.section.names")}
            description={t("branches.section.namesDescription")}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("branches.field.nameEn")} *</Label>
              <Input {...form.register("nameEn")} placeholder={isEdit ? undefined : "Main Branch"} />
              {form.formState.errors.nameEn && (
                <p className="text-xs text-destructive">{form.formState.errors.nameEn.message as string}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("branches.field.nameAr")} *</Label>
              <Input {...form.register("nameAr")} dir="rtl" placeholder={isEdit ? undefined : t("settings.branches.examplePlaceholder")} />
              {form.formState.errors.nameAr && (
                <p className="text-xs text-destructive">{form.formState.errors.nameAr.message as string}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Settings ── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader
            icon={Settings01Icon}
            title={t("branches.section.settings")}
            description={t("branches.section.settingsDescription")}
          />
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("branches.field.timezone")}</Label>
              <Select value={form.watch("timezone")} onValueChange={(v) => form.setValue("timezone", v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
        </CardContent>
      </Card>

      {/* ── Contact Info (full width) ── */}
      <Card className="lg:col-span-2">
        <CardContent className="pt-6">
          <SectionHeader
            icon={Location01Icon}
            title={t("branches.section.contact")}
            description={t("branches.section.contactDescription")}
          />
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("branches.field.address")}</Label>
              <Input {...form.register("address")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("branches.field.phone")}</Label>
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
