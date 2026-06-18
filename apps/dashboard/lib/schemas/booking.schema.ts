import { z } from "zod"
import { BLOOD_TYPES } from "@/lib/schemas/client.schema"

/* ─── Walk-in client schema (booking-client-step) ─── */

const phoneRegex = /^\+[1-9]\d{6,14}$/
const optionalMedicalText = z.string().max(1000).optional()

/**
 * Creates the walk-in client schema with translated messages.
 * Call inside a component that has access to `t()`.
 */
export function createWalkInClientSchema(t: (key: string) => string) {
  return z.object({
    fullName: z.string().trim().min(1).max(255),
    gender: z.enum(["male", "female"]).optional(),
    dateOfBirth: z.string().optional(),
    nationality: z.string().max(100).optional(),
    nationalId: z.string().max(20).optional(),
    phone: z
      .string()
      .min(1, t("validation.phoneRequired"))
      .regex(phoneRegex, t("validation.phoneInternational")),
    emergencyName: z.string().optional(),
    emergencyPhone: z
      .string()
      .optional()
      .refine((v) => !v || phoneRegex.test(v), t("validation.phoneInternationalShort")),
    bloodType: z.enum(BLOOD_TYPES).optional(),
    allergies: optionalMedicalText,
    chronicConditions: optionalMedicalText,
  })
}

/** @deprecated Use createWalkInClientSchema(t) for i18n support */
export const walkInClientSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  gender: z.enum(["male", "female"]).optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().max(100).optional(),
  nationalId: z.string().max(20).optional(),
  phone: z
    .string()
    .min(1, "رقم الجوال مطلوب")
    .regex(phoneRegex, "أدخل الرقم بصيغة دولية مثل: +966501234567"),
  emergencyName: z.string().optional(),
  emergencyPhone: z
    .string()
    .optional()
    .refine((v) => !v || phoneRegex.test(v), "أدخل الرقم بصيغة دولية"),
  bloodType: z.enum(BLOOD_TYPES).optional(),
  allergies: optionalMedicalText,
  chronicConditions: optionalMedicalText,
})

export type WalkInClientFormData = z.infer<typeof walkInClientSchema>

/* ─── Booking create schema (booking-details-step) ─── */

export function createBookingCreateSchema(t: (key: string) => string) {
  return z.object({
    employeeId: z.string().min(1, t("validation.selectEmployee")),
    serviceId: z.string().min(1, t("validation.selectService")),
    type: z.enum(["in_person", "online", "walk_in"]),
    durationOptionId: z.string().optional(),
    date: z.string().min(1, t("validation.selectDate")),
    startTime: z.string().min(1, t("validation.selectTime")),
    payAtClinic: z.boolean().optional(),
  })
}

/** @deprecated Use createBookingCreateSchema(t) for i18n support */
export const bookingCreateSchema = z.object({
  employeeId: z.string().min(1, "اختر الممارس"),
  serviceId: z.string().min(1, "اختر الخدمة"),
  type: z.enum([
    "in_person",
    "online",
    "walk_in",
  ]),
  durationOptionId: z.string().optional(),
  date: z.string().min(1, "اختر التاريخ"),
  startTime: z.string().min(1, "اختر الوقت"),
  payAtClinic: z.boolean().optional(),
})

export type BookingCreateFormData = z.infer<typeof bookingCreateSchema>

/* ─── Booking POS submit schema (booking-pos) ─── */

export const bookingPosPayloadSchema = z.object({
  clientId: z.string().min(1),
  employeeId: z.string().min(1),
  serviceId: z.string().min(1),
  type: z.enum(["individual", "group", "walk_in"]),
  deliveryType: z.enum(["in_person", "online"]),
  date: z.string().min(1),
  startTime: z.string().min(1),
  payAtClinic: z.boolean().optional(),
  branchId: z.string().min(1).optional(),
  couponCode: z.string().min(1).optional(),
})

export type BookingPosPayloadData = z.infer<typeof bookingPosPayloadSchema>

/* ─── Reschedule schema (booking-detail-sheet) ─── */

export function createRescheduleBookingSchema(t: (key: string) => string) {
  return z.object({
    date: z.string().min(1, t("validation.selectDate")),
    startTime: z.string().min(1, t("validation.selectTime")),
  })
}

/** @deprecated Use createRescheduleBookingSchema(t) for i18n support */
export const rescheduleBookingSchema = z.object({
  date: z.string().min(1, "اختر التاريخ"),
  startTime: z.string().min(1, "اختر الوقت"),
})

export type RescheduleBookingFormData = z.infer<typeof rescheduleBookingSchema>
