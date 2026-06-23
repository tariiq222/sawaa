"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react"
import { DirectionProvider } from "@radix-ui/react-direction"
import { translations, type Locale } from "@/lib/translations"

interface LocaleContextValue {
  locale: Locale
  dir: "ltr" | "rtl"
  toggleLocale: () => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

const STORAGE_KEY = "sawaa-locale"

function applyLocaleToDOM(locale: Locale) {
  const dir = locale === "ar" ? "rtl" : "ltr"
  document.documentElement.lang = locale
  document.documentElement.dir = dir
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider")
  return ctx
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("ar")

  // Read persisted locale after mount (avoids SSR/client hydration mismatch)
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === "en" || saved === "ar") queueMicrotask(() => setLocale(saved))
  }, [])

  // Sync DOM on mount and whenever locale changes
  useEffect(() => {
    applyLocaleToDOM(locale)
    localStorage.setItem(STORAGE_KEY, locale)
  }, [locale])

  const toggleLocale = useCallback(() => {
    setLocale((prev) => (prev === "en" ? "ar" : "en"))
  }, [])

  const t = useCallback(
    (key: string) => {
      if (!key) return ""
      const direct = translations[locale][key]
      if (direct !== undefined) return direct
      // Bridge: if the key exists only in the other locale (parity-window
      // drift), show real text instead of a raw dotted key. Parity is gated
      // by i18n:verify, so in production this rarely fires.
      const bridged = translations.en[key] ?? translations.ar[key]
      if (bridged !== undefined) return bridged
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing translation key: "${key}" (locale=${locale})`)
      }
      // Preserve legacy behaviour: return the key so existing
      // `t(dynamicKey) || rawValue` fallbacks keep working.
      return key
    },
    [locale]
  )

  const dir = locale === "ar" ? "rtl" : "ltr"

  // Memoize so the ~every-component useLocale() consumer tree doesn't
  // re-render on unrelated parent renders (e.g. 30s poll ticks).
  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dir, toggleLocale, t }),
    [locale, dir, toggleLocale, t],
  )

  return (
    <LocaleContext.Provider value={value}>
      <DirectionProvider dir={dir}>{children}</DirectionProvider>
    </LocaleContext.Provider>
  )
}
