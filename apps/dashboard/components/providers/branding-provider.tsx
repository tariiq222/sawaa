"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react"
import { useQuery } from "@tanstack/react-query"
import {
  deriveCssVars,
  isValidHex,
  type BrandingColors,
  type CSSVarMap,
} from "@/lib/color-utils"
import { fetchPublicBranding } from "@/lib/api/branding"
import type { PublicBranding } from "@/lib/types/branding"

/* ─── Context ─── */

interface BrandingContextValue {
  /** Current branding colors (null = using defaults from globals.css) */
  colors: BrandingColors | null
  /** Preview colors temporarily without saving */
  preview: (colors: BrandingColors) => void
  /** Clear preview — revert to saved colors */
  clearPreview: () => void
  /** Apply saved branding (after API save) */
  apply: (colors: BrandingColors) => void
}

const BrandingContext = createContext<BrandingContextValue>({
  colors: null,
  preview: () => {},
  clearPreview: () => {},
  apply: () => {},
})

export const useBranding = () => useContext(BrandingContext)

/* ─── CSS var injection ─── */

const DARK_STYLE_ID = "deqah-dark-theme"
const FONT_STYLE_ID = "deqah-font"

function injectLightVars(vars: CSSVarMap) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

function injectDarkVars(vars: CSSVarMap) {
  const css = `.dark {\n${Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n")}\n}`

  let el = document.getElementById(DARK_STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement("style")
    el.id = DARK_STYLE_ID
    document.head.appendChild(el)
  }
  el.textContent = css
}

function injectFont(fontFamily: string | null | undefined, fontUrl: string | null | undefined) {
  const root = document.documentElement
  if (fontFamily) {
    root.style.setProperty("--font-family", fontFamily)
  }
  if (!fontUrl) return
  let el = document.getElementById(FONT_STYLE_ID) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement("link")
    el.id = FONT_STYLE_ID
    el.rel = "stylesheet"
    document.head.appendChild(el)
  }
  el.href = fontUrl
}

function injectBackground(colorBackground: string | null | undefined) {
  if (!colorBackground) return
  document.documentElement.style.setProperty("--background", colorBackground)
}

function _clearAllVars(lightVars: CSSVarMap) {
  const root = document.documentElement
  for (const key of Object.keys(lightVars)) {
    root.style.removeProperty(key)
  }
  document.getElementById(DARK_STYLE_ID)?.remove()
}

/* ─── Apply all branding including extras ─── */

function applyBranding(colors: BrandingColors) {
  const { light, dark } = deriveCssVars(colors)
  injectLightVars(light)
  injectDarkVars(dark)
  injectBackground(colors.background)
  injectFont(colors.fontFamily, colors.fontUrl)
}

/* ─── Map PublicBranding → BrandingColors ─── */

function mapPublicBranding(data: PublicBranding | undefined): BrandingColors | null {
  if (!data) return null
  const primary = data.colorPrimary
  if (!primary || !isValidHex(primary)) return null
  const accent = data.colorAccent
  return {
    primary,
    accent: accent && isValidHex(accent) ? accent : primary,
    background: data.colorBackground ?? undefined,
    fontFamily: data.fontFamily ?? undefined,
    fontUrl: data.fontUrl ?? undefined,
  }
}

/* ─── Provider ─── */

interface Props {
  children: ReactNode
}

export const BRANDING_PUBLIC_QUERY_KEY = ["branding", "public"] as const

export function BrandingProvider({ children }: Props) {
  const { data } = useQuery({
    queryKey: BRANDING_PUBLIC_QUERY_KEY,
    queryFn: fetchPublicBranding,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })

  const savedColors = useMemo(() => mapPublicBranding(data), [data])
  const [previewColors, setPreviewColors] = useState<BrandingColors | null>(null)

  /* Apply active colors (preview takes priority) */
  const activeColors = previewColors ?? savedColors

  useEffect(() => {
    if (!activeColors) return
    applyBranding(activeColors)
  }, [activeColors])

  const preview = useCallback((colors: BrandingColors) => {
    if (isValidHex(colors.primary)) {
      setPreviewColors(colors)
      applyBranding(colors)
    }
  }, [])

  const clearPreview = useCallback(() => {
    setPreviewColors(null)
  }, [])

  const apply = useCallback((colors: BrandingColors) => {
    setPreviewColors(null)
    applyBranding(colors)
  }, [])

  return (
    <BrandingContext.Provider
      value={{ colors: activeColors, preview, clearPreview, apply }}
    >
      {children}
    </BrandingContext.Provider>
  )
}
