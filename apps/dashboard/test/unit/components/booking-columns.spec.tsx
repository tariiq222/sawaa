import { describe, expect, it, vi } from "vitest"

import { getBookingColumns } from "@/components/features/bookings/booking-columns"

describe("booking column sizing", () => {
  it("declares payment, status, and actions as compact columns", () => {
    const columns = getBookingColumns(vi.fn(), vi.fn(), vi.fn(), (key) => key)

    for (const id of ["paymentStatus", "status", "actions"]) {
      const column = columns.find(
        (candidate) => candidate.id === id || ("accessorKey" in candidate && candidate.accessorKey === id),
      )
      expect(column?.meta).toEqual({ sizing: "compact", className: "w-px" })
    }
  })
})
