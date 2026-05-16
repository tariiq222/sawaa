"use client"

import { useEffect, useState, startTransition } from "react"
import Image from "next/image"
import { SawaaMark } from "@/components/brand/sawaa-mark"
import { useLoginFlow } from "@/components/features/login/use-login-flow"
import { IdentifierStep } from "@/components/features/login/identifier-step"
import { MethodStep } from "@/components/features/login/method-step"
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

  const getTitle = () => {
    switch (flow.step) {
      case "identifier": return t("login.welcome")
      case "method": return t("login.chooseMethod")
      case "password": return t("login.welcome")
      case "otp": return t("login.otp.title")
      default: return t("login.welcome")
    }
  }

  return (
    <div className="flex min-h-screen w-full">
      {/* FORM column */}
      <div className="relative flex w-full flex-col overflow-hidden bg-background lg:w-7/12">
        <div aria-hidden className="login-grid-pattern pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-70 lg:opacity-40" />
        <div aria-hidden className="login-blob pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-90 lg:opacity-50" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-bl from-primary/[0.04] via-transparent to-accent/[0.03]" />

        <div className="relative z-10 flex items-center gap-3 px-6 pt-8 lg:px-12">
          <SawaaMark size={40} />
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-foreground">{t("brand.name")}</p>
            <p className="text-[11px] text-muted-foreground">{t("app.tagline")}</p>
          </div>
        </div>

        <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12 lg:px-12">
          <div className="w-full max-w-[400px]">
            <h1 className="mb-1.5 text-[28px] font-semibold tracking-tight text-foreground">
              {getTitle()}
            </h1>
            <p className="mb-6 text-sm text-muted-foreground">
              {t("login.subtitle")}
            </p>

            {notice && (
              <div className="mb-4 rounded-lg bg-warning/10 px-4 py-3 text-sm text-warning">
                {notice}
              </div>
            )}

            {flow.step === "identifier" && (
              <IdentifierStep
                loading={flow.loading}
                error={flow.error}
                onSubmit={flow.submitIdentifier}
                onClearError={flow.clearError}
              />
            )}

            {flow.step === "method" && (
              <MethodStep
                identifier={flow.identifier}
                hasPassword={flow.lookupResult?.hasPassword ?? false}
                loading={flow.loading}
                onSelectMethod={flow.selectMethod}
                onBack={flow.backToIdentifier}
              />
            )}

            {flow.step === "password" && (
              <CombinedStep
                loading={flow.loading}
                error={flow.error}
                onSubmit={flow.submitPassword}
                onBack={flow.backToMethod}
                onClearError={flow.clearError}
              />
            )}

            {flow.step === "otp" && (
              <OtpStep
                identifier={flow.identifier}
                loading={flow.loading}
                error={flow.error}
                otpSentAt={flow.otpSentAt}
                onSubmit={flow.submitOtp}
                onResend={flow.resendOtp}
                onBack={flow.backToMethod}
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
