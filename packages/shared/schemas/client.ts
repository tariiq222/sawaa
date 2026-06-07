import { z } from 'zod'

export const phoneRegex = /^\+[1-9]\d{6,14}$/
export const saudiPhoneRegex = /^\+9665\d{8}$/

export const createClientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().regex(phoneRegex).optional(),
  email: z.string().email().optional(),
  nationalId: z.string().max(20).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  nationality: z.string().optional(),
  bloodType: z.string().optional(),
  allergies: z.string().max(1000).optional(),
  chronicConditions: z.string().max(1000).optional(),
  emergencyContactName: z.string().max(100).optional(),
  emergencyContactPhone: z.string().regex(phoneRegex).optional(),
})

export const updateClientSchema = createClientSchema.partial()
