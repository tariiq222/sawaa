import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

import { translations } from "@/lib/translations"

describe("WhatsApp dashboard surface cleanup", () => {
  it("does not assemble retired WhatsApp copy while retaining Sawaa Ai settings", () => {
    for (const locale of ["ar", "en"] as const) {
      expect(Object.keys(translations[locale]).some((key) => key.startsWith("whatsapp."))).toBe(false)
      expect(translations[locale]["sawaaAi.menuLabel"]).toBeDefined()
    }
  })

  it("does not mount a retired WhatsApp dashboard route", () => {
    expect(
      existsSync(resolve(process.cwd(), "app/(dashboard)/whatsapp/page.tsx")),
    ).toBe(false)
  })
})
