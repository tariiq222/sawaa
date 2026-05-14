import { z } from "zod"

/* ─── Zod Schema ─── */

export const EMPLOYEE_GENDERS = ["MALE", "FEMALE"] as const
export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT"] as const

/**
 * Schema factory — accepts a `t` function so validation messages are
 * translated at call time. Falls back to English if called without `t`
 * (e.g. tests or server-side code that doesn't have locale context).
 */
export function createEmployeeSchema(t?: (key: string) => string) {
  const msg = (key: string, fallback: string) => t ? t(key) : fallback
  return z.object({
    title: z.string().optional(),
    nameEn: z.string().min(1, msg("employees.form.validation.nameEnRequired", "Full name in English is required")).max(255),
    nameAr: z.string().min(1, msg("employees.form.validation.nameArRequired", "Full name in Arabic is required")).max(255),
    email: z.string().email(msg("employees.form.validation.emailInvalid", "Invalid email address")),
    phone: z.string().regex(/^\+?[0-9\s-]{7,20}$/, msg("employees.form.validation.phoneInvalid", "Invalid phone number")).optional().or(z.literal("")),
    // Selects default to `<option value="">—</option>`, which submits `""`.
    // z.enum rejects "" — preprocess it to `undefined` so .optional() kicks in.
    gender: z.preprocess((v) => (v === "" ? undefined : v), z.enum(EMPLOYEE_GENDERS).optional()),
    employmentType: z.preprocess((v) => (v === "" ? undefined : v), z.enum(EMPLOYMENT_TYPES).optional()),
    specialty: z.string().min(1, msg("employees.form.validation.specialtyRequired", "Specialty is required")),
    specialtyAr: z.string().optional(),
    bio: z.string().optional(),
    bioAr: z.string().optional(),
    experience: z.coerce.number().int().min(0).optional(),
    education: z.string().optional(),
    educationAr: z.string().optional(),
    avatarUrl: z.string().url().optional().or(z.literal("")),
    avatarFile: z.instanceof(File).optional(),
    branchIds: z.array(z.string()).optional(),
    serviceIds: z.array(z.string()).optional(),
    isActive: z.boolean(),
  })
}

/** Convenience: static schema instance (no translated messages) */
export const createEmployeeSchemaStatic = createEmployeeSchema()

export type CreateEmployeeFormData = z.infer<ReturnType<typeof createEmployeeSchema>>

/* ─── Default Values ─── */

export const createEmployeeDefaults: CreateEmployeeFormData = {
  title: "",
  nameEn: "",
  nameAr: "",
  email: "",
  phone: "",
  gender: undefined,
  employmentType: "FULL_TIME",
  specialty: "",
  specialtyAr: "",
  bio: "",
  bioAr: "",
  experience: undefined,
  education: "",
  educationAr: "",
  avatarUrl: "",
  avatarFile: undefined,
  branchIds: [],
  serviceIds: [],
  isActive: true,
}
