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

/**
 * Creates blood type labels using i18n.
 * Call with `t()` from useLocale().
 */
export function getBloodLabels(t: (key: string) => string): Record<BloodType, string> {
  return {
    A_POS: "A+",
    A_NEG: "A−",
    B_POS: "B+",
    B_NEG: "B−",
    AB_POS: "AB+",
    AB_NEG: "AB−",
    O_POS: "O+",
    O_NEG: "O−",
    UNKNOWN: t("validation.bloodTypeUnknown"),
  }
}

/** @deprecated Use getBloodLabels(t) for i18n support */
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
const optionalNameField = z.string().max(255).optional()

/* ─── Name helpers ─── */

export function splitFullName(fullName: string): { firstName: string; middleName?: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] }
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  }
}

export function composeFullName(firstName?: string | null, middleName?: string | null, lastName?: string | null): string {
  return [firstName, middleName, lastName].filter((v): v is string => !!v).join(" ")
}
const optionalNationality = z.string().max(100).optional()
const optionalNationalId = z.string().max(20).optional()
const optionalMedicalText = z.string().max(1000).optional()

/* ─── Create Schema (i18n) ─── */

export function createClientSchemaWithI18n(t: (key: string) => string) {
  const optionalPhone = z
    .string()
    .optional()
    .refine((v) => !v || phoneRegex.test(v), {
      message: t("validation.saudiPhone"),
    })

  return z.object({
    fullName: z.string().trim().min(1).max(255),
    gender: z.enum(["male", "female"]).optional(),
    dateOfBirth: z.string().optional(),
    nationality: optionalNationality,
    nationalId: optionalNationalId,
    phone: z.string().min(1).regex(phoneRegex, {
      message: t("validation.saudiPhone"),
    }),
    emergencyName: optionalNameField,
    emergencyPhone: optionalPhone,
    bloodType: z.enum(BLOOD_TYPES).optional(),
    allergies: optionalMedicalText,
    chronicConditions: optionalMedicalText,
  })
}

/* ─── Create Schema (legacy) ─── */

const optionalPhone = z
  .string()
  .optional()
  .refine((v) => !v || phoneRegex.test(v), {
    message: "رقم سعودي غير صحيح — مثال +966501234567",
  })

/** @deprecated Use createClientSchemaWithI18n(t) for i18n support */
export const createClientSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
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
  fullName: z.string().trim().min(1).max(255),
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
