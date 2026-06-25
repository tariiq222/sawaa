"use client"

/**
 * Session Package Form Page — Sawaa Dashboard
 *
 * Single-page form (no stepper) for create / edit. The RHF form is wrapped
 * in a `FormProvider` so the nested `<PackageItemBuilder>` + the live
 * `<PackagePriceSummary>` can both read `watch` / `setValue` against the
 * same instance.
 *
 * Live pricing:
 *   - Each item row resolves its own unit price (employee override wins
 *     when present, matching `ComputePackagePriceService.resolveUnitPrice`).
 *   - The row reports its `lineTotal` upward via `onLineTotalChange`; the
 *     parent sums the array and feeds the subtotal into
 *     `<PackagePriceSummary>`.
 *
 * Money conversion at submit:
 *   - The form renders `discountValue` in SAR for FIXED; the submit handler
 *     converts SAR → halalas via `sarToHalalas` (PERCENTAGE stays 0-100).
 *   - `Number(price)` coercions defeat the Prisma Decimal string wire format.
 */

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { FormProvider, useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { showApiError } from "@/lib/mutation-helpers"

import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { usePackage, usePackageMutations } from "@/hooks/use-packages"
import { useLocale } from "@/components/locale-provider"
import { sarToHalalas } from "@/lib/money"
import { queryKeys } from "@/lib/query-keys"
import {
  createPackageSchema,
  editPackageSchema,
  type PackageFormData,
} from "@/lib/schemas/package.schema"
import { PackageItemBuilder } from "./package-item-builder"
import { PackagePriceSummary } from "./package-price-summary"
import type {
  CreateSessionPackagePayload,
  PackageDiscountType,
  SessionPackage,
  UpdateSessionPackagePayload,
} from "@/lib/types/package"

/* ─── Types ─── */

type Props = { mode: "create" } | { mode: "edit"; packageId: string }

const DEFAULT_VALUES: PackageFormData = {
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionEn: "",
  iconName: "",
  iconBgColor: "",
  discountType: "PERCENTAGE",
  discountValue: 0,
  sortOrder: 0,
  isActive: true,
  isPublic: false,
  items: [],
}

/* ─── Helpers ─── */

function toStorageValue(value: number, type: PackageDiscountType): number {
  return type === "FIXED" ? sarToHalalas(value) : value
}

/* ─── Component ─── */

export function PackageFormPage(props: Props) {
  const isEdit = props.mode === "edit"
  const packageId = isEdit ? props.packageId : null

  const router = useRouter()
  const { t } = useLocale()
  const qc = useQueryClient()
  const { createMut, updateMut } = usePackageMutations()
  const isPending = isEdit ? updateMut.isPending : createMut.isPending

  const { data: pkg, isLoading } = usePackage(packageId)

  // Use the edit (base) schema for the form so the input shape stays
  // identical between modes. The create mutation re-validates the strict
  // create schema server-side and the submit handler fills in defaults.
  const form = useForm<PackageFormData>({
    resolver: zodResolver(editPackageSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  })

  // Live subtotal aggregation. The item builder calls onLineTotalChange
  // when each row's inputs change; the parent sums the array and feeds it
  // into `<PackagePriceSummary>`.
  const [lineTotals, setLineTotals] = useState<Record<number, number>>({})
  const onLineTotalChange = useCallback((index: number, total: number) => {
    setLineTotals((prev) => {
      if (prev[index] === total) return prev
      return { ...prev, [index]: total }
    })
  }, [])
  const liveSubtotal = Object.values(lineTotals).reduce((a, b) => a + b, 0)

  // ── Hydrate form on edit load ───────────────────────────────────────────
  useEffect(() => {
    if (pkg) {
      form.reset({
        nameAr: pkg.nameAr,
        nameEn: pkg.nameEn ?? "",
        descriptionAr: pkg.descriptionAr ?? "",
        descriptionEn: pkg.descriptionEn ?? "",
        iconName: pkg.iconName ?? "",
        iconBgColor: pkg.iconBgColor ?? "",
        discountType: pkg.discountType,
        discountValue:
          pkg.discountType === "FIXED"
            ? Number(pkg.discountValue) / 100 // halalas → SAR for display
            : Number(pkg.discountValue),
        sortOrder: pkg.sortOrder,
        isActive: pkg.isActive,
        isPublic: pkg.isPublic,
        items: pkg.items.map((it) => ({
          serviceId: it.serviceId,
          employeeId: it.employeeId,
          durationOptionId: it.durationOptionId,
          paidQuantity: it.paidQuantity,
          freeQuantity: it.freeQuantity,
          sortOrder: it.sortOrder,
        })),
      })
    }
  }, [pkg, form])

  // Clear stale lineTotals if rows are removed.
  const watchedItems = form.watch("items") ?? []
  useEffect(() => {
    setLineTotals((prev) => {
      const next: Record<number, number> = {}
      for (let i = 0; i < watchedItems.length; i++) next[i] = prev[i] ?? 0
      return next
    })
  }, [watchedItems.length])

  const watchedDiscountType = (form.watch("discountType") ?? "PERCENTAGE") as PackageDiscountType
  const watchedDiscountValue = Number(form.watch("discountValue") ?? 0)
  const storageDiscount = toStorageValue(watchedDiscountValue, watchedDiscountType)

  const translateError = (msg?: string) => (msg ? t(msg) : undefined)

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const items = (data.items ?? []).map((it, i) => ({
        serviceId: it.serviceId,
        employeeId: it.employeeId,
        durationOptionId: it.durationOptionId,
        paidQuantity: Number(it.paidQuantity ?? 0),
        freeQuantity: Number(it.freeQuantity ?? 0),
        sortOrder: Number(it.sortOrder ?? i),
      }))

      // Defensive strict-mode parse so a missing nameAr etc. on create
      // surfaces as a real Zod error (the form's base schema permits
      // them to be optional).
      const strict = isEdit ? editPackageSchema : createPackageSchema
      const strictResult = strict.safeParse(data)
      if (!strictResult.success) {
        // Push errors into RHF so the existing <p>error</p> blocks render.
        for (const issue of strictResult.error.issues) {
          const key = issue.path.join(".") as Parameters<typeof form.setError>[0]
          form.setError(key, { type: "validate", message: issue.message })
        }
        return
      }
      const strictData = strictResult.data

      if (isEdit) {
        await updateMut.mutateAsync({
          id: pkg!.id,
          nameAr: strictData.nameAr,
          nameEn: strictData.nameEn || undefined,
          descriptionAr: strictData.descriptionAr || undefined,
          descriptionEn: strictData.descriptionEn || undefined,
          iconName: strictData.iconName || undefined,
          iconBgColor: strictData.iconBgColor || undefined,
          discountType: strictData.discountType,
          discountValue: storageDiscount,
          sortOrder: Number(strictData.sortOrder ?? 0),
          isActive: strictData.isActive,
          isPublic: strictData.isPublic,
          items,
        } satisfies { id: string } & UpdateSessionPackagePayload)
        toast.success(t("packages.edit.success"))
      } else {
        await createMut.mutateAsync({
          nameAr: strictData.nameAr ?? "",
          nameEn: strictData.nameEn || undefined,
          descriptionAr: strictData.descriptionAr || undefined,
          descriptionEn: strictData.descriptionEn || undefined,
          iconName: strictData.iconName || undefined,
          iconBgColor: strictData.iconBgColor || undefined,
          discountType: (strictData.discountType ?? "PERCENTAGE") as PackageDiscountType,
          discountValue: storageDiscount,
          sortOrder: Number(strictData.sortOrder ?? 0),
          isActive: strictData.isActive,
          isPublic: strictData.isPublic,
          items,
        } satisfies CreateSessionPackagePayload)
        toast.success(t("packages.create.success"))
      }
      // Best-effort cache revalidation before navigating.
      qc.invalidateQueries({ queryKey: queryKeys.packages.all })
      router.push("/packages")
    } catch (err) {
      showApiError(err, {
        fallback: t(isEdit ? "packages.edit.error" : "packages.create.error"),
        t,
      })
    }
  })

  if (isEdit && isLoading) {
    return (
      <ListPageShell>
        <Skeleton className="h-8 w-48" />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      </ListPageShell>
    )
  }

  if (isEdit && !isLoading && !pkg) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader title={t("packages.notFound.title")} description={t("packages.notFound.desc")} />
        <Button variant="ghost" onClick={() => router.push("/packages")}>{t("packages.notFound.back")}</Button>
      </ListPageShell>
    )
  }

  const title = isEdit ? t("packages.edit.title") : t("packages.create.title")
  const description = isEdit ? (pkg?.nameAr ?? "") : t("packages.create.description")
  const submitLabel = isPending
    ? t(isEdit ? "packages.edit.submitting" : "packages.create.submitting")
    : t(isEdit ? "packages.edit.submit" : "packages.create.submit")

  return (
    <FormProvider {...form}>
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader title={title} description={description} />
        <form onSubmit={onSubmit} className="flex flex-col gap-6 pb-24">
          {isEdit && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor="package-active" className="cursor-pointer">
                {t("packages.edit.isActive")}
              </Label>
              <Switch
                id="package-active"
                checked={!!form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("packages.create.nameAr")} *</Label>
              <Input {...form.register("nameAr")} dir="rtl" />
              {form.formState.errors.nameAr && (
                <p className="text-xs text-destructive">
                  {translateError(form.formState.errors.nameAr.message)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("packages.create.nameEn")}</Label>
              <Input {...form.register("nameEn")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("packages.create.descriptionAr")}</Label>
              <Input {...form.register("descriptionAr")} dir="rtl" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("packages.create.descriptionEn")}</Label>
              <Input {...form.register("descriptionEn")} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("packages.create.discountType")}</Label>
              <Controller
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <Select value={field.value ?? "PERCENTAGE"} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">{t("packages.create.discountPercentage")}</SelectItem>
                      <SelectItem value="FIXED">{t("packages.create.discountFixed")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("packages.create.discountValue")}</Label>
              <Controller
                control={form.control}
                name="discountValue"
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
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("packages.create.sortOrder")}</Label>
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
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("packages.create.iconLabel")}</Label>
              <Input
                {...form.register("iconName")}
                placeholder="package"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("packages.create.iconColor")}</Label>
              <Input
                {...form.register("iconBgColor")}
                placeholder="#FFD8A8"
              />
            </div>
          </div>

          <Controller
            control={form.control}
            name="items"
            render={() => (
              <div className="flex flex-col gap-1.5">
                <PackageItemBuilder
                  fieldArrayName="items"
                  onLineTotalChange={onLineTotalChange}
                />
                {form.formState.errors.items &&
                  typeof form.formState.errors.items === "object" &&
                  "message" in form.formState.errors.items && (
                    <p className="text-xs text-destructive">
                      {translateError((form.formState.errors.items as { message?: string }).message)}
                    </p>
                  )}
              </div>
            )}
          />

          <PackagePriceSummary
            subtotal={liveSubtotal}
            discountType={watchedDiscountType}
            discountValue={storageDiscount}
          />

          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label htmlFor="package-public" className="cursor-pointer">
                  {t("packages.edit.isPublic")}
                </Label>
                <span className="text-xs text-muted-foreground">
                  {t("packages.edit.isPublicDesc")}
                </span>
              </div>
              <Switch
                id="package-public"
                checked={!!form.watch("isPublic")}
                onCheckedChange={(v) => form.setValue("isPublic", v)}
              />
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={() => router.push("/packages")}>
              {t(isEdit ? "packages.edit.cancel" : "packages.create.cancel")}
            </Button>
            <Button type="submit" size="lg" className="rounded-lg" disabled={isPending}>{submitLabel}</Button>
          </div>
        </form>
      </ListPageShell>
    </FormProvider>
  )
}

// Re-export the type to keep this file grouped with the form.
export type { SessionPackage }
