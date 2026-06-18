import { useMemo } from "react"

export interface ProgressiveVisibility {
  showService: boolean
  showType: boolean
  showDatetime: boolean
  showTime: boolean
  showPayAtClinic: boolean
  canSubmit: boolean
}

interface ProgressiveDisclosureInput {
  employeeId: string
  serviceId: string
  type: string
  date: string
  startTime: string
}

export function useProgressiveDisclosure({
  employeeId,
  serviceId,
  type,
  date,
  startTime,
}: ProgressiveDisclosureInput): ProgressiveVisibility {
  return useMemo(() => {
    const showService = !!employeeId
    const showType = showService && !!serviceId
    const showDatetime = showType && !!type
    const showTime = showDatetime && !!date
    const showPayAtClinic = showTime && !!startTime
    const canSubmit =
      !!employeeId &&
      !!serviceId &&
      !!type &&
      !!date &&
      !!startTime

    return {
      showService,
      showType,
      showDatetime,
      showTime,
      showPayAtClinic,
      canSubmit,
    }
  }, [employeeId, serviceId, type, date, startTime])
}
