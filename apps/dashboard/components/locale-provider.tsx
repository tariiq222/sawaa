"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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
    (key: string) => translations[locale][key] ?? key,
    [locale]
  )

  const dir = locale === "ar" ? "rtl" : "ltr"

  return (
    <LocaleContext.Provider value={{ locale, dir, toggleLocale, t }}>
      <DirectionProvider dir={dir}>{children}</DirectionProvider>
    </LocaleContext.Provider>
  )
}
