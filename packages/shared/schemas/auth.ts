import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  rememberMe: z.boolean().optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one digit'),
})

export const passwordResetRequestSchema = z.object({
  email: z.string().email(),
})

export const passwordResetPerformSchema = z.object({
  token: z.string().uuid(),
  newPassword: z.string().min(8),
})
