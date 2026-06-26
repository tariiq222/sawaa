/**
 * Session package Zod schemas — Sawaa Dashboard
 *
 * The form fields differ from the backend DTOs in three ways, so we have
 * our own zod layer here instead of re-importing `@sawaa/shared`:
 *   1. `discountValue` for FIXED is rendered as SAR (not halalas); the
 *      submit handler converts at submit time. PERCENTAGE stays as 0-100.
 *   2. `items` uses `useFieldArray` — each item is a flat object the
 *      picker UI writes into.
 *   3. The cross-field rule "each item must have at least one session
 *      (paidQuantity + freeQuantity >= 1)" lives at the items-array level
 *      (the brief asks for at-least-one-item too) — backend enforces it
 *      defensively as a 400 fallback.
 *
 * A single base schema is shared between create and edit (every field is
 * optional on edit, but the **input shape is identical** so the RHF
 * resolver type stays stable across both modes). The submit handler
 * supplies defaults for missing edit fields.
 *
 * Error messages are **i18n keys** (e.g. `"common.required"`,
 * `"packages.errors.minItems"`) — the form re-translates them with `t()`
 * from `useLocale()`.
 */

import { z } from "zod"

const REQUIRED = "common.required"

const uuid = z.string().uuid()

/* ─── Item schema (used by the field array) ─── */

export const packageItemSchema = z.object({
  serviceId: uuid,
  employeeId: uuid,
  durationOptionId: uuid,
  paidQuantity: z.coerce.number().int().min(0, "packages.errors.minQuantity"),
  freeQuantity: z.coerce.number().int().min(0).optional(),
  // Per-item discount. FIXED value is rendered in SAR on the form; the submit
  // handler converts to halalas. PERCENTAGE stays 0-100. null = no discount.
  discountType: z.enum(["PERCENTAGE", "FIXED"]).nullable().optional(),
  discountValue: z.coerce.number().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
})

export type PackageItemFormData = z.infer<typeof packageItemSchema>

/**
 * Shared base schema — every field is optional here so create/edit
 * derive cleanly. `items` is required (at least one) and the
 * per-item quantity rule is enforced via `superRefine`.
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
  items: z
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
    .optional(),
})

export type PackageFormData = z.infer<typeof basePackageSchema>

/* ─── Create ─── */

export const createPackageSchema = basePackageSchema.extend({
  nameAr: z.string().trim().min(1, REQUIRED).max(200),
  items: z
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
    }),
})

export type CreatePackageFormData = z.infer<typeof createPackageSchema>

/* ─── Edit ─── */

export const editPackageSchema = basePackageSchema

export type EditPackageFormData = PackageFormData
