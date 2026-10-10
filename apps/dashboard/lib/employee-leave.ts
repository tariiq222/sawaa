import { formatDatePattern } from "@/lib/date"

/** Leave remains visible until the last Saudi calendar day has ended. */
export function isLeaveCurrentOrUpcoming(endDate: string, now = new Date()): boolean {
  const endDay = formatDatePattern(endDate, "yyyy-MM-dd", { fallback: "" })
  return !!endDay && endDay >= formatDatePattern(now, "yyyy-MM-dd")
}
