import { z } from "zod"

const trimmedRequiredName = z
  .string()
  .transform((v) => v.trim())
  .pipe(
    z
      .string()
      .min(1, { message: "validation.required" })
      .max(200, { message: "validation.maxLength" }),
  )

export const departmentSchema = z.object({
  nameAr: trimmedRequiredName,
  nameEn: trimmedRequiredName,
  descriptionAr: z.string().max(1000, { message: "validation.maxLength" }).optional().or(z.literal("")),
  descriptionEn: z.string().max(1000, { message: "validation.maxLength" }).optional().or(z.literal("")),
  icon: z.string().max(100, { message: "validation.maxLength" }).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0, { message: "validation.minZero" }),
  isActive: z.boolean(),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>
