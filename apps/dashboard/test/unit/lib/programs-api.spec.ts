/**
 * Programs api — unit tests
 *
 * Covers the dashboard `/dashboard/programs` CRUD wrapper and the public
 * `/api/v1/public/programs` fetcher. The dashboard wrapper delegates to the
 * shared `api.{get,post,patch}` client; the public fetcher hits the
 * same-origin route through the native `fetch`. Both should propagate
 * errors verbatim.
 *
 * What we assert (per endpoint):
 *  - HTTP method
 *  - URL (with encoded id where applicable)
 *  - request body shape
 *  - error propagation
 *  - public fetcher: 4xx/5xx throws with status in the message
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock },
}))

import {
  fetchPrograms,
  fetchProgram,
  createProgram,
  publishProgram,
  scheduleProgram,
  cancelProgram,
  enrollClientInProgram,
  fetchPublicPrograms,
  fetchPublicProgram,
} from "@/lib/api/programs"

describe("programs api — dashboard endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── List ────────────────────────────────────────────────────────────────

  describe("fetchPrograms", () => {
    it("GETs /dashboard/programs with no params when query is empty", async () => {
      getMock.mockResolvedValueOnce([])
      await fetchPrograms()
      expect(getMock).toHaveBeenCalledWith("/dashboard/programs", {})
    })

    it("forwards status, departmentId, and branchId as query params", async () => {
      getMock.mockResolvedValueOnce([])
      await fetchPrograms({
        status: "OPEN",
        departmentId: "d-1",
        branchId: "b-1",
      })
      expect(getMock).toHaveBeenCalledWith("/dashboard/programs", {
        status: "OPEN",
        departmentId: "d-1",
        branchId: "b-1",
      })
    })

    it("propagates api-layer errors", async () => {
      getMock.mockRejectedValueOnce(new Error("Forbidden"))
      await expect(fetchPrograms()).rejects.toThrow("Forbidden")
    })
  })

  // ─── Detail ──────────────────────────────────────────────────────────────

  describe("fetchProgram", () => {
    it("GETs /dashboard/programs/:id with the encoded id", async () => {
      getMock.mockResolvedValueOnce({ id: "p-1" })
      await fetchProgram("p-1")
      expect(getMock).toHaveBeenCalledWith("/dashboard/programs/p-1")
    })

    it("URL-encodes the id (uuid with hyphens is safe; specials must encode)", async () => {
      getMock.mockResolvedValueOnce({ id: "x/y" })
      await fetchProgram("x/y")
      expect(getMock).toHaveBeenCalledWith("/dashboard/programs/x%2Fy")
    })

    it("propagates api-layer errors", async () => {
      getMock.mockRejectedValueOnce(new Error("Not Found"))
      await expect(fetchProgram("missing")).rejects.toThrow("Not Found")
    })
  })

  // ─── Create ──────────────────────────────────────────────────────────────

  describe("createProgram", () => {
    it("POSTs the create payload to /dashboard/programs", async () => {
      postMock.mockResolvedValueOnce({ id: "p-new" })
      const payload = {
        departmentId: "d-1",
        branchId: "b-1",
        nameAr: "برنامج",
        daysCount: 5,
        hoursPerDay: 4,
        minParticipants: 5,
        maxParticipants: 20,
        price: 100000,
        supervisorIds: ["s-1"],
      }
      await createProgram(payload)
      expect(postMock).toHaveBeenCalledWith("/dashboard/programs", payload)
    })

    it("propagates api-layer errors", async () => {
      postMock.mockRejectedValueOnce(new Error("Unprocessable Entity"))
      await expect(
        createProgram({} as Parameters<typeof createProgram>[0]),
      ).rejects.toThrow("Unprocessable Entity")
    })
  })

  // ─── Publish ─────────────────────────────────────────────────────────────

  describe("publishProgram", () => {
    it("PATCHes /dashboard/programs/:id/publish with no body", async () => {
      patchMock.mockResolvedValueOnce({ id: "p-1", status: "OPEN" })
      await publishProgram("p-1")
      expect(patchMock).toHaveBeenCalledWith("/dashboard/programs/p-1/publish")
    })

    it("propagates api-layer errors", async () => {
      patchMock.mockRejectedValueOnce(new Error("Conflict"))
      await expect(publishProgram("p-1")).rejects.toThrow("Conflict")
    })
  })

  // ─── Schedule ────────────────────────────────────────────────────────────

  describe("scheduleProgram", () => {
    it("PATCHes /dashboard/programs/:id/schedule with the payload", async () => {
      patchMock.mockResolvedValueOnce({ id: "p-1", status: "SCHEDULED" })
      await scheduleProgram("p-1", { startDate: "2026-08-01" })
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/programs/p-1/schedule",
        { startDate: "2026-08-01" },
      )
    })

    it("propagates api-layer errors", async () => {
      patchMock.mockRejectedValueOnce(new Error("Invalid date"))
      await expect(
        scheduleProgram("p-1", { startDate: "bad" }),
      ).rejects.toThrow("Invalid date")
    })
  })

  // ─── Cancel ──────────────────────────────────────────────────────────────

  describe("cancelProgram", () => {
    it("PATCHes /dashboard/programs/:id/cancel with a reason", async () => {
      patchMock.mockResolvedValueOnce({ id: "p-1", status: "CANCELLED" })
      await cancelProgram("p-1", { reason: "إلغاء إداري" })
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/programs/p-1/cancel",
        { reason: "إلغاء إداري" },
      )
    })

    it("propagates api-layer errors", async () => {
      patchMock.mockRejectedValueOnce(new Error("Already cancelled"))
      await expect(
        cancelProgram("p-1", { reason: "إلغاء" }),
      ).rejects.toThrow("Already cancelled")
    })
  })

  // ─── Enroll ──────────────────────────────────────────────────────────────

  describe("enrollClientInProgram", () => {
    it("POSTs {clientId} (NOT programId) to /dashboard/programs/:id/enrollments", async () => {
      // programId comes from the URL — the backend EnrollClientDto rejects
      // unknown fields. Guards against a regression where the wrapper sends
      // both clientId and programId in the body.
      postMock.mockResolvedValueOnce({
        type: "ENROLLED",
        bookingId: "bk-1",
        status: "PENDING",
        invoiceId: null,
      })
      await enrollClientInProgram({ programId: "p-1", clientId: "c-1" })
      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/programs/p-1/enrollments",
        { clientId: "c-1" },
      )
      const body = postMock.mock.calls[0][1] as Record<string, unknown>
      expect(body).not.toHaveProperty("programId")
    })

    it("uses the programId from the payload in the URL", async () => {
      postMock.mockResolvedValueOnce({ type: "ENROLLED", bookingId: "x" })
      await enrollClientInProgram({ programId: "p-42", clientId: "c-1" })
      expect(postMock.mock.calls[0][0]).toBe(
        "/dashboard/programs/p-42/enrollments",
      )
    })

    it("propagates api-layer errors", async () => {
      postMock.mockRejectedValueOnce(new Error("Program full"))
      await expect(
        enrollClientInProgram({ programId: "p-1", clientId: "c-1" }),
      ).rejects.toThrow("Program full")
    })
  })
})

describe("programs api — public endpoints (native fetch)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("fetchPublicPrograms", () => {
    it("hits /api/v1/public/programs (no departmentId)", async () => {
      const spy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify([{ id: "p-1" }]), { status: 200 }),
        )

      const result = await fetchPublicPrograms()

      expect(spy).toHaveBeenCalledWith(
        "/api/v1/public/programs",
        expect.objectContaining({ credentials: "include" }),
      )
      expect(result).toEqual([{ id: "p-1" }])
    })

    it("appends ?departmentId=… when provided", async () => {
      const spy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), { status: 200 }),
        )

      await fetchPublicPrograms("d-7")

      const url = spy.mock.calls[0][0] as string
      expect(url).toBe("/api/v1/public/programs?departmentId=d-7")
    })

    it("unwraps { programs: [...] } envelope when present", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ programs: [{ id: "p-2" }, { id: "p-3" }] }),
          { status: 200 },
        ),
      )

      const result = await fetchPublicPrograms()
      expect(result).toEqual([{ id: "p-2" }, { id: "p-3" }])
    })

    it("throws with the status code on a 4xx response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }),
      )

      await expect(fetchPublicPrograms()).rejects.toThrow(
        "Failed to load public programs: 403",
      )
    })

    it("throws with the status code on a 5xx response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("", { status: 502 }),
      )

      await expect(fetchPublicPrograms()).rejects.toThrow(
        "Failed to load public programs: 502",
      )
    })
  })

  describe("fetchPublicProgram", () => {
    it("GETs /api/v1/public/programs/:id with credentials: include", async () => {
      const spy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: "p-1" }), { status: 200 }),
        )

      const result = await fetchPublicProgram("p-1")

      expect(spy).toHaveBeenCalledWith("/api/v1/public/programs/p-1", {
        credentials: "include",
      })
      expect(result).toEqual({ id: "p-1" })
    })

    it("throws with the status code on a 404", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("", { status: 404 }),
      )

      await expect(fetchPublicProgram("missing")).rejects.toThrow(
        "Failed to load public program: 404",
      )
    })
  })
})
