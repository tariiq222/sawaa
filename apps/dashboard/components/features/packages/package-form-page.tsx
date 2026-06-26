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

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { FormProvider, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { showApiError } from "@/lib/mutation-helpers"

import { Button } from "@sawaa/ui"
import { Skeleton } from "@sawaa/ui"

import { ListPageShell } from "@/components/features/list-page-shell"
import { PageHeader } from "@/components/features/page-header"
import { Breadcrumbs } from "@/components/features/breadcrumbs"
import { usePackage, usePackageMutations } from "@/hooks/use-packages"
import { uploadPackageImage } from "@/lib/api/packages"
import { useLocale } from "@/components/locale-provider"
import { sarToHalalas } from "@/lib/money"
import { computePackagePrice } from "@/lib/package-price"
import { queryKeys } from "@/lib/query-keys"
import {
  createPackageSchema,
  editPackageSchema,
  type PackageFormData,
} from "@/lib/schemas/package.schema"
import { PackageFormFields } from "./package-form-fields"
import type { PackageLineDetail } from "./package-item-builder"
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
  imageUrl: null,
  iconName: null,
  iconBgColor: null,
  sortOrder: 0,
  isActive: true,
  isPublic: false,
  items: [],
}

/* ─── Helpers ─── */

/** Per-item FIXED discount is entered in SAR; convert to halalas for storage. */
function itemStorageDiscount(
  type: PackageDiscountType | null | undefined,
  value: number | undefined,
): number {
  if (!type || !value) return 0
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

  // Image file picked but not yet uploaded; flushed after create/update.
  const pendingAvatarFile = useRef<File | null>(null)

  // Use the edit (base) schema for the form so the input shape stays
  // identical between modes. The create mutation re-validates the strict
  // create schema server-side and the submit handler fills in defaults.
  const form = useForm<PackageFormData>({
    resolver: zodResolver(editPackageSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  })

  // Live pricing aggregation. The item builder calls onLineChange when each
  // row's resolved detail changes; the parent keeps the per-row detail so the
  // `<PackagePriceSummary>` can render a per-service breakdown + subtotal.
  const [lineDetails, setLineDetails] = useState<Record<number, PackageLineDetail>>({})
  const onLineChange = useCallback((index: number, detail: PackageLineDetail) => {
    setLineDetails((prev) => {
      const cur = prev[index]
      if (
        cur &&
        cur.serviceName === detail.serviceName &&
        cur.paidQuantity === detail.paidQuantity &&
        cur.freeQuantity === detail.freeQuantity &&
        cur.unitPrice === detail.unitPrice &&
        cur.discountType === detail.discountType &&
        cur.discountValue === detail.discountValue
      ) {
        return prev
      }
      return { ...prev, [index]: detail }
    })
  }, [])
  const lineItems = Object.keys(lineDetails)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => lineDetails[i])
  // Live per-item + total price breakdown (storage scale; discount already in halalas/pct).
  const breakdown = computePackagePrice(
    lineItems.map((d) => ({
      unitPrice: d.unitPrice,
      paidQuantity: d.paidQuantity,
      freeQuantity: d.freeQuantity,
      discountType: d.discountType,
      discountValue: d.discountValue,
    })),
  )

  // ── Hydrate form on edit load ───────────────────────────────────────────
  useEffect(() => {
    if (pkg) {
      form.reset({
        nameAr: pkg.nameAr,
        nameEn: pkg.nameEn ?? "",
        descriptionAr: pkg.descriptionAr ?? "",
        descriptionEn: pkg.descriptionEn ?? "",
        imageUrl: pkg.imageUrl ?? null,
        iconName: pkg.iconName ?? null,
        iconBgColor: pkg.iconBgColor ?? null,
        sortOrder: pkg.sortOrder,
        isActive: pkg.isActive,
        isPublic: pkg.isPublic,
        items: pkg.items.map((it) => ({
          serviceId: it.serviceId,
          employeeId: it.employeeId,
          durationOptionId: it.durationOptionId,
          paidQuantity: it.paidQuantity,
          freeQuantity: it.freeQuantity,
          discountType: it.discountType ?? null,
          // FIXED stored as halalas → display in SAR; PERCENTAGE stays as-is.
          discountValue:
            it.discountType === "FIXED"
              ? Number(it.discountValue) / 100
              : Number(it.discountValue ?? 0),
          sortOrder: it.sortOrder,
        })),
      })
    }
  }, [pkg, form])

  // Clear stale line details if rows are removed.
  const watchedItems = form.watch("items") ?? []
  useEffect(() => {
    setLineDetails((prev) => {
      const next: Record<number, PackageLineDetail> = {}
      for (let i = 0; i < watchedItems.length; i++) if (prev[i]) next[i] = prev[i]
      return next
    })
  }, [watchedItems.length])

  const translateError = (msg?: string) => (msg ? t(msg) : undefined)

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const items = (data.items ?? []).map((it, i) => ({
        serviceId: it.serviceId,
        employeeId: it.employeeId,
        durationOptionId: it.durationOptionId,
        paidQuantity: Number(it.paidQuantity ?? 0),
        freeQuantity: Number(it.freeQuantity ?? 0),
        discountType: it.discountType ?? null,
        discountValue: itemStorageDiscount(it.discountType, it.discountValue),
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
          imageUrl: strictData.imageUrl?.startsWith("blob:") ? undefined : (strictData.imageUrl ?? null),
          iconName: strictData.iconName ?? null,
          iconBgColor: strictData.iconBgColor ?? null,
          sortOrder: Number(strictData.sortOrder ?? 0),
          isActive: strictData.isActive,
          isPublic: strictData.isPublic,
          items,
        } satisfies { id: string } & UpdateSessionPackagePayload)
        if (pendingAvatarFile.current) {
          await uploadPackageImage(pkg!.id, pendingAvatarFile.current)
          pendingAvatarFile.current = null
        }
        toast.success(t("packages.edit.success"))
      } else {
        const created = await createMut.mutateAsync({
          nameAr: strictData.nameAr ?? "",
          nameEn: strictData.nameEn || undefined,
          descriptionAr: strictData.descriptionAr || undefined,
          descriptionEn: strictData.descriptionEn || undefined,
          imageUrl: strictData.imageUrl?.startsWith("blob:") ? undefined : (strictData.imageUrl ?? null),
          iconName: strictData.iconName ?? null,
          iconBgColor: strictData.iconBgColor ?? null,
          sortOrder: Number(strictData.sortOrder ?? 0),
          isActive: strictData.isActive,
          isPublic: strictData.isPublic,
          items,
        } satisfies CreateSessionPackagePayload)
        if (pendingAvatarFile.current) {
          await uploadPackageImage(created.id, pendingAvatarFile.current)
          pendingAvatarFile.current = null
        }
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
          <PackageFormFields
            form={form}
            onLineChange={onLineChange}
            onImageSelect={(file) => { pendingAvatarFile.current = file }}
            lineItems={lineItems}
            breakdown={breakdown}
            translateError={translateError}
          />

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
