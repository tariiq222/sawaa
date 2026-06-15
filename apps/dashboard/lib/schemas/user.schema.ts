import { z } from "zod"
import type { TenantUserRole } from "@/lib/types/user"

/* ─── User base schema (user-form-page) ─── */

export const userBaseSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional().refine(
    (v) => !v || /^\+[1-9]\d{6,14}$/.test(v),
    { message: "أدخل الرقم بصيغة دولية مثل: +966501234567" }
  ),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
})

export const userCreateSchema = userBaseSchema.extend({
  password: z.string().min(8),
  roleSelection: z.string().min(1, "يجب اختيار الدور"),
})

export const userEditSchema = userBaseSchema.extend({
  roleSelection: z.string().optional(),
})

export type UserBaseFormData   = z.infer<typeof userBaseSchema>
export type UserCreateFormData = z.infer<typeof userCreateSchema>
export type UserEditFormData   = z.infer<typeof userEditSchema>

/* ─── Role selection parsing ─── */

export type RoleSelectionResult =
  | { kind: "system"; role: TenantUserRole }
  | { kind: "custom"; customRoleId: string }

export function parseRoleSelection(value: string): RoleSelectionResult {
  if (value.startsWith("custom:")) {
    return { kind: "custom", customRoleId: value.slice(7) }
  }
  return { kind: "system", role: value as TenantUserRole }
}

/* ─── Create role schema (create-role-dialog) ─── */

export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
}).strict()

export type CreateRoleFormData = z.infer<typeof createRoleSchema>
