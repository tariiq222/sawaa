import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, patchMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  patchMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, patch: patchMock },
}))

import {
  fetchContactMessages,
  updateContactMessageStatus,
  type ContactMessage,
  type ContactMessageStatus,
} from "@/lib/api/contact-messages"
import type { PaginatedResponse } from "@/lib/types/common"

const message: ContactMessage = {
  id: "message-1",
  name: "سارة",
  phone: null,
  email: null,
  subject: null,
  body: "استفسار",
  status: "NEW",
  createdAt: "2026-09-03T10:00:00.000Z",
  readAt: null,
  archivedAt: null,
}

const statuses: ContactMessageStatus[] = ["NEW", "READ", "REPLIED", "ARCHIVED"]

describe("contact-messages API request boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("GETs without a query string when filters are omitted", async () => {
    getMock.mockResolvedValueOnce({ items: [] })

    await fetchContactMessages()

    expect(getMock).toHaveBeenCalledExactlyOnceWith("/dashboard/comms/contact-messages")
    expect(patchMock).not.toHaveBeenCalled()
  })

  it.each(statuses)("preserves pagination and the %s status filter", async (status) => {
    getMock.mockResolvedValueOnce({ items: [] })

    await fetchContactMessages({ page: 2, limit: 25, status })

    expect(getMock).toHaveBeenCalledExactlyOnceWith(
      `/dashboard/comms/contact-messages?page=2&limit=25&status=${status}`,
    )
  })

  it("returns the original envelope, pagination metadata and nullable fields", async () => {
    const response: PaginatedResponse<ContactMessage> = {
      items: [message],
      meta: {
        total: 26,
        page: 2,
        limit: 25,
        totalPages: 2,
        hasNextPage: false,
        hasPreviousPage: true,
      },
    }
    getMock.mockResolvedValueOnce(response)

    expect(await fetchContactMessages({ page: 2 })).toBe(response)
  })

  it.each(statuses)("PATCHes the id/status route with only status %s", async (status) => {
    const response: ContactMessage = { ...message, status }
    patchMock.mockResolvedValueOnce(response)

    expect(await updateContactMessageStatus(message.id, status)).toBe(response)
    expect(patchMock).toHaveBeenCalledExactlyOnceWith(
      "/dashboard/comms/contact-messages/message-1/status",
      { status },
    )
    expect(getMock).not.toHaveBeenCalled()
  })

  it("encodes the path parameter without changing the request body", async () => {
    patchMock.mockResolvedValueOnce(message)

    await updateContactMessageStatus("message/with space", "READ")

    expect(patchMock).toHaveBeenCalledExactlyOnceWith(
      "/dashboard/comms/contact-messages/message%2Fwith%20space/status",
      { status: "READ" },
    )
  })

  it("preserves populated optional contact fields and timestamps", async () => {
    const response: ContactMessage = {
      ...message,
      phone: "+966501234567",
      email: "sender@example.com",
      subject: "سؤال",
      status: "ARCHIVED",
      readAt: "2026-09-03T11:00:00.000Z",
      archivedAt: "2026-09-03T12:00:00.000Z",
    }
    patchMock.mockResolvedValueOnce(response)

    expect(await updateContactMessageStatus(message.id, "ARCHIVED")).toBe(response)
  })

  it("propagates list errors unchanged", async () => {
    const error = new Error("Forbidden")
    getMock.mockRejectedValueOnce(error)

    await expect(fetchContactMessages()).rejects.toBe(error)
  })

  it("propagates update errors unchanged", async () => {
    const error = new Error("Message not found")
    patchMock.mockRejectedValueOnce(error)

    await expect(updateContactMessageStatus(message.id, "READ")).rejects.toBe(error)
  })
})
