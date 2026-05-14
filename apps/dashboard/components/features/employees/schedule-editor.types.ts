import { z } from "zod"

/* ─── Constants ─── */

export const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
] as const

export type DayName = (typeof DAY_NAMES)[number]

/* ─── Schema ─── */

export const slotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm format required"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:mm format required"),
  isActive: z.boolean(),
})

export const scheduleSchema = z.object({
  schedule: z.array(slotSchema).length(7),
})

export type FormData = z.infer<typeof scheduleSchema>

/* ─── Local Break type ─── */

export interface LocalBreak {
  key: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

let keyCounter = 0
export function nextKey() {
  keyCounter += 1
  return `break-${keyCounter}`
}
