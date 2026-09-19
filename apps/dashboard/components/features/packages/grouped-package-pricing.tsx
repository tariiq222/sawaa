"use client"

import type { UseFormReturn } from "react-hook-form"
import { Input, Label } from "@sawaa/ui"
import { FormSection } from "@/components/features/shared/form-section"
import { useLocale } from "@/components/locale-provider"
import { formatPrice } from "@/lib/money"
import type { GroupedPackageFormData } from "@/lib/schemas/package-groups.schema"

export function GroupedPackagePricing({ form, preview, translateError, idPrefix }: { form: UseFormReturn<GroupedPackageFormData>; preview: { subtotal: number; discountAmount: number; amountPaid: number; valid: boolean; error?: string }; translateError: (message?: string) => string | undefined; idPrefix?: string }) {
  const { t, locale } = useLocale()
  const discount = form.watch("globalDiscount")
  const error = form.formState.errors.globalDiscount?.value?.message
  const discountTypeRegistration = form.register("globalDiscount.type")
  const typeId = idPrefix ? `${idPrefix}-globalDiscount.type` : "globalDiscount.type"
  const valueId = idPrefix ? `${idPrefix}-globalDiscount.value` : "globalDiscount.value"
  return <FormSection title={t("packages.grouped.pricing.title")} description={t("packages.grouped.pricing.description")}>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={t("packages.grouped.discount.type")} htmlFor={typeId} error={translateError(form.formState.errors.globalDiscount?.type?.message)}>
        <select {...discountTypeRegistration} id={typeId} className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={discount.type} onChange={(event) => { void discountTypeRegistration.onChange(event); form.setValue("globalDiscount", { type: event.target.value as "NONE" | "PERCENTAGE" | "FIXED", value: 0 }, { shouldDirty: true }) }}>
          <option value="NONE">{t("packages.grouped.discount.none")}</option><option value="PERCENTAGE">{t("packages.grouped.discount.percent")}</option><option value="FIXED">{t("packages.grouped.discount.fixed")}</option>
        </select>
      </Field>
      {discount.type !== "NONE" && <Field label={discount.type === "FIXED" ? t("packages.grouped.discount.amountSar") : t("packages.grouped.discount.percentValue")} htmlFor={valueId} error={translateError(error)}><Input id={valueId} type="number" min={0} max={discount.type === "PERCENTAGE" ? 100 : undefined} step="0.01" {...form.register("globalDiscount.value", { valueAsNumber: true })} inputMode="decimal" /></Field>}
    </div>
    {!preview.valid && <p role="alert" className="mt-4 text-sm text-destructive">{t("packages.grouped.errors.invalidPreview")}</p>}
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label={t("packages.grouped.pricing.summary")}>
      <Price label={t("packages.summary.subtotal")} value={preview.valid ? preview.subtotal : null} locale={locale} />
      <Price label={t("packages.summary.discount")} value={preview.valid ? preview.discountAmount : null} locale={locale} />
      <Price label={t("packages.summary.finalPrice")} value={preview.valid ? preview.amountPaid : null} locale={locale} strong />
    </div>
  </FormSection>
}

function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: React.ReactNode; htmlFor: string }) { return <div className="flex flex-col gap-1.5"><Label htmlFor={htmlFor}>{label}</Label>{children}{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div> }
function Price({ label, value, locale, strong }: { label: string; value: number | null; locale: string; strong?: boolean }) { return <div className={`rounded-xl border border-border bg-surface-muted p-4 ${strong ? "border-primary/40" : ""}`}><Label className="text-xs text-muted-foreground">{label}</Label><p className={`mt-2 tabular-nums ${strong ? "text-lg font-semibold" : "text-base"}`}>{value === null ? "—" : formatPrice(value, { locale })} {value === null ? "" : locale === "ar" ? "ر.س" : "SAR"}</p></div> }
