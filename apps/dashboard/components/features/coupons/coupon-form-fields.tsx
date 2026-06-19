"use client"

import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import type { CouponFormData } from "@/lib/schemas/coupon.schema"
import { Input } from "@sawaa/ui"
import { DateTimeInput } from "@sawaa/ui"
import { Switch } from "@sawaa/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { FormSection, FormField } from "@/components/features/shared/form-section"
import { useLocale } from "@/components/locale-provider"

interface CouponFormFieldsProps {
  form: UseFormReturn<CouponFormData>
  isEdit: boolean
  mode: "create" | "edit"
}

export function CouponFormFields({ form, isEdit, mode }: CouponFormFieldsProps) {
  const { t } = useLocale()
  const discountType = form.watch("discountType")

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* ── Code & Discount ── */}
      <FormSection title={t("coupons.section.basic")}>
        <div className="space-y-4">
          <FormField
            label={t("coupons.create.code")}
            required={!isEdit}
            error={form.formState.errors.code?.message as string | undefined}
          >
            <Input
              {...form.register("code")}
              placeholder={isEdit ? undefined : "SUMMER20"}
              className="uppercase"
              onChange={(e) => form.setValue("code", e.target.value.toUpperCase())}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("coupons.create.discountType")} required={!isEdit}>
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
            </FormField>
            <FormField
              label={t("coupons.create.discountValue")}
              required={!isEdit}
              error={form.formState.errors.discountValue?.message as string | undefined}
            >
              <Input
                type="number"
                min={1}
                {...form.register("discountValue")}
                placeholder={discountType === "PERCENTAGE" ? "10" : "50"}
              />
            </FormField>
          </div>
        </div>
      </FormSection>

      {/* ── Limits & Expiry ── */}
      <FormSection title={t("coupons.section.limits")}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t("coupons.create.minAmount")}>
              <Input type="number" min={0} step="0.01" {...form.register("minOrderAmt")} placeholder={isEdit ? undefined : "0"} />
            </FormField>
            <FormField label={t("coupons.create.maxUses")}>
              <Input type="number" min={1} {...form.register("maxUses")} placeholder={t("coupons.noExpiry")} />
            </FormField>
          </div>
          <FormField label={t("coupons.create.maxUsesPerUser")}>
            <Input type="number" min={1} {...form.register("maxUsesPerUser")} placeholder={t("coupons.noExpiry")} />
          </FormField>
          <FormField label={t("coupons.create.expiresAt")}>
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
          </FormField>
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
      </FormSection>

      {/* ── Descriptions (full width) ── */}
      <FormSection title={t("coupons.section.description")} className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t("coupons.create.descEn")}>
            <Input {...form.register("descriptionEn")} />
          </FormField>
          <FormField label={t("coupons.create.descAr")}>
            <Input {...form.register("descriptionAr")} dir="rtl" />
          </FormField>
        </div>
      </FormSection>
    </div>
  )
}
