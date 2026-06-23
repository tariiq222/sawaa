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

  it('expands 3-digit shorthand hex into full RGB parts', () => {
    // #FFF / #fff → #FFFFFF → r=255, g=255, b=255
    const theme = { ...DEFAULT_BRANDING, colorPrimary: '#FFF', colorAccent: '#fff' }
    const css = generateCssVariables(theme)
    expect(css).toContain('--primary-glow:   rgba(255,255,255,0.35)')
    expect(css).toContain('--accent-glow:    rgba(255,255,255,0.30)')
    expect(css).toContain('--primary-ultra:  rgba(255,255,255,0.08)')
  })

  it('expands mixed-case 3-digit shorthand (#aBc → #AABBCC)', () => {
    const theme = { ...DEFAULT_BRANDING, colorPrimary: '#aBc', colorAccent: '#aBc' }
    const css = generateCssVariables(theme)
    // 0xAA = 170, 0xBB = 187, 0xCC = 204
    expect(css).toContain('--primary-glow:   rgba(170,187,204,0.35)')
    expect(css).toContain('--accent-glow:    rgba(170,187,204,0.30)')
  })

  it('throws on a fully-invalid hex instead of emitting NaN parts', () => {
    // parseInt('XY', 16) === NaN — the previous implementation leaked NaN into
    // the generated CSS. Now we fail loudly so the bad config surfaces.
    const theme = { ...DEFAULT_BRANDING, colorPrimary: '#XYZ', colorAccent: '#XYZ' }
    expect(() => generateCssVariables(theme)).toThrow(/Invalid hex color/)
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