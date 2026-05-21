import { describe, expect, it } from "vitest"
import {
  cn,
  combineDateTimeToISO,
  formatName,
  getInitials,
  getAvatarGradientStyle,
  formatClinicDate,
  formatClinicTime,
  getWeekStartDay,
  parseClinicTimeInput,
} from "@/lib/utils"
import { halalasToSar, sarToHalalas, formatPrice } from "@/lib/money"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar")
  })

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible")
  })

  it("deduplicates conflicting Tailwind classes (last wins)", () => {
    const result = cn("p-4", "p-8")
    expect(result).toBe("p-8")
  })

  it("handles undefined and null values", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end")
  })
})

describe("formatName", () => {
  it("joins first and last name with a space", () => {
    expect(formatName("أحمد", "العتيبي")).toBe("أحمد العتيبي")
  })

  it("returns only firstName when lastName is null", () => {
    expect(formatName("سارة", null)).toBe("سارة")
  })

  it("returns only lastName when firstName is null", () => {
    expect(formatName(null, "القحطاني")).toBe("القحطاني")
  })

  it("returns fallback when both are null", () => {
    expect(formatName(null, null)).toBe("—")
  })

  it("returns fallback when both are empty strings", () => {
    expect(formatName("", "")).toBe("—")
  })

  it("preserves whitespace in name parts when joining", () => {
    const result = formatName("  أحمد  ", "  الشهري  ")
    expect(result).toContain("أحمد")
    expect(result).toContain("الشهري")
    expect(result).toMatch(/^ .+ .+ $/) // leading space, content, trailing space
  })

  it("uses custom fallback when both names are missing", () => {
    expect(formatName(null, null, "بدون اسم")).toBe("بدون اسم")
  })
})

describe("getInitials", () => {
  it("extracts first letter of each name and uppercases", () => {
    expect(getInitials("Ahmed", "Al-Otaibi")).toMatch(/^[A-Z]{2}$/)
  })

  it("returns first initial when lastName is null", () => {
    expect(getInitials("فاطمة", null)).toBe("ف")
  })

  it("returns last initial when firstName is null", () => {
    const result = getInitials(null, "Sally")
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result).toMatch(/^[sS]/)
  })

  it("returns ? when both are null", () => {
    expect(getInitials(null, null)).toBe("?")
  })

  it("returns ? when both are empty strings", () => {
    expect(getInitials("", "")).toBe("?")
  })

  it("trims whitespace before extracting initials", () => {
    const result = getInitials("  John  ", " Doe")
    expect(result).toBe("JD")
  })
})

