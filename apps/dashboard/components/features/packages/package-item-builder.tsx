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
import type { PackageEditorLineDetail } from "@/lib/package-editor-lines"
import type { PackageItemFormData } from "@/lib/schemas/package.schema"
import { PackageItemRow } from "./package-item-row"

/* ─── Public shape ─── */

/**
 * Resolved per-row pricing detail, surfaced to the live price summary.
 * `discountValue` is in storage scale (PERCENTAGE 0-100 | FIXED halalas).
 * `serviceName` carries the human-readable scope summary for the row.
 */
export type PackageLineDetail = PackageEditorLineDetail

export interface PackageItemBuilderProps {
  /** RHF field-array name, e.g. `"items"`. */
  fieldArrayName: string
  /** Called when a row's resolved pricing detail changes. Index = row position. */
  onLineChange?: (index: number, detail: PackageLineDetail) => void
  /** Render the eligibility or pricing half of the row for the active step. */
  step?: 2 | 3
  ownerEmployeeId?: string | null
}

/** A fresh row starts fixed; the user can opt into flexible booking explicitly. */
function emptyItem(sortOrder: number): PackageItemFormData {
  return {
    selectionMode: "FIXED" as const,
    service: { mode: "INCLUDE", ids: [] },
    practitioner: { mode: "INCLUDE", ids: [] },
    duration: { mode: "INCLUDE", ids: [] },
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

export function PackageItemBuilder({ fieldArrayName, onLineChange, step = 2, ownerEmployeeId }: PackageItemBuilderProps) {
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
          onClick={() => {
            const item = emptyItem(fields.length)
            if (ownerEmployeeId) item.practitioner = { mode: "INCLUDE", ids: [ownerEmployeeId] }
            append(item)
          }}
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
              step={step}
              ownerEmployeeId={ownerEmployeeId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
