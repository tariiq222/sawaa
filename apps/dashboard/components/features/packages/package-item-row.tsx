"use client"

/**
 * Package item row — Sawaa Dashboard
 *
 * One `items[i]` row of the scope-based package builder. Each dimension is a
 * scope (`{ mode, ids }`):
 *   SERVICE / PRACTITIONER  →  3-way ScopeControl (ANY/INCLUDE/EXCLUDE)
 *   DURATION                →  shown only when the item is single-specific
 *                              (one service + one practitioner); reuses the
 *                              practitioner's `effectiveDurations`.
 *   DELIVERY                →  compact 3-way (الكل / حضوري / أونلاين).
 *
 * Pricing:
 *   - single-specific → unit price is DERIVED from the selected duration
 *     (unitPrice omitted from the payload; behaves exactly like before).
 *   - flexible        → a REQUIRED fixed price (SAR) is entered and used as the
 *     per-session price in the live summary.
 *
 * The resolved per-row detail is reported upward via `onLineChange` so the live
 * `PackagePriceSummary` and package subtotal stay in sync without re-querying.
 */

import { useEffect } from "react"
import { Controller, useFormContext } from "react-hook-form"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"

import { useServiceEmployees, useAllServices } from "@/hooks/use-services"
import { useAllEmployees } from "@/hooks/use-employees"
import { useLocale } from "@/components/locale-provider"
import { sarToHalalas } from "@/lib/money"
import { applyItemDiscount } from "@/lib/package-price"
import { isSingleSpecificItem } from "@/lib/package-scope"
import type { PackageDiscountType } from "@/lib/types/package"
import type { ScopeFormData } from "@/lib/schemas/package.schema"
import type { MultiSelectOption } from "./multi-select"
import { ScopeControl } from "./scope-control"
import { DeliveryControl } from "./delivery-control"
import { DurationSelect } from "./duration-select"
import { PackageItemFields } from "./package-item-fields"
import { buildItemSummary, type SummaryInput } from "./package-item-summary"
import type { PackageLineDetail } from "./package-item-builder"

const emptyScope: ScopeFormData = { mode: "ANY", ids: [] }

interface ItemRowProps {
  index: number
  fieldArrayName: string
  onRemove: () => void
  onLineChange?: (index: number, detail: PackageLineDetail) => void
}

