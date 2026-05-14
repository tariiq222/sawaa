"use client"

import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import type { CouponFormData } from "@/lib/schemas/coupon.schema"
import {
  DiscountIcon,
  TextAlignLeftIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { DateTimeInput } from "@deqah/ui"
import { Switch } from "@deqah/ui"
import { Card, CardContent } from "@deqah/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deqah/ui"
import { SectionHeader } from "@/components/features/section-header"
import { useLocale } from "@/components/locale-provider"

interface CouponFormFieldsProps {
  form: UseFormReturn<CouponFormData>
  isEdit: boolean
  mode: "create" | "edit"
}

export function CouponFormFields({ form, isEdit, mode }: CouponFormFieldsProps) {
  const { t } = useLocale()
  const discountType = form.watch("discountType")
  const req = isEdit ? "" : " *"

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ── Code & Discount ── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader
            icon={DiscountIcon}
            title={t("coupons.section.basic")}
            description={t("coupons.section.basicDescription")}
          />
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <Label>{t("coupons.create.code")}{req}</Label>
              <Input
                {...form.register("code")}
                placeholder={isEdit ? undefined : "SUMMER20"}
                className="uppercase"
                onChange={(e) => form.setValue("code", e.target.value.toUpperCase())}
              />
              {form.formState.errors.code && (
                <p className="text-xs text-destructive">{form.formState.errors.code.message as string}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.discountType")}{req}</Label>
                <Controller
                  control={form.control}
                  name="discountType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE">{t("coupons.type.percentage")}</SelectItem>
                        <SelectItem value="FIXED">{t("coupons.type.fixed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.discountValue")}{req}</Label>
                <Input
                  type="number"
                  min={1}
                  {...form.register("discountValue")}
                  placeholder={discountType === "PERCENTAGE" ? "10" : "50"}
                />
                {form.formState.errors.discountValue && (
                  <p className="text-xs text-destructive">{form.formState.errors.discountValue.message as string}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Limits & Expiry ── */}
      <Card>
        <CardContent className="pt-6">
          <SectionHeader
            icon={Settings01Icon}
            title={t("coupons.section.limits")}
            description={t("coupons.section.limitsDescription")}
          />
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.minAmount")}</Label>
                <Input type="number" min={0} step="0.01" {...form.register("minOrderAmt")} placeholder={isEdit ? undefined : "0"} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>{t("coupons.create.maxUses")}</Label>
                <Input type="number" min={1} {...form.register("maxUses")} placeholder={t("coupons.noExpiry")} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("coupons.create.maxUsesPerUser")}</Label>
              <Input type="number" min={1} {...form.register("maxUsesPerUser")} placeholder={t("coupons.noExpiry")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("coupons.create.expiresAt")}</Label>
              <Controller
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <DateTimeInput
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    error={!!form.formState.errors.expiresAt}
                  />
                )}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label htmlFor={`${mode}-coupon-active`} className="cursor-pointer text-sm">
                {t("coupons.create.isActive")}
              </Label>
              <Switch
                id={`${mode}-coupon-active`}
                checked={form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Descriptions (full width) ── */}
      <Card className="lg:col-span-2">
        <CardContent className="pt-6">
          <SectionHeader
            icon={TextAlignLeftIcon}
            title={t("coupons.section.description")}
            description={t("coupons.section.descriptionDescription")}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>{t("coupons.create.descEn")}</Label>
              <Input {...form.register("descriptionEn")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>{t("coupons.create.descAr")}</Label>
              <Input {...form.register("descriptionAr")} dir="rtl" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
