import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock },
}))

import {
  fetchSmsConfig,
  fetchSmsDeliveries,
  sendTestSms,
  upsertSmsConfig,
} from "@/lib/api/sms"

describe("sms api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Read ─────────────────────────────────────────────────────────────────

  describe("fetchSmsConfig", () => {
    it("GETs the dashboard SMS config endpoint", async () => {
      const view = {
        id: "cfg-1",
        provider: "UNIFONIC" as const,
        senderId: "SAWAA",
        credentialsConfigured: true,
        lastTestAt: null,
        lastTestOk: null,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      }
      getMock.mockResolvedValueOnce(view)
      await fetchSmsConfig()
      expect(getMock).toHaveBeenCalledWith("/dashboard/comms/settings/sms")
    })

    it("returns the parsed SmsConfigView", async () => {
      const view = {
        id: "cfg-1",
        provider: "UNIFONIC" as const,
        senderId: "SAWAA",
        credentialsConfigured: true,
        lastTestAt: null,
        lastTestOk: null,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      }
      getMock.mockResolvedValueOnce(view)
      const result = await fetchSmsConfig()
      expect(result).toEqual(view)
    })

    it("propagates api-layer errors", async () => {
      getMock.mockRejectedValueOnce(new Error("Forbidden"))
      await expect(fetchSmsConfig()).rejects.toThrow("Forbidden")
    })
  })

  // ─── Upsert ───────────────────────────────────────────────────────────────
  //
  // The provider-credential contract is write-only: unifonic.appSid /
  // apiKey and taqnyat.apiToken are submitted to the backend but the view
  // only exposes `credentialsConfigured: boolean`. These tests guard the
  // exact field names so a typo cannot silently leak credentials in a
  // different field (e.g. swapping `appSid` → `appId`).

  describe("upsertSmsConfig", () => {
    it("POSTs to the dashboard SMS config endpoint", async () => {
      postMock.mockResolvedValueOnce({})
      const input = {
        provider: "UNIFONIC" as const,
        senderId: "SAWAA",
        unifonic: { appSid: "SID", apiKey: "KEY" },
      }
      await upsertSmsConfig(input)
      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/comms/settings/sms",
        input,
      )
    })

    it("uses POST (not PUT) — provider switch is treated as a config update", async () => {
      postMock.mockResolvedValueOnce({})
      await upsertSmsConfig({
        provider: "NONE" as const,
      })
      // No PUT helper is mocked here — only POST and GET. So if upsertSmsConfig
      // accidentally used PUT, the call would throw. The fact that this
      // assertion passes confirms the method choice.
      expect(postMock).toHaveBeenCalledOnce()
    })

    it("sends Unifonic credentials under their exact field names (appSid + apiKey)", async () => {
      postMock.mockResolvedValueOnce({})
      const input = {
        provider: "UNIFONIC" as const,
        senderId: "SAWAA",
        unifonic: { appSid: "APP_SID", apiKey: "API_KEY" },
      }
      await upsertSmsConfig(input)
      const sent = postMock.mock.calls[0][1] as {
        unifonic: { appSid: string; apiKey: string }
      }
      // Guards against a regression that swaps the keys
      // (e.g. appSid → appId).
      expect(sent.unifonic.appSid).toBe("APP_SID")
      expect(sent.unifonic.apiKey).toBe("API_KEY")
    })

    it("sends Taqnyat credentials under apiToken (not apiKey, not token)", async () => {
      postMock.mockResolvedValueOnce({})
      const input = {
        provider: "TAQNYAT" as const,
        taqnyat: { apiToken: "TAQ_TOKEN" },
      }
      await upsertSmsConfig(input)
      const sent = postMock.mock.calls[0][1] as {
        taqnyat: { apiToken: string }
      }
      expect(sent.taqnyat.apiToken).toBe("TAQ_TOKEN")
    })

    it("allows sending just the provider (NONE) without credentials", async () => {
      postMock.mockResolvedValueOnce({})
      await upsertSmsConfig({ provider: "NONE" as const })
      const sent = postMock.mock.calls[0][1] as Record<string, unknown>
      expect(sent.provider).toBe("NONE")
      expect("unifonic" in sent).toBe(false)
      expect("taqnyat" in sent).toBe(false)
    })

    it("propagates api-layer errors", async () => {
      postMock.mockRejectedValueOnce(new Error("Validation failed"))
      await expect(upsertSmsConfig({ provider: "NONE" as const })).rejects.toThrow(
        "Validation failed",
      )
    })
  })

  // ─── Test connection ──────────────────────────────────────────────────────

  describe("sendTestSms", () => {
    it("POSTs to the SMS test endpoint with the recipient phone under toPhone", async () => {
      postMock.mockResolvedValueOnce({ ok: true })
      await sendTestSms("+966501234567")
      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/comms/settings/sms/test",
        { toPhone: "+966501234567" },
      )
    })

    it("sends the phone under the exact key toPhone (not 'phone' or 'recipient')", async () => {
      // Field-name guard: the backend expects toPhone.
      postMock.mockResolvedValueOnce({ ok: true })
      await sendTestSms("0501234567")
      const body = postMock.mock.calls[0][1] as Record<string, unknown>
      expect(body.toPhone).toBe("0501234567")
      expect("phone" in body).toBe(false)
      expect("recipient" in body).toBe(false)
    })

    it("returns the parsed TestSmsResult on success", async () => {
      const result = { ok: true, providerMessageId: "msg-1" }
      postMock.mockResolvedValueOnce(result)
      const actual = await sendTestSms("+966501234567")
      expect(actual).toEqual(result)
    })

    it("returns ok=false with a bilingual error without throwing", async () => {
      const result = {
        ok: false,
        error: { ar: "فشل الإرسال", en: "Send failed" },
      }
      postMock.mockResolvedValueOnce(result)
      const actual = await sendTestSms("+966501234567")
      expect(actual.ok).toBe(false)
      expect(actual.error?.en).toBe("Send failed")
    })

    it("propagates api-layer errors", async () => {
      postMock.mockRejectedValueOnce(new Error("Timeout"))
      await expect(sendTestSms("+966501234567")).rejects.toThrow("Timeout")
    })
  })

  // ─── Deliveries list ──────────────────────────────────────────────────────

  describe("fetchSmsDeliveries", () => {
    it("GETs the SMS deliveries endpoint", async () => {
      getMock.mockResolvedValueOnce({ items: [] })
      await fetchSmsDeliveries()
      expect(getMock).toHaveBeenCalledWith(
        "/dashboard/comms/settings/sms/deliveries",
      )
    })

    it("returns the items array from the response envelope", async () => {
      const rows = [
        {
          id: "d-1",
          provider: "UNIFONIC" as const,
          toPhone: "+966501234567",
          status: "DELIVERED" as const,
          providerMessageId: "msg-1",
          errorMessage: null,
          sentAt: "2026-05-02T10:00:00.000Z",
          deliveredAt: "2026-05-02T10:01:00.000Z",
          createdAt: "2026-05-02T10:00:00.000Z",
        },
      ]
      getMock.mockResolvedValueOnce({ items: rows })
      const result = await fetchSmsDeliveries()
      expect(result.items).toEqual(rows)
    })

    it("returns an empty array when the org has no deliveries yet", async () => {
      getMock.mockResolvedValueOnce({ items: [] })
      const result = await fetchSmsDeliveries()
      expect(result.items).toEqual([])
    })

    it("propagates api-layer errors", async () => {
      getMock.mockRejectedValueOnce(new Error("Forbidden"))
      await expect(fetchSmsDeliveries()).rejects.toThrow("Forbidden")
    })
  })
})