import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, putMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  putMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, put: putMock, post: postMock },
}))

import {
  fetchZoomConfig,
  retryBookingZoomMeeting,
  testZoomConfig,
  upsertZoomConfig,
} from "@/lib/api/zoom"

describe("zoom api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Read ─────────────────────────────────────────────────────────────────

  describe("fetchZoomConfig", () => {
    it("GETs the dashboard Zoom integration endpoint", async () => {
      getMock.mockResolvedValueOnce({ configured: false, isActive: false })
      await fetchZoomConfig()
      expect(getMock).toHaveBeenCalledWith("/dashboard/integrations/zoom")
    })

    it("returns the parsed ZoomConfigView (configured + isActive)", async () => {
      const view = { configured: true, isActive: true }
      getMock.mockResolvedValueOnce(view)
      const result = await fetchZoomConfig()
      expect(result).toEqual(view)
    })

    it("propagates api-layer errors", async () => {
      const apiError = new Error("Zoom integration unavailable")
      getMock.mockRejectedValueOnce(apiError)
      await expect(fetchZoomConfig()).rejects.toBe(apiError)
    })
  })

  // ─── Upsert ───────────────────────────────────────────────────────────────
  //
  // Credential contract is identical to Moyasar: clientId / clientSecret /
  // accountId are write-only (sent in the PUT body) and never echoed back.
  // The view only exposes { configured, isActive } — the "is this org set up?"
  // pair — and a regression that leaked credentials would break the audit
  // posture.

  describe("upsertZoomConfig", () => {
    it("PUTs (not PATCH) — full replacement of the Zoom integration", async () => {
      putMock.mockResolvedValueOnce({ configured: true, isActive: true })
      await upsertZoomConfig({ zoomClientId: "cid", zoomClientSecret: "csec" })
      expect(putMock).toHaveBeenCalledWith(
        "/dashboard/integrations/zoom",
        expect.objectContaining({
          zoomClientId: "cid",
          zoomClientSecret: "csec",
        }),
      )
    })

    it("sends all three credential fields under their exact names", async () => {
      // Guards against a field-swap regression like renaming
      // zoomClientId → zoomAccountId in the body.
      putMock.mockResolvedValueOnce({ configured: true, isActive: true })
      await upsertZoomConfig({
        zoomClientId: "CID",
        zoomClientSecret: "CSEC",
        zoomAccountId: "ACC",
      })
      const sent = putMock.mock.calls[0][1] as Record<string, unknown>
      expect(sent.zoomClientId).toBe("CID")
      expect(sent.zoomClientSecret).toBe("CSEC")
      expect(sent.zoomAccountId).toBe("ACC")
    })

    it("allows partial updates (only accountId) — backend merges with existing config", async () => {
      putMock.mockResolvedValueOnce({ configured: true, isActive: true })
      await upsertZoomConfig({ zoomAccountId: "ACC_ONLY" })
      const sent = putMock.mock.calls[0][1] as Record<string, unknown>
      expect(sent).toEqual({ zoomAccountId: "ACC_ONLY" })
    })

    it("returns the trimmed ZoomConfigView — never echoes credentials back", async () => {
      const trimmed = { configured: true, isActive: false }
      putMock.mockResolvedValueOnce(trimmed)
      const result = await upsertZoomConfig({ zoomClientId: "x" })
      expect(result).toEqual(trimmed)
      // Write-only contract: no credentials in the response.
      expect("zoomClientId" in result).toBe(false)
      expect("zoomClientSecret" in result).toBe(false)
      expect("zoomAccountId" in result).toBe(false)
    })

    it("propagates api-layer errors", async () => {
      putMock.mockRejectedValueOnce(new Error("Forbidden"))
      await expect(upsertZoomConfig({})).rejects.toThrow("Forbidden")
    })
  })

  // ─── Test connection ──────────────────────────────────────────────────────

  describe("testZoomConfig", () => {
    it("POSTs the input credentials to the probe endpoint", async () => {
      postMock.mockResolvedValueOnce({ ok: true })
      const input = {
        zoomClientId: "CID",
        zoomClientSecret: "CSEC",
        zoomAccountId: "ACC",
      }
      await testZoomConfig(input)
      expect(postMock).toHaveBeenCalledWith("/dashboard/integrations/zoom/test", input)
    })

    it("returns ok=true on a successful probe", async () => {
      postMock.mockResolvedValueOnce({ ok: true })
      const result = await testZoomConfig({ zoomClientId: "x" })
      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it("returns ok=false with an error message on a failed probe (no throw)", async () => {
      postMock.mockResolvedValueOnce({
        ok: false,
        error: "Invalid client credentials",
      })
      const result = await testZoomConfig({ zoomClientId: "x" })
      expect(result.ok).toBe(false)
      expect(result.error).toBe("Invalid client credentials")
    })

    it("propagates api-layer errors", async () => {
      postMock.mockRejectedValueOnce(new Error("Timeout"))
      await expect(testZoomConfig({ zoomClientId: "x" })).rejects.toThrow("Timeout")
    })
  })

  // ─── Booking retry ────────────────────────────────────────────────────────

  describe("retryBookingZoomMeeting", () => {
    it("POSTs to the booking-scoped retry endpoint with an empty body", async () => {
      postMock.mockResolvedValueOnce({
        id: "bk-1",
        zoomMeetingId: "123",
        zoomJoinUrl: "https://zoom.us/j/123",
        zoomStartUrl: "https://zoom.us/s/123",
      })
      await retryBookingZoomMeeting("bk-1")
      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/bookings/bk-1/zoom/retry",
        {},
      )
    })

    it("targets the retry endpoint for the given booking ref", async () => {
      postMock.mockResolvedValueOnce({
        id: "PREFIX-42",
        zoomMeetingId: null,
        zoomJoinUrl: null,
        zoomStartUrl: null,
      })
      // Booking identifiers are backend-issued UUIDs or `PREFIX-<n>` refs and
      // never contain path separators, so the id is interpolated as-is.
      await retryBookingZoomMeeting("PREFIX-42")
      const url = postMock.mock.calls[0][0] as string
      expect(url).toBe("/dashboard/bookings/PREFIX-42/zoom/retry")
    })

    it("returns the updated Zoom meeting fields on success", async () => {
      const retryResult = {
        id: "bk-1",
        zoomMeetingId: "123",
        zoomJoinUrl: "https://zoom.us/j/123",
        zoomStartUrl: "https://zoom.us/s/123",
      }
      postMock.mockResolvedValueOnce(retryResult)
      const result = await retryBookingZoomMeeting("bk-1")
      expect(result).toEqual(retryResult)
    })

    it("propagates a failure (e.g. booking cancelled, Zoom unreachable)", async () => {
      postMock.mockRejectedValueOnce(new Error("Zoom API unreachable"))
      await expect(retryBookingZoomMeeting("bk-1")).rejects.toThrow(
        "Zoom API unreachable",
      )
    })
  })
})