/**
 * step-employee-hint.ts
 *
 * Helpers and the `useNearestSlotHints` hook for the "nearest slot" hint
 * rendered inside each practitioner card on the booking wizard's
 * employee step. Extracted from step-employee.tsx so the parent component
 * stays under the 300-line feature-component cap (CLAUDE.md File Size
 * Limits).
 *
 * The hint compares BOTH active delivery types (IN_PERSON and ONLINE)
 * for the selected service default duration, picks whichever has the
 * truly earliest bookable slot across the two, and renders that type +
 * date/time. If both types offer slots on the same earliest day we pick
 * whichever resolves earliest in the second phase (or fall back to
 * IN_PERSON to keep ordering deterministic).
 */

import { useMemo } from "react"
import { useQueries } from "@tanstack/react-query"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Building01Icon,
  VideoReplayIcon,
} from "@hugeicons/core-free-icons"
import { formatInTimeZone } from "date-fns-tz"

import type { Employee } from "@/lib/types/employee"
import type { ServiceEmployeeServiceType } from "@/lib/types/service"
import {
  fetchAvailableDays,
  fetchSlots,
} from "@/lib/api/employees-schedule"

// Operating timezone — re-declared here to avoid a lib → component import
// (forbidden by the dashboard layer rules). Keep in sync with
// `BUSINESS_TZ` in apps/dashboard/lib/utils.ts.
export const BUSINESS_TZ = "Asia/Riyadh"

// Window scanned per practitioner per delivery type for the "nearest
// available" hint.
export const NEAREST_LOOKAHEAD_DAYS = 14

export type DeliveryTypeKey = "IN_PERSON" | "ONLINE"

export const DELIVERY_TYPE_META: Record<
  DeliveryTypeKey,
  { icon: IconSvgElement; labelKey: string }
> = {
  IN_PERSON: {
    icon: Building01Icon,
    labelKey: "bookings.wizard.step.typeDuration.inPerson",
  },
  ONLINE: {
    icon: VideoReplayIcon,
    labelKey: "bookings.wizard.step.typeDuration.online",
  },
}

export interface NearestSlotHint {
  deliveryType: string
  date: string
  time: string
}

/** Today (YYYY-MM-DD) in Asia/Riyadh wall-clock — the clinic's TZ. */
export function getTodayInRiyadh(): string {
  return formatInTimeZone(new Date(), BUSINESS_TZ, "yyyy-MM-dd")
}

/** Filter the practitioner's service types down to active IN_PERSON/ONLINE. */
export function getActiveDeliveryTypes(
  serviceTypes: ServiceEmployeeServiceType[] | undefined,
): ServiceEmployeeServiceType[] {
  if (!serviceTypes) return []
  return serviceTypes.filter((st) => {
    if (!st.isActive) return false
    const k = (st.deliveryType ?? "").toUpperCase()
    return k === "IN_PERSON" || k === "ONLINE"
  })
}

export function getDeliveryTypeMeta(
  raw: string,
): { icon: IconSvgElement; labelKey: string } | null {
  const key = (raw ?? "").toUpperCase() as DeliveryTypeKey
  return DELIVERY_TYPE_META[key] ?? null
}

/** Locale-aware day + short-month label (e.g. "5 Jul" / "٥ تموز"). */
export function formatLocalizedDate(dateISO: string, locale: "ar" | "en"): string {
  // Anchor at noon to avoid TZ drift on the day boundary.
  const d = new Date(`${dateISO}T12:00:00Z`)
  if (isNaN(d.getTime())) return dateISO
  return new Intl.DateTimeFormat(
    locale === "ar" ? "ar-SA" : "en-US",
    { day: "numeric", month: "short" },
  ).format(d)
}

/** Convert a backend UTC HH:mm slot time to Asia/Riyadh wall-clock HH:mm. */
export function convertSlotTimeToRiyadhHHMM(
  dateISO: string,
  timeUtc: string,
): string {
  const m = timeUtc.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return timeUtc
  const utcIso = `${dateISO}T${m[1].padStart(2, "0")}:${m[2]}:00Z`
  return formatInTimeZone(new Date(utcIso), BUSINESS_TZ, "HH:mm")
}

/* ─── Hook: useNearestSlotHints ─────────────────────────────────────────── */

interface UseNearestSlotHintsArgs {
  employees: Employee[]
  serviceTypesByEmployee: Map<string, ServiceEmployeeServiceType[]>
  serviceId: string
  noScheduleById: Record<string, boolean>
}

/**
 * Phase 1 — for each (employee, type) pair, fetch the list of available
 * days inside NEAREST_LOOKAHEAD_DAYS.
 *
 * Phase 2 — for every (employee, type) pair that has at least one day,
 * fetch the slots on its earliest day. This means IN_PERSON and ONLINE
 * are compared on equal footing: whichever (date, time) combination is
 * earliest wins, IN_PERSON only on absolute equality.
 *
 * Phase 3 — resolve the winning (employee, type, date, time) per
 * employee by sorting candidates by absolute UTC slot-start moment
 * and returning the converted Riyadh wall-clock start time.
 */
