"use client"

import { useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

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
import { useBundle, useBundleMutations } from "@/hooks/use-bundles"
import { useAllServices } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { sarToHalalas, halalasToSarNumber } from "@/lib/money"
import {
  createBundleSchema,
  editBundleSchema,
  type EditBundleFormData,
} from "@/lib/schemas/bundle.schema"
import { BundleServicesPicker } from "./bundle-services-picker"
import { BundlePriceSummary } from "./bundle-price-summary"

/* ─── Types ─── */

type Props = { mode: "create" } | { mode: "edit"; bundleId: string }

const DEFAULT_VALUES: EditBundleFormData = {
  nameAr: "",
  nameEn: "",
  descriptionAr: "",
  descriptionEn: "",
  discountType: "PERCENTAGE",
  discountValue: 0,
  sortOrder: 0,
  serviceIds: [],
}

/* ─── Helpers ─── */

function toDisplayValue(value: number, type: "PERCENTAGE" | "FIXED") {
  return type === "FIXED" ? halalasToSarNumber(value) : value
}

function toStorageValue(value: number, type: "PERCENTAGE" | "FIXED") {
  return type === "FIXED" ? sarToHalalas(value) : value
}

/* ─── Bundle Form Page ─── */

export function BundleFormPage(props: Props) {
  const isEdit = props.mode === "edit"
  const bundleId = isEdit ? props.bundleId : null

  const router = useRouter()
  const { t } = useLocale()
  const { createMut, updateMut } = useBundleMutations()
  const isPending = isEdit ? updateMut.isPending : createMut.isPending

  const { data: bundle, isLoading } = useBundle(bundleId)
  const { services } = useAllServices()

  const form = useForm<EditBundleFormData>({
    resolver: zodResolver(isEdit ? editBundleSchema : createBundleSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (bundle) {
      form.reset({
        nameAr: bundle.nameAr,
        nameEn: bundle.nameEn ?? "",
        descriptionAr: bundle.descriptionAr ?? "",
        descriptionEn: bundle.descriptionEn ?? "",
        discountType: bundle.discountType,
        discountValue: toDisplayValue(bundle.discountValue, bundle.discountType),
        sortOrder: bundle.sortOrder,
        isActive: bundle.isActive,
        isHidden: bundle.isHidden,
        serviceIds: bundle.items.map((i) => i.serviceId),
      })
    }
  }, [bundle, form])

  const watchedServiceIds = form.watch("serviceIds") ?? []
  const watchedDiscountType = form.watch("discountType") ?? "PERCENTAGE"
  const watchedDiscountValue = form.watch("discountValue") ?? 0

  const selectedPrices = useMemo(() => {
    const serviceIds = watchedServiceIds
    const priceById = new Map<string, number>()
    for (const s of services) priceById.set(s.id, s.price)
    for (const item of bundle?.items ?? []) {
      if (!priceById.has(item.serviceId)) priceById.set(item.serviceId, item.service.price)
    }
    return serviceIds.map((id) => priceById.get(id)).filter((p): p is number => p != null)
  }, [services, watchedServiceIds, bundle])

  const translateError = (msg?: string) => (msg ? t(msg) : undefined)

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      if (isEdit) {
        await updateMut.mutateAsync({
          id: bundle!.id,
          nameAr: data.nameAr,
          nameEn: data.nameEn || undefined,
          descriptionAr: data.descriptionAr || undefined,
          descriptionEn: data.descriptionEn || undefined,
          discountType: data.discountType,
          discountValue:
            data.discountValue != null && data.discountType != null
              ? toStorageValue(data.discountValue, data.discountType)
              : data.discountValue,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
          isHidden: data.isHidden,
          serviceIds: data.serviceIds,
        })
        toast.success(t("bundles.edit.success"))
      } else {
        const discountType = (data.discountType ?? "PERCENTAGE") as "PERCENTAGE" | "FIXED"
        await createMut.mutateAsync({
          nameAr: data.nameAr ?? "",
          nameEn: data.nameEn || undefined,
          descriptionAr: data.descriptionAr || undefined,
          descriptionEn: data.descriptionEn || undefined,
          discountType,
          discountValue: toStorageValue(data.discountValue ?? 0, discountType),
          sortOrder: data.sortOrder ?? 0,
          serviceIds: data.serviceIds ?? [],
        })
        toast.success(t("bundles.create.success"))
      }
      router.push("/bundles")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(isEdit ? "bundles.edit.error" : "bundles.create.error"))
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

  if (isEdit && !isLoading && !bundle) {
    return (
      <ListPageShell>
        <Breadcrumbs />
        <PageHeader title={t("bundles.notFound.title")} description={t("bundles.notFound.desc")} />
        <Button variant="ghost" onClick={() => router.push("/bundles")}>{t("bundles.notFound.back")}</Button>
      </ListPageShell>
    )
  }

  const title = isEdit ? t("bundles.edit.title") : t("bundles.create.title")
  const description = isEdit ? (bundle?.nameAr ?? "") : t("bundles.create.description")
  const submitLabel = isPending
    ? t(isEdit ? "bundles.edit.submitting" : "bundles.create.submitting")
    : t(isEdit ? "bundles.edit.submit" : "bundles.create.submit")

  return (
    <ListPageShell>
      <Breadcrumbs />
      <PageHeader title={title} description={description} />
      <form onSubmit={onSubmit} className="flex flex-col gap-6 pb-24">
        {isEdit && (
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="bundle-active" className="cursor-pointer">
              {t("bundles.edit.isActive")}
            </Label>
            <Switch
              id="bundle-active"
              checked={!!form.watch("isActive")}
              onCheckedChange={(v) => form.setValue("isActive", v)}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("bundles.create.nameAr")} *</Label>
            <Input {...form.register("nameAr")} dir="rtl" />
            {form.formState.errors.nameAr && (
              <p className="text-xs text-destructive">
                {translateError(form.formState.errors.nameAr.message)}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("bundles.create.nameEn")}</Label>
            <Input {...form.register("nameEn")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("bundles.create.descriptionAr")}</Label>
            <Input {...form.register("descriptionAr")} dir="rtl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("bundles.create.descriptionEn")}</Label>
            <Input {...form.register("descriptionEn")} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>{t("bundles.create.discountType")}</Label>
            <Controller
              control={form.control}
              name="discountType"
              render={({ field }) => (
                <Select value={field.value ?? "PERCENTAGE"} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">{t("bundles.create.discountPercentage")}</SelectItem>
                    <SelectItem value="FIXED">{t("bundles.create.discountFixed")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t("bundles.create.discountValue")}</Label>
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
            <Label>{t("bundles.create.sortOrder")}</Label>
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

        <Controller
          control={form.control}
          name="serviceIds"
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <BundleServicesPicker value={field.value ?? []} onChange={field.onChange} />
              {form.formState.errors.serviceIds && (
                <p className="text-xs text-destructive">
                  {translateError(form.formState.errors.serviceIds.message)}
                </p>
              )}
            </div>
          )}
        />

        <BundlePriceSummary
          servicePrices={selectedPrices}
          discountType={watchedDiscountType}
          discountValue={toStorageValue(watchedDiscountValue, watchedDiscountType)}
        />

        {isEdit && (
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label htmlFor="bundle-hidden" className="cursor-pointer">
              {t("bundles.edit.isHidden")}
            </Label>
            <Switch
              id="bundle-hidden"
              checked={!!form.watch("isHidden")}
              onCheckedChange={(v) => form.setValue("isHidden", v)}
            />
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-6 border-t border-border bg-background px-4 sm:px-6 py-3 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" size="lg" className="rounded-lg" onClick={() => router.push("/bundles")}>
            {t(isEdit ? "bundles.edit.cancel" : "bundles.create.cancel")}
          </Button>
          <Button type="submit" size="lg" className="rounded-lg" disabled={isPending}>{submitLabel}</Button>
        </div>
      </form>
    </ListPageShell>
  )
}
