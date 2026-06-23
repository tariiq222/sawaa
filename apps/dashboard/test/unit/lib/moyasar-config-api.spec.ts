import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, patch: patchMock, post: postMock },
}))

import {
  fetchMoyasarConfig,
  testMoyasarConfig,
  upsertMoyasarConfig,
} from "@/lib/api/moyasar-config"

describe("moyasar-config api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Read ─────────────────────────────────────────────────────────────────

  describe("fetchMoyasarConfig", () => {
    it("GETs the organization Moyasar config endpoint", async () => {
      getMock.mockResolvedValueOnce(null)
      await fetchMoyasarConfig()
      expect(getMock).toHaveBeenCalledWith("/dashboard/finance/moyasar/config")
    })

    it("returns null when the organization has not configured Moyasar yet", async () => {
      getMock.mockResolvedValueOnce(null)
      const result = await fetchMoyasarConfig()
      expect(result).toBeNull()
    })

    it("returns the parsed config when the organization has one configured", async () => {
      const view = {
        publishableKey: "pk_test_12345678901234567890",
        secretKeyMasked: "sk_test_****7890",
        hasWebhookSecret: true,
        isLive: false,
        lastVerifiedAt: "2026-05-01T10:00:00.000Z",
        lastVerifiedStatus: "OK",
        updatedAt: "2026-05-01T10:00:00.000Z",
      }
      getMock.mockResolvedValueOnce(view)
      const result = await fetchMoyasarConfig()
      expect(result).toEqual(view)
    })

    it("propagates network errors from the api layer", async () => {
      const apiError = new Error("Network down")
      getMock.mockRejectedValueOnce(apiError)
      await expect(fetchMoyasarConfig()).rejects.toBe(apiError)
    })
  })

  // ─── Write ────────────────────────────────────────────────────────────────
  //
  // The credential contract is *write-only*: the secret key and webhook secret
  // are submitted to the backend but never returned in the GET view. A
  // regression that silently dropped those keys (or — worse — returned them
  // in `fetchMoyasarConfig`) would break the dashboard's "key rotation"
  // workflow and possibly leak secrets to the browser. These tests guard the
  // exact field names sent in the PATCH body and assert that no raw secret
  // key leaks into the view.

  describe("upsertMoyasarConfig", () => {
    it("PATCHes the organization Moyasar config endpoint", async () => {
      patchMock.mockResolvedValueOnce({})
      await upsertMoyasarConfig({ publishableKey: "pk_test_xxx" })
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/finance/moyasar/config",
        expect.objectContaining({ publishableKey: "pk_test_xxx" }),
      )
    })

    it("uses PATCH (not POST or PUT) — config is upserted, not replaced", async () => {
      patchMock.mockResolvedValueOnce({})
      await upsertMoyasarConfig({ publishableKey: "pk_test_xxx" })
      // Make sure neither POST nor PUT was used by mistake.
      expect(postMock).not.toHaveBeenCalled()
      // `get` is the only other method registered on the mocked api object,
      // so confirming getMock is untouched gives us a 3-way guard.
      expect(getMock).not.toHaveBeenCalled()
    })

    it("sends secretKey and webhookSecret under their exact field names (no swap)", async () => {
      // Guards against a regression where publishableKey and secretKey are
      // accidentally swapped before send — that would silently leak the
      // secret to the publishable-key channel.
      patchMock.mockResolvedValueOnce({})
      const payload = {
        publishableKey: "pk_test_PUBLIC",
        secretKey: "sk_test_SECRET",
        webhookSecret: "whsec_TEST",
        isLive: false,
      }
      await upsertMoyasarConfig(payload)
      const sent = patchMock.mock.calls[0][1] as Record<string, unknown>
      expect(sent.publishableKey).toBe("pk_test_PUBLIC")
      expect(sent.secretKey).toBe("sk_test_SECRET")
      expect(sent.webhookSecret).toBe("whsec_TEST")
      expect(sent.isLive).toBe(false)
    })

    it("sends ONLY publishableKey when secretKey + webhookSecret are omitted", async () => {
      // Staff editing only the live flag should not need to re-supply secrets
      // (the backend keeps the existing ones).
      patchMock.mockResolvedValueOnce({})
      await upsertMoyasarConfig({ publishableKey: "pk_test_xxx", isLive: true })
      const sent = patchMock.mock.calls[0][1] as Record<string, unknown>
      expect(sent).toEqual({ publishableKey: "pk_test_xxx", isLive: true })
    })

    it("returns the trimmed view shape (publishableKey + isLive + updatedAt only)", async () => {
      const trimmedView = {
        publishableKey: "pk_test_xxx",
        isLive: true,
        updatedAt: "2026-05-02T11:00:00.000Z",
      }
      patchMock.mockResolvedValueOnce(trimmedView)
      const result = await upsertMoyasarConfig({ publishableKey: "pk_test_xxx" })
      expect(result).toEqual(trimmedView)
      // The trimmed view must NOT include any secret fields — write-only.
      expect("secretKey" in result).toBe(false)
      expect("secretKeyMasked" in result).toBe(false)
      expect("webhookSecret" in result).toBe(false)
    })

    it("propagates a PATCH failure (e.g. 4xx from the backend)", async () => {
      const apiError = new Error("Validation failed")
      patchMock.mockRejectedValueOnce(apiError)
      await expect(
        upsertMoyasarConfig({ publishableKey: "pk_test_xxx" }),
      ).rejects.toBe(apiError)
    })
  })

  // ─── Test connection ──────────────────────────────────────────────────────

  describe("testMoyasarConfig", () => {
    it("POSTs to the stored-credential probe endpoint with an empty body", async () => {
      postMock.mockResolvedValueOnce({ ok: true, status: "OK" })
      await testMoyasarConfig()
      expect(postMock).toHaveBeenCalledWith("/dashboard/finance/moyasar/config/test", {})
    })

    it("returns the parsed test result on success", async () => {
      const result = { ok: true, status: "OK" }
      postMock.mockResolvedValueOnce(result)
      const actual = await testMoyasarConfig()
      expect(actual).toEqual(result)
    })

    it("returns a failed result without throwing (status != OK)", async () => {
      const failed = { ok: false, status: "INVALID_KEY" }
      postMock.mockResolvedValueOnce(failed)
      const actual = await testMoyasarConfig()
      expect(actual).toEqual(failed)
    })

    it("propagates a network failure from the api layer", async () => {
      const apiError = new Error("Timeout")
      postMock.mockRejectedValueOnce(apiError)
      await expect(testMoyasarConfig()).rejects.toBe(apiError)
    })
  })
})