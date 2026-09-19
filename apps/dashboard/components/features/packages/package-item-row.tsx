"use client"

import { useEffect } from "react"
import { useFormContext } from "react-hook-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { sarToHalalas } from "@/lib/money"
import { applyItemDiscount } from "@/lib/package-price"
import { usePackageEditorItem } from "@/hooks/use-package-editor-item"
import type { PackageDiscountType } from "@/lib/types/package"
import { transitionPackageEditorMode } from "@/lib/package-editor-pricing"
import { PackageItemFields } from "./package-item-fields"
import { PackageItemScopes, type PackageItemError } from "./package-item-scopes"
import { buildItemSummary, type SummaryInput } from "./package-item-summary"
import type { PackageLineDetail } from "./package-item-builder"

interface ItemRowProps { index: number; fieldArrayName: string; onRemove: () => void; onLineChange?: (index: number, detail: PackageLineDetail) => void; step?: 2 | 3; ownerEmployeeId?: string | null }
export function PackageItemRow({ index, fieldArrayName, onRemove, onLineChange, step = 2, ownerEmployeeId }: ItemRowProps) {
  const { setValue, watch } = useFormContext()
  const item = usePackageEditorItem(index, fieldArrayName, ownerEmployeeId)
  const { t, p, base, service, practitioner, duration, delivery, control, serviceOptions, practitionerOptions, durationChoices, selectedDuration, singleSpecific, selectionMode, advancedRules, setAdvancedRules, setScope, itemErr, resetNotice, pricePending } = item
  const paid = Number(watch(p.paid) ?? 0)
  const free = Number(watch(p.free) ?? 0)
  const discountType = (watch(p.discountType) as PackageDiscountType | null | undefined) ?? null
  const rawDiscountValue = Number(watch(p.discountValue) ?? 0)
  const storageDiscountValue = discountType === "FIXED" ? sarToHalalas(rawDiscountValue) : rawDiscountValue
  const rawUnitPriceSar = Number(watch(p.unitPrice) ?? 0)
  const hasSavedUnitPrice = watch(p.hasUnitPriceOverride) === true
  const priceUnavailable = watch(p.priceUnavailable) === true
  const hasHistoricalOverride = singleSpecific && (hasSavedUnitPrice || rawUnitPriceSar > 0)
  const unitPrice = singleSpecific ? hasHistoricalOverride ? sarToHalalas(rawUnitPriceSar) : Number(selectedDuration?.price ?? 0) : sarToHalalas(rawUnitPriceSar)
  const payable = paid * unitPrice
  const fullValue = (paid + free) * unitPrice
  const freeValue = free * unitPrice
  const lineDiscount = applyItemDiscount(payable, discountType, storageDiscountValue)
  const net = Math.max(0, payable - lineDiscount)
  const serviceNames = service.ids.map((id) => serviceOptions.find((option) => option.value === id)?.label ?? t("packages.review.unavailable"))
  const practitionerNames = practitioner.ids.map((id) => practitionerOptions.find((option) => option.value === id)?.label ?? t("packages.review.unavailable"))
  const deliveryNames = delivery.ids.map((id) => t(`packages.items.deliveryType.${id}`))
  const durationLabels = duration.ids.map((id) => {
    const choice = durationChoices.find((entry) => entry.id === id)
    return choice ? `${t(`packages.items.deliveryType.${choice.deliveryType}`)} · ${choice.durationMins} ${t("common.min")}` : t("packages.review.unavailable")
  })
  const durationName = duration.mode === "ANY" ? t("packages.scope.any") : durationLabels.length ? `${duration.mode === "EXCLUDE" ? t("packages.review.except") : t("packages.review.only")}: ${durationLabels.join("، ")}` : t("packages.review.unavailable")
  const deliveryName = delivery.mode === "ANY" ? t("packages.scope.any") : deliveryNames.length ? deliveryNames.join("، ") : t("packages.review.unavailable")
  const summaryInput: SummaryInput = { paid, free, service, practitioner, delivery, serviceNames, practitionerNames }
  const summary = buildItemSummary(summaryInput, t)

  useEffect(() => {
    onLineChange?.(index, { serviceName: serviceNames.join("، ") || summary, practitionerName: practitionerNames.join("، ") || t("packages.review.unavailable"), durationName, durations: durationChoices, deliveryName, paidQuantity: paid, freeQuantity: free, unitPrice, discountType, discountValue: storageDiscountValue, discountAmount: lineDiscount, net, priceAvailable: !priceUnavailable && (!singleSpecific || hasHistoricalOverride || !!selectedDuration), pricePending })
  }, [deliveryName, discountType, durationChoices, durationName, free, hasHistoricalOverride, index, lineDiscount, net, onLineChange, paid, practitionerNames, pricePending, priceUnavailable, selectedDuration, serviceNames, singleSpecific, storageDiscountValue, summary, t, unitPrice])

  const errors = itemErr as (PackageItemError & { unitPriceSar?: { message?: string }; paidQuantity?: { message?: string }; freeQuantity?: { message?: string }; discountValue?: { message?: string } }) | undefined
  const changeSelectionMode = (mode: "FIXED" | "FLEXIBLE") => {
    if (mode === selectionMode) return
    const transition = transitionPackageEditorMode({
      currentMode: selectionMode,
      nextMode: mode,
      service,
      practitioner,
      duration,
      ownerEmployeeId,
    })
    setValue(p.selectionMode, mode, { shouldDirty: true })
    setValue(p.service, transition.service, { shouldDirty: true })
    setValue(p.practitioner, transition.practitioner, { shouldDirty: true })
    setValue(p.duration, transition.duration, { shouldDirty: true })
    if (transition.clearPrice) {
      setValue(p.hasUnitPriceOverride, false as never, { shouldDirty: true })
      setValue(p.unitPrice, undefined as never, { shouldDirty: true })
      setValue(p.priceResetNotice, true, { shouldDirty: false })
    }
    setValue(`${base}.originalConstraints`, undefined, { shouldDirty: true })
  }
  return <div data-package-item={index} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
    <div className="flex items-start justify-between gap-2"><span className="text-xs text-muted-foreground">{t("packages.items.itemNumber")} <span className="tabular-nums">{index + 1}</span>{summary && <span className="ms-2 text-muted-foreground/80">— {summary}</span>}</span><button type="button" onClick={onRemove} aria-label={t("packages.items.remove")} className="text-muted-foreground transition-colors hover:text-destructive"><HugeiconsIcon icon={Cancel01Icon} size={16} /></button></div>
    {resetNotice && <p role="status" className="text-xs text-muted-foreground">{t("packages.items.priceResetNotice")}</p>}
    {errors?.duration?.mode?.message && <p role="alert" className="text-xs text-destructive">{t(errors.duration.mode.message)}</p>}
    {step === 2 && <div className="flex flex-col gap-2" role="group" aria-label={t("packages.items.selectionMode")}><span className="text-sm font-medium">{t("packages.items.selectionMode")}</span><div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{(["FIXED", "FLEXIBLE"] as const).map((mode) => <button key={mode} type="button" aria-pressed={selectionMode === mode} onClick={() => changeSelectionMode(mode)} className={`rounded-md border px-3 py-2 text-start text-sm transition-colors ${selectionMode === mode ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}><span className="font-medium">{t(`packages.items.selectionMode.${mode}`)}</span><span className="mt-1 block text-xs text-muted-foreground">{t(`packages.items.selectionMode.${mode}Hint`)}</span></button>)}</div>{selectionMode === "FLEXIBLE" && <p className="text-xs text-muted-foreground">{t("packages.items.flexibleScopeHint")}</p>}</div>}
    {step === 2 && <PackageItemScopes control={control} paths={{ service: p.service, practitioner: p.practitioner, duration: p.duration, delivery: p.delivery }} service={service} practitioner={practitioner} duration={duration} delivery={delivery} serviceOptions={serviceOptions} practitionerOptions={practitionerOptions} durationChoices={durationChoices} showDuration={service.mode === "INCLUDE" && service.ids.length === 1 && practitioner.mode === "INCLUDE" && practitioner.ids.length === 1} ownerEmployeeId={ownerEmployeeId} selectionMode={selectionMode} itemError={errors} advancedRules={advancedRules} onToggleAdvanced={() => setAdvancedRules((current) => !current)} setScope={setScope} />}
    {step === 3 && <PackageItemFields paths={{ unitPrice: p.unitPrice, paid: p.paid, free: p.free, discountType: p.discountType, discountValue: p.discountValue }} money={{ singleSpecific, hasDerivedPrice: !!selectedDuration, pricePending, priceUnavailable, unitPrice, paid, free, fullValue, freeValue, lineDiscount, net, payable, discountType, hasHistoricalOverride }} unitPriceError={errors?.unitPriceSar?.message ? t(errors.unitPriceSar.message) : priceUnavailable ? t("packages.errors.priceUnavailable") : undefined} paidError={errors?.paidQuantity?.message ? t(errors.paidQuantity.message) : undefined} freeError={errors?.freeQuantity?.message ? t(errors.freeQuantity.message) : undefined} discountValueError={errors?.discountValue?.message ? t(errors.discountValue.message) : undefined} />}
  </div>
}
