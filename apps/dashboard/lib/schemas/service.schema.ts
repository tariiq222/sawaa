import { z } from "zod"

/** i18n key used as the Zod error message — resolved at render time. */
const REQUIRED = "common.required"

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
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  departmentId: z
    .union([z.string().uuid(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
})

export type CreateCategoryFormData = z.infer<typeof createCategorySchema>

/* ─── Edit category schema (edit-category-dialog) ─── */

export const editCategorySchema = z.object({
  nameAr: z.string().trim().min(1, REQUIRED).max(200).optional(),
  nameEn: z.string().trim().max(200).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
  departmentId: z
    .union([z.string().uuid(), z.literal(""), z.null()])
    .optional(),
})

export type EditCategoryFormData = z.infer<typeof editCategorySchema>
