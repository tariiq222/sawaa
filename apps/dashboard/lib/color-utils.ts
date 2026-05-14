/**
 * color-utils.ts
 * Pure color manipulation utilities for organization branding.
 * No external dependencies — all math is self-contained.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrandingColors = {
  primary: string
  accent: string
  background?: string
  fontFamily?: string
  fontUrl?: string
}
export type CSSVarMap = Record<string, string>

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Accepts only #rrggbb (exactly 6 hex digits, case-insensitive). */
export function isValidHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

// ---------------------------------------------------------------------------
// Hex ↔ RGB helpers
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "")
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// ---------------------------------------------------------------------------
// hexToHsl / hslToHex
// ---------------------------------------------------------------------------

/** h in degrees 0–360, s and l as fractions 0–1. */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(hex)
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  const l = (max + min) / 2

  let s = 0
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1))
  }

  let h = 0
  if (delta !== 0) {
    if (max === rn) {
      h = 60 * (((gn - bn) / delta) % 6)
    } else if (max === gn) {
      h = 60 * ((bn - rn) / delta + 2)
    } else {
      h = 60 * ((rn - gn) / delta + 4)
    }
  }

  if (h < 0) h += 360

  return { h, s, l }
}

/** Returns lowercase #rrggbb. h in degrees 0–360, s/l as 0–1. */
export function hslToHex({ h, s, l }: { h: number; s: number; l: number }): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2

  let r = 0, g = 0, b = 0
  if (h < 60)       { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else              { r = c; g = 0; b = x }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255)
}

// ---------------------------------------------------------------------------
// darkVariant
// ---------------------------------------------------------------------------

/**
 * Returns a variant of `hex` suitable for dark mode.
 * - If the color is already light (l >= targetL), keeps the same hue and
 *   targetL lightness, but reduces saturation so it reads well on dark surfaces.
 * - Otherwise, sets lightness to targetL directly (boosts it for dark mode).
 */
export function darkVariant(hex: string, targetL: number): string {
  const { h, s, l } = hexToHsl(hex)

  if (l >= targetL) {
    // Already light — reduce saturation instead of further boosting lightness
    const newS = Math.max(0, s * 0.6)
    return hslToHex({ h, s: newS, l: targetL })
  }

  // Dark color — boost lightness to targetL for visibility on dark bg
  return hslToHex({ h, s, l: targetL })
}

// ---------------------------------------------------------------------------
// WCAG contrast
// ---------------------------------------------------------------------------

function linearize(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const R = linearize(r)
  const G = linearize(g)
  const B = linearize(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/** WCAG 2.1 contrast ratio. Returns a value like 4.5, 21, etc. */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Returns "#FFFFFF" for dark backgrounds, "#1B2026" for light backgrounds. */
export function pickForeground(bg: string): string {
  const white = "#FFFFFF"
  const dark = "#1B2026"
  const contrastWhite = contrastRatio(bg, white)
  const contrastDark = contrastRatio(bg, dark)
  return contrastWhite >= contrastDark ? white : dark
}

// ---------------------------------------------------------------------------
// CSS variable derivation
// ---------------------------------------------------------------------------

function tintHex(hex: string, targetL: number): string {
  const { h, s } = hexToHsl(hex)
  return hslToHex({ h, s: s * 0.3, l: targetL })
}

function buildVarMap(primary: string, accent: string): CSSVarMap {
  const { r, g, b } = hexToRgb(primary)
  const primaryFg = pickForeground(primary)
  const accentFg = pickForeground(accent)

  return {
    "--primary": primary,
    "--primary-foreground": primaryFg,
    "--primary-light": tintHex(primary, 0.85),
    "--primary-ultra-light": tintHex(primary, 0.95),
    "--accent": accent,
    "--accent-foreground": accentFg,
    "--accent-ultra-light": tintHex(accent, 0.95),
    "--ring": `rgba(${r}, ${g}, ${b}, 0.4)`,
    "--shadow-primary-color": `rgba(${r}, ${g}, ${b}, 0.25)`,
    "--shadow-primary-hover-color": `rgba(${r}, ${g}, ${b}, 0.4)`,
    "--sidebar-primary": primary,
    "--sidebar-primary-foreground": primaryFg,
    "--sidebar-accent": accent,
    "--sidebar-accent-foreground": accentFg,
    "--sidebar-ring": `rgba(${r}, ${g}, ${b}, 0.4)`,
  }
}

/**
 * Derives a full set of CSS custom properties for both light and dark mode
 * from the two brand colors.
 */
export function deriveCssVars(colors: BrandingColors): { light: CSSVarMap; dark: CSSVarMap } {
  const light = buildVarMap(colors.primary, colors.accent)

  const darkPrimary = darkVariant(colors.primary, 0.68)
  const darkAccent = darkVariant(colors.accent, 0.62)
  const dark = buildVarMap(darkPrimary, darkAccent)

  // In dark mode, lightened primary sits on a dark surface → dark fg
  dark["--primary-foreground"] = "#1B2026"
  dark["--sidebar-primary-foreground"] = "#1B2026"

  return { light, dark }
}

// ---------------------------------------------------------------------------
// Style object builder
// ---------------------------------------------------------------------------

/**
 * Converts a CSS var map into a React-compatible style object.
 * Currently an identity function — the keys are already CSS custom property names.
 */
export function buildStyleFromVars(vars: CSSVarMap): Record<string, string> {
  return { ...vars }
}
