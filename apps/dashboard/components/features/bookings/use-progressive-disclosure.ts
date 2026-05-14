import { useMemo } from "react"

export interface ProgressiveVisibility {
  showService: boolean
  showType: boolean
  showDuration: boolean
  showDatetime: boolean
  showTime: boolean
  showPayAtClinic: boolean
  canSubmit: boolean
}

interface ProgressiveDisclosureInput {
  employeeId: string
  serviceId: string
  type: string
  durationOptionId: string
  date: string
  startTime: string
  hasDurationOptions: boolean
}

export function useProgressiveDisclosure({
  employeeId,
  serviceId,
  type,
  durationOptionId,
  date,
  startTime,
  hasDurationOptions,
}: ProgressiveDisclosureInput): ProgressiveVisibility {
  return useMemo(() => {
    const showService = !!employeeId
    const showType = showService && !!serviceId
    const showDuration = showType && !!type && hasDurationOptions
    const showDatetime = showType && !!type && (!hasDurationOptions || !!durationOptionId)
    const showTime = showDatetime && !!date
    const showPayAtClinic = showTime && !!startTime
    const canSubmit =
      !!employeeId &&
      !!serviceId &&
      !!type &&
      (!hasDurationOptions || !!durationOptionId) &&
      !!date &&
      !!startTime

    return {
      showService,
      showType,
      showDuration,
      showDatetime,
      showTime,
      showPayAtClinic,
      canSubmit,
    }
  }, [employeeId, serviceId, type, durationOptionId, date, startTime, hasDurationOptions])
}
