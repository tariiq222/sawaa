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
  fetchBookingIntakeResponses,
} from "@/lib/api/intake-forms"

describe("intake-forms api", () => {
  beforeEach(() => { vi.clearAllMocks() })

  it("fetchIntakeForms calls /intake-forms", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchIntakeForms()
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms")
  })

  it("fetchIntakeForm calls /intake-forms/:id", async () => {
    getMock.mockResolvedValueOnce({ id: "form-1", type: "PRE_BOOKING", scope: "GLOBAL", fields: [] })
    await fetchIntakeForm("form-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1")
  })

  it("createIntakeForm posts to /intake-forms", async () => {
    postMock.mockResolvedValueOnce({ id: "form-1", type: "PRE_BOOKING", scope: "GLOBAL", fields: [] })
    await createIntakeForm({ nameAr: "نموذج", nameEn: "Form", type: "pre_booking", scope: "global" } as Parameters<typeof createIntakeForm>[0])
    expect(postMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms", expect.anything())
  })

  it("updateIntakeForm patches /intake-forms/:id", async () => {
    patchMock.mockResolvedValueOnce({ id: "form-1", type: "PRE_BOOKING", scope: "GLOBAL", fields: [] })
    await updateIntakeForm("form-1", { nameEn: "Updated Form" } as Parameters<typeof updateIntakeForm>[1])
    expect(patchMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1", expect.anything())
  })

  it("deleteIntakeForm deletes /intake-forms/:id", async () => {
    deleteMock.mockResolvedValueOnce(undefined)
    await deleteIntakeForm("form-1")
    expect(deleteMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1")
  })

  it("setIntakeFields puts to /intake-forms/:id/fields", async () => {
    putMock.mockResolvedValueOnce({ id: "form-1", type: "PRE_BOOKING", scope: "GLOBAL", fields: [] })
    await setIntakeFields("form-1", { fields: [] } as Parameters<typeof setIntakeFields>[1])
    expect(putMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/form-1/fields", expect.anything())
  })

  it("fetchIntakeResponses calls /intake-forms/responses/:bookingId", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchIntakeResponses("bk-1")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/responses/bk-1")
  })

  it("fetchBookingIntakeResponses calls /intake-forms/responses/:bookingId", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchBookingIntakeResponses("bk-2")
    expect(getMock).toHaveBeenCalledWith("/dashboard/organization/intake-forms/responses/bk-2")
  })

  it("serializes false explicitly and encodes reference path parameters", async () => {
    getMock.mockResolvedValueOnce([])
    await fetchIntakeForms({ isActive: false })
    expect(getMock).toHaveBeenLastCalledWith("/dashboard/organization/intake-forms?isActive=false")
    getMock.mockResolvedValueOnce({ id: "form-1", type: "PRE_BOOKING", scope: "GLOBAL", fields: [] })
    await fetchIntakeForm("FRM/1")
    expect(getMock).toHaveBeenLastCalledWith("/dashboard/organization/intake-forms/FRM%2F1")
  })

  it("normalizes nested field enums in both atomic create and patch requests", async () => {
    const response = { id: "form-1", type: "POST_SESSION", scope: "GLOBAL", fields: [] }
    const fields = [{ labelAr: "السؤال", fieldType: "select" as const, options: ["نعم", "لا"] }]
    postMock.mockResolvedValueOnce(response)
    await createIntakeForm({ nameAr: "نموذج", nameEn: "Form", type: "post_session", scope: "global", fields })
    expect(postMock).toHaveBeenLastCalledWith("/dashboard/organization/intake-forms", {
      nameAr: "نموذج", nameEn: "Form", type: "POST_SESSION", scope: "GLOBAL",
      fields: [{ labelAr: "السؤال", fieldType: "SELECT", options: ["نعم", "لا"] }],
    })
    patchMock.mockResolvedValueOnce(response)
    await updateIntakeForm("form-1", { type: "post_session", scope: "global", scopeId: null, fields })
    expect(patchMock).toHaveBeenLastCalledWith("/dashboard/organization/intake-forms/form-1", {
      type: "POST_SESSION", scope: "GLOBAL", scopeId: null,
      fields: [{ labelAr: "السؤال", fieldType: "SELECT", options: ["نعم", "لا"] }],
    })
  })

  it("preserves nullable labels, actual counts and response scope enrichment", async () => {
    getMock.mockResolvedValueOnce([{
      id: "response-1", formId: "form-1", bookingId: "bk-1", clientId: "",
      answers: { "field-1": ["نعم"] }, createdAt: "2026-09-05T00:00:00.000Z",
      form: { id: "form-1", nameAr: "نموذج", nameEn: null,
        type: "pre_session", scope: "service", scopeId: "svc-1", submissionsCount: 7,
        scopeLabel: "استشارة", serviceId: "svc-1", employeeId: null, branchId: null,
        fields: [{ id: "field-1", labelEn: null, fieldType: "CHECKBOX", options: null }] },
    }])
    const [response] = await fetchIntakeResponses("bk-1")
    expect(response.form).toMatchObject({
      nameEn: null, type: "pre_session", scope: "service", submissionsCount: 7,
      scopeLabel: "استشارة", serviceId: "svc-1", employeeId: null, branchId: null,
      fields: [{ labelEn: null, fieldType: "checkbox", options: null }],
    })
    expect(response.answers).toEqual({ "field-1": ["نعم"] })
  })
})
