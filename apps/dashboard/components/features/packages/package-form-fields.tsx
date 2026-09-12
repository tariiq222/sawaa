"use client"

import { Controller, type UseFormReturn } from "react-hook-form"
import { Input } from "@sawaa/ui"
import { FormSection, FormField } from "@/components/features/shared/form-section"
import { useLocale } from "@/components/locale-provider"
import type { PackageFormData } from "@/lib/schemas/package.schema"
import type { PackagePriceBreakdown } from "@/lib/types/package"
import { PackageItemBuilder, type PackageLineDetail } from "./package-item-builder"
import { PackagePriceSummary } from "./package-price-summary"
import { PackageReview } from "./package-review"
import { PackageDetailsFields } from "./package-details-fields"

interface PackageFormFieldsProps { form: UseFormReturn<PackageFormData>; onLineChange: (index: number, detail: PackageLineDetail) => void; onImageSelect?: (file: File) => void; lineItems: PackageLineDetail[]; breakdown: PackagePriceBreakdown; translateError: (msg?: string) => string | undefined; step: 1 | 2 | 3 | 4 }

export function PackageFormFields({ form, onLineChange, onImageSelect, lineItems, breakdown, translateError, step }: PackageFormFieldsProps) {
  const { t } = useLocale()
  const errors = form.formState.errors
  const itemsError = errors.items && typeof errors.items === "object" && "message" in errors.items ? translateError((errors.items as { message?: string }).message) : undefined
  const ownerId = form.watch("ownerEmployeeId")
  return <>
    {step === 1 && <PackageDetailsFields form={form} onImageSelect={onImageSelect} translateError={translateError} />}
    {(step === 2 || step === 3) && <FormSection title={t("packages.section.items")} description={t("packages.items.description")}><div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-package-section="items" tabIndex={-1}><div className="flex flex-col gap-6 lg:col-span-2"><PackageItemBuilder fieldArrayName="items" onLineChange={onLineChange} step={step} ownerEmployeeId={ownerId} />{itemsError && <p role="alert" className="mt-3 text-xs text-destructive">{itemsError}</p>}{step === 3 && <div className="border-t border-border pt-5"><FormField label={t("packages.create.sortOrder")} error={translateError(errors.sortOrder?.message)} className="sm:max-w-xs"><Controller control={form.control} name="sortOrder" render={({ field }) => <Input type="number" min={0} className="tabular-nums" value={field.value ?? 0} onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))} />} /></FormField></div>}</div><div className="lg:col-span-1"><div className="lg:sticky lg:top-4"><PackagePriceSummary items={lineItems} breakdown={breakdown} /></div></div></div></FormSection>}
    {step === 4 && <PackageReview form={form} breakdown={breakdown} lineItems={lineItems} />}
  </>
}
