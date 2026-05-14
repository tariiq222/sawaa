import type { CSSProperties } from "react"

// cn() moved to @deqah/ui/lib/cn as of SaaS-05a.
// Re-exported here for backward compatibility across the dashboard workspace;
// new code should import { cn } from "@deqah/ui" directly.
export { cn } from "@deqah/ui/lib/cn"

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
 * @param format - Clinic date format from BrandingConfig
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
 * @param format - Clinic time format from BrandingConfig
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

/**
 * Get the week start day as a number (0 = Sunday, 1 = Monday).
 */
export function getWeekStartDay(weekStartDay: "sunday" | "monday" = "sunday"): 0 | 1 {
  return weekStartDay === "monday" ? 1 : 0
}
