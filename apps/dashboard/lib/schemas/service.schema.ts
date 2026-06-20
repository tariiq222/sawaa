import { z } from "zod"

/** i18n key used as the Zod error message — resolved at render time. */
const REQUIRED = "common.required"

/**
 * Optional display-order field. The number input registers with valueAsNumber,
 * so an empty field arrives as NaN — coerce that (and "" / null) to undefined
 * instead of letting it fail .int() and silently block the wizard.
 */
const sortOrderSchema = z.preprocess(
  (v) => (v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v),
  z.coerce.number().int().min(0).max(999).optional(),
)

/* ─── Create category schema (create-category-dialog) ─── */

export const createCategorySchema = z.object({
  nameAr: z.string().trim().min(1, REQUIRED).max(200),
  nameEn: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  sortOrder: sortOrderSchema,
  departmentId: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  bookingMode: z.enum(["DIRECT", "SERVICES"]).default("DIRECT"),
  iconName: z.string().nullable().optional(),
  iconBgColor: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
})

export type CreateCategoryFormData = z.infer<typeof createCategorySchema>

/* ─── Edit category schema (edit-category-dialog) ─── */

export const editCategorySchema = z.object({
  nameAr: z.string().trim().min(1, REQUIRED).max(200).optional(),
  nameEn: z.string().trim().max(200).optional(),
  sortOrder: sortOrderSchema,
  isActive: z.boolean().optional(),
  departmentId: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional(),
  bookingMode: z.enum(["DIRECT", "SERVICES"]).optional(),
  iconName: z.string().nullable().optional(),
  iconBgColor: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
})

export type EditCategoryFormData = z.infer<typeof editCategorySchema>
