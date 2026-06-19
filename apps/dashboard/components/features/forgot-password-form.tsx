"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import Link from "next/link"
import { z } from "zod"
import { Button } from "@sawaa/ui"
import { Input } from "@sawaa/ui"
import { Label } from "@sawaa/ui"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons"
import { useLocale } from "@/components/locale-provider"
import { requestStaffPasswordReset } from "@/lib/api/auth"

const emailSchema = z.string().email()

export function ForgotPasswordForm() {
  const { t } = useLocale()
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [fieldError, setFieldError] = useState("")

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setFieldError("")

    const parsed = emailSchema.safeParse(email.trim())
    if (!parsed.success) {
      setFieldError(t("login.errors.identifierShape"))
      return
    }

    setLoading(true)
    try {
      await requestStaffPasswordReset(parsed.data)
      setSubmitted(true)
    } catch {
      setError(t("forgotPassword.requestFailed"))
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
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
        <h2 className="mb-2 text-xl font-semibold text-foreground">
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
    <div>
      {/* Heading */}
      <div className="mb-6 text-center">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">
          {t("forgotPassword.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("forgotPassword.subtitle")}
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
          <Label htmlFor="email">
            {t("forgotPassword.emailLabel")}
          </Label>
          <Input
            id="email"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (fieldError) setFieldError("")
            }}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={loading}
          />
          {fieldError && (
            <p className="text-sm text-error">{fieldError}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full"
        >
          {loading ? t("forgotPassword.submitting") : t("forgotPassword.submit")}
        </Button>
      </form>

      {/* Back link */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("forgotPassword.back")}
        </Link>
      </div>
    </div>
  )
}
