import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock },
}))

import {
  fetchEmailConfig,
  sendTestEmail,
  upsertEmailConfig,
} from "@/lib/api/email-config"

describe("email-config api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Read ─────────────────────────────────────────────────────────────────

  describe("fetchEmailConfig", () => {
    it("GETs the dashboard email config endpoint", async () => {
      const view = {
        id: "ec-1",
        organizationId: "org-1",
        provider: "RESEND" as const,
        senderName: "Sawaa",
        senderEmail: "no-reply@sawaa.sa",
        credentialsConfigured: true,
        lastTestAt: null,
        lastTestOk: null,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      }
      getMock.mockResolvedValueOnce(view)
      await fetchEmailConfig()
      expect(getMock).toHaveBeenCalledWith("/dashboard/comms/settings/email")
    })

    it("returns the parsed EmailConfigView", async () => {
      const view = {
        id: "ec-1",
        organizationId: "org-1",
        provider: "RESEND" as const,
        senderName: "Sawaa",
        senderEmail: "no-reply@sawaa.sa",
        credentialsConfigured: true,
        lastTestAt: null,
        lastTestOk: null,
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      }
      getMock.mockResolvedValueOnce(view)
      const result = await fetchEmailConfig()
      expect(result).toEqual(view)
    })

    it("propagates api-layer errors", async () => {
      getMock.mockRejectedValueOnce(new Error("Forbidden"))
      await expect(fetchEmailConfig()).rejects.toThrow("Forbidden")
    })
  })

  // ─── Upsert ───────────────────────────────────────────────────────────────
  //
  // Provider credentials (smtp.pass, resend.apiKey, sendgrid.apiKey,
  // mailchimp.apiKey) are write-only. The view only exposes
  // `credentialsConfigured: boolean`. These tests guard the exact field
  // names so a typo cannot route a real password to the wrong provider
  // (e.g. typing `smtp.user` instead of `smtp.pass` would silently strip
  // authentication on the next test send).

  describe("upsertEmailConfig", () => {
    it("POSTs the input to the dashboard email config endpoint", async () => {
      postMock.mockResolvedValueOnce({})
      const input = {
        provider: "SMTP" as const,
        senderName: "Sawaa",
        senderEmail: "no-reply@sawaa.sa",
        smtp: {
          host: "smtp.example.com",
          port: 587,
          user: "u",
          pass: "p",
          secure: false,
        },
      }
      await upsertEmailConfig(input)
      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/comms/settings/email",
        input,
      )
    })

    it("uses POST (not PUT) — provider switch is a config update", async () => {
      postMock.mockResolvedValueOnce({})
      await upsertEmailConfig({ provider: "NONE" as const })
      expect(postMock).toHaveBeenCalledOnce()
    })

    it("sends SMTP credentials under their exact nested field names", async () => {
      // Guards against a regression where `smtp.user` / `smtp.pass` get
      // renamed (e.g. to `username` / `password`) — the backend rejects
      // unknown fields and the SMTP login would silently fail.
      postMock.mockResolvedValueOnce({})
      await upsertEmailConfig({
        provider: "SMTP" as const,
        smtp: { host: "h", port: 587, user: "U", pass: "P" },
      })
      const sent = postMock.mock.calls[0][1] as {
        smtp: { host: string; port: number; user: string; pass: string }
      }
      expect(sent.smtp.host).toBe("h")
      expect(sent.smtp.port).toBe(587)
      expect(sent.smtp.user).toBe("U")
      expect(sent.smtp.pass).toBe("P")
    })

    it("sends Resend credentials under apiKey (not token)", async () => {
      postMock.mockResolvedValueOnce({})
      await upsertEmailConfig({
        provider: "RESEND" as const,
        resend: { apiKey: "re_xxxx" },
      })
      const sent = postMock.mock.calls[0][1] as {
        resend: { apiKey: string }
      }
      expect(sent.resend.apiKey).toBe("re_xxxx")
    })

    it("sends SendGrid credentials under apiKey", async () => {
      postMock.mockResolvedValueOnce({})
      await upsertEmailConfig({
        provider: "SENDGRID" as const,
        sendgrid: { apiKey: "SG.xxxx" },
      })
      const sent = postMock.mock.calls[0][1] as {
        sendgrid: { apiKey: string }
      }
      expect(sent.sendgrid.apiKey).toBe("SG.xxxx")
    })

    it("sends Mailchimp credentials under apiKey", async () => {
      postMock.mockResolvedValueOnce({})
      await upsertEmailConfig({
        provider: "MAILCHIMP" as const,
        mailchimp: { apiKey: "mc-xxxx-us1" },
      })
      const sent = postMock.mock.calls[0][1] as {
        mailchimp: { apiKey: string }
      }
      expect(sent.mailchimp.apiKey).toBe("mc-xxxx-us1")
    })

    it("allows sending just the provider (NONE) without credentials", async () => {
      postMock.mockResolvedValueOnce({})
      await upsertEmailConfig({ provider: "NONE" as const })
      const sent = postMock.mock.calls[0][1] as Record<string, unknown>
      expect(sent.provider).toBe("NONE")
      expect("smtp" in sent).toBe(false)
      expect("resend" in sent).toBe(false)
      expect("sendgrid" in sent).toBe(false)
      expect("mailchimp" in sent).toBe(false)
    })

    it("propagates api-layer errors", async () => {
      postMock.mockRejectedValueOnce(new Error("Validation failed"))
      await expect(upsertEmailConfig({ provider: "NONE" as const })).rejects.toThrow(
        "Validation failed",
      )
    })
  })

  // ─── Test connection ──────────────────────────────────────────────────────

  describe("sendTestEmail", () => {
    it("POSTs to the email test endpoint with the recipient under toEmail", async () => {
      postMock.mockResolvedValueOnce({ ok: true })
      await sendTestEmail("test@sawaa.sa")
      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/comms/settings/email/test",
        { toEmail: "test@sawaa.sa" },
      )
    })

    it("sends the recipient under the exact key toEmail (not 'to', 'recipient', 'email')", async () => {
      // Field-name guard.
      postMock.mockResolvedValueOnce({ ok: true })
      await sendTestEmail("test@sawaa.sa")
      const body = postMock.mock.calls[0][1] as Record<string, unknown>
      expect(body.toEmail).toBe("test@sawaa.sa")
      expect("to" in body).toBe(false)
      expect("recipient" in body).toBe(false)
      expect("email" in body).toBe(false)
    })

    it("returns the parsed TestEmailResult on success (messageId echoed)", async () => {
      const result = { ok: true, messageId: "msg-123" }
      postMock.mockResolvedValueOnce(result)
      const actual = await sendTestEmail("test@sawaa.sa")
      expect(actual).toEqual(result)
    })

    it("returns ok=false with a bilingual error without throwing", async () => {
      const result = {
        ok: false,
        error: { ar: "فشل الإرسال", en: "Send failed" },
      }
      postMock.mockResolvedValueOnce(result)
      const actual = await sendTestEmail("test@sawaa.sa")
      expect(actual.ok).toBe(false)
      expect(actual.error?.en).toBe("Send failed")
    })

    it("propagates api-layer errors", async () => {
      postMock.mockRejectedValueOnce(new Error("Timeout"))
      await expect(sendTestEmail("test@sawaa.sa")).rejects.toThrow("Timeout")
    })
  })
})