/**
 * discount-reasons API — Sawaa Dashboard
 *
 * Controller: dashboard/discount-reasons
 *  - GET    /dashboard/discount-reasons?includeInactive=...
 *  - POST   /dashboard/discount-reasons
 *  - PATCH  /dashboard/discount-reasons/:id
 *  - DELETE /dashboard/discount-reasons/:id
 *
 * These tests guard the URL+method+body contracts (URL hygiene + method
 * choice matters for route protection, audit logging, and idempotency)
 * and assert that the typed response is returned as-is.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock },
}))

import {
  fetchDiscountReasons,
  createDiscountReason,
  updateDiscountReason,
  deleteDiscountReason,
} from "@/lib/api/discount-reasons"

describe("discount-reasons api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── List ─────────────────────────────────────────────────────────────────

  describe("fetchDiscountReasons", () => {
    it("GETs the discount-reasons endpoint without the includeInactive param by default", async () => {
      getMock.mockResolvedValueOnce([])
      await fetchDiscountReasons()
      // Default: includeInactive=false, the param must be `undefined` so the
      // api layer omits it from the query string.
      expect(getMock).toHaveBeenCalledWith(
        "/dashboard/discount-reasons",
        { includeInactive: undefined },
      )
    })

    it("includes includeInactive=true when the caller asks for inactive reasons", async () => {
      getMock.mockResolvedValueOnce([])
      await fetchDiscountReasons(true)
      expect(getMock).toHaveBeenCalledWith(
        "/dashboard/discount-reasons",
        { includeInactive: true },
      )
    })

    it("returns the parsed array (no envelope unwrapping)", async () => {
      const list = [
        { id: "dr-1", label: "Compassionate", isActive: true, sortOrder: 1 },
        { id: "dr-2", label: "Returning", isActive: false, sortOrder: 2 },
      ]
      getMock.mockResolvedValueOnce(list)
      const result = await fetchDiscountReasons(true)
      expect(result).toEqual(list)
    })

    it("propagates api errors", async () => {
      const err = new Error("Forbidden")
      getMock.mockRejectedValueOnce(err)
      await expect(fetchDiscountReasons()).rejects.toBe(err)
    })
  })

  // ─── Create ───────────────────────────────────────────────────────────────

  describe("createDiscountReason", () => {
    it("POSTs to /dashboard/discount-reasons with the input body", async () => {
      postMock.mockResolvedValueOnce({ id: "dr-1", label: "Compassionate", isActive: true, sortOrder: 1 })
      const input = { label: "Compassionate", isActive: true, sortOrder: 1 }
      await createDiscountReason(input)
      expect(postMock).toHaveBeenCalledWith("/dashboard/discount-reasons", input)
    })

    it("returns the persisted DiscountReason (with backend-assigned id)", async () => {
      const persisted = { id: "dr-1", label: "Compassionate", isActive: true, sortOrder: 1 }
      postMock.mockResolvedValueOnce(persisted)
      const result = await createDiscountReason({ label: "Compassionate", isActive: true, sortOrder: 1 })
      expect(result).toEqual(persisted)
    })

    it("propagates validation errors", async () => {
      const err = new Error("label is required")
      postMock.mockRejectedValueOnce(err)
      await expect(
        createDiscountReason({ label: "", isActive: true, sortOrder: 0 }),
      ).rejects.toThrow("label is required")
    })
  })

  // ─── Update ───────────────────────────────────────────────────────────────

  describe("updateDiscountReason", () => {
    it("PATCHes the row by id with the input body", async () => {
      patchMock.mockResolvedValueOnce({ id: "dr-1", label: "Renamed", isActive: true, sortOrder: 1 })
      await updateDiscountReason("dr-1", { label: "Renamed" })
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/discount-reasons/dr-1",
        { label: "Renamed" },
      )
    })

    it("uses PATCH (not PUT) — partial update", async () => {
      patchMock.mockResolvedValueOnce({ id: "dr-1", label: "x", isActive: false, sortOrder: 2 })
      await updateDiscountReason("dr-1", { isActive: false, sortOrder: 2 })
      // No PUT/PATCH confusion.
      expect(patchMock).toHaveBeenCalledTimes(1)
      expect(postMock).not.toHaveBeenCalled()
    })

    it("propagates api errors", async () => {
      patchMock.mockRejectedValueOnce(new Error("Not found"))
      await expect(updateDiscountReason("dr-x", { label: "x" })).rejects.toThrow("Not found")
    })
  })

  // ─── Delete ───────────────────────────────────────────────────────────────

  describe("deleteDiscountReason", () => {
    it("DELETEs the row by id", async () => {
      deleteMock.mockResolvedValueOnce({ id: "dr-1" })
      await deleteDiscountReason("dr-1")
      expect(deleteMock).toHaveBeenCalledWith("/dashboard/discount-reasons/dr-1")
    })

    it("returns the deleted id envelope", async () => {
      deleteMock.mockResolvedValueOnce({ id: "dr-1" })
      const result = await deleteDiscountReason("dr-1")
      expect(result).toEqual({ id: "dr-1" })
    })

    it("propagates api errors (e.g. FK conflict when reason is in use)", async () => {
      deleteMock.mockRejectedValueOnce(new Error("Reason is referenced by invoices"))
      await expect(deleteDiscountReason("dr-1")).rejects.toThrow(
        "Reason is referenced by invoices",
      )
    })
  })
})
