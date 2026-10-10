import { describe, expect, it } from "vitest"
import { buildSmsConfigInput } from "@/lib/sms-config-input"

describe("SMS credential replacement", () => {
  it("omits credentials for sender-only changes", () => {
    expect(buildSmsConfigInput("UNIFONIC", "NewSender", "", "", "")).toEqual({provider: "UNIFONIC", senderId: "NewSender"})
    expect(buildSmsConfigInput("TAQNYAT", "", "", "", "")).toEqual({provider: "TAQNYAT", senderId: ""})
  })
  it("rejects an incomplete replacement", () => {
    expect(() => buildSmsConfigInput("UNIFONIC", "", "app", "", "")).toThrow()
  })
  it("sends complete explicitly entered replacement credentials", () => {
    expect(buildSmsConfigInput("UNIFONIC", "Brand", " app ", " key ", "")).toEqual({provider:"UNIFONIC",senderId:"Brand",unifonic:{appSid:"app",apiKey:"key"}})
  })
})
