"use client"

import { useEffect, useState, startTransition } from "react"
import Image from "next/image"
import { SawaaMark } from "@/components/brand/sawaa-mark"
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
    <div className="flex min-h-screen w-full">
      {/* FORM column */}
      <div className="relative flex w-full flex-col overflow-hidden bg-background lg:w-7/12">
        {/* Decorative layers — strong below lg (no hero visible), subtle on lg+ */}
        <div
          aria-hidden
          className="login-grid-pattern pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-70 lg:opacity-40"
        />
        <div
          aria-hidden
          className="login-blob pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-90 lg:opacity-50"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-primary/[0.04] via-transparent to-accent/[0.03]"
        />

        {/* Brand lockup */}
        <div className="relative z-10 flex items-center gap-3 px-6 pt-8 lg:px-12">
          <SawaaMark size={40} />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {t("brand.name")}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {t("app.tagline")}
            </p>
          </div>
        </div>

        {/* Centered form */}
        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12 lg:px-12">
          <div className="w-full max-w-[400px]">
            <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {t("login.subtitle")}
            </p>

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

      {/* HERO image column (lg+) */}
      <div className="relative hidden lg:block lg:w-5/12">
        <Image
          src="/login-hero.png"
          alt=""
          fill
          priority
          sizes="42vw"
          className="object-cover"
        />
      </div>
    </div>
  )
}