describe("getAvatarGradientStyle", () => {
  it("returns a CSSProperties object with linear-gradient background", () => {
    const style = getAvatarGradientStyle("entity-1")
    expect(style).toHaveProperty("background")
    expect(String(style.background)).toMatch(/^linear-gradient\(135deg,/)
  })

  it("is deterministic — same id returns same gradient", () => {
    const a = getAvatarGradientStyle("same-id")
    const b = getAvatarGradientStyle("same-id")
    expect(a.background).toBe(b.background)
  })

  it("distributes across avatar pairs for different ids", () => {
    const styles = Array.from({ length: 8 }, (_, i) =>
      getAvatarGradientStyle(`id-${i}`),
    )
    const backgrounds = styles.map((s) => String(s.background))
    const unique = new Set(backgrounds)
    expect(unique.size).toBeGreaterThan(1)
  })
})

describe("formatClinicDate", () => {
  it("formats Y-m-d (default) correctly", () => {
    expect(formatClinicDate("2026-04-15")).toBe("2026-04-15")
  })

  it("formats d/m/Y correctly", () => {
    expect(formatClinicDate("2026-04-15", "d/m/Y")).toBe("15/04/2026")
  })

  it("formats m/d/Y correctly", () => {
    expect(formatClinicDate("2026-04-15", "m/d/Y")).toBe("04/15/2026")
  })

  it("formats DD/MM/YYYY the same as d/m/Y", () => {
    expect(formatClinicDate("2026-04-15", "DD/MM/YYYY")).toBe("15/04/2026")
  })

  it("accepts Date object", () => {
    const d = new Date("2026-05-20T12:00:00Z")
    expect(formatClinicDate(d)).toBe("2026-05-20")
  })

  it("returns empty string for invalid date", () => {
    expect(formatClinicDate("not-a-date")).toBe("")
  })

  it("handles ISO strings with time component", () => {
    expect(formatClinicDate("2026-07-01T09:30:00.000Z", "Y-m-d")).toBe("2026-07-01")
  })
})

describe("formatClinicTime", () => {
  it("formats 24h time correctly (default)", () => {
    expect(formatClinicTime("14:30")).toBe("14:30")
  })

  it("formats 24h time with seconds", () => {
    expect(formatClinicTime("14:30:00")).toBe("14:30")
  })

  it("formats 12h time with Arabic period", () => {
    const result = formatClinicTime("14:30", "12h")
    expect(result).toMatch(/2:30/)
    expect(result).toMatch(/م/) // Arabic م for PM
  })

  it("formats 12h midnight correctly", () => {
    const result = formatClinicTime("00:00", "12h")
    expect(result).toMatch(/12:00/)
    expect(result).toMatch(/ص/) // Arabic ص for AM
  })

  it("formats 12h noon correctly", () => {
    const result = formatClinicTime("12:00", "12h")
    expect(result).toMatch(/12:00/)
    expect(result).toMatch(/م/)
  })

  it("returns empty string for empty input", () => {
    expect(formatClinicTime("")).toBe("")
  })

  it("returns original string for unparseable input", () => {
    expect(formatClinicTime("invalid")).toBe("invalid")
  })
})

describe("getWeekStartDay", () => {
  it("returns 0 for sunday", () => {
    expect(getWeekStartDay("sunday")).toBe(0)
  })

  it("returns 1 for monday", () => {
    expect(getWeekStartDay("monday")).toBe(1)
  })

  it("defaults to 0 when no argument given", () => {
    expect(getWeekStartDay()).toBe(0)
  })
})

describe("halalasToSar", () => {
  it("converts halalas to SAR", () => {
    expect(halalasToSar(10000)).toBe(100)
  })

  it("returns 0 for null/undefined", () => {
    expect(halalasToSar(null)).toBe(0)
    expect(halalasToSar(undefined)).toBe(0)
  })
})

describe("sarToHalalas", () => {
  it("converts SAR to halalas", () => {
    expect(sarToHalalas(100)).toBe(10000)
  })

  it("rounds to nearest halala", () => {
    expect(sarToHalalas(10.505)).toBe(1051)
  })
})

describe("formatPrice", () => {
  it("returns dash for null", () => {
    expect(formatPrice(null)).toBe("—")
  })

  it("returns dash for undefined", () => {
    expect(formatPrice(undefined)).toBe("—")
  })

  it("converts halalas to SAR numeric value", () => {
    expect(halalasToSar(10000)).toBe(100)
  })
})

describe("parseClinicTimeInput", () => {
  it("returns null for empty input", () => {
    expect(parseClinicTimeInput("", "24h")).toBeNull()
  })

  it("returns null for whitespace-only input", () => {
    expect(parseClinicTimeInput("   ", "24h")).toBeNull()
  })

  it("returns canonical HH:mm for already-canonical 24h input", () => {
    expect(parseClinicTimeInput("09:30", "24h")).toBe("09:30")
  })

  it("pads single-digit hours in 24h input", () => {
    expect(parseClinicTimeInput("9:30", "24h")).toBe("09:30")
  })

  it("accepts the upper edge 23:59 in 24h format", () => {
    expect(parseClinicTimeInput("23:59", "24h")).toBe("23:59")
  })

  it("rejects 24:00 in 24h format", () => {
    expect(parseClinicTimeInput("24:00", "24h")).toBeNull()
  })

  it("parses 12h AM correctly", () => {
    expect(parseClinicTimeInput("9:30 AM", "12h")).toBe("09:30")
  })

  it("parses 12h PM correctly", () => {
    expect(parseClinicTimeInput("9:30 PM", "12h")).toBe("21:30")
  })

  it("parses 12:00 AM as midnight (00:00)", () => {
    expect(parseClinicTimeInput("12:00 AM", "12h")).toBe("00:00")
  })

  it("parses 12:00 PM as noon (12:00)", () => {
    expect(parseClinicTimeInput("12:00 PM", "12h")).toBe("12:00")
  })

  it("parses Arabic ص suffix as AM", () => {
    expect(parseClinicTimeInput("9:30 ص", "12h")).toBe("09:30")
  })

  it("parses Arabic م suffix as PM", () => {
    expect(parseClinicTimeInput("9:30 م", "12h")).toBe("21:30")
  })

  it("is case-insensitive for AM/PM suffix", () => {
    expect(parseClinicTimeInput("9:30 am", "12h")).toBe("09:30")
    expect(parseClinicTimeInput("9:30 pm", "12h")).toBe("21:30")
  })

  it("rejects suffix in 24h format", () => {
    expect(parseClinicTimeInput("9:30 AM", "24h")).toBeNull()
  })

  it("rejects hour out of 1-12 when suffix is provided", () => {
    expect(parseClinicTimeInput("13:00 PM", "12h")).toBeNull()
  })

  it("rejects 0:30 with suffix (hour must be 1-12)", () => {
    expect(parseClinicTimeInput("0:30 AM", "12h")).toBeNull()
  })

  it("returns null for non-numeric input", () => {
    expect(parseClinicTimeInput("abc", "24h")).toBeNull()
  })

  it("returns null when minutes are invalid (>59)", () => {
    expect(parseClinicTimeInput("9:60", "24h")).toBeNull()
  })

  it("returns null when minutes are missing", () => {
    expect(parseClinicTimeInput("9", "24h")).toBeNull()
  })

  it("returns null when minute portion is not two digits", () => {
    expect(parseClinicTimeInput("9:5", "24h")).toBeNull()
  })

  it("trims surrounding whitespace before parsing", () => {
    expect(parseClinicTimeInput("  09:30  ", "24h")).toBe("09:30")
  })
})

describe("combineDateTimeToISO", () => {
  it("converts a Riyadh wall-clock pair to its UTC instant", () => {
    // 14:30 Riyadh (UTC+3) = 11:30 UTC
    expect(combineDateTimeToISO("2026-05-21", "14:30")).toBe(
      "2026-05-21T11:30:00.000Z",
    )
  })

  it("accepts HH:mm:ss and zero-pads single-digit hours", () => {
    // 09:05:45 Riyadh = 06:05:45 UTC
    expect(combineDateTimeToISO("2026-05-21", "9:05:45")).toBe(
      "2026-05-21T06:05:45.000Z",
    )
  })

  it("returns null on malformed inputs", () => {
    expect(combineDateTimeToISO("", "10:00")).toBeNull()
    expect(combineDateTimeToISO("2026-05-21", "")).toBeNull()
    expect(combineDateTimeToISO("not-a-date", "10:00")).toBeNull()
    expect(combineDateTimeToISO("2026-05-21", "10")).toBeNull()
  })

  it("represents the same UTC instant regardless of host timezone", () => {
    // 12:00 Riyadh = 09:00 UTC. Asia/Riyadh has no DST, so this is invariant
    // across any host timezone or season.
    const iso = combineDateTimeToISO("2026-05-21", "12:00")!
    expect(new Date(iso).toISOString()).toBe("2026-05-21T09:00:00.000Z")
  })
})
