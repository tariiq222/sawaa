// EXCEPTION: employee basic info form with deeply interdependent field logic; splitting by section adds indirection, approved 2026-04-24
"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  TextAlignLeftIcon,
  Award01Icon,
  Mail01Icon,
  Certificate01Icon,
} from "@hugeicons/core-free-icons"

import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { AvatarUpload } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { SectionHeader } from "@/components/features/section-header"
import { FormSection, FormField } from "@/components/features/shared/form-section"
import { EmployeeStatusDialog } from "@/components/features/employees/employee-status-dialog"
import type { UseFormReturn } from "react-hook-form"
import type { CreateEmployeeFormData } from "./create/form-schema"

/* ─── Props ─── */

interface BasicInfoTabProps {
  form: UseFormReturn<CreateEmployeeFormData>
  showEmail?: boolean
  employeeName?: string
  /** Existing email shown read-only on edit mode. */
  readOnlyEmail?: string | null
  showPublicToggle?: boolean
}

/* ─── Component ─── */

export function BasicInfoTab({ form, showEmail = false, employeeName, readOnlyEmail, showPublicToggle = false }: BasicInfoTabProps) {
  const { t } = useLocale()
  const [pendingValue, setPendingValue] = useState<boolean | null>(null)

  const displayName = employeeName ?? form.watch("nameEn") ?? ""

  function handleSwitchChange(v: boolean) {
    setPendingValue(v)
  }

  function handleConfirm() {
    if (pendingValue !== null) {
      form.setValue("isActive", pendingValue)
    }
    setPendingValue(null)
  }

  function handleCancel() {
    setPendingValue(null)
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

      {/* ── Column 1 (1/3): Personal Info ── */}
      <FormSection className="md:row-span-2 lg:row-span-2">
          {/* Avatar + switch in same row */}
          <AvatarUpload
            value={form.watch("avatarUrl") || undefined}
            onChange={(file, previewUrl) => {
              form.setValue("avatarFile", file)
              form.setValue("avatarUrl", previewUrl)
            }}
            onClear={() => {
              form.setValue("avatarFile", undefined)
              form.setValue("avatarUrl", "")
            }}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="employee-active" className="cursor-pointer text-xs text-muted-foreground">
                  {t("employees.status.active")}
                </Label>
                <Switch
                  id="employee-active"
                  checked={form.watch("isActive") ?? true}
                  onCheckedChange={handleSwitchChange}
                />
              </div>

              {showPublicToggle && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="employee-public" className="cursor-pointer text-xs text-muted-foreground">
                    {t("employees.public.showInDirectory")}
                  </Label>
                  <Switch
                    id="employee-public"
                    checked={form.watch("isPublic") ?? false}
                    onCheckedChange={(v) => form.setValue("isPublic", v)}
                  />
                </div>
              )}

            </div>
          </AvatarUpload>

          <div className="space-y-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label>
                <span className="flex items-center gap-1.5">
                  <HugeiconsIcon icon={Certificate01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("employees.create.titleLabel")}
                </span>
              </Label>
              <Input
                {...form.register("title")}
                placeholder={t("employees.create.titlePlaceholder")}
              />
            </div>

            {/* Email — editable on create, read-only on edit */}
            {showEmail ? (
              <div className="flex flex-col gap-1.5">
                <Label>
                  <span className="flex items-center gap-1.5">
                    <HugeiconsIcon icon={Mail01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("employees.create.emailLabel")} *
                  </span>
                </Label>
                <Input
                  {...form.register("email")}
                  type="email"
                  placeholder="doctor@clinic.com"
                  dir="ltr"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {String(form.formState.errors.email.message ?? "")}
                  </p>
                )}
              </div>
            ) : readOnlyEmail ? (
              <div className="flex flex-col gap-1.5">
                <Label>
                  <span className="flex items-center gap-1.5">
                    <HugeiconsIcon icon={Mail01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("employees.create.emailLabel")}
                  </span>
                </Label>
                <Input value={readOnlyEmail} readOnly dir="ltr" className="bg-muted/40 text-muted-foreground" />
              </div>
            ) : null}

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <Label>{t("employees.create.phoneLabel")}</Label>
              <Input
                {...form.register("phone")}
                type="tel"
                placeholder="+966500000000"
                dir="ltr"
              />
              {form.formState.errors.phone && (
                <p className="text-xs text-destructive">
                  {String(form.formState.errors.phone.message ?? "")}
                </p>
              )}
            </div>

            {/* Gender + employment type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t("employees.create.genderLabel")}</Label>
                <select
                  {...form.register("gender")}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">—</option>
                  <option value="MALE">{t("employees.create.genderMale")}</option>
                  <option value="FEMALE">{t("employees.create.genderFemale")}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("employees.create.employmentTypeLabel")}</Label>
                <select
                  {...form.register("employmentType")}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="FULL_TIME">{t("employees.create.employmentFullTime")}</option>
                  <option value="PART_TIME">{t("employees.create.employmentPartTime")}</option>
                  <option value="CONTRACT">{t("employees.create.employmentContract")}</option>
                </select>
              </div>
            </div>

            {/* Full Name EN */}
            <FormField label={t("employees.create.nameEn")} required={showEmail} error={form.formState.errors.nameEn ? String(form.formState.errors.nameEn.message ?? "") : undefined}>
              <Input
                {...form.register("nameEn")}
                placeholder="e.g. Ahmed Al-Shammari"
                dir="ltr"
              />
            </FormField>

            {/* Full Name AR */}
            <FormField label={t("employees.create.nameAr")} required={showEmail} error={form.formState.errors.nameAr ? String(form.formState.errors.nameAr.message ?? "") : undefined}>
              <Input
                {...form.register("nameAr")}
                placeholder={t("employees.create.placeholderNameAr")}
                dir="rtl"
              />
            </FormField>

          </div>
      </FormSection>

      {/* ── Column 2-3 (2/3): Specialty + Qualifications + Bio ── */}
      <FormSection className="md:col-span-2 md:row-span-2 lg:col-span-2 lg:row-span-2"><div className="space-y-6">
          {/* Specialty */}
          <div className="flex flex-col gap-3">
            <SectionHeader
              icon={Certificate01Icon}
              title={t("employees.create.specialtySection")}
              description={t("employees.create.specialtyDescription")}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <FormField label={`${t("employees.create.specialty")} (EN)`} required={showEmail} error={form.formState.errors.specialty ? String(form.formState.errors.specialty.message ?? "") : undefined}>
                <Input
                  {...form.register("specialty")}
                  placeholder="e.g. Addiction Counselor"
                />
              </FormField>
              <FormField label={`${t("employees.create.specialty")} (AR)`}>
                <Input
                  {...form.register("specialtyAr")}
                  placeholder={t("employees.create.placeholderSpecialtyAr")}
                  dir="rtl"
                />
              </FormField>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Qualifications */}
          <div className="flex flex-col gap-3">
            <SectionHeader
              icon={Award01Icon}
              title={t("employees.create.qualifications")}
              description={t("employees.create.qualificationsDesc")}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FormField label={t("employees.create.experience")}>
                <Input
                  type="number"
                  min={0}
                  max={70}
                  {...form.register("experience")}
                  placeholder="e.g. 5"
                />
              </FormField>
              <FormField label={t("employees.create.educationEn")}>
                <Input {...form.register("education")} />
              </FormField>
              <FormField label={t("employees.create.educationAr")}>
                <Input {...form.register("educationAr")} dir="rtl" />
              </FormField>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Bio */}
          <div className="flex flex-col gap-3">
            <SectionHeader
              icon={TextAlignLeftIcon}
              title={t("employees.create.bioSection")}
              description={t("employees.create.bioDescription")}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t("employees.create.bioEn")}>
                <Textarea {...form.register("bio")} rows={4} />
              </FormField>
              <FormField label={t("employees.create.bioAr")}>
                <Textarea {...form.register("bioAr")} rows={4} dir="rtl" />
              </FormField>
            </div>
          </div>
        </div></FormSection>

      <EmployeeStatusDialog
        open={pendingValue !== null}
        targetStatus={pendingValue ?? true}
        employeeName={displayName}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  )
}
