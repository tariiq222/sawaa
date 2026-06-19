"use client"

import { SawaaMark } from "@/components/brand/sawaa-mark"
import { useLocale } from "@/components/locale-provider"

interface AuthShellProps {
  children: React.ReactNode
}

/**
 * Shared visual shell for all three auth pages (login, forgot-password, reset-password).
 * Provides: full-screen layout, background decoratives, brand header, centred card.
 */
export function AuthShell({ children }: AuthShellProps) {
  const { t } = useLocale()

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      {/* Decorative background */}
      <div aria-hidden className="login-grid-pattern pointer-events-none absolute inset-x-0 top-0 h-[55vh]" />
      <div aria-hidden className="login-blob pointer-events-none absolute inset-x-0 top-0 h-[55vh]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-primary/[0.04] via-transparent to-accent/[0.03]" />

      {/* Card */}
      <div className="login-card relative z-10 w-full max-w-[440px] overflow-hidden rounded-2xl border border-border bg-card">
        {/* Brand header */}
        <div className="flex items-center gap-3 border-b border-border px-8 py-5">
          <SawaaMark size={36} />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-foreground">{t("brand.name")}</p>
            <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
          </div>
        </div>

        {/* Form content */}
        <div className="p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
