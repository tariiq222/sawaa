import type { BrandingConfig, DerivedTokens } from '../types/branding'

function hexToRgbParts(hex: string): string {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex
  // Expand 3-digit shorthand (#abc → #aabbcc) before parsing.
  const expanded =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid hex color: ${hex}`)
  }
  const r = parseInt(expanded.substring(0, 2), 16)
  const g = parseInt(expanded.substring(2, 4), 16)
  const b = parseInt(expanded.substring(4, 6), 16)
  return `${r} ${g} ${b}`
}

function derivedTokens(theme: BrandingConfig): DerivedTokens {
  const pr = hexToRgbParts(theme.colorPrimary).replace(/ /g, ',')
  const ac = hexToRgbParts(theme.colorAccent).replace(/ /g, ',')
  return {
    colorPrimaryGlow:  `rgba(${pr},0.35)`,
    colorPrimaryUltra: `rgba(${pr},0.08)`,
    colorAccentGlow:   `rgba(${ac},0.30)`,
    colorAccentUltra:  `rgba(${ac},0.10)`,
  }
}

export function generateCssVariables(theme: BrandingConfig): string {
  const d = derivedTokens(theme)
  return `:root {
  --primary:        ${theme.colorPrimary};
  --primary-light:  ${theme.colorPrimaryLight};
  --primary-dark:   ${theme.colorPrimaryDark};
  --primary-glow:   ${d.colorPrimaryGlow};
  --primary-ultra:  ${d.colorPrimaryUltra};
  --accent:         ${theme.colorAccent};
  --accent-dark:    ${theme.colorAccentDark};
  --accent-glow:    ${d.colorAccentGlow};
  --accent-ultra:   ${d.colorAccentUltra};
  --bg:             ${theme.colorBackground};
  --font-primary:   '${theme.fontFamily}', system-ui, sans-serif;
}`
}
