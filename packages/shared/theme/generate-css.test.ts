import { describe, it, expect } from 'vitest'
import { generateCssVariables } from './generate-css'
import { DEFAULT_BRANDING } from '../types/branding'

describe('generateCssVariables', () => {
  it('returns a CSS string starting with ":root {"', () => {
    const css = generateCssVariables(DEFAULT_BRANDING)
    expect(css.startsWith(':root {')).toBe(true)
    expect(css.trimEnd().endsWith('}')).toBe(true)
  })

  it('includes every expected CSS variable', () => {
    const css = generateCssVariables(DEFAULT_BRANDING)
    for (const v of [
      '--primary',
      '--primary-light',
      '--primary-dark',
      '--primary-glow',
      '--primary-ultra',
      '--accent',
      '--accent-dark',
      '--accent-glow',
      '--accent-ultra',
      '--bg',
      '--font-primary',
    ]) {
      expect(css).toContain(v)
    }
  })

  it('inlines the exact primary/accent/background hex values from the theme', () => {
    const theme = {
      ...DEFAULT_BRANDING,
      colorPrimary: '#55CCB0',
      colorPrimaryLight: '#7CD8C2',
      colorPrimaryDark: '#0E4B43',
      colorAccent: '#E7DBC4',
      colorAccentDark: '#CAAF7B',
      colorBackground: '#EAF8F4',
    }
    const css = generateCssVariables(theme)
    expect(css).toContain('--primary:        #55CCB0')
    expect(css).toContain('--primary-light:  #7CD8C2')
    expect(css).toContain('--primary-dark:   #0E4B43')
    expect(css).toContain('--accent:         #E7DBC4')
    expect(css).toContain('--accent-dark:    #CAAF7B')
    expect(css).toContain('--bg:             #EAF8F4')
  })

  it('derives rgba(...) parts from a 6-digit hex: --primary-glow and --primary-ultra', () => {
    const theme = {
      ...DEFAULT_BRANDING,
      colorPrimary: '#55CCB0',
      colorAccent: '#E7DBC4',
    }
    const css = generateCssVariables(theme)
    // #55CCB0 → r=85, g=204, b=176
    expect(css).toContain('--primary-glow:   rgba(85,204,176,0.35)')
    expect(css).toContain('--primary-ultra:  rgba(85,204,176,0.08)')
  })

  it('derives rgba(...) parts from a 6-digit hex: --accent-glow and --accent-ultra', () => {
    const theme = {
      ...DEFAULT_BRANDING,
      colorPrimary: '#55CCB0',
      colorAccent: '#E7DBC4',
    }
    const css = generateCssVariables(theme)
    // #E7DBC4 → r=231, g=219, b=196
    expect(css).toContain('--accent-glow:    rgba(231,219,196,0.30)')
    expect(css).toContain('--accent-ultra:   rgba(231,219,196,0.10)')
  })

  it('emits a font-family declaration with quotes and the system-ui fallback', () => {
    const css = generateCssVariables(DEFAULT_BRANDING)
    expect(css).toMatch(/--font-primary:\s+'Handicrafts',\s*system-ui,\s*sans-serif/)
  })

  it('uses the supplied fontFamily verbatim in the font variable', () => {
    const theme = { ...DEFAULT_BRANDING, fontFamily: 'Cairo' }
    const css = generateCssVariables(theme)
    expect(css).toContain("--font-primary:   'Cairo', system-ui, sans-serif")
  })

  it('derives rgba parts from a 3-digit hex (documenting actual behavior)', () => {
    // NOTE: hexToRgbParts uses substring(0,2)/(2,4)/(4,6) on a 6-char window.
    // For "#FFF" (length 3): r = parseInt('FF',16) = 255,
    //                       g = parseInt('F',16)  = 15  (substring(2,4) is 'F'),
    //                       b = parseInt('',16)   = NaN (substring(4,6) is '').
    // This documents the current behavior — see report.
    const theme = { ...DEFAULT_BRANDING, colorPrimary: '#FFF', colorAccent: '#FFF' }
    const css = generateCssVariables(theme)
    expect(css).toContain('--primary-glow:   rgba(255,15,NaN,0.35)')
    expect(css).toContain('--accent-glow:    rgba(255,15,NaN,0.30)')
  })

  it('derives NaN parts from a fully-invalid hex (documenting actual behavior)', () => {
    // NOTE: parseInt('XY',16) === NaN, so all three channels become NaN.
    const theme = { ...DEFAULT_BRANDING, colorPrimary: '#XYZ', colorAccent: '#XYZ' }
    const css = generateCssVariables(theme)
    expect(css).toContain('--primary-glow:   rgba(NaN,NaN,NaN,0.35)')
    expect(css).toContain('--accent-glow:    rgba(NaN,NaN,NaN,0.30)')
  })

  it('strips a leading "#" before parsing', () => {
    const theme = { ...DEFAULT_BRANDING, colorPrimary: '#000000', colorAccent: '#FFFFFF' }
    const css = generateCssVariables(theme)
    expect(css).toContain('--primary-glow:   rgba(0,0,0,0.35)')
    expect(css).toContain('--accent-glow:    rgba(255,255,255,0.30)')
  })

  it('handles mid-range hex values correctly', () => {
    const theme = { ...DEFAULT_BRANDING, colorPrimary: '#123ABC', colorAccent: '#ABCDEF' }
    const css = generateCssVariables(theme)
    // #123ABC → r=18, g=58, b=188; #ABCDEF → r=171, g=205, b=239
    expect(css).toContain('--primary-glow:   rgba(18,58,188,0.35)')
    expect(css).toContain('--accent-glow:    rgba(171,205,239,0.30)')
  })
})