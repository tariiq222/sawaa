import { beforeEach, describe, expect, it, vi } from "vitest"

const { getMock, postMock, patchMock, deleteMock, putMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
  putMock: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  api: { get: getMock, post: postMock, patch: patchMock, delete: deleteMock, put: putMock },
}))

import {
  fetchEmailTemplates,
  fetchEmailTemplate,
  updateEmailTemplate,
} from "@/lib/api/email-templates"

describe("email-templates api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchEmailTemplates calls /email-templates", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchEmailTemplates()
    expect(getMock).toHaveBeenCalledWith("/dashboard/comms/email-templates")
  })

  it("fetchEmailTemplate calls /email-templates/:slug", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchEmailTemplate("booking-confirmed")
    expect(getMock).toHaveBeenCalledWith("/dashboard/comms/email-templates/booking-confirmed")
  })

  it("updateEmailTemplate patches /email-templates/:id", async () => {
    patchMock.mockResolvedValueOnce({})
    await updateEmailTemplate("tpl-1", { subject: "موضوع", htmlBody: "<p>مرحبا</p>" })
    expect(patchMock).toHaveBeenCalledWith("/dashboard/comms/email-templates/tpl-1", {
      subject: "موضوع",
      htmlBody: "<p>مرحبا</p>",
    })
  })

})
