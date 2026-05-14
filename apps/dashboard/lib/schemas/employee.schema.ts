import { z } from "zod"

/* ─── Edit employee service schema (edit-employee-service-sheet) ─── */

export const editEmployeeServiceSchema = z.object({
  bufferMinutes: z.coerce.number().int().min(0),
  isActive: z.boolean(),
})

export type EditEmployeeServiceFormData = z.infer<typeof editEmployeeServiceSchema>

/* ─── Assign service schema (assign-service-sheet) ─── */

export const assignServiceSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  bufferMinutes: z.coerce.number().int().min(0),
  isActive: z.boolean(),
})

export type AssignServiceFormData = z.infer<typeof assignServiceSchema>
