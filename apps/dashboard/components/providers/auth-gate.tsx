"use client"

import type { ReactNode } from "react"
import { useAuth } from "./auth-provider"
import { LoginForm } from "@/components/features/login-form"
import { useLocale } from "@/components/locale-provider"
import { Button } from "@sawaa/ui"

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, restoreError, retryRestore } = useAuth()
  const { t } = useLocale()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>{t("authGate.loading")}</p>
        </div>
      </div>
    )
  }

  if (restoreError) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-6">
        <div role="alert" className="flex max-w-sm flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">{t("authGate.restoreError")}</p>
          <Button type="button" onClick={retryRestore}>
            {t("authGate.retry")}
          </Button>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return <>{children}</>
}
