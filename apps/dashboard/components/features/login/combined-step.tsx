"use client"

import { useState } from "react"
import { Button, Input, Label, Checkbox } from "@sawaa/ui"
import { useLocale } from "@/components/locale-provider"
import { HugeiconsIcon } from "@hugeicons/react"
import { EyeIcon, ScanEyeIcon } from "@hugeicons/core-free-icons"
import { LoginErrorAlert } from "@/components/features/login/login-error-alert"
import { z } from "zod"

const passwordSchema = z.string().min(8, { message: "INVALID_PASSWORD" })

interface Props {
  loading: boolean
  error: unknown
  onSubmit: (password: string, rememberMe?: boolean) => void | Promise<void>
  onBack: () => void
  onClearError: () => void
}

export function CombinedStep({ loading, error, onSubmit, onBack, onClearError }: Props) {
  const { t } = useLocale()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [fieldError, setFieldError] = useState("")

  const handle = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) {
      setFieldError(t("login.errors.passwordTooShort"))
      return
    }
    setFieldError("")
    onSubmit(password, rememberMe)
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-4">
      {!!error && <LoginErrorAlert error={error} />}
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
              if (fieldError) setFieldError("")
            }}
            disabled={loading}
            className="pe-10"
          />
          <button
            type="button"
            className="absolute inset-y-0 end-0 flex items-center pe-3 text-muted-foreground"
            onClick={() => setShowPassword((p) => !p)}
            aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
          >
            <HugeiconsIcon icon={showPassword ? ScanEyeIcon : EyeIcon} size={18} />
          </button>
        </div>
        {fieldError && (
          <p className="text-sm text-destructive">{fieldError}</p>
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
          {t("login.rememberMe")}
        </label>
      </div>

      <Button type="submit" disabled={loading || !password} className="w-full">
        {loading ? t("login.signingIn") : t("login.password.submit")}
      </Button>

      <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={loading}>
        {t("common.back")}
      </Button>
    </form>
  )
}
