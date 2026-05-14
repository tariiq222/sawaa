"use client"

import { useOrganizationSettings } from "@/hooks/use-organization-settings"
import { formatClinicDate, formatClinicTime, getWeekStartDay } from "@/lib/utils"
import type { DateFormat, TimeFormat } from "@/lib/utils"

export function useOrganizationConfig() {
  const { data: settings } = useOrganizationSettings()

  const dateFormat = (settings?.dateFormat ?? "Y-m-d") as DateFormat
  const timeFormat = (settings?.timeFormat ?? "24h") as TimeFormat
  const weekStartDay = (settings?.weekStartDay ?? "sunday") as "sunday" | "monday"
  const timezone = settings?.timezone ?? "Asia/Riyadh"

  return {
    dateFormat,
    timeFormat,
    weekStartDay,
    timezone,
    weekStartDayNumber: getWeekStartDay(weekStartDay),
    formatDate: (date: Date | string) => formatClinicDate(date, dateFormat),
    formatTime: (time: string) => formatClinicTime(time, timeFormat),
  }
}
