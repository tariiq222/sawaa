import { z } from "zod"

/** i18n key used as the Zod error message — resolved at render time. */
const REQUIRED = "common.required"

/* ─── Create bundle schema ─── */

export const createBundleSchema = z.object({
  nameAr: z.string().trim().min(1, REQUIRED).max(200),
  nameEn: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  descriptionAr: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  descriptionEn: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.coerce.number().min(0),
  sortOrder: z.coerce.number().int().min(0).optional(),
  serviceIds: z
    .array(z.string().uuid())
    .min(2, "bundles.errors.minServices"),
  isActive: z.boolean().optional(),
  isHidden: z.boolean().optional(),
})

export type CreateBundleFormData = z.infer<typeof createBundleSchema>

/* ─── Edit bundle schema ─── */

export const editBundleSchema = z.object({
  nameAr: z.string().trim().min(1, REQUIRED).max(200).optional(),
  nameEn: z.string().trim().max(200).optional(),
  descriptionAr: z.string().trim().max(2000).optional(),
  descriptionEn: z.string().trim().max(2000).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.coerce.number().min(0).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  serviceIds: z.array(z.string().uuid()).min(2, "bundles.errors.minServices").optional(),
  isActive: z.boolean().optional(),
  isHidden: z.boolean().optional(),
})

export type EditBundleFormData = z.infer<typeof editBundleSchema>