export function useNearestSlotHints({
  employees,
  serviceTypesByEmployee,
  serviceId,
  noScheduleById,
}: UseNearestSlotHintsArgs): Record<string, NearestSlotHint | null> {
  const today = getTodayInRiyadh()

  // Build the flat per-(employee, type) query list. One query per active
  // delivery type that the practitioner offers for the service.
  const dayKeys = useMemo(() => {
    const out: Array<{
      employeeId: string
      type: ServiceEmployeeServiceType
      duration: number | null
    }> = []
    for (const emp of employees) {
      if (noScheduleById[emp.id]) continue
      const types = getActiveDeliveryTypes(serviceTypesByEmployee.get(emp.id))
      for (const st of types) {
        out.push({ employeeId: emp.id, type: st, duration: st.durationMins ?? null })
      }
    }
    return out
  }, [employees, serviceTypesByEmployee, noScheduleById])

  const dayQueries = useQueries({
    queries: dayKeys.map(({ employeeId, type, duration }) => ({
      queryKey: [
        "step-employee",
        "nearest-day",
        employeeId,
        type.deliveryType,
        duration,
        serviceId,
      ] as const,
      queryFn: () =>
        fetchAvailableDays(employeeId, today, {
          days: NEAREST_LOOKAHEAD_DAYS,
          duration: duration ?? undefined,
          serviceId,
          deliveryType: type.deliveryType,
        }),
      enabled: !!serviceId && duration != null,
      staleTime: 60 * 1000,
    })),
  })

  // Earliest date per (employee, type) pair — first entry of the days array.
  const earliestByKey = useMemo(
    () =>
      dayQueries.map((q) => {
        const dates = q.data
        return Array.isArray(dates) && dates.length > 0 ? dates[0] : null
      }),
    [dayQueries],
  )

  // Phase 2 — fetch the first slots for every (employee, type) candidate
  // that has at least one available day. We keep a parallel query list
  // to `dayKeys` so each slot candidate is paired with its own date and
  // delivery type. Candidates without an earliest date stay disabled
  // (enabled: false → no fetch).
  const slotQueries = useQueries({
    queries: dayKeys.map((k, i) => {
      const date = earliestByKey[i] ?? null
      return {
        queryKey: [
          "step-employee",
          "nearest-slot",
          k.employeeId,
          k.type.deliveryType,
          k.duration,
          date,
          serviceId,
        ] as const,
        queryFn: () =>
          fetchSlots(k.employeeId, date!, k.duration ?? undefined, {
            serviceId,
            deliveryType: k.type.deliveryType,
          }),
        enabled:
          !!serviceId &&
          date !== null &&
          k.duration != null,
        staleTime: 60 * 1000,
      }
    }),
  })

  // Build a sorted UTC slot-start instant from a backend (date, timeUtc)
  // pair so candidates on different dates AND different times can be
  // compared on a single absolute axis.
  function buildSlotStartUtc(dateISO: string, timeUtc: string): number | null {
    const m = timeUtc.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const y = Number(dateISO.slice(0, 4))
    const mo = Number(dateISO.slice(5, 7)) - 1
    const d = Number(dateISO.slice(8, 10))
    const h = Number(m[1])
    const mi = Number(m[2])
    if ([y, mo, d, h, mi].some((n) => !Number.isFinite(n))) return null
    return Date.UTC(y, mo, d, h, mi)
  }

  return useMemo<Record<string, NearestSlotHint | null>>(() => {
    const map: Record<string, NearestSlotHint | null> = {}
    type Candidate = {
      type: ServiceEmployeeServiceType
      date: string
      time: string
      startUtcMs: number
    }
    const candidatesByEmployee = new Map<string, Candidate[]>()

    dayKeys.forEach((k, i) => {
      const date = earliestByKey[i] ?? null
      const slots = slotQueries[i]?.data
      const slot = Array.isArray(slots) && slots.length > 0 ? slots[0] : null
      if (!date || !slot?.startTime) return
      const startUtcMs = buildSlotStartUtc(date, slot.startTime)
      if (startUtcMs === null) return
      const c: Candidate = {
        type: k.type,
        date,
        startUtcMs,
        time: convertSlotTimeToRiyadhHHMM(date, slot.startTime),
      }
      const list = candidatesByEmployee.get(k.employeeId) ?? []
      list.push(c)
      candidatesByEmployee.set(k.employeeId, list)
    })

    for (const emp of employees) {
      if (noScheduleById[emp.id]) {
        map[emp.id] = null
        continue
      }
      const candidates = candidatesByEmployee.get(emp.id) ?? []
      if (candidates.length === 0) {
        map[emp.id] = null
        continue
      }
      // Truly earliest slot wins. Absolute UTC tie (date + time equal)
      // falls back to IN_PERSON so output stays deterministic across
      // re-renders and cache replays.
      const winner = [...candidates].sort((a, b) => {
        if (a.startUtcMs !== b.startUtcMs) return a.startUtcMs - b.startUtcMs
        const aIn = (a.type.deliveryType ?? "").toUpperCase() === "IN_PERSON"
        const bIn = (b.type.deliveryType ?? "").toUpperCase() === "IN_PERSON"
        if (aIn && !bIn) return -1
        if (!aIn && bIn) return 1
        return 0
      })[0]
      map[emp.id] = {
        deliveryType: winner.type.deliveryType,
        date: winner.date,
        time: winner.time,
      }
    }
    return map
  }, [employees, dayKeys, earliestByKey, slotQueries, noScheduleById])
}
