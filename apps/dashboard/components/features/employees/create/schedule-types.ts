/* ─── Schedule shared types, constants, and utilities ─── */

/**
 * English day names — used for aria labels and fallback display.
 * Locale-aware display should use `DAY_NAME_KEYS` with `t()`.
 */
export const DAY_NAMES_EN = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
] as const

/**
 * Translation keys for day names (index = JS day number 0=Sun…6=Sat).
 * Usage: `t(DAY_NAME_KEYS[slot.dayOfWeek])`
 */
export const DAY_NAME_KEYS = [
  "employees.day.0",
  "employees.day.1",
  "employees.day.2",
  "employees.day.3",
  "employees.day.4",
  "employees.day.5",
  "employees.day.6",
] as const

export interface LocalBreak {
  key: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface LocalVacation {
  enabled: boolean
  startDate: string
  endDate: string
  reason: string
}

let breakKeyCounter = 0
export function nextBreakKey() {
  breakKeyCounter += 1
  return `brk-${breakKeyCounter}`
}
