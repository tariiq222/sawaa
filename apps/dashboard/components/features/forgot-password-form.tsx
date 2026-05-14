"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { Button } from "@deqah/ui"
import { Input } from "@deqah/ui"
import { Label } from "@deqah/ui"
import { useLocale } from "@/components/locale-provider"
import { requestStaffPasswordReset } from "@/lib/api/auth"

export function ForgotPasswordForm() {
  const { t } = useLocale()
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await requestStaffPasswordReset(email)
      setSubmitted(true)
    } catch {
      setError(t("forgotPassword.requestFailed"))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
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
        <h2 className="mb-2 text-xl font-bold text-foreground">
          {t("forgotPassword.successTitle")}
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {t("forgotPassword.successBody")}
        </p>
        <Link
          href="/"
          className="text-sm font-medium text-primary hover:underline"
        >
          {t("forgotPassword.back")}
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
      {/* Heading */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          {t("forgotPassword.title")}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t("forgotPassword.subtitle")}
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
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            {t("forgotPassword.emailLabel")}
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="h-11 text-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full text-sm font-semibold"
        >
          {loading ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
        </Button>
      </form>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {t("forgotPassword.back")}
        </Link>
      </div>
    </div>
  )
}
