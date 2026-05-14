"use client"

import { Suspense, useState } from "react"
import type { FormEvent } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { performStaffPasswordReset } from "@/lib/api/auth"

export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordFormInner />
    </Suspense>
  )
}

function ResetPasswordFormInner() {
  const { t } = useLocale()
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams?.get("token") ?? ""

  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    if (newPassword.length < 8) {
      setError(t("resetPassword.weakPassword"))
      return
    }
    if (newPassword !== confirm) {
      setError(t("resetPassword.passwordMismatch"))
      return
    }
    setLoading(true)
    try {
      await performStaffPasswordReset(token, newPassword)
      setSuccess(true)
      setTimeout(() => router.push("/"), 2000)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("resetPassword.invalidToken"),
      )
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm text-destructive">
          {t("resetPassword.invalidToken")}
        </p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm space-y-3">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              className="text-success"
            >
              <path
                d="M20 6L9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {t("resetPassword.successTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("resetPassword.successBody")}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      {/* Heading */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          {t("resetPassword.title")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("resetPassword.subtitle")}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="new-password"
            className="text-sm font-medium text-foreground"
          >
            {t("resetPassword.newPasswordLabel")}
          </Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="h-11 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="confirm-password"
            className="text-sm font-medium text-foreground"
          >
            {t("resetPassword.confirmLabel")}
          </Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
            className="h-11 text-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full text-sm font-semibold"
        >
          {loading ? t("resetPassword.submitting") : t("resetPassword.submit")}
        </Button>
      </form>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {t("resetPassword.backToLogin")}
        </Link>
      </div>
    </div>
  )
}
