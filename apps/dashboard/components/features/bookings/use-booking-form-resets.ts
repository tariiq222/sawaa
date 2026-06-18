import { useEffect } from "react"
import type { UseFormReturn, FieldValues, Path } from "react-hook-form"

/**
 * Resets downstream slot-selection fields when upstream booking selectors change.
 *
 * Used by create/page.tsx — clears startTime whenever the employee, service,
 * or delivery type changes, and clears startTime alone when the date changes.
 */
export function useBookingCreateResets<T extends FieldValues>(
  form: UseFormReturn<T>,
  employeeId: string,
  serviceId: string,
  deliveryType: string,
  date: string,
) {
  // Reset time when any upstream selector changes
  useEffect(() => {
    form.setValue("startTime" as Path<T>, "" as never)
  }, [employeeId, serviceId, deliveryType, form])

  // Reset time alone when date changes
  useEffect(() => {
    form.setValue("startTime" as Path<T>, "" as never)
  }, [date, form])
}

/**
 * Resets startTime when the date changes during a reschedule, but only after
 * the booking has loaded and only when the date actually differs from the
 * original booking date (avoids resetting on the initial form population).
 */
export function useBookingEditDateReset<T extends FieldValues>(
  form: UseFormReturn<T>,
  date: string,
  originalDate: string | undefined,
) {
  useEffect(() => {
    if (originalDate && date !== originalDate) {
      form.setValue("startTime" as Path<T>, "" as never)
    }
  }, [date, originalDate, form])
}
