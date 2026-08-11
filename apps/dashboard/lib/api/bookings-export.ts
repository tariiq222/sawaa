/**
 * Bookings CSV Export — Sawaa Dashboard
 *
 * Paginates through the existing GET /dashboard/bookings endpoint using the
 * current filter set and serializes every matching row to a UTF-8 CSV file
 * with a BOM (so Excel opens Arabic text correctly).
 *
 * Design notes:
 *  - Backend authorization remains authoritative because every page is
 *    fetched via the same fetchBookings() call the list view uses.
 *  - page/limit are stripped from the incoming query so the dashboard's
 *    own paging controls do not influence export paging.
 *  - The export fetches its own pages at EXPORT_PAGE_SIZE (200), stops when
 *    the backend reports no more data, and rejects totals above
 *    MAX_EXPORT_ROWS before requesting the remaining pages so a stray
 *    unfiltered export cannot drag the browser through tens of thousands
 *    of rows.
 *  - No Zoom host/start URLs, payment details, invoice details, tokens,
 *    or any other secret fields are ever serialized.
 */

import { fetchBookings } from "@/lib/api/bookings"
import type { Booking, BookingListQuery } from "@/lib/types/booking"

/** Upper bound for a single export. Forces the user to narrow filters. */
export const MAX_EXPORT_ROWS = 50_000

/** Page size used while paginating the export. */
export const EXPORT_PAGE_SIZE = 200

/** UTF-8 BOM — required for Excel to detect UTF-8 (and render Arabic). */
const UTF8_BOM = "\uFEFF"

/** Stable, machine-readable header order. */
export const BOOKINGS_CSV_HEADERS = [
  "booking_number",
  "booking_id",
  "date",
  "start_time",
  "end_time",
  "client_id",
  "client_name",
  "client_phone",
  "client_email",
  "employee_id",
  "employee_name",
  "service_id",
  "service_name",
  "branch_name",
  "status",
  "booking_type",
  "delivery_type",
  "source",
  "duration_minutes",
  "price_halalas",
  "cancellation_reason",
  "notes",
  "created_at",
  "updated_at",
] as const

/** Tokens that can trigger spreadsheet formula execution when typed into a cell. */
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"])

/**
 * Escape a single CSV cell:
 *  - null/undefined → empty string
 *  - prefix leading =, +, -, @, tab, CR with a single quote to neutralize
 *    spreadsheet formula injection
 *  - wrap in double quotes and double-up internal quotes if it contains
 *    a comma, double quote, CR, or LF
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ""
  const s = typeof value === "string" ? value : String(value)
  if (s.length === 0) return ""
  const neutralized = FORMULA_TRIGGERS.has(s.charAt(0)) ? `'${s}` : s
  return /[",\r\n]/.test(neutralized)
    ? `"${neutralized.replace(/"/g, '""')}"`
    : neutralized
}

function rowFor(b: Booking): string[] {
  const client = b.client
  const employee = b.employee
    ? `${b.employee.user.firstName} ${b.employee.user.lastName}`.trim()
    : ""
  return [
    b.bookingNumber ?? "",
    b.id,
    b.date,
    b.startTime,
    b.endTime,
    b.clientId ?? "",
    client ? `${client.firstName} ${client.lastName}`.trim() : "",
    client?.phone ?? "",
    client?.email ?? "",
    b.employeeId,
    employee,
    b.serviceId,
    b.service?.nameEn ?? "",
    b.branchNameSnapshot ?? "",
    b.status,
    b.type,
    b.deliveryType ?? "",
    b.source,
    b.durationMinutesSnapshot ?? "",
    b.priceSnapshot ?? "",
    b.cancellationReason ?? "",
    b.notes ?? "",
    b.createdAt,
    b.updatedAt,
  ]
}

export function buildBookingsCsv(rows: Booking[]): string {
  const lines: string[] = []
  lines.push(BOOKINGS_CSV_HEADERS.map(escapeCsvCell).join(","))
  for (const b of rows) lines.push(rowFor(b).map(escapeCsvCell).join(","))
  // Use \r\n line endings — Excel and the CSV RFC (4180) prefer CRLF.
  return UTF8_BOM + lines.join("\r\n") + "\r\n"
}

export function buildBookingsFilename(now: Date = new Date()): string {
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  return `bookings-${yyyy}-${mm}-${dd}.csv`
}

/** Thrown when the filter set matches more than {@link MAX_EXPORT_ROWS} rows. */
export class BookingsExportTooLargeError extends Error {
  readonly total: number
  constructor(total: number) {
    super(
      `Booking export matches ${total} rows which exceeds the maximum of ${MAX_EXPORT_ROWS}. Please narrow the filters and try again.`,
    )
    this.name = "BookingsExportTooLargeError"
    this.total = total
  }
}

/**
 * Page through the existing GET /dashboard/bookings endpoint until every
 * matching row is collected. The incoming `page`/`limit` are intentionally
 * stripped so the visible list page size does not silently truncate the
 * export.
 */
export async function fetchAllBookingsForExport(
  query: BookingListQuery,
): Promise<Booking[]> {
  const baseQuery: BookingListQuery = { ...query }
  delete baseQuery.page
  delete baseQuery.limit

  const first = await fetchBookings({ ...baseQuery, page: 1, limit: EXPORT_PAGE_SIZE })
  const total = first.meta?.total ?? first.items.length
  if (total > MAX_EXPORT_ROWS) throw new BookingsExportTooLargeError(total)
  const collected: Booking[] = [...first.items]
  const totalPages = first.meta?.totalPages ?? 1
  if (totalPages <= 1) return collected
  for (let page = 2; page <= totalPages; page += 1) {
    const res = await fetchBookings({ ...baseQuery, page, limit: EXPORT_PAGE_SIZE })
    if (res.items.length === 0) break
    collected.push(...res.items)
  }
  return collected
}

/** Browser-only: trigger a CSV download and revoke the object URL. */
export function downloadBookingsCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }
}

/** End-to-end helper: page, serialize, trigger a CSV download. */
export async function exportBookingsCsv(
  query: BookingListQuery,
  now: Date = new Date(),
): Promise<{ rowCount: number; filename: string }> {
  const rows = await fetchAllBookingsForExport(query)
  downloadBookingsCsv(buildBookingsCsv(rows), buildBookingsFilename(now))
  return { rowCount: rows.length, filename: buildBookingsFilename(now) }
}