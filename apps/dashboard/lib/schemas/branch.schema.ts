import { z } from "zod"

/* ─── Branch schema (branch-form-page) ─── */

export const branchSchema = z.object({
  nameAr: z.string().min(1).max(255),
  nameEn: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
  phone: z.string().optional().refine(
    (v) => !v || /^\+[1-9]\d{6,14}$/.test(v),
    { message: "أدخل الرقم بصيغة دولية مثل: +966501234567" }
  ),
  isMain: z.boolean(),
  isActive: z.boolean(),
  timezone: z.string(),
})

export type BranchFormData = z.infer<typeof branchSchema>
