"use client"

import { useState } from "react"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { Textarea } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { useCategories } from "@/hooks/use-services"
import { useDepartmentOptions } from "@/hooks/use-departments"
import { useLocale } from "@/components/locale-provider"
import { ServiceAvatarPicker } from "@/components/features/services/service-avatar-picker"
import { ServiceBranchesTab } from "@/components/features/services/service-branches-tab"
import { ServiceBranchesPicker } from "@/components/features/services/service-branches-picker"
import type { UseFormReturn } from "react-hook-form"
import type { CreateServiceFormData } from "./form-schema"

/* ─── Props ─── */

interface BasicInfoTabProps {
  form: UseFormReturn<CreateServiceFormData>
  onImageSelect?: (file: File) => void
  serviceId?: string
}

/* ─── Component ─── */

export function BasicInfoTab({ form, onImageSelect, serviceId }: BasicInfoTabProps) {
  const { t, locale } = useLocale()
  const { data: categories, isLoading: loadingCategories } = useCategories()
  const { options: departments } = useDepartmentOptions()
  const isMultiBranch = true
  const [selectedDeptId, setSelectedDeptId] = useState<string>("")

  const hasDepts = departments.length > 0
  const hasAnyCategories = (categories ?? []).length > 0
  const visibleCategories = selectedDeptId
    ? (categories ?? []).filter((c) => c.departmentId === selectedDeptId)
    : (categories ?? [])

  const {
    isActive,
    isHidden,
    hidePriceOnBooking,
    hideDurationOnBooking,
    categoryId: watchedCategoryId,
    iconName,
    iconBgColor,
    imageUrl,
    branchIds,
  } = form.watch()

  /* ─── Locale-ordered field pairs ─── */
  const primaryName    = locale === "ar" ? "nameAr"        : "nameEn"
  const secondaryName  = locale === "ar" ? "nameEn"        : "nameAr"
  const primaryDesc    = locale === "ar" ? "descriptionAr" : "descriptionEn"
  const secondaryDesc  = locale === "ar" ? "descriptionEn" : "descriptionAr"
  const primaryNameLabel   = locale === "ar" ? t("services.create.nameAr")  : t("services.create.nameEn")
  const secondaryNameLabel = locale === "ar" ? t("services.create.nameEn")  : t("services.create.nameAr")
  const primaryDescLabel   = locale === "ar" ? t("services.create.descAr")  : t("services.create.descEn")
  const secondaryDescLabel = locale === "ar" ? t("services.create.descEn")  : t("services.create.descAr")
  const primaryDir   = locale === "ar" ? "rtl" : "ltr"
  const secondaryDir = locale === "ar" ? "ltr" : "rtl"

  return (
    <Card className="border-s-2 border-s-primary/40">
      <CardHeader>
        {/* Avatar sits beside the card title — profile-style header */}
        <div className="flex items-center gap-4">
          <ServiceAvatarPicker
            iconName={iconName}
            iconBgColor={iconBgColor}
            imageUrl={imageUrl}
            serviceName={form.watch("nameAr") || form.watch("nameEn")}
            onIconChange={(name, color) => {
              form.setValue("iconName", name)
              form.setValue("iconBgColor", color)
              form.setValue("imageUrl", null)
            }}
            onImageChange={(file) => {
              const url = URL.createObjectURL(file)
              form.setValue("imageUrl", url)
              form.setValue("iconName", null)
              form.setValue("iconBgColor", null)
              onImageSelect?.(file)
            }}
            onClear={() => {
              form.setValue("iconName", null)
              form.setValue("iconBgColor", null)
              form.setValue("imageUrl", null)
            }}
          />
          <div className="flex flex-col gap-1">
            <CardTitle>{t("services.create.tabs.basic")}</CardTitle>
            <CardDescription>
              {t("services.create.tabs.basicDesc")} &mdash;{" "}
              <span className="text-destructive">*</span>{" "}
              {t("services.create.requiredFields")}
            </CardDescription>
            <p className="text-xs text-muted-foreground">{t("services.create.avatarHint")}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">

        {/* First-run guidance: category is required but none exist yet */}
        {!loadingCategories && !hasAnyCategories && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
            <p className="text-sm text-warning-foreground">
              {t("services.create.noCategoriesBanner")}
            </p>
            <a
              href="/categories"
              className="shrink-0 rounded-md border border-warning/40 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-warning/20"
            >
              {t("services.create.noCategoriesCta")}
            </a>
          </div>
        )}

        {/* ── Row 1: Names ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{primaryNameLabel} *</Label>
            <Input {...form.register(primaryName)} dir={primaryDir} />
            {form.formState.errors[primaryName] && (
              <p className="text-xs text-destructive">{t(form.formState.errors[primaryName]?.message ?? "")}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{secondaryNameLabel} *</Label>
            <Input {...form.register(secondaryName)} dir={secondaryDir} />
            {form.formState.errors[secondaryName] && (
              <p className="text-xs text-destructive">{t(form.formState.errors[secondaryName]?.message ?? "")}</p>
            )}
          </div>
        </div>

        {/* ── Row 2: Department (optional) + Category + Active ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto]">
          {/* Department filter — only shown when departments exist */}
          {hasDepts && (
            <div className="flex flex-col gap-1.5">
              <Label>{t("services.create.department")}</Label>
              <Select
                value={selectedDeptId || "__none__"}
                onValueChange={(v) => {
                  const val = v === "__none__" ? "" : v
                  setSelectedDeptId(val)
                  const current = categories?.find((c) => c.id === watchedCategoryId)
                  if (current && val && current.departmentId !== val) {
                    form.setValue("categoryId", "", { shouldValidate: false })
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("services.create.allDepartments")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("services.create.allDepartments")}</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {locale === "ar" ? d.nameAr : d.nameEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Category */}
          <div className={`flex flex-col gap-1.5 ${!hasDepts ? "sm:col-span-2" : ""}`}>
            <Label>{t("services.create.category")} *</Label>
            <Select
              key={`${selectedDeptId}-${watchedCategoryId || "empty"}`}
              value={watchedCategoryId || ""}
              onValueChange={(v) => form.setValue("categoryId", v, { shouldValidate: true })}
              disabled={loadingCategories}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("services.create.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {visibleCategories.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    {t("services.create.noCategories")}
                  </div>
                ) : (
                  visibleCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {locale === "ar" ? c.nameAr : c.nameEn}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {form.formState.errors.categoryId && (
              <p className="text-xs text-destructive">
                {t(form.formState.errors.categoryId.message ?? "services.create.categoryRequired")}
              </p>
            )}
          </div>

          {/* Active */}
          <div className="flex flex-col gap-1.5">
            <Label>&nbsp;</Label>
            <div className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 whitespace-nowrap">
              <Switch
                id="create-service-active"
                checked={isActive}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
              <Label htmlFor="create-service-active" className="cursor-pointer text-sm">
                {t("services.create.isActive")}
              </Label>
            </div>
          </div>
        </div>

        {/* ── Row 2: Descriptions — 2 equal columns ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>{primaryDescLabel}</Label>
            <Textarea {...form.register(primaryDesc)} rows={3} dir={primaryDir} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{secondaryDescLabel}</Label>
            <Textarea {...form.register(secondaryDesc)} rows={3} dir={secondaryDir} />
          </div>
        </div>

        {/* ── Row 3: Branch Restrictions (only when multi_branch enabled) + Display Settings ── */}
        <div className={`grid gap-4 ${isMultiBranch ? "grid-cols-2" : "grid-cols-1"}`}>
          {isMultiBranch && (
            <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{t("services.branches.title")}</p>
              </div>
              <p className="text-xs text-muted-foreground">{t("services.branches.cardDesc")}</p>
              {serviceId ? (
                <ServiceBranchesTab serviceId={serviceId} />
              ) : (
                <ServiceBranchesPicker
                  value={branchIds ?? []}
                  onChange={(ids) => form.setValue("branchIds", ids)}
                />
              )}
            </div>
          )}

          {/* Display Settings */}
          <div className="rounded-lg border border-border bg-surface-muted px-4 py-3 flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">
              {t("services.create.tabs.display")}
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                <Label htmlFor="create-hidden" className="cursor-pointer text-xs">
                  {t("services.display.hideService")}
                </Label>
                <Switch
                  id="create-hidden"
                  checked={isHidden}
                  onCheckedChange={(v) => form.setValue("isHidden", v)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                <Label htmlFor="create-hide-price" className="cursor-pointer text-xs">
                  {t("services.display.hidePrice")}
                </Label>
                <Switch
                  id="create-hide-price"
                  checked={hidePriceOnBooking}
                  onCheckedChange={(v) => form.setValue("hidePriceOnBooking", v)}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                <Label htmlFor="create-hide-duration" className="cursor-pointer text-xs">
                  {t("services.display.hideDuration")}
                </Label>
                <Switch
                  id="create-hide-duration"
                  checked={hideDurationOnBooking}
                  onCheckedChange={(v) => form.setValue("hideDurationOnBooking", v)}
                />
              </div>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}
