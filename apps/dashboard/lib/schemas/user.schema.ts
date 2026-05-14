import { z } from "zod"

const USER_ROLES = [
  "ADMIN",
  "RECEPTIONIST",
  "ACCOUNTANT",
  "EMPLOYEE",
] as const

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
  role: z.enum(USER_ROLES),
})

export const userEditSchema = userBaseSchema.extend({
  role: z.enum(USER_ROLES).optional(),
})

export type UserBaseFormData   = z.infer<typeof userBaseSchema>
export type UserCreateFormData = z.infer<typeof userCreateSchema>
export type UserEditFormData   = z.infer<typeof userEditSchema>

/* ─── Create role schema (create-role-dialog) ─── */

export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
}).strict()

export type CreateRoleFormData = z.infer<typeof createRoleSchema>
