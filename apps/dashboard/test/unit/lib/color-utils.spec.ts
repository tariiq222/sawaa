import { describe, expect, it } from "vitest"
import { deriveCssVars, buildStyleFromVars, isValidHex, hexToHsl, hslToHex, darkVariant } from "@/lib/color-utils"

describe("isValidHex", () => {
  it("accepts 6-digit hex with #", () => {
    expect(isValidHex("#1A2B3C")).toBe(true)
  })

  it("accepts lowercase hex", () => {
    expect(isValidHex("#aabbcc")).toBe(true)
  })

  it("rejects 3-digit shorthand", () => {
    expect(isValidHex("#abc")).toBe(false)
  })

  it("rejects hex without #", () => {
    expect(isValidHex("AABBCC")).toBe(false)
  })

  it("rejects invalid characters", () => {
    expect(isValidHex("#GGHHII")).toBe(false)
  })

  it("rejects empty string", () => {
    expect(isValidHex("")).toBe(false)
  })
})

describe("deriveCssVars", () => {
  const colors = { primary: "#1677FF", accent: "#FF6B35" }

  it("returns --primary equal to input primary hex", () => {
    const { light } = deriveCssVars(colors)
    expect(light["--primary"]).toBe("#1677FF")
  })

  it("returns --accent equal to input accent hex", () => {
    const { light } = deriveCssVars(colors)
    expect(light["--accent"]).toBe("#FF6B35")
  })

  it("returns --primary-foreground as a color string", () => {
    const { light } = deriveCssVars(colors)
    expect(typeof light["--primary-foreground"]).toBe("string")
    expect(light["--primary-foreground"].length).toBeGreaterThan(0)
  })

  it("returns --ring as an rgba string", () => {
    const { light } = deriveCssVars(colors)
    expect(light["--ring"]).toMatch(/^rgba\(/)
  })

  it("includes sidebar variables", () => {
    const { light } = deriveCssVars(colors)
    expect(light).toHaveProperty("--sidebar-primary")
    expect(light).toHaveProperty("--sidebar-primary-foreground")
    expect(light).toHaveProperty("--sidebar-ring")
  })

  it("returns white foreground for dark primary", () => {
    const { light } = deriveCssVars({ primary: "#000000", accent: "#FFFFFF" })
    expect(light["--primary-foreground"]).toBe("#FFFFFF")
  })

  it("returns dark foreground for light primary", () => {
    const { light } = deriveCssVars({ primary: "#FFFFFF", accent: "#000000" })
    expect(light["--primary-foreground"]).toBe("#1B2026")
  })

  it("returns light and dark maps", () => {
    const result = deriveCssVars(colors)
    expect(result).toHaveProperty("light")
    expect(result).toHaveProperty("dark")
  })

  it("light map has --primary equal to input", () => {
    const { light } = deriveCssVars({ primary: "#354FD8", accent: "#82CC17" })
    expect(light["--primary"]).toBe("#354FD8")
  })

  it("dark map has --primary lighter than input", () => {
    const { dark } = deriveCssVars({ primary: "#354FD8", accent: "#82CC17" })
    const { l } = hexToHsl(dark["--primary"] as string)
    expect(l).toBeGreaterThan(0.6)
  })

  it("dark primary and dark accent are distinct", () => {
    const { dark } = deriveCssVars({ primary: "#354FD8", accent: "#82CC17" })
    expect(dark["--primary"]).not.toBe(dark["--accent"])
  })

  it("dark map contains all required vars", () => {
    const { dark } = deriveCssVars({ primary: "#354FD8", accent: "#82CC17" })
    const required = [
      "--primary", "--primary-foreground", "--primary-light",
      "--primary-ultra-light", "--accent", "--accent-foreground",
      "--accent-ultra-light", "--ring", "--shadow-primary-color",
      "--shadow-primary-hover-color",
      "--sidebar-primary", "--sidebar-primary-foreground",
      "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-ring",
    ]
    for (const v of required) {
      expect(dark).toHaveProperty(v)
    }
  })
})

describe("hexToHsl", () => {
  it("converts pure red", () => {
    const result = hexToHsl("#FF0000")
    expect(result.h).toBeCloseTo(0, 0)
    expect(result.s).toBeCloseTo(1, 2)
    expect(result.l).toBeCloseTo(0.5, 2)
  })

  it("converts Deqah primary blue", () => {
    const result = hexToHsl("#354FD8")
    expect(result.h).toBeCloseTo(230, 0)
    expect(result.s).toBeGreaterThan(0.6)
    expect(result.l).toBeCloseTo(0.52, 1)
  })

  it("converts white", () => {
    const result = hexToHsl("#FFFFFF")
    expect(result.l).toBeCloseTo(1, 2)
  })

  it("converts black", () => {
    const result = hexToHsl("#000000")
    expect(result.l).toBeCloseTo(0, 2)
  })
})

describe("hslToHex", () => {
  it("roundtrips red", () => {
    const hex = hslToHex({ h: 0, s: 1, l: 0.5 })
    expect(hex.toLowerCase()).toBe("#ff0000")
  })

  it("roundtrips white", () => {
    expect(hslToHex({ h: 0, s: 0, l: 1 })).toBe("#ffffff")
  })

  it("roundtrips via hexToHsl", () => {
    const original = "#354FD8"
    const result = hslToHex(hexToHsl(original))
    // allow ±2 per channel due to rounding
    const toNum = (h: string) => parseInt(h.replace("#", ""), 16)
    expect(Math.abs(toNum(result) - toNum(original))).toBeLessThan(0x030303)
  })
})

describe("buildStyleFromVars", () => {
  it("converts CSS var map to style object", () => {
    const vars = { "--primary": "#1677FF", "--accent": "#FF6B35" }
    const style = buildStyleFromVars(vars)
    expect(style).toEqual({ "--primary": "#1677FF", "--accent": "#FF6B35" })
  })

  it("returns empty object for empty input", () => {
    expect(buildStyleFromVars({})).toEqual({})
  })
})

describe("darkVariant", () => {
  it("makes a dark primary from Deqah blue", () => {
    const result = darkVariant("#354FD8", 0.68)
    const { l } = hexToHsl(result)
    expect(l).toBeCloseTo(0.68, 1)
  })

  it("keeps same hue as original", () => {
    const original = "#354FD8"
    const result = darkVariant(original, 0.68)
    const origH = hexToHsl(original).h
    const resultH = hexToHsl(result).h
    expect(Math.abs(origH - resultH)).toBeLessThan(2)
  })

  it("reduces saturation for already-light colors instead of boosting lightness", () => {
    // #9ADB40 is lime green with l ~0.55 — already light
    const result = darkVariant("#9ADB40", 0.68)
    const { s: origS } = hexToHsl("#9ADB40")
    const { s: resultS } = hexToHsl(result)
    expect(resultS).toBeLessThan(origS)
  })

  it("primary and accent are distinct when same color used for both", () => {
    const primary = darkVariant("#354FD8", 0.68)
    const accent = darkVariant("#354FD8", 0.62)
    expect(primary).not.toBe(accent)
    const { l: lp } = hexToHsl(primary)
    const { l: la } = hexToHsl(accent)
    expect(Math.abs(lp - la)).toBeGreaterThan(0.04)
  })
})
