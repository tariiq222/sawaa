import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock, postMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
  postMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: {
    get: getMock,
    patch: patchMock,
    post: postMock,
  },
  getAccessToken: vi.fn(() => null),
}))

import {
  fetchChatbotConfig,
  upsertChatbotConfig,
  fetchChatSession,
  endChatSession,
  sendStaffMessage,
  fetchChatSessions,
} from "@/lib/api/chatbot"

describe("chatbot api", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("fetchChatbotConfig", () => {
    it("calls GET /dashboard/ai/chatbot-config", async () => {
      getMock.mockResolvedValueOnce({ id: "cfg-1", systemPromptAr: "مرحبا" })
      await fetchChatbotConfig()
      expect(getMock).toHaveBeenCalledWith("/dashboard/ai/chatbot-config")
    })
  })

  describe("upsertChatbotConfig", () => {
    it("calls PATCH /dashboard/ai/chatbot-config with payload", async () => {
      patchMock.mockResolvedValueOnce({ id: "cfg-1" })
      const payload = { systemPromptAr: "مرحباً بك", systemPromptEn: "Welcome" }
      await upsertChatbotConfig(payload)
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/ai/chatbot-config",
        payload,
      )
    })
  })

  describe("fetchChatSession", () => {
    it("calls GET /dashboard/comms/chat/conversations/:id", async () => {
      getMock.mockResolvedValueOnce({ id: "sess-1", messages: [] })
      await fetchChatSession("sess-1")
      expect(getMock).toHaveBeenCalledWith("/dashboard/comms/chat/conversations/sess-1")
    })
  })

  describe("endChatSession", () => {
    it("calls PATCH /dashboard/comms/chat/conversations/:id/close", async () => {
      patchMock.mockResolvedValueOnce({ id: "sess-1", endedAt: "2026-01-01T00:00:00Z" })
      await endChatSession("sess-1")
      expect(patchMock).toHaveBeenCalledWith(
        "/dashboard/comms/chat/conversations/sess-1/close",
      )
    })
  })

  describe("sendStaffMessage", () => {
    it("calls POST /dashboard/comms/chat/conversations/:id/messages with body", async () => {
      postMock.mockResolvedValueOnce({ id: "msg-1", body: "مرحباً", createdAt: "2026-01-01T00:00:00Z" })
      await sendStaffMessage("sess-1", "مرحباً")
      expect(postMock).toHaveBeenCalledWith(
        "/dashboard/comms/chat/conversations/sess-1/messages",
        { body: "مرحباً" },
      )
    })
  })

  describe("fetchChatSessions", () => {
    it("calls /dashboard/comms/chat/conversations with pagination", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchChatSessions({ page: 2, perPage: 20 })
      expect(getMock).toHaveBeenCalledWith(
        expect.stringContaining("/dashboard/comms/chat/conversations"),
        expect.objectContaining({ page: 2, limit: 20 }),
      )
    })

    it("converts handedOff boolean to string for the API", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchChatSessions({ handedOff: true })
      expect(getMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ handedOff: "true" }),
      )
    })

    it("omits handedOff from params when undefined", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchChatSessions({})
      expect(getMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.objectContaining({ handedOff: expect.anything() }),
      )
    })

    it("passes language and date range filters", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchChatSessions({ language: "ar", dateFrom: "2026-01-01", dateTo: "2026-01-31" })
      expect(getMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ language: "ar", fromDate: "2026-01-01", toDate: "2026-01-31" }),
      )
    })

    it("passes search filter when provided", async () => {
      getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
      await fetchChatSessions({ search: "استفسار" })
      expect(getMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ search: "استفسار" }),
      )
    })
  })
})