export function PackageItemRow({ index, fieldArrayName, onRemove, onLineChange }: ItemRowProps) {
  const { t, locale } = useLocale()
  const { control, watch, setValue, formState } = useFormContext()

  const base = `${fieldArrayName}.${index}`
  const p = {
    service: `${base}.service`,
    practitioner: `${base}.practitioner`,
    duration: `${base}.duration`,
    delivery: `${base}.delivery`,
    unitPrice: `${base}.unitPriceSar`,
    paid: `${base}.paidQuantity`,
    free: `${base}.freeQuantity`,
    discountType: `${base}.discountType`,
    discountValue: `${base}.discountValue`,
  }

  const service = (watch(p.service) as ScopeFormData) ?? emptyScope
  const practitioner = (watch(p.practitioner) as ScopeFormData) ?? emptyScope
  const duration = (watch(p.duration) as ScopeFormData) ?? emptyScope
  const delivery = (watch(p.delivery) as ScopeFormData) ?? emptyScope

  const { services } = useAllServices()
  const { employees: allEmployees } = useAllEmployees()

  // A single specific service scopes the practitioner options + enables duration.
  const singleServiceId =
    service.mode === "INCLUDE" && service.ids.length === 1 ? service.ids[0] : ""
  const { data: serviceEmployees = [] } = useServiceEmployees(singleServiceId)

  // Options + duration choices are derived cheaply per render; the React
  // Compiler memoizes them automatically, so no manual useMemo is needed.
  const serviceOptions: MultiSelectOption[] = services.map((s) => ({
    value: s.id,
    label: locale === "ar" ? s.nameAr : (s.nameEn ?? s.nameAr),
  }))

  const practitionerOptions: MultiSelectOption[] = singleServiceId
    ? serviceEmployees.map((e) => ({
        value: e.employee.id,
        label:
          [e.employee.user?.firstName, e.employee.user?.lastName].filter(Boolean).join(" ") ||
          e.employee.nameAr ||
          e.employee.id.slice(0, 8),
      }))
    : allEmployees.map((e) => ({
        value: e.id,
        label:
          [e.user?.firstName, e.user?.lastName].filter(Boolean).join(" ") ||
          e.nameAr ||
          e.id.slice(0, 8),
      }))

  const singleSpecific = isSingleSpecificItem({ service, practitioner, duration })
  const showDuration =
    service.mode === "INCLUDE" &&
    service.ids.length === 1 &&
    practitioner.mode === "INCLUDE" &&
    practitioner.ids.length === 1

  // Duration choices for the single selected practitioner (effective rows).
  const selectedPractitionerId = practitioner.ids[0]
  const selectedEmployee = serviceEmployees.find((e) => e.employee.id === selectedPractitionerId)
  const durationChoices = (selectedEmployee?.effectiveDurations ?? []).flatMap((g) =>
    g.durations.map((d) => ({
      id: d.id,
      deliveryType: d.deliveryType,
      durationMins: d.durationMins,
      price: d.price,
    })),
  )
  const selectedDuration = durationChoices.find((d) => d.id === duration.ids[0])

  // ── Pricing ────────────────────────────────────────────────────────────────
  const paid = Number(watch(p.paid) ?? 0)
  const free = Number(watch(p.free) ?? 0)
  const discountType = (watch(p.discountType) as PackageDiscountType | null | undefined) ?? null
  const rawDiscountValue = Number(watch(p.discountValue) ?? 0)
  const storageDiscountValue =
    discountType === "FIXED" ? sarToHalalas(rawDiscountValue) : rawDiscountValue

  const rawUnitPriceSar = Number(watch(p.unitPrice) ?? 0)
  // Single-specific → derived from the duration; flexible → fixed SAR input (→ halalas).
  const unitPrice = singleSpecific
    ? Number(selectedDuration?.price ?? 0)
    : sarToHalalas(rawUnitPriceSar)

  const payable = paid * unitPrice
  const fullValue = (paid + free) * unitPrice
  const freeValue = free * unitPrice
  const lineDiscount = applyItemDiscount(payable, discountType, storageDiscountValue)
  const net = Math.max(0, payable - lineDiscount)

  const serviceLabel = service.ids
    .map((id) => serviceOptions.find((o) => o.value === id)?.label ?? id)
    .join("، ")
  const summaryInput: SummaryInput = {
    paid,
    free,
    service,
    practitioner,
    delivery,
    serviceNames: service.ids.map((id) => serviceOptions.find((o) => o.value === id)?.label ?? id),
    practitionerNames: practitioner.ids.map(
      (id) => practitionerOptions.find((o) => o.value === id)?.label ?? id,
    ),
  }
  const summary = buildItemSummary(summaryInput, t)

  useEffect(() => {
    onLineChange?.(index, {
      serviceName: serviceLabel || summary,
      paidQuantity: paid,
      freeQuantity: free,
      unitPrice,
      discountType,
      discountValue: storageDiscountValue,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, serviceLabel, summary, paid, free, unitPrice, discountType, storageDiscountValue])

  const errors = formState.errors
  const itemErr = (
    Array.isArray(errors?.[fieldArrayName])
      ? (errors[fieldArrayName] as Array<Record<string, { ids?: { message?: string }; message?: string }>>)[index]
      : undefined
  ) as
    | {
        service?: { ids?: { message?: string } }
        practitioner?: { ids?: { message?: string } }
        unitPriceSar?: { message?: string }
      }
    | undefined

  const setScope = (path: string) => (next: ScopeFormData) =>
    setValue(path, next as never, { shouldDirty: true })

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {t("packages.items.itemNumber")} <span className="tabular-nums">{index + 1}</span>
          {summary && <span className="ms-2 text-muted-foreground/80">— {summary}</span>}
        </span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("packages.items.remove")}
          className="text-muted-foreground transition-colors hover:text-destructive"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={16} />
        </button>
      </div>

      {/* Scope editors */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Controller
          control={control}
          name={p.service}
          render={() => (
            <ScopeControl
              id={p.service}
              label={t("packages.items.service")}
              mode={service.mode}
              ids={service.ids}
              onChange={setScope(p.service)}
              options={serviceOptions}
              selectPlaceholder={t("packages.items.servicePlaceholder")}
              searchPlaceholder={t("packages.scope.searchServices")}
              emptyLabel={t("packages.scope.noServices")}
              error={itemErr?.service?.ids?.message ? t(itemErr.service.ids.message) : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name={p.practitioner}
          render={() => (
            <ScopeControl
              id={p.practitioner}
              label={t("packages.items.employee")}
              mode={practitioner.mode}
              ids={practitioner.ids}
              onChange={setScope(p.practitioner)}
              options={practitionerOptions}
              selectPlaceholder={t("packages.items.employeePlaceholder")}
              searchPlaceholder={t("packages.scope.searchPractitioners")}
              emptyLabel={t("packages.scope.noPractitioners")}
              error={
                itemErr?.practitioner?.ids?.message ? t(itemErr.practitioner.ids.message) : undefined
              }
            />
          )}
        />
      </div>

      {/* Duration (single-specific only) + delivery */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {showDuration && (
          <Controller
            control={control}
            name={p.duration}
            render={() => (
              <DurationSelect
                id={p.duration}
                selectedId={duration.ids[0]}
                choices={durationChoices}
                onChange={setScope(p.duration)}
              />
            )}
          />
        )}

        <Controller
          control={control}
          name={p.delivery}
          render={() => <DeliveryControl scope={delivery} onChange={setScope(p.delivery)} />}
        />
      </div>

      {/* Quantities + price + discount + line breakdown */}
      <PackageItemFields
        paths={{
          unitPrice: p.unitPrice,
          paid: p.paid,
          free: p.free,
          discountType: p.discountType,
          discountValue: p.discountValue,
        }}
        money={{
          singleSpecific,
          hasDerivedPrice: !!selectedDuration,
          unitPrice,
          paid,
          free,
          fullValue,
          freeValue,
          lineDiscount,
          net,
          payable,
          discountType,
        }}
        unitPriceError={itemErr?.unitPriceSar?.message ? t(itemErr.unitPriceSar.message) : undefined}
      />
    </div>
  )
}
