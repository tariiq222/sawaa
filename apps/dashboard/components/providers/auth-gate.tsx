"use client"

import type { ReactNode } from "react"
import { useAuth } from "./auth-provider"
import { LoginForm } from "@/components/features/login-form"
import { useLocale } from "@/components/locale-provider"

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
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

  if (!user) {
    return <LoginForm />
  }

  return <>{children}</>
}
