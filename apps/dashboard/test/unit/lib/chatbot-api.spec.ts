import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock },
  getAccessToken: vi.fn(() => null),
}))

import { fetchChatSessions } from "@/lib/api/chatbot"

describe("chatbot api — sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("fetchChatSessions calls /chatbot/sessions", async () => {
    getMock.mockResolvedValueOnce({ items: [], meta: { total: 0 } })
    await fetchChatSessions({ page: 1 })
    expect(getMock).toHaveBeenCalledWith(
      expect.stringContaining("conversations"),
      expect.objectContaining({ page: 1 }),
    )
  })
})
