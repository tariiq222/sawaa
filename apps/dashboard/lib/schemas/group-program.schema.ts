import { z } from "zod"

export const createGroupProgramSchema = z.object({
  nameAr: z.string().min(1, { message: "required" }).max(200),
  nameEn: z.string().max(200).optional(),
  departmentId: z.string().min(1, { message: "required" }),
  minParticipants: z.coerce.number().int().min(1, { message: "required" }),
  maxParticipants: z.coerce.number().int().min(1, { message: "required" }),
  defaultPriceInSar: z.coerce.number().min(0, { message: "required" }),
  isActive: z.boolean().default(true),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
})

export type CreateGroupProgramFormData = z.input<typeof createGroupProgramSchema>
