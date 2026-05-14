"use client"

import { useEffect, useState, startTransition } from "react"
import { useLoginFlow } from "@/components/features/login/use-login-flow"
import { CombinedStep } from "@/components/features/login/combined-step"
import { OtpStep } from "@/components/features/login/otp-step"
import { useLocale } from "@/components/locale-provider"

export function LoginForm() {
  const { t } = useLocale()
  const flow = useLoginFlow()
  const [notice, setNotice] = useState("")

  useEffect(() => {
    const reason = sessionStorage.getItem("sawaa_auth_reason")
    if (reason === "ORG_SUSPENDED") {
      startTransition(() => setNotice(t("login.orgSuspended")))
      sessionStorage.removeItem("sawaa_auth_reason")
    }
  }, [t])

  const title = flow.mode === "otp" ? t("login.otp.title") : t("login.welcome")

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      <div className="login-card relative z-10 w-full max-w-[400px] overflow-hidden rounded-2xl border border-border bg-card">
        <div aria-hidden className="login-grid-pattern pointer-events-none absolute inset-x-0 top-0 h-72" />
        <div aria-hidden className="login-blob pointer-events-none absolute inset-x-0 top-0 h-72" />
        <div className="relative p-8">
          <h1 className="mb-1 text-center text-2xl font-semibold">{title}</h1>
          <p className="mb-6 text-center text-sm text-muted-foreground">{t("login.subtitle")}</p>

          {notice && (
            <div className="mb-4 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
              {notice}
            </div>
          )}

          {flow.mode === "login" && (
            <CombinedStep
              loading={flow.loading}
              error={flow.error}
              onSubmit={flow.submitLogin}
              onSwitchToOtp={flow.switchToOtp}
              onClearError={flow.clearError}
            />
          )}
          {flow.mode === "otp" && (
            <OtpStep
              identifier={flow.identifier}
              loading={flow.loading}
              error={flow.error}
              otpSentAt={flow.otpSentAt}
              onSubmit={flow.submitOtp}
              onResend={flow.resendOtp}
              onBack={flow.backToLogin}
            />
          )}
        </div>
      </div>
    </div>
  )
}
