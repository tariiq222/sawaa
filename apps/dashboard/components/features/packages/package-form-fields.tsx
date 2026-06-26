"use client"

/**
 * Package form fields — Sawaa Dashboard
 *
 * Sectioned create/edit surface, aligned with the services form design
 * language (`services/create/basic-info-tab.tsx`):
 *   - A header card groups the avatar picker + section intro on one side
 *     and a compact status/visibility switch card on the other.
 *   - Pricing lives in its own card.
 *   - Items + the live price summary share a two-column card.
 *
 * The parent owns the RHF instance, live pricing aggregation, and submit;
 * the nested `PackageItemBuilder` reads the same form via `useFormContext`.
 */

import { Controller, type UseFormReturn } from "react-hook-form"

import { Input } from "@sawaa/ui"
import { Textarea } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
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

import { FormSection, FormField } from "@/components/features/shared/form-section"
import { ServiceAvatarPicker } from "@/components/features/shared/service-avatar-picker"
import { useLocale } from "@/components/locale-provider"
import type { PackageFormData } from "@/lib/schemas/package.schema"
import type { PackagePriceBreakdown } from "@/lib/types/package"
import { PackageItemBuilder, type PackageLineDetail } from "./package-item-builder"
import { PackagePriceSummary } from "./package-price-summary"

interface PackageFormFieldsProps {
  form: UseFormReturn<PackageFormData>
  onLineChange: (index: number, detail: PackageLineDetail) => void
  onImageSelect?: (file: File) => void
  lineItems: PackageLineDetail[]
  breakdown: PackagePriceBreakdown
  translateError: (msg?: string) => string | undefined
}

export function PackageFormFields({
  form,
  onLineChange,
  onImageSelect,
  lineItems,
  breakdown,
  translateError,
}: PackageFormFieldsProps) {
  const { t } = useLocale()
  const errors = form.formState.errors

  const itemsError =
    errors.items && typeof errors.items === "object" && "message" in errors.items
      ? translateError((errors.items as { message?: string }).message)
      : undefined

  const statusItems = [
    {
      id: "package-active",
      label: t("packages.edit.isActive"),
      desc: t("packages.edit.isActiveDesc"),
      field: "isActive" as const,
    },
    {
      id: "package-public",
      label: t("packages.edit.isPublic"),
      desc: t("packages.edit.isPublicDesc"),
      field: "isPublic" as const,
    },
  ]

  return (
    <>
      {/* ── Header: identity + status/visibility ── */}
      <FormSection>
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          {/* Left: avatar + intro */}
          <div className="flex min-w-0 items-start gap-4">
            <ServiceAvatarPicker
              iconName={form.watch("iconName")}
              iconBgColor={form.watch("iconBgColor")}
              imageUrl={form.watch("imageUrl")}
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
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">{t("packages.section.basic")}</p>
              <p className="text-xs text-muted-foreground">
                {t("packages.create.basicDesc")} &mdash;{" "}
                <span className="text-destructive">*</span> {t("packages.create.requiredFields")}
              </p>
              <p className="text-xs text-muted-foreground">{t("packages.create.avatarHint")}</p>
            </div>
          </div>

          {/* Right: compact status/visibility card */}
          <div className="w-full shrink-0 rounded-lg border border-border bg-surface-muted p-3 sm:w-auto">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("packages.section.status")}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {statusItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-1">
                    <Label htmlFor={item.id} className="cursor-pointer truncate text-xs leading-none">
                      {item.label}
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={item.label}
                        >
                          <HugeiconsIcon icon={AlertCircleIcon} size={12} strokeWidth={2} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="bottom" align="end" className="w-64">
                        <PopoverHeader>
                          <PopoverTitle>{item.label}</PopoverTitle>
                          <PopoverDescription>{item.desc}</PopoverDescription>
                        </PopoverHeader>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Switch
                    id={item.id}
                    checked={!!form.watch(item.field)}
                    onCheckedChange={(v) => form.setValue(item.field, v)}
                    size="sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Name + description */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label={t("packages.create.nameAr")}
            required
            error={translateError(errors.nameAr?.message)}
          >
            <Input {...form.register("nameAr")} dir="rtl" />
          </FormField>
          <FormField label={t("packages.create.nameEn")}>
            <Input {...form.register("nameEn")} dir="ltr" />
          </FormField>
          <FormField label={t("packages.create.descriptionAr")}>
            <Textarea {...form.register("descriptionAr")} dir="rtl" rows={2} />
          </FormField>
          <FormField label={t("packages.create.descriptionEn")}>
            <Textarea {...form.register("descriptionEn")} dir="ltr" rows={2} />
          </FormField>
        </div>
      </FormSection>

      {/* ── Items (with per-item discount) + live price summary (one card) ── */}
      <FormSection
        title={t("packages.section.items")}
        description={t("packages.items.description")}
      >
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: items then display order */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <div className="flex flex-col">
              <PackageItemBuilder fieldArrayName="items" onLineChange={onLineChange} />
              {itemsError && <p className="mt-3 text-xs text-destructive">{itemsError}</p>}
            </div>

            <div className="border-t border-border pt-5">
              <FormField
                label={t("packages.create.sortOrder")}
                error={translateError(errors.sortOrder?.message)}
                className="sm:max-w-xs"
              >
                <Controller
                  control={form.control}
                  name="sortOrder"
                  render={({ field }) => (
                    <Input
                      type="number"
                      min={0}
                      className="tabular-nums"
                      value={field.value ?? 0}
                      onChange={(e) => field.onChange(e.target.value === "" ? 0 : Number(e.target.value))}
                    />
                  )}
                />
              </FormField>
            </div>
          </div>

          {/* Right: live price summary */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-4">
              <PackagePriceSummary items={lineItems} breakdown={breakdown} />
            </div>
          </div>
        </div>
      </FormSection>
    </>
  )
}
