"use client"

import { Suspense, useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { z } from "zod"
import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"
import { performStaffPasswordReset } from "@/lib/api/auth"

const strongPasswordSchema = z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/)

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
  const [token] = useState(() => searchParams?.get("token") ?? "")

  const [newPassword, setNewPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !searchParams?.has("token")) return

    const url = new URL(window.location.href)
    url.searchParams.delete("token")
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`
    )
  }, [searchParams, token])

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    const parsed = strongPasswordSchema.safeParse(newPassword)
    if (!parsed.success) {
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
        err instanceof Error ? err.message : t("resetPassword.invalidToken")
      )
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="mb-4 text-sm text-error">
          {t("resetPassword.invalidToken")}
        </p>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("resetPassword.backToLogin")}
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="space-y-3 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10">
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              size={24}
              className="text-success"
              aria-hidden
            />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("resetPassword.successTitle")}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("resetPassword.successBody")}
        </p>
      </div>
    )
  }

  return (
    <div>
      {/* Heading */}
      <div className="mb-6 text-center">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">
          {t("resetPassword.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("resetPassword.subtitle")}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-password">
            {t("resetPassword.newPasswordLabel")}
          </Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              if (error) setError(null)
            }}
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm-password">
            {t("resetPassword.confirmLabel")}
          </Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              if (error) setError(null)
            }}
            required
            autoComplete="new-password"
            disabled={loading}
          />
        </div>

        <Button
          type="submit"
          disabled={loading || !newPassword || !confirm}
          className="w-full"
        >
          {loading ? t("resetPassword.submitting") : t("resetPassword.submit")}
        </Button>
      </form>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("resetPassword.backToLogin")}
        </Link>
      </div>
    </div>
  )
}
