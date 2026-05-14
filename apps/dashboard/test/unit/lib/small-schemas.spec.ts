import { describe, expect, it } from "vitest"
import { createKbEntrySchema } from "@/lib/schemas/chatbot.schema"

describe("createKbEntrySchema", () => {
  it("accepts a valid KB entry", () => {
    const result = createKbEntrySchema.safeParse({ title: "FAQ", content: "Answer here" })
    expect(result.success).toBe(true)
  })

  it("rejects empty title", () => {
    const result = createKbEntrySchema.safeParse({ title: "", content: "Answer here" })
    expect(result.success).toBe(false)
  })

  it("rejects empty content", () => {
    const result = createKbEntrySchema.safeParse({ title: "FAQ", content: "" })
    expect(result.success).toBe(false)
  })

  it("accepts optional category", () => {
    const result = createKbEntrySchema.safeParse({ title: "FAQ", content: "Answer", category: "General" })
    expect(result.success).toBe(true)
  })
})

