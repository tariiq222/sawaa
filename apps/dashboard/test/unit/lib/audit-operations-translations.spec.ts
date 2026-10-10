import { describe, it, expect } from "vitest"
import { arAuditOperations } from "@/lib/translations/ar.audit-operations"
import { enAuditOperations } from "@/lib/translations/en.audit-operations"
describe("operations translations", () => {
  it("covers both locales and all handoff categories with visible text", () => {
    expect(Object.keys(arAuditOperations).sort()).toEqual(Object.keys(enAuditOperations).sort())
    for (const dictionary of [arAuditOperations, enAuditOperations]) {
      for (const [key,value] of Object.entries(dictionary)) {expect(value.trim()).not.toBe("");expect(value).not.toBe(key)}
      for (const category of ["USER_REQUESTED","COMPLAINT","FINANCIAL_EXCEPTION","UNAVAILABLE_APPOINTMENT","OTHER"]) {
        expect(dictionary[`conversations.detail.handoffCategory.${category}`]).toBeTruthy()
      }
    }
  })
})
