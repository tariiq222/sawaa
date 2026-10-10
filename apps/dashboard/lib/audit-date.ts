/** Calendar boundaries for the counseling center, independent of browser timezone. */
const DAY = 86_400_000
export function riyadhDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date))
}
export function riyadhDayStart(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new RangeError("Invalid calendar day")
  return new Date(`${day}T00:00:00.000+03:00`).toISOString()
}
export function riyadhDayEnd(day: string): string {
  return new Date(
    new Date(riyadhDayStart(day)).getTime() + DAY - 1
  ).toISOString()
}
export function riyadhDateRange(
  from: string,
  to: string
): { dateFrom: string; dateTo: string } {
  const [first, last] = from <= to ? [from, to] : [to, from]
  return { dateFrom: riyadhDayStart(first), dateTo: riyadhDayEnd(last) }
}
export function riyadhDateTimeValue(date: string | null | undefined): string {
  if (!date) return ""
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ""
  return new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 16)
}
export function riyadhDateTimeInstant(value: string): string {
  return new Date(`${value}:00+03:00`).toISOString()
}
