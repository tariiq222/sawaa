"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  UserIcon,
  TextAlignLeftIcon,
  Award01Icon,
  CheckmarkBadge01Icon,
  Mail01Icon,
  Certificate01Icon,
} from "@hugeicons/core-free-icons"

import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { Card, CardContent } from "@deqah/ui"
import { AvatarUpload } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import type { UseFormReturn } from "react-hook-form"
import type { CreateEmployeeFormData } from "./form-schema"

/* ─── Props ─── */

interface BasicInfoTabProps {
  form: UseFormReturn<CreateEmployeeFormData>
}

/* ─── Section Header ─── */

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: typeof UserIcon
  title: string
  description?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <HugeiconsIcon icon={icon} className="h-4.5 w-4.5 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  )
}

/* ─── Component ─── */

export function BasicInfoTab({ form }: BasicInfoTabProps) {
  const { t } = useLocale()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ── Section 1: Personal Info & Specialty (Required) ── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader
            icon={UserIcon}
            title={t("employees.create.personalInfo")}
            description={t("employees.create.personalInfoDesc")}
          />

          <div className="space-y-4">
            {/* Title (1/3) + Email (2/3) */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="create-title">
                  <span className="flex items-center gap-1.5">
                    <HugeiconsIcon icon={Certificate01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("employees.create.titleLabel")}
                  </span>
                </Label>
                <Input
                  id="create-title"
                  {...form.register("title")}
                  placeholder={t("employees.create.titlePlaceholder")}
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="create-email">
                  <span className="flex items-center gap-1.5">
                    <HugeiconsIcon icon={Mail01Icon} className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("employees.create.emailLabel")} *
                  </span>
                </Label>
                <Input
                  id="create-email"
                  {...form.register("email")}
                  type="email"
                  placeholder="doctor@clinic.com"
                  dir="ltr"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* Full Name EN (50%) + AR (50%) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="create-nameEn">{t("employees.create.nameEn")} *</Label>
                <Input
                  id="create-nameEn"
                  {...form.register("nameEn")}
                  placeholder="e.g. Ahmed Al-Shammari"
                  dir="ltr"
                />
                {form.formState.errors.nameEn && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameEn.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="create-nameAr">{t("employees.create.nameAr")} *</Label>
                <Input
                  id="create-nameAr"
                  {...form.register("nameAr")}
                  placeholder={t("employees.create.placeholderNameAr")}
                  dir="rtl"
                />
                {form.formState.errors.nameAr && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.nameAr.message}
                  </p>
                )}
              </div>
            </div>

            {/* Specialty EN (50%) + AR (50%) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>{t("employees.create.specialty")} *</Label>
                <Input
                  {...form.register("specialty")}
                  placeholder={t("employees.create.placeholderSpecialtyAr")}
                />
                {form.formState.errors.specialty && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.specialty.message}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("employees.create.specialty")} (AR)</Label>
                <Input
                  {...form.register("specialtyAr")}
                  placeholder={t("employees.create.placeholderSpecialtyAr")}
                  dir="rtl"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Qualifications + Avatar & Status ── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader
            icon={Award01Icon}
            title={t("employees.create.qualificationsProfile")}
            description={t("employees.create.qualificationsProfileDesc")}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label>{t("employees.create.experience")}</Label>
              <Input
                type="number"
                min={0}
                {...form.register("experience")}
                placeholder="e.g. 5"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("employees.create.educationEn")}</Label>
              <Input {...form.register("education")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("employees.create.educationAr")}</Label>
              <Input {...form.register("educationAr")} dir="rtl" />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            />

            <div className="flex items-center justify-between rounded-lg border border-border p-3 self-end">
              <div className="flex items-center gap-2">
                <HugeiconsIcon
                  icon={CheckmarkBadge01Icon}
                  className="h-4 w-4 text-muted-foreground"
                />
                <Label
                  htmlFor="create-employee-active"
                  className="cursor-pointer text-sm"
                >
                  {t("common.active")}
                </Label>
              </div>
              <Switch
                id="create-employee-active"
                checked={form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Bio (Full width) ── */}
      <Card className="lg:col-span-2">
        <CardContent className="pt-6">
          <SectionHeader
            icon={TextAlignLeftIcon}
            title={t("employees.create.bioSection")}
            description={t("employees.create.bioDescription")}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("employees.create.bioEn")}</Label>
              <Textarea {...form.register("bio")} rows={3} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("employees.create.bioAr")}</Label>
              <Textarea {...form.register("bioAr")} rows={3} dir="rtl" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
