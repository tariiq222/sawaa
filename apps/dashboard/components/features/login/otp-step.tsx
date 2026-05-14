"use client"

import { useEffect, useState } from "react"
import { Button, Input, Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { loginErrorMessage } from "@/lib/api/auth-errors"

const RESEND_COOLDOWN = 30

interface Props {
  identifier: string
  loading: boolean
  error: unknown
  otpSentAt: number | null
  onSubmit: (code: string) => void
  onResend: () => void
  onBack: () => void
}

export function OtpStep({ identifier, loading, error, otpSentAt, onSubmit, onResend, onBack }: Props) {
  const { t } = useLocale()
  const [code, setCode] = useState("")
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const elapsed = otpSentAt ? Math.floor((now - otpSentAt) / 1000) : RESEND_COOLDOWN
  const remaining = Math.max(0, RESEND_COOLDOWN - elapsed)
  const canResend = remaining === 0 && !loading

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return
    onSubmit(code)
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("login.otp.sentTo")}{" "}
        <span className="font-medium" dir="ltr">
          {identifier}
        </span>
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="otp-code">{t("login.otp.label")}</Label>
        <Input
          id="otp-code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="text-center text-2xl tracking-[0.5em] font-mono"
          disabled={loading}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive">{loginErrorMessage(error)}</p>
      ) : null}
      <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
        {loading ? t("login.signingIn") : t("login.signIn")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={!canResend}
        onClick={onResend}
      >
        {remaining > 0 ? `${t("login.otp.resendIn")} ${remaining}s` : t("login.otp.resend")}
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={loading}>
        {t("common.back")}
      </Button>
    </form>
  )
}
