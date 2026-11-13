import { z } from "zod"
import { emailAddress, formNumber } from "@/lib/schemas/primitives"

/** Email is optional during employee edits so records without one can be saved unchanged. */
export function createEmployeeEmailSchema(t?: (key: string) => string) {
  const message =
    t?.("employees.form.validation.emailInvalid") ?? "Invalid email address"
  return emailAddress(message).optional().or(z.literal(""))
}

/* ─── Edit employee service schema (edit-employee-service-sheet) ─── */

export const editEmployeeServiceSchema = z.object({
  bufferMinutes: formNumber().int().min(0),
  isActive: z.boolean(),
})

export type EditEmployeeServiceFormData = z.infer<
  typeof editEmployeeServiceSchema
>

/* ─── Assign service schema (assign-service-sheet) ─── */

export const assignServiceSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  bufferMinutes: formNumber().int().min(0),
  isActive: z.boolean(),
})

export type AssignServiceFormData = z.infer<typeof assignServiceSchema>
