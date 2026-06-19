import { z } from "zod"

const now = () => new Date()

export const createGroupSessionSchema = z.object({
  branchId: z.string().min(1, { message: "required" }),
  employeeId: z.string().min(1, { message: "required" }),
  serviceId: z.string().min(1, { message: "required" }),
  title: z.string().min(1, { message: "required" }).max(200),
  scheduledAt: z
    .string()
    .min(1, { message: "required" })
    .refine((val) => new Date(val) > now(), { message: "groupSessions.form.error.futureDateRequired" }),
  durationMins: z.coerce.number().int().min(1, { message: "required" }),
  maxCapacity: z.coerce.number().int().min(1, { message: "required" }),
  priceInSar: z.coerce.number().min(0, { message: "required" }),
  deliveryType: z.enum(["IN_PERSON", "ONLINE"]),
  isPublic: z.boolean(),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
  publicDescriptionAr: z.string().optional(),
  publicDescriptionEn: z.string().optional(),
})

export type CreateGroupSessionFormData = z.infer<typeof createGroupSessionSchema>

export const cancelGroupSessionSchema = z.object({
  cancelReason: z.string().optional(),
})

export type CancelGroupSessionFormData = z.infer<typeof cancelGroupSessionSchema>
