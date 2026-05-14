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
  fetchIntakeForms,
  fetchIntakeForm,
  createIntakeForm,
  updateIntakeForm,
  deleteIntakeForm,
  setIntakeFields,
  fetchIntakeResponses,
} from "@/lib/api/intake-forms"

describe("intake-forms api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchIntakeForms calls /intake-forms", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchIntakeForms()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms", undefined)
  })

  it("fetchIntakeForm calls /intake-forms/:id", async () => {
    getMock.mockResolvedValueOnce({})
    await fetchIntakeForm("form-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1")
  })

  it("createIntakeForm posts to /intake-forms", async () => {
    postMock.mockResolvedValueOnce({})
    await createIntakeForm({ nameAr: "نموذج", nameEn: "Form" } as Parameters<typeof createIntakeForm>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms", expect.anything())
  })

  it("updateIntakeForm patches /intake-forms/:id", async () => {
    patchMock.mockResolvedValueOnce({})
    await updateIntakeForm("form-1", { nameEn: "Updated Form" } as Parameters<typeof updateIntakeForm>[1])
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1", expect.anything())
  })

  it("deleteIntakeForm deletes /intake-forms/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteIntakeForm("form-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1")
  })

  it("setIntakeFields puts to /intake-forms/:id/fields", async () => {
    putMock.mockResolvedValueOnce([])
    await setIntakeFields("form-1", { fields: [] } as Parameters<typeof setIntakeFields>[1])
    expect(putMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1/fields", expect.anything())
  })

  it("fetchIntakeResponses calls /intake-forms/responses/:bookingId", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchIntakeResponses("bk-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/responses/bk-1")
  })
})
