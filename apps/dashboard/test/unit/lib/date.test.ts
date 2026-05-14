import { describe, expect, it } from "vitest"
import {
  formatDatePattern,
  formatDateTimeLocalValue,
  formatLocaleDate,
  formatRelativeTime,
  resolveDateLocale,
} from "@/lib/date"

describe("date helpers", () => {
  describe("resolveDateLocale", () => {
    it("maps short locale codes to BCP-47 tags", () => {
      expect(resolveDateLocale("ar")).toBe("ar-SA")
      expect(resolveDateLocale("en")).toBe("en-US")
    })

    it("falls back to en-US for unknown locales", () => {
      expect(resolveDateLocale("fr")).toBe("en-US")
    })
  })

  describe("formatLocaleDate", () => {
    const iso = "2026-04-26T10:00:00.000Z"

    it("returns em-dash for null/undefined", () => {
      expect(formatLocaleDate(null, "ar")).toBe("—")
      expect(formatLocaleDate(undefined, "en")).toBe("—")
    })

    it("returns em-dash for invalid date strings", () => {
      expect(formatLocaleDate("not-a-date", "en")).toBe("—")
    })

    it("formats Date / ISO / number inputs", () => {
      const d = new Date(iso)
      const fromDate = formatLocaleDate(d, "en")
      const fromIso = formatLocaleDate(iso, "en")
      const fromMs = formatLocaleDate(d.getTime(), "en")
      expect(fromDate).toBe(fromIso)
      expect(fromIso).toBe(fromMs)
      expect(fromDate.length).toBeGreaterThan(0)
    })

    it("respects Intl.DateTimeFormatOptions", () => {
      const out = formatLocaleDate(iso, "en", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
      expect(out).toMatch(/2026/)
    })
  })

  describe("formatDatePattern", () => {
    it("returns em-dash for invalid inputs instead of throwing", () => {
      expect(formatDatePattern(undefined, "MMM d, yyyy")).toBe("—")
      expect(formatDatePattern("not-a-date", "MMM d, yyyy")).toBe("—")
    })

    it("formats valid values with a date-fns pattern", () => {
      expect(formatDatePattern("2026-04-26T10:00:00.000Z", "yyyy")).toBe("2026")
    })
  })

  describe("formatRelativeTime", () => {
    it("returns em-dash for invalid inputs instead of throwing", () => {
      expect(formatRelativeTime("not-a-date")).toBe("—")
    })
  })

  describe("formatDateTimeLocalValue", () => {
    it("returns an empty string for invalid inputs instead of throwing", () => {
      expect(formatDateTimeLocalValue("not-a-date")).toBe("")
    })

    it("formats valid values for datetime-local inputs", () => {
      expect(formatDateTimeLocalValue("2026-04-26T10:30:00.000Z")).toBe("2026-04-26T10:30")
    })
  })
})
