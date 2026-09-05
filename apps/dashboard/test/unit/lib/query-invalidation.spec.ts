import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"

import { invalidateMutationImpact } from "@/lib/query-invalidation"

describe("invalidateMutationImpact", () => {
  it("invalidates the scoped payment and financial queries", async () => {
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, "invalidateQueries")

    await invalidateMutationImpact(client, {
      kind: "payment-refunded",
      invoiceId: "inv-1",
      paymentId: "payment-1",
      bookingId: "booking-1",
      clientId: "client-1",
      employeeId: "employee-1",
    })

    const keys = invalidate.mock.calls.map(([options]) => options?.queryKey)
    expect(keys).toContainEqual(["payments"])
    expect(keys).toContainEqual(["payments", "stats"])
    expect(keys).toContainEqual(["payments", "detail", "payment-1"])
    expect(keys).toContainEqual(["invoices"])
    expect(keys).toContainEqual(["invoices", "detail", "inv-1"])
    expect(keys).toContainEqual(["bookings"])
    expect(keys).toContainEqual(["bookings", "detail", "booking-1"])
    expect(keys).toContainEqual(["clients", "detail", "client-1"])
    expect(keys).toContainEqual(["reports", "employee", "employee-1"])
    expect(keys).toContainEqual(["reports", "overview"])
    expect(keys).toContainEqual(["reports", "revenue"])
  })

  it("invalidates credit balances, matching credits, and the affected schedule", async () => {
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, "invalidateQueries")

    await invalidateMutationImpact(client, {
      kind: "credit-booked",
      clientId: "client-1",
      employeeId: "employee-1",
      date: "2026-09-05",
      bookingId: "booking-1",
    })

    const keys = invalidate.mock.calls.map(([options]) => options?.queryKey)
    expect(keys).toContainEqual(["bookings"])
    expect(keys).toContainEqual(["bookings", "detail", "booking-1"])
    expect(keys).toContainEqual(["package-purchases"])
    expect(keys).toContainEqual(["package-purchases", "client", "client-1"])
    expect(keys).toContainEqual(["credit-bookings"])
    expect(keys).toContainEqual(["employees", "slots", "employee-1", "2026-09-05"])
    expect(keys).toContainEqual(["employees", "schedule", "employee-1"])
    expect(keys).toContainEqual(["package-reports"])
  })

  it("refreshes the affected group program when credit is returned", async () => {
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, "invalidateQueries")

    await invalidateMutationImpact(client, {
      kind: "credit-returned",
      clientId: "client-1",
      employeeId: "employee-1",
      date: "2026-09-05",
      bookingId: "booking-1",
      programId: "program-1",
    })

    const keys = invalidate.mock.calls.map(([options]) => options?.queryKey)
    expect(keys).toContainEqual(["programs", "detail", "program-1"])
  })

  it("keeps a successful mutation nonfatal when a follow-up refetch rejects", async () => {
    const client = new QueryClient()
    vi.spyOn(client, "invalidateQueries").mockRejectedValue(new Error("network"))

    await expect(invalidateMutationImpact(client, {
      kind: "payment-settled",
      invoiceId: "inv-1",
    })).resolves.toBeUndefined()
  })
})
