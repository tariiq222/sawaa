"use client"

import { useMemo } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { useBundleMutations } from "@/hooks/use-bundles"
import { useServices } from "@/hooks/use-services"
import { useLocale } from "@/components/locale-provider"
import {
  createBundleSchema,
  type CreateBundleFormData,
} from "@/lib/schemas/bundle.schema"
import { BundleServicesPicker } from "./bundle-services-picker"
import { BundlePriceSummary } from "./bundle-price-summary"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateBundleDialog({ open, onOpenChange }: Props) {
  const { t } = useLocale()
  const { createMut } = useBundleMutations()
  const { services } = useServices()

  const form = useForm<CreateBundleFormData>({
    resolver: zodResolver(createBundleSchema),
    defaultValues: {
      nameAr: "",
      nameEn: "",
      descriptionAr: "",
      descriptionEn: "",
      discountType: "PERCENTAGE",
      discountValue: 0,
      sortOrder: 0,
      serviceIds: [],
    },
  })

  const watchedServiceIds = form.watch("serviceIds")
  const watchedDiscountType = form.watch("discountType")
  const watchedDiscountValue = form.watch("discountValue")

  const selectedPrices = useMemo(
    () =>
      services
        .filter((s) => watchedServiceIds.includes(s.id))
        .map((s) => s.price),
    [services, watchedServiceIds],
  )

  const translateError = (msg?: string) => (msg ? t(msg) : undefined)

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await createMut.mutateAsync({
        nameAr: data.nameAr,
        nameEn: data.nameEn || undefined,
        descriptionAr: data.descriptionAr || undefined,
        descriptionEn: data.descriptionEn || undefined,
        discountType: data.discountType,
        discountValue: data.discountValue,
        sortOrder: data.sortOrder,
        serviceIds: data.serviceIds,
      })
      toast.success(t("bundles.create.success"))
      form.reset()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("bundles.create.error"))
    }
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("bundles.create.title")}</DialogTitle>
          <DialogDescription>{t("bundles.create.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id="create-bundle-form" onSubmit={onSubmit} className="flex flex-col gap-5">
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
                    <Select value={field.value} onValueChange={field.onChange}>
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
                  <BundleServicesPicker value={field.value} onChange={field.onChange} />
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
              discountValue={watchedDiscountValue ?? 0}
            />
          </form>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("bundles.create.cancel")}
          </Button>
          <Button type="submit" form="create-bundle-form" disabled={createMut.isPending}>
            {createMut.isPending
              ? t("bundles.create.submitting")
              : t("bundles.create.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
