import type { CSSProperties } from "react"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"

// cn() moved to @sawaa/ui/lib/cn as of SaaS-05a.
// Re-exported here for backward compatibility across the dashboard workspace;
// new code should import { cn } from "@sawaa/ui" directly.
export { cn } from "@sawaa/ui/lib/cn"

/**
 * Safely joins first and last name, filtering out null/undefined/empty parts.
 * Returns a fallback dash when both are missing.
 */
export function formatName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  fallback = "—",
): string {
  const parts = [firstName, lastName].filter((p) => p?.trim())
  return parts.length > 0 ? parts.join(" ") : fallback
}

/**
 * Safely extracts initials from first and last name.
 * Returns "?" when both are missing or empty.
 */
const AVATAR_PAIRS: [string, string][] = [
  ["var(--avatar-1-from)", "var(--avatar-1-to)"],
  ["var(--avatar-2-from)", "var(--avatar-2-to)"],
  ["var(--avatar-3-from)", "var(--avatar-3-to)"],
  ["var(--avatar-4-from)", "var(--avatar-4-to)"],
  ["var(--avatar-5-from)", "var(--avatar-5-to)"],
  ["var(--avatar-6-from)", "var(--avatar-6-to)"],
  ["var(--avatar-7-from)", "var(--avatar-7-to)"],
  ["var(--avatar-8-from)", "var(--avatar-8-to)"],
]

function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return h
}

/**
 * Returns a deterministic CSS gradient style for an avatar based on an entity id.
 * Uses CSS custom properties so it respects dark mode and branding theming.
 */
export function getAvatarGradientStyle(id: string): CSSProperties {
  const idx = Math.abs(hashCode(id)) % AVATAR_PAIRS.length
  const [from, to] = AVATAR_PAIRS[idx]
  return { background: `linear-gradient(135deg, ${from}, ${to})` }
}

export function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const f = firstName?.trim()?.[0] ?? ""
  const l = lastName?.trim()?.[0] ?? ""
  return (f + l).toUpperCase() || "?"
}

// ─── Clinic Date/Time Formatting ───────────────────────────────────────────

export type DateFormat = "Y-m-d" | "d/m/Y" | "m/d/Y" | "DD/MM/YYYY"
export type TimeFormat = "24h" | "12h"

/**
 * Format a date according to the clinic's configured date format.
 * @param date - Date object or ISO string
 * @param format - Clinic date format from OrganizationSettings
 * @returns Formatted date string
 */
export function formatClinicDate(date: Date | string, format: DateFormat = "Y-m-d"): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ""

  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")

  switch (format) {
    case "DD/MM/YYYY":
    case "d/m/Y": return `${day}/${month}/${year}`
    case "m/d/Y": return `${month}/${day}/${year}`
    case "Y-m-d":
    default:      return `${year}-${month}-${day}`
  }
}

/**
 * Format a time string (HH:mm or HH:mm:ss) according to the clinic's configured time format.
 * @param time - Time string in 24h format (e.g. "14:30" or "14:30:00")
 * @param format - Clinic time format from OrganizationSettings
 * @returns Formatted time string
 */
export function formatClinicTime(time: string, format: TimeFormat = "24h"): string {
  if (!time) return ""
  const [hourStr, minuteStr] = time.split(":")
  const hour = parseInt(hourStr, 10)
  const minute = minuteStr?.padStart(2, "0") ?? "00"

  if (isNaN(hour)) return time

  if (format === "12h") {
    const period = hour >= 12 ? "م" : "ص"
    const hour12 = hour % 12 || 12
    return `${hour12}:${minute} ${period}`
  }

  return `${String(hour).padStart(2, "0")}:${minute}`
}

/** Timezone for مركز سواء — Asia/Riyadh, fixed +03:00, no DST. */
const BUSINESS_TZ = "Asia/Riyadh"

/**
 * Combine a date (YYYY-MM-DD) and time (HH:mm[:ss]) into a UTC ISO 8601
 * string, interpreting the wall-clock pair in Asia/Riyadh.
 *
 * Asia/Riyadh is the operating timezone for مركز سواء — clinic working hours,
 * employee schedules, and appointment slots are all expressed in local Riyadh
 * time. The backend stores `scheduledAt` as UTC, so the contract is:
 * wall-clock (Riyadh) → UTC ISO.
 *
 * Uses `date-fns-tz/fromZonedTime` instead of a hardcoded `+03:00` offset so
 * the conversion is driven by the IANA database and will survive any future
 * TZ policy change without a code edit.
 *
 * Returns null if either input is missing/malformed.
 */
export function combineDateTimeToISO(date: string, time: string): string | null {
  if (!date || !time) return null
  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const timeMatch = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!dateMatch || !timeMatch) return null
  const hh = String(Number(timeMatch[1])).padStart(2, "0")
  const mm = timeMatch[2]
  const ss = timeMatch[3] ?? "00"
  const zonedDateTimeStr = `${dateMatch[0]}T${hh}:${mm}:${ss}`
  const utcDate = fromZonedTime(zonedDateTimeStr, BUSINESS_TZ)
  return utcDate.toISOString()
}

/**
 * Convert a UTC HH:mm time (as returned by the backend slot endpoint) to the
 * equivalent wall-clock HH:mm in Asia/Riyadh on a given date.
 * Inputs: dateISO=YYYY-MM-DD (selected date in Riyadh), timeUtc=HH:mm UTC.
 */
export function utcTimeToRiyadhHHMM(dateISO: string, timeUtc: string): string {
  const m = timeUtc.match(/^(\d{1,2}):(\d{2})$/)
  const dm = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m || !dm) return timeUtc
  // Construct a UTC instant for that date + UTC time, then format in Riyadh
  const utcIso = `${dateISO}T${m[1].padStart(2, "0")}:${m[2]}:00Z`
  return formatInTimeZone(new Date(utcIso), BUSINESS_TZ, "HH:mm")
}

/** Convert a Date/ISO timestamp to the HH:mm input expected by formatClinicTime. */
export function toCanonicalTime(date: Date | string): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ""

  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function parseClinicTimeInput(input: string, format: TimeFormat = "24h"): string | null {
  const value = input.trim()
  if (!value) return null

  const suffixMatch = value.match(/\s*(ص|م|am|pm)\s*$/i)
  const suffix = suffixMatch?.[1]?.toLowerCase()
  const timeValue = suffixMatch ? value.slice(0, suffixMatch.index ?? value.length).trim() : value
  const match = timeValue.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null

  let hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null

  if (suffix) {
    if (format !== "12h" || hour < 1 || hour > 12) return null
    const isPm = suffix === "م" || suffix === "pm"
    hour = hour % 12 + (isPm ? 12 : 0)
  } else if (hour < 0 || hour > 23) {
    return null
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

/**
 * Get the week start day as a number (0 = Sunday, 1 = Monday).
 */
export function getWeekStartDay(weekStartDay: "sunday" | "monday" = "sunday"): 0 | 1 {
  return weekStartDay === "monday" ? 1 : 0
}

/**
 * Format a readable reference code, e.g. formatRef("GS", 1024) → "GS-1024".
 */
export function formatRef(prefix: string, ref: number): string {
  return `${prefix}-${ref}`
}
