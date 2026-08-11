import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Booking } from "@/lib/types/booking"

const { fetchBookings } = vi.hoisted(() => ({ fetchBookings: vi.fn() }))
vi.mock("@/lib/api/bookings", () => ({ fetchBookings }))

import {
  BOOKINGS_CSV_HEADERS,
  BookingsExportTooLargeError,
  MAX_EXPORT_ROWS,
  buildBookingsCsv,
  downloadBookingsCsv,
  fetchAllBookingsForExport,
} from "@/lib/api/bookings-export"

const booking = (overrides: Partial<Booking> = {}) => ({
  id: "booking-1", bookingNumber: 7, clientId: "client-1", employeeId: "employee-1",
  serviceId: "service-1", employeeServiceId: "employee-service-1", type: "individual",
  deliveryType: "IN_PERSON", source: "RECEPTION", date: "2026-08-11", startTime: "09:00",
  endTime: "10:00", status: "confirmed", checkedInAt: null, notes: null, zoomJoinUrl: null,
  zoomHostUrl: "secret-host-url", zoomMeetingStatus: null, zoomMeetingError: null,
  cancellationReason: null, cancelledBy: null, suggestedRefundType: null, adminNotes: null,
  cancelledAt: null, confirmedAt: null, completedAt: null, createdAt: "2026-08-11T00:00:00Z",
  updatedAt: "2026-08-11T00:00:00Z", client: { id: "client-1", firstName: "علي", lastName: "العميل", email: "a@example.com", phone: null },
  employee: { id: "employee-1", userId: "user-1", user: { firstName: "Sara", lastName: "Staff" }, specialty: "", specialtyAr: "" },
  service: { id: "service-1", nameAr: "خدمة", nameEn: "Service", price: 10, duration: 60 },
  employeeService: { id: "employee-service-1" }, rescheduledFrom: null, payment: { id: "payment-1", amount: 10, method: "cash", status: "paid", totalAmount: 10 }, invoice: null,
  intakeFormId: null, intakeFormAlreadySubmitted: false, priceSnapshot: 1000, durationMinutesSnapshot: 60,
  branchNameSnapshot: "Main", employeeNameSnapshot: null, serviceNameSnapshot: null, categoryNameSnapshot: null, departmentNameSnapshot: null,
  ...overrides,
} as Booking)

describe("bookings export API", () => {
  beforeEach(() => vi.clearAllMocks())

  it("propagates filters across every export page and strips visible pagination", async () => {
    const query = { page: 4, limit: 20, status: "confirmed" as const, search: "علي" }
    fetchBookings.mockResolvedValueOnce({ items: [booking()], meta: { total: 201, totalPages: 2 } })
    fetchBookings.mockResolvedValueOnce({ items: [booking({ id: "booking-2" })], meta: { total: 201, totalPages: 2 } })

    await expect(fetchAllBookingsForExport(query)).resolves.toHaveLength(2)
    expect(fetchBookings).toHaveBeenNthCalledWith(1, { status: "confirmed", search: "علي", page: 1, limit: 200 })
    expect(fetchBookings).toHaveBeenNthCalledWith(2, { status: "confirmed", search: "علي", page: 2, limit: 200 })
  })

  it("rejects totals above the explicit cap before fetching another page", async () => {
    fetchBookings.mockResolvedValueOnce({ items: [], meta: { total: MAX_EXPORT_ROWS + 1, totalPages: 251 } })
    await expect(fetchAllBookingsForExport({})).rejects.toBeInstanceOf(BookingsExportTooLargeError)
    expect(fetchBookings).toHaveBeenCalledTimes(1)
  })

  it("builds BOM-prefixed Arabic CSV, escapes cells, neutralizes formulas, and supports empty exports", () => {
    const csv = buildBookingsCsv([booking({ notes: "=SUM(A1)", client: { ...booking().client!, firstName: "علي,\"عميل\"", lastName: "\n" } })])
    expect(csv.startsWith("\uFEFF")).toBe(true)
    expect(csv).toContain(BOOKINGS_CSV_HEADERS.join(","))
    expect(csv).toContain("'\u003dSUM(A1)")
    expect(csv).toContain('"علي,""عميل""')
    expect(buildBookingsCsv([])).toBe(`\uFEFF${BOOKINGS_CSV_HEADERS.join(",")}\r\n`)
    expect(csv).not.toContain("secret-host-url")
  })

  it("cleans up the temporary download anchor and object URL", () => {
    const append = vi.spyOn(document.body, "appendChild")
    const remove = vi.spyOn(document.body, "removeChild")
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test")
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    downloadBookingsCsv("csv", "bookings.csv")
    expect(click).toHaveBeenCalled()
    expect(append).toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test")
  })
})
