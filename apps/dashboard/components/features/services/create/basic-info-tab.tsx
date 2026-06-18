"use client"

import { useState } from "react"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@sawaa/ui"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
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
  // Single-branch center: branch restrictions UI is hidden; services apply to the only branch.
  const isMultiBranch = false
  const [selectedDeptId, setSelectedDeptId] = useState<string>("")

  const hasDepts = departments.length > 0
  const hasAnyCategories = (categories ?? []).length > 0
  const visibleCategories = selectedDeptId
    ? (categories ?? []).filter((c) => c.departmentId === selectedDeptId || !c.departmentId)
    : (categories ?? [])

  const handleCategoryChange = (categoryId: string) => {
    form.setValue("categoryId", categoryId, { shouldValidate: true })
    const cat = categories?.find((c) => c.id === categoryId)
    if (cat?.departmentId && cat.departmentId !== selectedDeptId) {
      setSelectedDeptId(cat.departmentId)
    }
  }

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
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          {/* Left: avatar + title block */}
          <div className="flex items-center gap-4 min-w-0">
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
            <div className="flex flex-col gap-1 min-w-0">
              <CardTitle>{t("services.create.tabs.basic")}</CardTitle>
              <CardDescription>
                {t("services.create.tabs.basicDesc")} &mdash;{" "}
                <span className="text-destructive">*</span>{" "}
                {t("services.create.requiredFields")}
              </CardDescription>
              <p className="text-xs text-muted-foreground">{t("services.create.avatarHint")}</p>
            </div>
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

        {/* ── Display & Visibility — unified card with info popovers ── */}
        <div className="rounded-lg border border-border bg-surface-muted/40 px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">
              {t("services.create.tabs.display")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("services.create.tabs.displayDesc")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {/* Active */}
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Label htmlFor="basic-is-active" className="cursor-pointer text-xs">
                  {t("services.create.isActive")}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={t("services.create.isActive")}
                    >
                      <HugeiconsIcon icon={AlertCircleIcon} size={14} strokeWidth={2} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-64">
                    <PopoverHeader>
                      <PopoverTitle>{t("services.create.isActive")}</PopoverTitle>
                      <PopoverDescription>
                        {t("services.create.isActiveDesc")}
                      </PopoverDescription>
                    </PopoverHeader>
                  </PopoverContent>
                </Popover>
              </div>
              <Switch
                id="basic-is-active"
                checked={isActive}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>

            {/* Hidden */}
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Label htmlFor="basic-is-hidden" className="cursor-pointer text-xs">
                  {t("services.create.isHidden")}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={t("services.create.isHidden")}
                    >
                      <HugeiconsIcon icon={AlertCircleIcon} size={14} strokeWidth={2} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-64">
                    <PopoverHeader>
                      <PopoverTitle>{t("services.create.isHidden")}</PopoverTitle>
                      <PopoverDescription>
                        {t("services.create.isHiddenDesc")}
                      </PopoverDescription>
                    </PopoverHeader>
                  </PopoverContent>
                </Popover>
              </div>
              <Switch
                id="basic-is-hidden"
                checked={isHidden}
                onCheckedChange={(v) => form.setValue("isHidden", v)}
              />
            </div>

            {/* Hide price */}
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Label htmlFor="basic-hide-price" className="cursor-pointer text-xs">
                  {t("services.display.hidePrice")}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={t("services.display.hidePrice")}
                    >
                      <HugeiconsIcon icon={AlertCircleIcon} size={14} strokeWidth={2} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-64">
                    <PopoverHeader>
                      <PopoverTitle>{t("services.display.hidePrice")}</PopoverTitle>
                      <PopoverDescription>
                        {t("services.display.hidePriceDesc")}
                      </PopoverDescription>
                    </PopoverHeader>
                  </PopoverContent>
                </Popover>
              </div>
              <Switch
                id="basic-hide-price"
                checked={hidePriceOnBooking}
                onCheckedChange={(v) => form.setValue("hidePriceOnBooking", v)}
              />
            </div>

            {/* Hide duration */}
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Label htmlFor="basic-hide-duration" className="cursor-pointer text-xs">
                  {t("services.display.hideDuration")}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={t("services.display.hideDuration")}
                    >
                      <HugeiconsIcon icon={AlertCircleIcon} size={14} strokeWidth={2} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-64">
                    <PopoverHeader>
                      <PopoverTitle>{t("services.display.hideDuration")}</PopoverTitle>
                      <PopoverDescription>
                        {t("services.display.hideDurationDesc")}
                      </PopoverDescription>
                    </PopoverHeader>
                  </PopoverContent>
                </Popover>
              </div>
              <Switch
                id="basic-hide-duration"
                checked={hideDurationOnBooking}
                onCheckedChange={(v) => form.setValue("hideDurationOnBooking", v)}
              />
            </div>
          </div>
        </div>

        {/* ── Row 2: Department (optional) + Category ── */}
        <div className={`grid grid-cols-1 gap-4 ${hasDepts ? "sm:grid-cols-2" : ""}`}>
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
          <div className="flex flex-col gap-1.5">
            <Label>{t("services.create.category")} *</Label>
            <Select
              key={`${selectedDeptId}-${watchedCategoryId || "empty"}`}
              value={watchedCategoryId || ""}
              onValueChange={handleCategoryChange}
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
        </div>

      </CardContent>
    </Card>
  )
}
