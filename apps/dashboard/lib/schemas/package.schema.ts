/**
 * Session package Zod schemas — Sawaa Dashboard
 *
 * The form fields differ from the backend DTOs, so we keep our own zod layer
 * here instead of re-importing `@sawaa/shared`:
 *   1. Each item's eligibility is edited as a per-dimension *scope*
 *      (`{ mode, ids }`) rather than a raw constraints array — the submit
 *      handler translates scopes → `constraints[]`.
 *   2. `discountValue` for FIXED and the flexible `unitPriceSar` are rendered
 *      in SAR (not halalas); the submit handler converts at submit time.
 *   3. `items` uses `useFieldArray` — each item is a flat object the scope
 *      editor writes into.
 *
 * A single base schema is shared between create and edit (every field is
 * optional on edit, but the **input shape is identical** so the RHF resolver
 * type stays stable across both modes). The submit handler supplies defaults
 * for missing edit fields.
 *
 * Error messages are **i18n keys** (e.g. `"common.required"`,
 * `"packages.errors.minItems"`) — re-translated by the form with `t()`.
 */

import { z } from "zod"

const REQUIRED = "common.required"

/* ─── Per-dimension scope ─── */

/**
 * One editable dimension: `mode` picks ANY/INCLUDE/EXCLUDE and `ids` holds the
 * selected targets (service/employee/durationOption ids, or delivery-type enum
 * values). ANY ignores `ids`.
 */
export const scopeSchema = z.object({
  mode: z.enum(["ANY", "INCLUDE", "EXCLUDE"]),
  ids: z.array(z.string()),
})

export type ScopeFormData = z.infer<typeof scopeSchema>

/** True when the scope pins exactly one target via INCLUDE. */
export function isSingleInclude(scope: ScopeFormData | undefined): boolean {
  return !!scope && scope.mode === "INCLUDE" && scope.ids.length === 1
}

/* ─── Item schema (used by the field array) ─── */

export const packageItemSchema = z
  .object({
    service: scopeSchema,
    practitioner: scopeSchema,
    /** Only meaningful when single-specific; otherwise implicitly ANY. */
    duration: scopeSchema,
    delivery: scopeSchema,
    /** Fixed prepaid unit price in SAR (flexible items only). Converted to halalas on submit. */
    unitPriceSar: z.coerce.number().min(0).optional(),
    paidQuantity: z.coerce.number().int().min(0, "packages.errors.minQuantity"),
    freeQuantity: z.coerce.number().int().min(0).optional(),
    // Per-item discount. FIXED value is rendered in SAR; the submit handler
    // converts to halalas. PERCENTAGE stays 0-100. null = no discount.
    discountType: z.enum(["PERCENTAGE", "FIXED"]).nullable().optional(),
    discountValue: z.coerce.number().min(0).optional(),
    label: z.string().trim().max(200).optional(),
    sortOrder: z.coerce.number().int().min(0).optional(),
  })
  .superRefine((item, ctx) => {
    // INCLUDE/EXCLUDE require at least one target per dimension.
    for (const dim of ["service", "practitioner", "delivery"] as const) {
      const s = item[dim]
      if (s.mode !== "ANY" && s.ids.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [dim, "ids"],
          message: "packages.errors.scopeNeedsTarget",
        })
      }
    }

    const singleService = isSingleInclude(item.service)
    const singlePractitioner = isSingleInclude(item.practitioner)
    const singleSpecific =
      singleService && singlePractitioner && isSingleInclude(item.duration)

    // A flexible (non single-specific) item needs a fixed unit price.
    if (!singleSpecific && !(item.unitPriceSar && item.unitPriceSar > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unitPriceSar"],
        message: "packages.errors.unitPriceRequired",
      })
    }
  })

export type PackageItemFormData = z.infer<typeof packageItemSchema>

/* ─── Items array (min 1 + per-item quantity rule) ─── */

const itemsArray = z
  .array(packageItemSchema)
  .min(1, "packages.errors.minItems")
  .superRefine((items, ctx) => {
    items.forEach((it, i) => {
      if (it.paidQuantity + (it.freeQuantity ?? 0) < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "paidQuantity"],
          message: "packages.errors.minQuantity",
        })
      }
    })
  })

/**
 * Shared base schema — every top-level field is optional here so create/edit
 * derive cleanly. `items` is required (at least one).
 */
const basePackageSchema = z.object({
  nameAr: z.string().trim().min(1, REQUIRED).max(200).optional(),
  nameEn: z.string().trim().max(200).optional(),
  descriptionAr: z.string().trim().max(2000).optional(),
  descriptionEn: z.string().trim().max(2000).optional(),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  iconName: z.string().trim().max(100).nullable().optional(),
  iconBgColor: z.string().trim().max(20).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  items: itemsArray.optional(),
})

export type PackageFormData = z.infer<typeof basePackageSchema>

/* ─── Create ─── */

export const createPackageSchema = basePackageSchema.extend({
  nameAr: z.string().trim().min(1, REQUIRED).max(200),
  items: itemsArray,
})

export type CreatePackageFormData = z.infer<typeof createPackageSchema>

/* ─── Edit ─── */

export const editPackageSchema = basePackageSchema

export type EditPackageFormData = PackageFormData
