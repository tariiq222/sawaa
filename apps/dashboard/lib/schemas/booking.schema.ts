import { z } from "zod"
import { BLOOD_TYPES } from "@/lib/schemas/client.schema"

/* ─── Walk-in client schema (booking-client-step) ─── */

const phoneRegex = /^\+[1-9]\d{6,14}$/
const requiredName = z.string().min(1).max(255)
const optionalName = z.string().max(255).optional()
const optionalMedicalText = z.string().max(1000).optional()

export const walkInClientSchema = z.object({
  firstName: requiredName,
  middleName: optionalName,
  lastName: requiredName,
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

/* ─── Reschedule schema (booking-detail-sheet) ─── */

export const rescheduleBookingSchema = z.object({
  date: z.string().min(1, "اختر التاريخ"),
  startTime: z.string().min(1, "اختر الوقت"),
})

export type RescheduleBookingFormData = z.infer<typeof rescheduleBookingSchema>
