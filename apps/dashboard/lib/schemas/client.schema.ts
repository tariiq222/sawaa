import { z } from "zod"

/* ─── Constants ─── */

export const BLOOD_TYPES = [
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
  "UNKNOWN",
] as const

export type BloodType = (typeof BLOOD_TYPES)[number]

export const BLOOD_LABELS: Record<BloodType, string> = {
  A_POS: "A+",
  A_NEG: "A−",
  B_POS: "B+",
  B_NEG: "B−",
  AB_POS: "AB+",
  AB_NEG: "AB−",
  O_POS: "O+",
  O_NEG: "O−",
  UNKNOWN: "غير معروف",
}

/* ─── Phone regex ─── */

// Saudi phone: +966 followed by 5 then 8 digits (local number 5XXXXXXXX)
const phoneRegex = /^\+9665\d{8}$/
const nameField = z.string().min(1).max(255)
const optionalNameField = z.string().max(255).optional()
const optionalNationality = z.string().max(100).optional()
const optionalNationalId = z.string().max(20).optional()
const optionalPhone = z
  .string()
  .optional()
  .refine((v) => !v || phoneRegex.test(v), {
    message: "رقم سعودي غير صحيح — مثال +966501234567",
  })
const optionalMedicalText = z.string().max(1000).optional()

/* ─── Create Schema ─── */

export const createClientSchema = z.object({
  firstName: nameField,
  middleName: optionalNameField,
  lastName: nameField,
  gender: z.enum(["male", "female"]).optional(),
  dateOfBirth: z.string().optional(),
  nationality: optionalNationality,
  nationalId: optionalNationalId,
  phone: z.string().min(1).regex(phoneRegex, {
    message: "رقم سعودي غير صحيح — مثال +966501234567",
  }),
  emergencyName: optionalNameField,
  emergencyPhone: optionalPhone,
  bloodType: z.enum(BLOOD_TYPES).optional(),
  allergies: optionalMedicalText,
  chronicConditions: optionalMedicalText,
})

/* ─── Edit Schema ─── */

export const editClientSchema = z.object({
  firstName: nameField.optional(),
  middleName: optionalNameField,
  lastName: nameField.optional(),
  gender: z.enum(["male", "female"]).optional(),
  dateOfBirth: z.string().optional(),
  nationality: optionalNationality,
  nationalId: optionalNationalId,
  phone: optionalPhone,
  emergencyName: optionalNameField,
  emergencyPhone: optionalPhone,
  bloodType: z.enum(BLOOD_TYPES).optional(),
  allergies: optionalMedicalText,
  chronicConditions: optionalMedicalText,
  isActive: z.boolean().optional(),
})

/* ─── Types ─── */

export type CreateClientFormData = z.infer<typeof createClientSchema>
export type EditClientFormData = z.infer<typeof editClientSchema>
