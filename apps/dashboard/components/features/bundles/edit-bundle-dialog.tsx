"use client"

import { useEffect, useMemo } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { Button } from "@sawaa/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { useBundleMutations } from "@/hooks/use-bundles"
import { useAllServices } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import { sarToHalalas, halalasToSarNumber } from "@/lib/money"
import {
  editBundleSchema,
  type EditBundleFormData,
} from "@/lib/schemas/bundle.schema"
import type { ServiceBundle } from "@/lib/types/bundle"
import { BundleServicesPicker } from "./bundle-services-picker"
import { BundlePriceSummary } from "./bundle-price-summary"

interface Props {
  bundle: ServiceBundle | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// FIXED bundles store discountValue in halalas; the form input is SAR-major.
// PERCENTAGE stores a raw percent (0-100) and must never be converted.
function toDisplayValue(value: number, type: "PERCENTAGE" | "FIXED") {
  return type === "FIXED" ? halalasToSarNumber(value) : value
}

function toStorageValue(value: number, type: "PERCENTAGE" | "FIXED") {
  return type === "FIXED" ? sarToHalalas(value) : value
}

export function EditBundleDialog({ bundle, open, onOpenChange }: Props) {
  const { t } = useLocale()
  const { updateMut } = useBundleMutations()
  const { services } = useAllServices()

  const form = useForm<EditBundleFormData>({
    resolver: zodResolver(editBundleSchema),
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

  const watchedServiceIds = form.watch("serviceIds")
  const watchedDiscountType = form.watch("discountType") ?? "PERCENTAGE"
  const watchedDiscountValue = form.watch("discountValue") ?? 0

  const selectedPrices = useMemo(
    () => {
      const serviceIds = watchedServiceIds ?? []
      // Resolve prices from the full services list, falling back to the prices
      // the backend already returned on bundle.items — so a selected service
      // that is missing from the fetched list is never undercounted.
      const priceById = new Map<string, number>()
      for (const s of services) priceById.set(s.id, s.price)
      for (const item of bundle?.items ?? []) {
        if (!priceById.has(item.serviceId)) {
          priceById.set(item.serviceId, item.service.price)
        }
      }
      return serviceIds
        .map((id) => priceById.get(id))
        .filter((p): p is number => p != null)
    },
    [services, watchedServiceIds, bundle],
  )

  const translateError = (msg?: string) => (msg ? t(msg) : undefined)

  const onSubmit = form.handleSubmit(async (data) => {
    if (!bundle) return
    try {
      await updateMut.mutateAsync({
        id: bundle.id,
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
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bundles.edit.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("bundles.edit.title")}</DialogTitle>
          <DialogDescription>{t("bundles.edit.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="edit-bundle-form" onSubmit={onSubmit} className="flex flex-col gap-5">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="edit-bundle-active" className="cursor-pointer">
                {t("bundles.edit.isActive")}
              </Label>
              <Switch
                id="edit-bundle-active"
                checked={!!form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>

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
                  <BundleServicesPicker
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
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
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("bundles.edit.cancel")}
          </Button>
          <Button type="submit" form="edit-bundle-form" size="sm" disabled={updateMut.isPending}>
            {updateMut.isPending
              ? t("bundles.edit.submitting")
              : t("bundles.edit.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
