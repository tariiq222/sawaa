"use client"

/**
 * Package item builder — Sawaa Dashboard
 *
 * `useFieldArray` over `items[i]`. Each row is a scope-based eligibility editor
 * (see `package-item-row.tsx`): per-dimension ANY/INCLUDE/EXCLUDE scopes for
 * SERVICE / PRACTITIONER, an optional DURATION (single-specific only) and a
 * compact DELIVERY control, plus quantities, a fixed price (flexible items) or
 * derived price (single-specific), and a per-item discount.
 *
 * Rows report their resolved pricing detail up via `onLineChange` so the live
 * `PackagePriceSummary` and the package subtotal stay in sync.
 */

import { useFieldArray, useFormContext } from "react-hook-form"

import { Button } from "@sawaa/ui"

import { useLocale } from "@/components/locale-provider"
import type { PackageDiscountType } from "@/lib/types/package"
import { PackageItemRow } from "./package-item-row"

/* ─── Public shape ─── */

/**
 * Resolved per-row pricing detail, surfaced to the live price summary.
 * `discountValue` is in storage scale (PERCENTAGE 0-100 | FIXED halalas).
 * `serviceName` carries the human-readable scope summary for the row.
 */
export interface PackageLineDetail {
  serviceName: string
  paidQuantity: number
  freeQuantity: number
  unitPrice: number
  discountType: PackageDiscountType | null
  discountValue: number
}

export interface PackageItemBuilderProps {
  /** RHF field-array name, e.g. `"items"`. */
  fieldArrayName: string
  /** Called when a row's resolved pricing detail changes. Index = row position. */
  onLineChange?: (index: number, detail: PackageLineDetail) => void
}

/** A fresh row: everything ANY, one paid session, no discount. */
function emptyItem(sortOrder: number) {
  return {
    service: { mode: "ANY", ids: [] },
    practitioner: { mode: "ANY", ids: [] },
    duration: { mode: "ANY", ids: [] },
    delivery: { mode: "ANY", ids: [] },
    unitPriceSar: undefined,
    paidQuantity: 1,
    freeQuantity: 0,
    discountType: null,
    discountValue: 0,
    label: "",
    sortOrder,
  }
}

export function PackageItemBuilder({ fieldArrayName, onLineChange }: PackageItemBuilderProps) {
  const { t } = useLocale()
  const { control } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name: fieldArrayName })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(emptyItem(fields.length))}
        >
          {t("packages.items.addItem")}
        </Button>
      </div>

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          {t("packages.items.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <PackageItemRow
              key={field.id}
              index={index}
              fieldArrayName={fieldArrayName}
              onRemove={() => remove(index)}
              onLineChange={onLineChange}
            />
          ))}
        </div>
      )}
    </div>
  )
}
