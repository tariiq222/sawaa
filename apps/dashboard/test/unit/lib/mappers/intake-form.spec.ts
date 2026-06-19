import { describe, expect, it } from "vitest"
import { mapApiForm } from "@/lib/mappers/intake-form"
import type { IntakeFormApi } from "@/lib/types/intake-form-api"

function makeApiForm(overrides: Partial<IntakeFormApi> = {}): IntakeFormApi {
  return {
    id: "form-1",
    ref: 1,
    nameEn: "New Client Intake",
    nameAr: "نموذج عميل جديد",
    type: "pre_booking",
    scope: "global",
    scopeId: "scope-1",
    isActive: true,
    submissionsCount: 7,
    createdAt: "2026-06-01T08:00:00.000Z",
    updatedAt: "2026-06-01T08:00:00.000Z",
    fields: [
      {
        id: "field-1",
        formId: "form-1",
        labelEn: "Marital status",
        labelAr: "الحالة الاجتماعية",
        fieldType: "select",
        isRequired: true,
        options: ["متزوج", "أعزب"],
        position: 0,
      },
    ],
    ...overrides,
  }
}

describe("mapApiForm", () => {
  it("maps API field names to the frontend shape (fieldType→type, isRequired→required)", () => {
    const mapped = mapApiForm(makeApiForm())
    expect(mapped.fields).toEqual([
      {
        id: "field-1",
        labelEn: "Marital status",
        labelAr: "الحالة الاجتماعية",
        type: "select",
        required: true,
        options: ["متزوج", "أعزب"],
      },
    ])
    expect(mapped.id).toBe("form-1")
    expect(mapped.nameAr).toBe("نموذج عميل جديد")
    expect(mapped.scope).toBe("global")
    expect(mapped.isActive).toBe(true)
    expect(mapped.submissionsCount).toBe(7)
  })

  it("falls back to an empty scopeId when the API sends null", () => {
    const mapped = mapApiForm(makeApiForm({ scopeId: null }))
    expect(mapped.scopeId).toBe("")
  })

  it("defaults to no fields when the API omits the fields array", () => {
    const mapped = mapApiForm(makeApiForm({ fields: undefined }))
    expect(mapped.fields).toEqual([])
    expect(mapped.fieldsCount).toBe(0)
  })

  it("defaults a field's options to [] when the API sends null", () => {
    const apiForm = makeApiForm()
    apiForm.fields![0].options = null as unknown as string[]
    const mapped = mapApiForm(apiForm)
    expect(mapped.fields?.[0]?.options).toEqual([])
  })

  it("computes fieldsCount from the mapped fields and preserves order", () => {
    const apiForm = makeApiForm()
    apiForm.fields = [
      { ...apiForm.fields![0], id: "f-a" },
      { ...apiForm.fields![0], id: "f-b", fieldType: "text", isRequired: false },
    ]
    const mapped = mapApiForm(apiForm)
    expect(mapped.fieldsCount).toBe(2)
    expect(mapped.fields?.map((f) => f.id)).toEqual(["f-a", "f-b"])
    expect(mapped.fields?.[1]?.required).toBe(false)
  })

  it("always nulls scopeLabel (resolved later by the caller)", () => {
    expect(mapApiForm(makeApiForm()).scopeLabel).toBeNull()
  })
})
