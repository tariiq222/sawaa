import { describe, expect, it } from "vitest"

import { formatUserRole } from "@/components/features/users/user-columns"

describe("user columns", () => {
  it("falls back to localized role labels when translations are missing", () => {
    const missingTranslation = (key: string) => key

    expect(formatUserRole("ACCOUNTANT", missingTranslation, "ar")).toBe("محاسب")
    expect(formatUserRole("ACCOUNTANT", missingTranslation, "en")).toBe("Accountant")
  })

  it("uses translated role labels when available", () => {
    const translate = (key: string) =>
      key === "users.role.ACCOUNTANT" ? "محاسب مترجم" : key

    expect(formatUserRole("ACCOUNTANT", translate, "ar")).toBe("محاسب مترجم")
  })
})
