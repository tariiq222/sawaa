/**
 * Pure helpers for the employee form.
 *
 * Extracted from use-employee-form.ts to keep the hook orchestration focused
 * on side-effects (mutations, hydration effects) and away from data transforms.
 * All functions are pure (no React, no side effects, no I/O).
 */

import { halalasToSarNumber, sarToHalalas } from "@/lib/money"
import type { DraftService } from "@/components/features/employees/create/services-tab"
import type { AvailabilitySlot, EmployeeService } from "@/lib/types/employee"

/**
 * Convert wire-format serviceTypes (from API) into form-display shape
 * (SAR numbers, undefined for empty).
 */
export function toDisplayTypeConfigs(types: EmployeeService["serviceTypes"] = []) {
  return types.map((st) => ({
    deliveryType: st.deliveryType,
    price: st.price != null ? halalasToSarNumber(st.price) : undefined,
    duration: st.duration ?? undefined,
    isActive: st.isActive,
  }))
}

/**
 * Convert form-shape type configs into wire-format (integer halalas).
 */
export function toStorageTypeConfigs(types: DraftService["types"] = []) {
  return types.map((tc) => ({
    ...tc,
    price: tc.price != null ? sarToHalalas(tc.price) : tc.price,
  }))
}

/**
 * Default weekly availability used as a fallback when editing an employee
 * with no existing slots. Sun–Thu active 09:00–17:00, Fri–Sat inactive.
 */
export const defaultSchedule: AvailabilitySlot[] = Array.from(
  { length: 7 },
  (_, i) => ({
    dayOfWeek: i,
    startTime: "09:00",
    endTime: "17:00",
    isActive: i <= 4,
  }),
)

/**
 * Build the practitioner-owned durations payload for a draft service when
 * the user entered any custom price/duration. Persisting these owned rows
 * + flipping pricing mode to custom is what makes the wizard's per-type
 * overrides take effect — without it the assignment silently lands in
 * inherit mode and the entered prices are dropped. Returns null when no
 * custom values were entered (pure inherit), in which case the caller
 * leaves the link in inherit mode.
 */
export function buildOwnedDurationsPayload(ds: DraftService) {
  const defByDt = new Map(
    (ds.serviceBookingTypes ?? []).map((bt) => [bt.deliveryType.toLowerCase(), bt]),
  )
  const durations = ds.types
    .filter((tc) => tc.isActive !== false && (tc.price != null || tc.duration != null))
    .map((tc) => {
      const def = defByDt.get(tc.deliveryType)
      const durationMins = tc.duration ?? def?.durationMins ?? null
      const priceSar = tc.price ?? (def ? halalasToSarNumber(def.price) : null)
      if (durationMins == null || priceSar == null) return null
      return {
        deliveryType: tc.deliveryType.toUpperCase(),
        items: [
          {
            label: `${durationMins} min`,
            labelAr: `${durationMins} دقيقة`,
            durationMins,
            price: sarToHalalas(priceSar),
          },
        ],
      }
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
  return durations.length > 0 ? { durations } : null
}