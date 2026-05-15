"use client"

import { useState } from "react"
import Link from "next/link"
import { Button, Input, Label, Checkbox } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import { EyeIcon, ScanEyeIcon } from "@hugeicons/core-free-icons"
import { LoginErrorAlert } from "@/components/features/login/login-error-alert"
import { identifierSchema } from "@/lib/schemas/auth-login.schema"
import { z } from "zod"

const passwordSchema = z.string().min(8, { message: "INVALID_PASSWORD" })

const combinedSchema = z.object({
  identifier: identifierSchema,
  password: passwordSchema,
})

interface Props {
  loading: boolean
  error: unknown
  onSubmit: (identifier: string, password: string, rememberMe?: boolean) => void | Promise<void>
  onSwitchToOtp: (identifier: string) => void
  onClearError: () => void
}

export function CombinedStep({ loading, error, onSubmit, onSwitchToOtp, onClearError }: Props) {
  const { t } = useLocale()
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({})

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = combinedSchema.safeParse({
      identifier: identifier.trim(),
      password,
    })
    if (!parsed.success) {
      const errs = parsed.error.flatten().fieldErrors
      setFieldErrors({
        identifier: errs.identifier?.[0] === "INVALID_IDENTIFIER"
          ? t("login.errors.identifierShape")
          : errs.identifier?.[0] === "REQUIRED"
            ? t("login.errors.identifierShape")
            : errs.identifier?.[0],
        password: errs.password?.[0] === "INVALID_PASSWORD"
          ? t("login.errors.passwordTooShort")
          : errs.password?.[0],
      })
      return
    }
    setFieldErrors({})
    onSubmit(parsed.data.identifier, parsed.data.password, rememberMe)
  }

  const handleSwitchToOtp = () => {
    const parsed = identifierSchema.safeParse(identifier.trim())
    onSwitchToOtp(parsed.success ? parsed.data : identifier.trim())
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-4">
      {!!error && <LoginErrorAlert error={error} />}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="identifier">{t("login.identifierLabel")}</Label>
        <Input
          id="identifier"
          dir="ltr"
          autoComplete="username"
          inputMode="email"
          placeholder={t("login.identifier.placeholder")}
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value)
            if (error) onClearError()
            if (fieldErrors.identifier) setFieldErrors((prev) => ({ ...prev, identifier: undefined }))
          }}
          disabled={loading}
        />
        {fieldErrors.identifier && (
          <p className="text-sm text-destructive">{fieldErrors.identifier}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">{t("login.passwordLabel")}</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) onClearError()
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }))
            }}
            disabled={loading}
            className="pe-10"
          />
          <button
            type="button"
            className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground"
            onClick={() => setShowPassword((p) => !p)}
            tabIndex={-1}
          >
            <HugeiconsIcon icon={showPassword ? ScanEyeIcon : EyeIcon} size={18} />
          </button>
        </div>
        {fieldErrors.password && (
          <p className="text-sm text-destructive">{fieldErrors.password}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="rememberMe"
          checked={rememberMe}
          onCheckedChange={(checked) => setRememberMe(checked === true)}
        />
        <label
          htmlFor="rememberMe"
          className="text-sm text-muted-foreground cursor-pointer select-none"
        >
          تذكرني
        </label>
      </div>
      <Button type="submit" disabled={loading || !identifier.trim() || !password} className="w-full">
        {loading ? t("login.signingIn") : t("login.password.submit")}
      </Button>
      <Link
        href="/forgot-password"
        className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline text-center"
      >
        {t("login.forgotPassword")}
      </Link>
      <button
        type="button"
        onClick={handleSwitchToOtp}
        disabled={loading}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline disabled:opacity-50"
      >
        دخول بدون كلمة المرور
      </button>
    </form>
  )
}
